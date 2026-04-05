import { create } from 'zustand';
import { searchRecipes, DEFAULT_FILTERS } from '../lib/search';
import { toggleFavorite, deleteRecipe } from '../lib/db';
import type { FilterState, RecipeSummary } from '../lib/search';

type RecipeStore = {
  recipes: RecipeSummary[];
  filters: FilterState;
  loading: boolean;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  loadRecipes: () => Promise<void>;
  toggleFav: (id: number, current: number) => Promise<void>;
  removeRecipe: (id: number) => Promise<void>;
};

// Monotonically increasing counter — each call to loadRecipes() claims the
// current generation. If a newer call starts before an older one resolves,
// the older result is discarded so stale data never overwrites fresh data.
let loadGeneration = 0;

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: [],
  filters: { ...DEFAULT_FILTERS },
  loading: false,

  setFilter: (key, value) => {
    set(s => ({ filters: { ...s.filters, [key]: value } }));
    get().loadRecipes();
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } });
    get().loadRecipes();
  },

  loadRecipes: async () => {
    const gen = ++loadGeneration;
    set({ loading: true });
    try {
      const results = await searchRecipes(get().filters);
      // Discard result if a newer load has already started
      if (gen !== loadGeneration) return;
      set({ recipes: results, loading: false });
    } catch (e) {
      if (gen !== loadGeneration) return;
      console.error('loadRecipes error:', e);
      set({ loading: false });
    }
  },

  toggleFav: async (id, current) => {
    await toggleFavorite(id, current);
    set(s => ({
      recipes: s.recipes.map(r =>
        r.id === id ? { ...r, is_favorite: current ? 0 : 1 } : r
      ),
    }));
  },

  removeRecipe: async (id) => {
    await deleteRecipe(id);
    set(s => ({ recipes: s.recipes.filter(r => r.id !== id) }));
  },
}));
