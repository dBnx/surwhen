"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  DEFAULT_ACCENT_COLOR,
  NEUTRAL_COLOR,
  LAST_COLOR_KEY,
  isValidHexColor,
  applyColorToDOM,
} from "~/lib/color";

interface UseAccentColorOptions {
  onSave?: (color: string) => Promise<void>;
  debounceMs?: number;
}

let globalColorState: string | null = null;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function initializeColor(): Promise<string> {
  if (isInitialized && globalColorState) {
    return globalColorState;
  }

  if (initializationPromise) {
    await initializationPromise;
    return globalColorState ?? DEFAULT_ACCENT_COLOR;
  }

  initializationPromise = (async () => {
    const lastColor = sessionStorage.getItem(LAST_COLOR_KEY);
    
    if (lastColor && isValidHexColor(lastColor)) {
      globalColorState = lastColor;
      applyColorToDOM(lastColor);
    } else {
      applyColorToDOM(NEUTRAL_COLOR);
    }

    try {
      const response = await fetch("/api/accent-color", {
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as { accentColor: string };
        const color = data.accentColor;
        if (isValidHexColor(color)) {
          globalColorState = color;
          applyColorToDOM(color);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(LAST_COLOR_KEY, color);
          }
        } else {
          globalColorState = DEFAULT_ACCENT_COLOR;
          applyColorToDOM(DEFAULT_ACCENT_COLOR);
        }
      } else {
        globalColorState = DEFAULT_ACCENT_COLOR;
        applyColorToDOM(DEFAULT_ACCENT_COLOR);
      }
    } catch {
      globalColorState = DEFAULT_ACCENT_COLOR;
      applyColorToDOM(DEFAULT_ACCENT_COLOR);
    }

    isInitialized = true;
    initializationPromise = null;
  })();

  await initializationPromise;
  return globalColorState ?? DEFAULT_ACCENT_COLOR;
}

export function useAccentColor(options: UseAccentColorOptions = {}) {
  const { onSave, debounceMs = 500 } = options;
  const [accentColor, setAccentColorState] = useState<string>(NEUTRAL_COLOR);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const RATE_LIMIT_WINDOW_MS = 500;

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const color = await initializeColor();
      if (mounted) {
        setAccentColorState(color);
        setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setAccentColor = useCallback(
    (color: string, applyToDOM = true) => {
      if (!isValidHexColor(color)) return;

      setAccentColorState(color);
      globalColorState = color;

      if (applyToDOM) {
        applyColorToDOM(color);
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem(LAST_COLOR_KEY, color);
      }
    },
    [],
  );

  const saveAccentColor = useCallback(
    async (color?: string): Promise<void> => {
      const colorToSave = color ?? accentColor;
      if (!isValidHexColor(colorToSave)) {
        throw new Error("Invalid color");
      }

      if (!onSave) {
        return;
      }

      const now = Date.now();
      if (now - lastSaveTimeRef.current < RATE_LIMIT_WINDOW_MS) {
        throw new Error("Too many requests. Please wait before updating again.");
      }

      lastSaveTimeRef.current = now;

      await onSave(colorToSave);

      setAccentColor(colorToSave, true);
    },
    [accentColor, onSave, setAccentColor],
  );

  const saveAccentColorDebounced = useCallback(
    (color: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setAccentColor(color, true);

      if (onSave) {
        saveTimeoutRef.current = setTimeout(() => {
          void saveAccentColor(color);
          saveTimeoutRef.current = null;
        }, debounceMs);
      }
    },
    [onSave, debounceMs, setAccentColor, saveAccentColor],
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    accentColor,
    isLoading,
    setAccentColor,
    saveAccentColor,
    saveAccentColorDebounced,
  };
}





