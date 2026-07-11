/**
 * Converts HSL color string to RGBA format
 * @param hsl - HSL string in format "h s% l%" (e.g., "201 35% 40%")
 * @param alpha - Alpha value between 0 and 1
 * @returns RGBA string
 */
export function hslToRgba(hsl: string, alpha: number = 1): string {
  const parts = hsl.split(" ");
  if (parts.length < 3) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  const h = parseFloat(parts[0] ?? "0");
  const s = parseFloat((parts[1] ?? "0%").replace("%", "")) / 100;
  const l = parseFloat((parts[2] ?? "0%").replace("%", "")) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const rFinal = Math.round((r + m) * 255);
  const gFinal = Math.round((g + m) * 255);
  const bFinal = Math.round((b + m) * 255);

  return `rgba(${rFinal}, ${gFinal}, ${bFinal}, ${alpha})`;
}

/**
 * Get computed CSS variable value
 */
export function getCssVariable(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
