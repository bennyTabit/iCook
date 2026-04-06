export const DarkColors = {
  primary: "#FF6B6B",       // coral unchanged — brand identity
  secondary: "#4ECDC4",
  accent: "#FFE66D",
  background: "#1C1917",    // warm dark canvas (warm near-black)
  surface: "#252220",       // card background
  surfaceElevated: "#2E2B28", // elevated card
  border: "#3D3A36",        // subtle border
  overlay: "rgba(255, 255, 255, 0.06)",
  shadow: "#000000",

  error: "#FF6B6B",
  errorSurface: "#2D1A1A",
  errorBorder: "#5C2020",
  warning: "#F6A623",
  warningSurface: "#261E0A",
  warningBorder: "#4A3510",
  success: "#4ECDC4",
  successSurface: "#0A2220",
  disabled: "#4A4844",
  disabledSurface: "#252220",

  text: {
    primary: "#F5F0EB",
    secondary: "#A89E96",
    tertiary: "#6E6660",
    inverse: "#1C1917",
    disabled: "#5A5450",
    error: "#FF8A80",
    warning: "#FFB74D",
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

  heroGradient: ["#C0392B", "#A93226"] as [string, string],
} as const;
