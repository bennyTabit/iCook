import { create } from 'zustand';
import { searchRecipes, DEFAULT_FILTERS } from '../lib/search';
import { toggleFavorite, deleteRecipe, getRecipeById, insertRecipe, updateRecipeImageUri } from '../lib/db';
import { syncRecipeToCloud, deleteRecipeFromCloud, fetchCloudRecipes } from '../lib/firestore';
import { auth } from '../lib/firebase';
import { uploadRecipeImage, isLocalUri } from '../lib/storage';
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
  /** Push a single recipe (by local id) to Firestore. No-op if not signed in. */
  syncToCloud: (localId: number) => Promise<void>;
  /** Pull cloud recipes missing from local SQLite. No-op if not signed in. */
  pullFromCloud: () => Promise<void>;
};

// Monotonically increasing counter — each call to loadRecipes() claims the
// current generation. If a newer call starts before an older one resolves,
// the older result is discarded so stale data never overwrites fresh data.
let loadGeneration = 0;

function getUid(): string | null {
  return auth.currentUser?.uid ?? null;
}

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
    // Sync updated favorite state to cloud
    get().syncToCloud(id).catch(err =>
      console.warn('[recipeStore] Cloud sync after toggleFav failed:', err)
    );
  },

  removeRecipe: async (id) => {
    await deleteRecipe(id);
    set(s => ({ recipes: s.recipes.filter(r => r.id !== id) }));
    // Remove from cloud
    const uid = getUid();
    if (uid) {
      deleteRecipeFromCloud(uid, id).catch(err =>
        console.warn('[recipeStore] Cloud delete failed:', err)
      );
    }
  },

  pullFromCloud: async () => {
    const uid = getUid();
    if (!uid) return;
    try {
      const cloudRecipes = await fetchCloudRecipes(uid);
      for (const r of cloudRecipes) {
        const existing = await getRecipeById(r.id);
        if (!existing) {
          await insertRecipe({
            title_he: r.title_he,
            title_en: r.title_en ?? undefined,
            description_he: r.description_he ?? undefined,
            description_en: r.description_en ?? undefined,
            category_id: r.category_id ?? undefined,
            difficulty: (r.difficulty ?? undefined) as any,
            prep_time_min: r.prep_time_min ?? undefined,
            cook_time_min: r.cook_time_min ?? undefined,
            servings: r.servings ?? undefined,
            source_type: (r.source_type ?? 'manual') as any,
            source_url: r.source_url ?? undefined,
            image_uri: r.image_uri ?? undefined,
            notes_he: r.notes_he ?? undefined,
            notes_en: r.notes_en ?? undefined,
            is_favorite: r.is_favorite ?? 0,
          });
        }
      }
      await get().loadRecipes();
    } catch (err) {
      console.warn('[recipeStore] pullFromCloud error:', err);
    }
  },

  syncToCloud: async (localId) => {
    const uid = getUid();
    if (!uid) return; // not signed in — skip silently
    try {
      const recipe = await getRecipeById(localId);
      if (!recipe) return;

      // Upload local image to Firebase Storage before syncing to Firestore
      let imageUri = recipe.image_uri ?? null;
      if (isLocalUri(imageUri)) {
        try {
          const cloudUrl = await uploadRecipeImage(uid, imageUri!, localId);
          await updateRecipeImageUri(localId, cloudUrl);
          imageUri = cloudUrl;
        } catch (imgErr) {
          console.warn('[recipeStore] Image upload failed, keeping local URI:', imgErr);
          // Fall through — sync recipe text without the image URL
        }
      }

      await syncRecipeToCloud(uid, {
        id: localId,
        title_he: recipe.title_he,
        title_en: recipe.title_en ?? null,
        description_he: recipe.description_he ?? null,
        description_en: recipe.description_en ?? null,
        category_id: recipe.category_id ?? null,
        difficulty: recipe.difficulty ?? null,
        prep_time_min: recipe.prep_time_min ?? null,
        cook_time_min: recipe.cook_time_min ?? null,
        servings: recipe.servings ?? null,
        source_type: recipe.source_type ?? "manual",
        source_url: recipe.source_url ?? null,
        image_uri: imageUri,
        notes_he: recipe.notes_he ?? null,
        notes_en: recipe.notes_en ?? null,
        is_favorite: recipe.is_favorite ?? 0,
        created_at: recipe.created_at ?? new Date().toISOString(),
        updated_at: recipe.updated_at ?? new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[recipeStore] syncToCloud error:', err);
    }
  },
}));
