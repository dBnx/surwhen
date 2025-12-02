"use client";

import { useAccentColor } from "~/hooks/useAccentColor";

export default function AccentColorLoader() {
  useAccentColor();
  return null;
}

