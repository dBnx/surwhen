"use client";

import { useEffect } from "react";

const DEFAULT_ACCENT_COLOR = "#2563eb";
const NEUTRAL_COLOR = "#808080";

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
          document.documentElement.style.setProperty(
            "--color-gradient-start",
            data.accentColor,
          );
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

