export type MediaFitMode = "auto" | "cover" | "contain";
export type ThemePresetId = "custom" | "rose" | "mint" | "sky" | "peach";

export type DecorThemeState = {
  themePreset: ThemePresetId;
  backgroundColor: string;
  panelColor: string;
  textColor: string;
  overlayOpacity: number;
  panelOpacity: number;
};

export type DecorMediaState = {
  mediaUrl: string;
  cloudMediaPath: string;
  uploadedMediaUrl: string;
  uploadedMediaType: "image" | "video" | "";
  mediaFit: MediaFitMode;
};

export type DecorState = DecorThemeState & DecorMediaState;

export const DEFAULT_DECOR_THEME: DecorThemeState = {
  themePreset: "custom",
  backgroundColor: "#020617",
  panelColor: "#ffffff",
  textColor: "#0f172a",
  overlayOpacity: 0.16,
  panelOpacity: 0.66,
};

export const DEFAULT_DECOR_MEDIA: DecorMediaState = {
  mediaUrl: "",
  cloudMediaPath: "",
  uploadedMediaUrl: "",
  uploadedMediaType: "",
  mediaFit: "auto",
};

export const DEFAULT_DECOR: DecorState = {
  ...DEFAULT_DECOR_THEME,
  ...DEFAULT_DECOR_MEDIA,
};

export const PASTEL_THEME_PRESETS: Array<{
  id: Exclude<ThemePresetId, "custom">;
  label: string;
  swatches: string[];
  decor: Pick<DecorThemeState, "themePreset" | "backgroundColor" | "panelColor" | "textColor" | "overlayOpacity" | "panelOpacity">;
}> = [
  {
    id: "rose",
    label: "Rose",
    swatches: ["#f8d7da", "#f5e2e4", "#fff8f3"],
    decor: {
      themePreset: "rose",
      backgroundColor: "#f8d7da",
      panelColor: "#fff4f6",
      textColor: "#4b2e39",
      overlayOpacity: 0.06,
      panelOpacity: 0.84,
    },
  },
  {
    id: "mint",
    label: "Mint",
    swatches: ["#d8efe3", "#edf8f1", "#f9fffc"],
    decor: {
      themePreset: "mint",
      backgroundColor: "#d8efe3",
      panelColor: "#f3fff8",
      textColor: "#26483b",
      overlayOpacity: 0.06,
      panelOpacity: 0.84,
    },
  },
  {
    id: "sky",
    label: "Sky",
    swatches: ["#d9ecff", "#eef6ff", "#f8fbff"],
    decor: {
      themePreset: "sky",
      backgroundColor: "#d9ecff",
      panelColor: "#f4f9ff",
      textColor: "#24425d",
      overlayOpacity: 0.05,
      panelOpacity: 0.82,
    },
  },
  {
    id: "peach",
    label: "Peach",
    swatches: ["#ffe4cf", "#fff1e5", "#fffaf6"],
    decor: {
      themePreset: "peach",
      backgroundColor: "#ffe4cf",
      panelColor: "#fff7f0",
      textColor: "#5a4033",
      overlayOpacity: 0.05,
      panelOpacity: 0.82,
    },
  },
];

export function splitDecorState(decor?: Partial<DecorState> | null) {
  return {
    theme: { ...DEFAULT_DECOR_THEME, ...(decor || {}) },
    media: { ...DEFAULT_DECOR_MEDIA, ...(decor || {}) },
  };
}
