import { Colors } from "./colors";

/** Emoji per category key (English lowercase category name). */
export const CATEGORY_EMOJI: Record<string, string> = {
  pasta: "🍝",
  salads: "🥗",
  desserts: "🍰",
  soups: "🍲",
  meat: "🥩",
  fish: "🐟",
  veggie: "🥦",
  breakfast: "🍳",
  all: "🍽️",
};

/** Background color per category key. */
export const CATEGORY_BG: Record<string, string> = {
  pasta: "#FFF3D6",
  salads: "#E6F7EF",
  desserts: "#FDE8F0",
  soups: "#FFF0E0",
  meat: "#FDEAEA",
  fish: "#E0F4FF",
  veggie: "#E8F8E8",
  breakfast: "#FFF8E1",
  all: "#F5F3EE",
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
