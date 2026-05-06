import { Colors } from "./colors";

/** Emoji per category (matches name_en.toLowerCase() from DB). */
export const CATEGORY_EMOJI: Record<string, string> = {
  "breakfast":        "🍳",
  "starters":         "🥗",
  "main dishes":      "🍲",
  "sides":            "🥣",
  "desserts & cakes": "🍰",
  "breads & pastries":"🥐",
  "sauces & spreads": "🫙",
  "veggie / vegan":   "🥦",
  "quick (20 min)":   "⚡",
  "hosting & events": "🎉",
};

/** Background color per category (matches name_en.toLowerCase()). */
export const CATEGORY_BG: Record<string, string> = {
  "breakfast":        "#FFF8E1",
  "starters":         "#E6F7EF",
  "main dishes":      "#FFF0E0",
  "sides":            "#FFF3D6",
  "desserts & cakes": "#FDE8F0",
  "breads & pastries":"#FFF3D6",
  "sauces & spreads": "#F0F4FF",
  "veggie / vegan":   "#E8F8E8",
  "quick (20 min)":   "#FFFBE6",
  "hosting & events": "#FDE8F8",
};

/** Difficulty color per level key. */
export const DIFFICULTY_COLOR: Record<string, string> = {
  easy: Colors.difficulty.easy,
  medium: Colors.difficulty.medium,
  hard: Colors.difficulty.hard,
};

/** Bilingual difficulty labels. */
export const DIFFICULTY_LABEL: Record<string, { he: string; en: string }> = {
  easy: { he: "קל", en: "Easy" },
  medium: { he: "בינוני", en: "Medium" },
  hard: { he: "קשה", en: "Hard" },
};

/** Source type icon names (Ionicons). */
export const SOURCE_ICON: Record<string, string> = {
  manual: "create-outline",
  ocr: "camera-outline",
  url: "link-outline",
  instagram: "logo-instagram",
  ai: "sparkles-outline",
};

/** Default fallback emoji when category is unknown. */
export const FALLBACK_EMOJI = "🍽️";
export const FALLBACK_BG = "#F5F3EE";
