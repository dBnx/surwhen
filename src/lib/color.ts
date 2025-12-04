export const DEFAULT_ACCENT_COLOR = "#2563eb";
export const NEUTRAL_COLOR = "#808080";
export const LAST_COLOR_KEY = "accent-color-last-color";

export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/i.test(color);
}

export function applyColorToDOM(color: string): void {
  if (!isValidHexColor(color)) return;
  
  document.documentElement.style.setProperty("--color-gradient-start", color);
  const gradient = `linear-gradient(to bottom right, ${color}, var(--color-gradient-mid), var(--color-gradient-end))`;
  document.body.style.backgroundImage = gradient;
  document.documentElement.style.backgroundImage = gradient;
}


