import { create } from 'zustand';
import {
  getAllCollections,
  insertCollection,
  updateCollection,
  deleteCollection,
  addRecipeToCollection,
  removeRecipeFromCollection,
  getCollectionRecipes,
  getRecipeCollections,
  Collection,
} from '../lib/db';
import type { Recipe } from '../lib/db';

interface CollectionState {
  collections: Collection[];
  loading: boolean;
  loadCollections: () => Promise<void>;
  createCollection: (name_he: string, name_en: string, color: string, icon: string) => Promise<number>;
  updateCollection: (id: number, patch: Partial<Omit<Collection, 'id' | 'created_at' | 'recipe_count'>>) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;
  addRecipe: (collectionId: number, recipeId: number) => Promise<void>;
  removeRecipe: (collectionId: number, recipeId: number) => Promise<void>;
  getRecipes: (collectionId: number) => Promise<Recipe[]>;
  getRecipeCollections: (recipeId: number) => Promise<Collection[]>;
}

export const useCollectionStore = create<CollectionState>()((set, get) => ({
  collections: [],
  loading: false,

  loadCollections: async () => {
    set({ loading: true });
    try {
      const collections = await getAllCollections();
      set({ collections });
    } catch (err) {
      console.warn('[collectionStore] loadCollections error:', err);
    } finally {
      set({ loading: false });
    }
  },

  createCollection: async (name_he, name_en, color, icon) => {
    const id = await insertCollection({ name_he, name_en, color, icon });
    await get().loadCollections();
    return id;
  },

  updateCollection: async (id, patch) => {
    await updateCollection(id, patch);
    await get().loadCollections();
  },

  deleteCollection: async (id) => {
    await deleteCollection(id);
    await get().loadCollections();
  },

  addRecipe: async (collectionId, recipeId) => {
    await addRecipeToCollection(collectionId, recipeId);
    await get().loadCollections();
  },

  removeRecipe: async (collectionId, recipeId) => {
    await removeRecipeFromCollection(collectionId, recipeId);
    await get().loadCollections();
  },

  getRecipes: async (collectionId) => {
    return getCollectionRecipes(collectionId);
  },

  getRecipeCollections: async (recipeId) => {
    return getRecipeCollections(recipeId);
  },
}));
