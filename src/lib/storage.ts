import { promises as fs } from "fs";
import { put, head } from "@vercel/blob";
import { env } from "~/env";

/**
 * Storage interface for abstracting file storage operations
 */
export interface StorageBackend {
  read(key: string): Promise<string>;
  write(key: string, content: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Local storage backend using /tmp directory
 */
class LocalStorageBackend implements StorageBackend {
  private getPath(key: string): string {
    return `/tmp/${key}`;
  }

  async read(key: string): Promise<string> {
    const path = this.getPath(key);
    return await fs.readFile(path, "utf-8");
  }

  async write(key: string, content: string): Promise<void> {
    const path = this.getPath(key);
    await fs.writeFile(path, content, "utf-8");
  }

  async exists(key: string): Promise<boolean> {
    const path = this.getPath(key);
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Vercel Blob storage backend
 */
class BlobStorageBackend implements StorageBackend {
  private token: string;
  private readonly maxRetries = 3;
  private readonly initialRetryDelay = 100;
  private readonly maxRetryDelay = 2000;

  constructor(token: string) {
    this.token = token;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async read(key: string): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const blob = await head(key, { token: this.token });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
          const response = await fetch(blob.url, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch blob ${key}: ${response.status} ${response.statusText}`);
          }
          
          return await response.text();
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            throw new Error(`Timeout while fetching blob ${key}`);
          }
          throw fetchError;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (error instanceof Error && error.message.includes("not found")) {
          throw error;
        }
        
        if (attempt < this.maxRetries) {
          const delay = Math.min(
            this.initialRetryDelay * Math.pow(2, attempt),
            this.maxRetryDelay,
          );
          await this.sleep(delay);
          continue;
        }
      }
    }
    
    throw new Error(
      `Failed to read blob ${key} after ${this.maxRetries + 1} attempts: ${lastError?.message ?? "Unknown error"}`,
    );
  }

  async write(key: string, content: string): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await put(key, content, {
          access: "public",
          token: this.token,
          allowOverwrite: true,
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries) {
          const delay = Math.min(
            this.initialRetryDelay * Math.pow(2, attempt),
            this.maxRetryDelay,
          );
          await this.sleep(delay);
          continue;
        }
      }
    }
    
    throw new Error(
      `Failed to write blob ${key} after ${this.maxRetries + 1} attempts: ${lastError?.message ?? "Unknown error"}`,
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await head(key, { token: this.token });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        return false;
      }
      throw new Error(
        `Failed to check if blob ${key} exists: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Get the appropriate storage backend based on environment variables
 */
export function getStorageBackend(): StorageBackend {
  // If STORAGE_BACKEND is explicitly set to "local", use local storage
  if (env.STORAGE_BACKEND === "local") {
    return new LocalStorageBackend();
  }

  // If BLOB_READ_WRITE_TOKEN is set and STORAGE_BACKEND is not "local", use blob storage
  if (env.BLOB_READ_WRITE_TOKEN) {
    return new BlobStorageBackend(env.BLOB_READ_WRITE_TOKEN);
  }

  // Default to local storage if no blob token is provided
  return new LocalStorageBackend();
}

