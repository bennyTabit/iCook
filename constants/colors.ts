export const Colors = {
  primary: "#FF6B6B",     // coral red — main brand
  secondary: "#4ECDC4",   // mint teal
  accent: "#FFE66D",      // sunshine yellow
  background: "#FCFAF5",  // warm app canvas
  surface: "#F5F3EE",     // card background
  surfaceElevated: "#FFFFFF",
  border: "#E8E8E3",      // subtle border
  overlay: "rgba(26, 26, 26, 0.06)",
  shadow: "#1A1A1A",

  // Semantic feedback colors
  error: "#FF4757",
  errorSurface: "#FFF0ED",
  errorBorder: "#FFC7BC",
  warning: "#F6A623",
  warningSurface: "#FFFBEB",
  warningBorder: "#F6CC6A",
  success: "#4ECDC4",
  successSurface: "#F0FAFA",
  disabled: "#C4C4BE",
  disabledSurface: "#F0EFE9",

  text: {
    primary: "#1A1A1A",
    secondary: "#6B6B65",
    tertiary: "#A0A09A",
    inverse: "#FFFFFF",
    disabled: "#B0B0AA",
    error: "#B33F31",
    warning: "#92650A",
  },

  difficulty: {
    easy: "#4ECDC4",
    medium: "#FFE66D",
    hard: "#FF6B6B",
  },

  source: {
    manual: "#888780",
    ocr: "#4ECDC4",
    url: "#FF6B6B",
    instagram: "#D45079",
    ai: "#7F77DD",
  },

  // Hero gradient — used on multiple screens
  heroGradient: ["#FF6B6B", "#FF8E53"] as [string, string],
} as const;
