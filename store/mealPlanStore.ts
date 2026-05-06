import { create } from 'zustand';
import {
  getMealPlanForWeek,
  insertMealPlan,
  deleteMealPlan,
  getRecipeById,
  getIngredientsForRecipe,
  MealPlanEntry,
  MealType,
} from '../lib/db';
import { useShoppingStore } from './shoppingStore';

// ── Week helpers ────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD string for a Date */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Get the week start (Sunday or Monday) containing the given date */
export function getWeekStart(d: Date = new Date(), sundayStart = false): string {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = sundayStart
    ? -day                         // shift back to Sunday
    : (day === 0 ? -6 : 1 - day); // shift back to Monday
  date.setDate(date.getDate() + diff);
  return toDateStr(date);
}

/** Get array of 7 date strings starting from weekStart (Monday) */
export function getWeekDays(weekStart: string): string[] {
  const days: string[] = [];
  const base = new Date(weekStart + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(toDateStr(d));
  }
  return days;
}

/** Returns last day of the week (Sunday) */
export function getWeekEnd(weekStart: string): string {
  const days = getWeekDays(weekStart);
  return days[6];
}

/** Advance weekStart by +/- 1 week */
export function shiftWeek(weekStart: string, direction: 1 | -1): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + direction * 7);
  return toDateStr(d);
}

// ── Store ────────────────────────────────────────────────────────────────────

interface MealPlanState {
  entries: MealPlanEntry[];
  weekStart: string;
  loading: boolean;

  setWeek: (weekStart: string) => void;
  loadWeek: (weekStart: string) => Promise<void>;
  addEntry: (date: string, mealType: MealType, recipeId: number) => Promise<void>;
  removeEntry: (id: number) => Promise<void>;
  addWeekToShopping: (isHe: boolean) => Promise<void>;
}

export const useMealPlanStore = create<MealPlanState>()((set, get) => ({
  entries: [],
  weekStart: getWeekStart(),
  loading: false,

  setWeek: (weekStart) => {
    set({ weekStart });
    get().loadWeek(weekStart);
  },

  loadWeek: async (weekStart) => {
    set({ loading: true });
    try {
      const entries = await getMealPlanForWeek(weekStart, getWeekEnd(weekStart));
      set({ entries, weekStart });
    } catch (err) {
      console.warn('[mealPlanStore] loadWeek error:', err);
    } finally {
      set({ loading: false });
    }
  },

  addEntry: async (date, mealType, recipeId) => {
    try {
      await insertMealPlan(date, mealType, recipeId);
      await get().loadWeek(get().weekStart);
    } catch (err) {
      console.warn('[mealPlanStore] addEntry error:', err);
    }
  },

  removeEntry: async (id) => {
    try {
      await deleteMealPlan(id);
      set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    } catch (err) {
      console.warn('[mealPlanStore] removeEntry error:', err);
    }
  },

  addWeekToShopping: async (isHe) => {
    const { entries } = get();
    if (!entries.length) return;
    const addFromRecipe = useShoppingStore.getState().addFromRecipe;

    // De-duplicate recipe IDs so each recipe's ingredients appear once
    const seen = new Set<number>();
    for (const e of entries) {
      if (!seen.has(e.recipe_id)) {
        seen.add(e.recipe_id);
        const recipe = await getRecipeById(e.recipe_id);
        if (!recipe) continue;

        // Fetch structured ingredients from the DB
        const rows = await getIngredientsForRecipe(e.recipe_id);

        // Build human-readable strings, e.g. "2 כוסות קמח" or just "עגבנייה"
        const ingredientStrings: string[] = rows
          .map((row) => {
            const text = (isHe ? row.free_text_he : row.free_text_en) ?? row.free_text_he ?? '';
            if (!text.trim()) return null;
            const qty = row.quantity != null ? String(row.quantity) : '';
            const unit = (isHe ? row.unit_he : row.unit_en) ?? row.unit_he ?? '';
            return [qty, unit, text].filter(Boolean).join(' ').trim();
          })
          .filter((s): s is string => s !== null && s.length > 0);

        // Pass ingredient strings directly; fallback (recipe title) handled inside addFromRecipe
        addFromRecipe(recipe, ingredientStrings.length ? ingredientStrings : undefined);
      }
    }
  },
}));
