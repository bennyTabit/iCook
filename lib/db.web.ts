export type Recipe = {
  id?: number;
  title_he: string;
  title_en?: string;
  description_he?: string;
  description_en?: string;
  category_id?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  prep_time_min?: number;
  cook_time_min?: number;
  servings?: number;
  source_type?: 'manual' | 'ocr' | 'url' | 'instagram' | 'ai';
  source_url?: string;
  source_name?: string;
  image_uri?: string;
  notes_he?: string;
  notes_en?: string;
  is_favorite?: number;
  created_at?: string;
  updated_at?: string;
};

type Category = {
  id: number;
  name_he: string;
  name_en: string;
};

const categories: Category[] = [
  { id: 1, name_he: 'הכל', name_en: 'All' },
  { id: 2, name_he: 'פסטה', name_en: 'Pasta' },
  { id: 3, name_he: 'סלטים', name_en: 'Salads' },
  { id: 4, name_he: 'קינוחים', name_en: 'Desserts' },
  { id: 5, name_he: 'מרקים', name_en: 'Soups' },
  { id: 6, name_he: 'בשר', name_en: 'Meat' },
  { id: 7, name_he: 'דגים', name_en: 'Fish' },
  { id: 8, name_he: 'צמחוני', name_en: 'Veggie' },
  { id: 9, name_he: 'ארוחות בוקר', name_en: 'Breakfast' },
];

let nextId = 2;
let recipes: Recipe[] = [
  {
    id: 1,
    title_he: 'פסטה לדוגמה',
    title_en: 'Sample Pasta',
    description_he: 'גרסת ווב ללא SQLite',
    description_en: 'Web fallback without SQLite',
    category_id: 2,
    difficulty: 'easy',
    cook_time_min: 20,
    servings: 2,
    source_type: 'manual',
    is_favorite: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function initDB() {
  return;
}

export async function getAllRecipes(): Promise<Recipe[]> {
  return [...recipes].sort((a, b) => {
    const ad = a.created_at ?? '';
    const bd = b.created_at ?? '';
    return ad < bd ? 1 : -1;
  });
}

export async function getRecipeById(id: number): Promise<Recipe | null> {
  return recipes.find(r => r.id === id) ?? null;
}

export async function insertRecipe(recipe: Recipe): Promise<number> {
  const id = nextId++;
  const now = new Date().toISOString();
  recipes.unshift({
    ...recipe,
    id,
    source_type: recipe.source_type ?? 'manual',
    is_favorite: recipe.is_favorite ?? 0,
    created_at: now,
    updated_at: now,
  });
  return id;
}

export async function updateRecipe(id: number, patch: Partial<Recipe>): Promise<void> {
  recipes = recipes.map(r => (r.id === id ? { ...r, ...patch, updated_at: new Date().toISOString() } : r));
}

export async function toggleFavorite(id: number, current: number) {
  recipes = recipes.map(r => (r.id === id ? { ...r, is_favorite: current ? 0 : 1, updated_at: new Date().toISOString() } : r));
}

export async function deleteRecipe(id: number) {
  recipes = recipes.filter(r => r.id !== id);
}

export async function searchRecipes(query: string): Promise<Recipe[]> {
  const q = query.trim().toLowerCase();
  if (!q) return getAllRecipes();
  return (await getAllRecipes()).filter(r =>
    (r.title_he ?? '').toLowerCase().includes(q)
    || (r.title_en ?? '').toLowerCase().includes(q)
    || (r.description_he ?? '').toLowerCase().includes(q)
    || (r.description_en ?? '').toLowerCase().includes(q)
  );
}

export async function getRecipesByFilter(filters: {
  categoryId?: number;
  difficulty?: string;
  maxCookTime?: number;
  tagIds?: number[];
}): Promise<Recipe[]> {
  let out = await getAllRecipes();
  if (filters.categoryId) out = out.filter(r => r.category_id === filters.categoryId);
  if (filters.difficulty) out = out.filter(r => r.difficulty === filters.difficulty);
  if (filters.maxCookTime) out = out.filter(r => (r.cook_time_min ?? Number.MAX_SAFE_INTEGER) <= filters.maxCookTime!);
  return out;
}

export function getCategoryName(categoryId?: number): { he: string; en: string } {
  const c = categories.find(x => x.id === categoryId);
  if (!c) return { he: 'הכל', en: 'All' };
  return { he: c.name_he, en: c.name_en };
}

const db = {
  getAllAsync: async <T>() => [] as T[],
  getFirstAsync: async <T>() => null as T | null,
  runAsync: async () => ({ lastInsertRowId: 0 }),
  execAsync: async () => undefined,
};

export default db;
