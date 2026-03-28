import { create } from 'zustand';
import type { Recipe } from '../lib/db';

type ShopItem = {
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
  addFromRecipe: (recipe: Recipe) => void;
  checkItem: (id: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
};

const CATEGORY_MAP: Record<string, string> = {
  'בשר':   '🥩 בשר ודגים', 'דג':    '🥩 בשר ודגים', 'עוף':   '🥩 בשר ודגים',
  'חלב':   '🧀 מוצרי חלב', 'גבינ':  '🧀 מוצרי חלב', 'שמנת': '🧀 מוצרי חלב',
  'ירק':   '🥦 ירקות ופירות', 'עגבני':'🥦 ירקות ופירות', 'בצל':  '🥦 ירקות ופירות',
  'קמח':   '🏺 מזווה', 'שמן':  '🏺 מזווה', 'סוכר': '🏺 מזווה', 'פסטה': '🏺 מזווה',
};

function guessCategory(text: string): string {
  for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
    if (text.includes(keyword)) return cat;
  }
  return '🛒 אחר';
}

function groupItems(items: ShopItem[]): Record<string, ShopItem[]> {
  return items.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, ShopItem[]>);
}

export const useShoppingStore = create<ShoppingStore>((set, get) => ({
  items: [],
  grouped: {},

  addFromRecipe: (recipe) => {
    // TODO: load recipe_ingredients from DB for this recipe in v2
    const newItems: ShopItem[] = [
      {
        id: `${recipe.id}-demo`,
        text: recipe.title_he || recipe.title_en || 'מרכיב',
        quantity: undefined,
        unit: undefined,
        checked: false,
        category: guessCategory(''),
      },
    ];
    const merged = [
      ...get().items,
      ...newItems.filter(n => !get().items.find(i => i.text === n.text)),
    ];
    set({ items: merged, grouped: groupItems(merged) });
  },

  checkItem: (id) => {
    const items = get().items.map(i => i.id === id ? { ...i, checked: !i.checked } : i);
    set({ items, grouped: groupItems(items) });
  },

  clearChecked: () => {
    const items = get().items.filter(i => !i.checked);
    set({ items, grouped: groupItems(items) });
  },

  clearAll: () => set({ items: [], grouped: {} }),
}));
