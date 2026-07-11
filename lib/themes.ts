export type ThemeName = "blue" | "orange" | "midnight";

export interface Theme {
  name: string;
  colors: {
    primary: string;
    accent: string;
  };
}

// Swatch hexes mirror the [data-theme] token values in app/css/styles.css —
// keep them in sync when editing theme palettes.
export const themes: Record<ThemeName, Theme> = {
  blue: {
    name: "Blue",
    colors: {
      primary: "#446e88",
      accent: "#0db4b9",
    },
  },
  orange: {
    name: "Orange",
    colors: {
      primary: "#cb6005",
      accent: "#e9ae0c",
    },
  },
  midnight: {
    name: "Midnight",
    colors: {
      primary: "#f97316",
      accent: "#fb923c",
    },
  },
};

export const DEFAULT_THEME: ThemeName = "blue";

export const themeOptions: { value: ThemeName; label: string; description: string }[] = [
  { value: "blue", label: "Blue", description: "Professional and calm" },
  { value: "orange", label: "Orange", description: "Warm and energetic" },
  { value: "midnight", label: "Midnight", description: "Dark-first with orange highlights" },
];
