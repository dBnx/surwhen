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

  constructor(token: string) {
    this.token = token;
  }

  async read(key: string): Promise<string> {
    try {
      const blob = await head(key, { token: this.token });
      const response = await fetch(blob.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob ${key}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error;
      }
      throw new Error(`Failed to read blob ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async write(key: string, content: string): Promise<void> {
    await put(key, content, {
      access: "public",
      token: this.token,
      allowOverwrite: true,
    });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await head(key, { token: this.token });
      return true;
    } catch {
      return false;
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

