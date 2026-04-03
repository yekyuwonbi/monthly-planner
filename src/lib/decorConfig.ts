export type MediaFitMode = "auto" | "cover" | "contain";
export type ThemePresetId = "custom";

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

export function splitDecorState(decor?: Partial<DecorState> | null) {
  const theme: DecorThemeState = { ...DEFAULT_DECOR_THEME, ...(decor || {}), themePreset: "custom" };
  const media: DecorMediaState = { ...DEFAULT_DECOR_MEDIA, ...(decor || {}) };

  return {
    theme,
    media,
  };
}
