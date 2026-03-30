import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Recipe } from "../lib/db";

const STORAGE_KEY = "@icook_shopping_items";

export type ShopItem = {
  id: string;
  text: string;
  quantity?: string;
  unit?: string;
  checked: boolean;
  category: string;
};

type ShoppingStore = {
  items: ShopItem[];
  grouped: Record<string, ShopItem[]>;
  addFromRecipe: (recipe: Recipe, ingredients?: string[]) => void;
  addItem: (text: string) => void;
  checkItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
};

const CATEGORY_MAP: Record<string, string> = {
  בשר: "🥩 בשר ודגים",
  דג: "🥩 בשר ודגים",
  עוף: "🥩 בשר ודגים",
  חלב: "🧀 מוצרי חלב",
  גבינ: "🧀 מוצרי חלב",
  שמנת: "🧀 מוצרי חלב",
  ירק: "🥦 ירקות ופירות",
  עגבני: "🥦 ירקות ופירות",
  בצל: "🥦 ירקות ופירות",
  תפוח: "🥦 ירקות ופירות",
  קמח: "🏺 מזווה",
  שמן: "🏺 מזווה",
  סוכר: "🏺 מזווה",
  פסטה: "🏺 מזווה",
  אורז: "🏺 מזווה",
  קטניות: "🏺 מזווה",
  עדשים: "🏺 מזווה",
  ביצ: "🥚 ביצים",
};

function guessCategory(text: string): string {
  for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
    if (text.includes(keyword)) return cat;
  }
  return "🛒 אחר";
}

function groupItems(items: ShopItem[]): Record<string, ShopItem[]> {
  return items.reduce(
    (acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, ShopItem[]>,
  );
}

function parseIngredientsFromNotes(notes?: string): string[] {
  if (!notes?.trim()) return [];

  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const starts = ["מרכיבים", "ingredients"];
  const stops = ["שלבים", "steps", "הוראות", "notes", "הערות"];
  const result: string[] = [];
  let inIngredients = false;

  for (const rawLine of lines) {
    const normalized = rawLine.toLowerCase().replace(/[:：]/g, "").trim();

    if (starts.some((marker) => normalized.includes(marker))) {
      inIngredients = true;
      continue;
    }

    if (!inIngredients) continue;
    if (stops.some((marker) => normalized.includes(marker))) break;

    const cleaned = rawLine.replace(/^([-*•]\s*|\d+[.)]\s*)/, "").trim();
    if (cleaned) result.push(cleaned);
  }

  return result;
}

function persist(items: ShopItem[]) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
}

export const useShoppingStore = create<ShoppingStore>((set, get) => {
  // Hydrate from AsyncStorage on store creation
  AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (raw) {
        const items = JSON.parse(raw) as ShopItem[];
        set({ items, grouped: groupItems(items) });
      }
    })
    .catch(() => {});

  return {
    items: [],
    grouped: {},

    addFromRecipe: (recipe, ingredients) => {
      const parsed =
        ingredients ??
        parseIngredientsFromNotes(recipe.notes_he || recipe.notes_en);

      const fallback = recipe.title_he || recipe.title_en || "מרכיב";
      const source = parsed.length ? parsed : [fallback];

      const existing = get().items;
      const newItems: ShopItem[] = source
        .filter((text) => !existing.find((i) => i.text === text))
        .map((text, index) => ({
          id: `${recipe.id ?? "recipe"}-${Date.now()}-${index}`,
          text,
          quantity: undefined,
          unit: undefined,
          checked: false,
          category: guessCategory(text),
        }));

      const merged = [...existing, ...newItems];
      persist(merged);
      set({ items: merged, grouped: groupItems(merged) });
    },

    addItem: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const existing = get().items;
      if (existing.find((i) => i.text === trimmed)) return;
      const item: ShopItem = {
        id: `manual-${Date.now()}`,
        text: trimmed,
        checked: false,
        category: guessCategory(trimmed),
      };
      const merged = [...existing, item];
      persist(merged);
      set({ items: merged, grouped: groupItems(merged) });
    },

    checkItem: (id) => {
      const items = get().items.map((i) =>
        i.id === id ? { ...i, checked: !i.checked } : i,
      );
      persist(items);
      set({ items, grouped: groupItems(items) });
    },

    removeItem: (id) => {
      const items = get().items.filter((i) => i.id !== id);
      persist(items);
      set({ items, grouped: groupItems(items) });
    },

    clearChecked: () => {
      const items = get().items.filter((i) => !i.checked);
      persist(items);
      set({ items, grouped: groupItems(items) });
    },

    clearAll: () => {
      persist([]);
      set({ items: [], grouped: {} });
    },
  };
});
