"use client";

import { useEffect } from "react";

const DEFAULT_ACCENT_COLOR = "#2563eb";
const NEUTRAL_COLOR = "#808080";
const LAST_COLOR_KEY = "accent-color-last-color";

function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/i.test(color);
}

function applyColorToDOM(color: string): void {
  if (!isValidHexColor(color)) return;
  
  document.documentElement.style.setProperty("--color-gradient-start", color);
  const gradient = `linear-gradient(to bottom right, ${color}, var(--color-gradient-mid), var(--color-gradient-end))`;
  document.body.style.backgroundImage = gradient;
  document.documentElement.style.backgroundImage = gradient;
}

export default function AccentColorLoader() {
  useEffect(() => {
    const lastColor = sessionStorage.getItem(LAST_COLOR_KEY);
    
    if (lastColor && isValidHexColor(lastColor)) {
      applyColorToDOM(lastColor);
    } else {
      applyColorToDOM(NEUTRAL_COLOR);
    }

    async function loadAccentColor() {
      try {
        const response = await fetch("/api/accent-color", {
          cache: "no-store",
        });
        if (response.ok) {
          const data = (await response.json()) as { accentColor: string };
          const color = data.accentColor;
          if (isValidHexColor(color)) {
            applyColorToDOM(color);
          } else {
            applyColorToDOM(DEFAULT_ACCENT_COLOR);
          }
        } else {
          applyColorToDOM(DEFAULT_ACCENT_COLOR);
        }
      } catch {
        applyColorToDOM(DEFAULT_ACCENT_COLOR);
      }
    }

    void loadAccentColor();
  }, []);

  return null;
}

