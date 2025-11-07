"use client";

import { useEffect } from "react";

const DEFAULT_ACCENT_COLOR = "#2563eb";
const NEUTRAL_COLOR = "#808080";

function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/i.test(color);
}

export default function AccentColorLoader() {
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--color-gradient-start",
      NEUTRAL_COLOR,
    );

    async function loadAccentColor() {
      try {
        const response = await fetch("/api/accent-color");
        if (response.ok) {
          const data = (await response.json()) as { accentColor: string };
          const color = data.accentColor;
          if (isValidHexColor(color)) {
            document.documentElement.style.setProperty(
              "--color-gradient-start",
              color,
            );
          } else {
            document.documentElement.style.setProperty(
              "--color-gradient-start",
              DEFAULT_ACCENT_COLOR,
            );
          }
        } else {
          document.documentElement.style.setProperty(
            "--color-gradient-start",
            DEFAULT_ACCENT_COLOR,
          );
        }
      } catch {
        document.documentElement.style.setProperty(
          "--color-gradient-start",
          DEFAULT_ACCENT_COLOR,
        );
      }
    }

    void loadAccentColor();
  }, []);

  return null;
}

