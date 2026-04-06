import { create } from 'zustand';
import {
  getMealPlanForWeek,
  insertMealPlan,
  deleteMealPlan,
  MealPlanEntry,
  MealType,
} from '../lib/db';
import { useShoppingStore } from './shoppingStore';

// ── Week helpers ────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD string for a Date */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Get Monday of the week containing the given date */
export function getWeekStart(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
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
  addWeekToShopping: (isHe: boolean) => void;
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

  addWeekToShopping: (isHe) => {
    const { entries } = get();
    if (!entries.length) return;
    const addItem = useShoppingStore.getState().addItem;
    // De-duplicate recipe IDs
    const seen = new Set<number>();
    entries.forEach((e) => {
      if (!seen.has(e.recipe_id)) {
        seen.add(e.recipe_id);
        addItem(isHe ? e.title_he : (e.title_en ?? e.title_he));
      }
    });
  },
}));
