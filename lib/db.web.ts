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

// tag store: recipeId → Set<tagId>
const recipeTagsStore = new Map<number, Set<number>>();

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
    notes_he: 'מרכיבים:\n- 200 גרם פסטה\n- 2 כפות שמן זית\n- 2 שיני שום\n- מלח ופלפל\n\nשלבים:\n1. הרתיחו מים עם מלח בסיר גדול\n2. בשלו את הפסטה 8 דקות עד לאל-דנטה\n3. בזמן הבישול, חממו שמן זית במחבת ואדו שום 2 דקות\n4. סננו את הפסטה ושמרו כוס ממי הבישול\n5. ערבבו פסטה עם שמן השום, הוסיפו מעט מי בישול לפי הצורך\n6. טעמו ותבלו במלח ופלפל לפי הטעם\n\nהערות:\nאפשר להוסיף פרמזן מגורר',
    notes_en: 'Ingredients:\n- 200g pasta\n- 2 tbsp olive oil\n- 2 garlic cloves\n- salt and pepper\n\nSteps:\n1. Boil salted water in a large pot\n2. Cook pasta 8 minutes until al-dente\n3. Meanwhile heat olive oil and saute garlic for 2 minutes\n4. Drain pasta, reserve a cup of cooking water\n5. Toss pasta with garlic oil, add cooking water as needed\n6. Season with salt and pepper to taste\n\nNotes:\nAdd grated parmesan if desired',
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

export interface RecipeIngredientRow {
  free_text_he: string | null;
  free_text_en: string | null;
  quantity: number | null;
  unit_he: string | null;
  unit_en: string | null;
}

/** Web stub — ingredients not stored in memory, returns empty array */
export async function getIngredientsForRecipe(_recipeId: number): Promise<RecipeIngredientRow[]> {
  return [];
}

// ── Recipe images (web in-memory) ─────────────────────────────────────────────
export interface RecipeImage {
  id: number;
  recipe_id: number;
  image_uri: string;
  caption_he: string | null;
  caption_en: string | null;
  sort_order: number;
}

let recipeImagesStore: RecipeImage[] = [];
let recipeImageNextId = 1;

export async function getImagesForRecipe(recipeId: number): Promise<RecipeImage[]> {
  return recipeImagesStore
    .filter((img) => img.recipe_id === recipeId)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

export async function insertRecipeImage(
  recipeId: number,
  imageUri: string,
  sortOrder: number = 0,
): Promise<number> {
  const id = recipeImageNextId++;
  recipeImagesStore.push({ id, recipe_id: recipeId, image_uri: imageUri, caption_he: null, caption_en: null, sort_order: sortOrder });
  return id;
}

export async function deleteRecipeImage(id: number): Promise<void> {
  recipeImagesStore = recipeImagesStore.filter((img) => img.id !== id);
}

export async function insertRecipe(recipe: Recipe): Promise<number> {
  if (!recipe.title_he?.trim()) {
    throw new Error("כותרת המתכון לא יכולה להיות ריקה / Recipe title cannot be empty");
  }
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

export async function updateRecipeImageUri(id: number, uri: string): Promise<void> {
  recipes = recipes.map(r => (r.id === id ? { ...r, image_uri: uri, updated_at: new Date().toISOString() } : r));
}

export async function toggleFavorite(id: number, current: number) {
  recipes = recipes.map(r => (r.id === id ? { ...r, is_favorite: current ? 0 : 1, updated_at: new Date().toISOString() } : r));
}

export async function deleteRecipe(id: number) {
  recipes = recipes.filter(r => r.id !== id);
  recipeTagsStore.delete(id);
}

export async function insertRecipeTag(recipeId: number, tagId: number): Promise<void> {
  if (!recipeTagsStore.has(recipeId)) recipeTagsStore.set(recipeId, new Set());
  recipeTagsStore.get(recipeId)!.add(tagId);
}

export async function setRecipeTags(recipeId: number, tagIds: number[]): Promise<void> {
  recipeTagsStore.set(recipeId, new Set(tagIds));
}

export function getTagIdsForRecipe(recipeId: number): number[] {
  return Array.from(recipeTagsStore.get(recipeId) ?? []);
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

// ── Meal Plans (web in-memory) ─────────────────────────────────────────────
export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanEntry {
  id: number;
  date: string;
  meal_type: MealType;
  recipe_id: number;
  title_he: string;
  title_en?: string;
  image_uri?: string;
}

let mealPlansStore: MealPlanEntry[] = [];
let mealPlanNextId = 1;

export async function getMealPlanForWeek(weekStart: string, weekEnd: string): Promise<MealPlanEntry[]> {
  return mealPlansStore.filter(m => m.date >= weekStart && m.date <= weekEnd);
}

export async function insertMealPlan(date: string, mealType: MealType, recipeId: number): Promise<number> {
  const exists = mealPlansStore.find(m => m.date === date && m.meal_type === mealType && m.recipe_id === recipeId);
  if (exists) return exists.id;
  const recipe = recipes.find(r => r.id === recipeId);
  const entry: MealPlanEntry = {
    id: mealPlanNextId++,
    date,
    meal_type: mealType,
    recipe_id: recipeId,
    title_he: recipe?.title_he ?? '',
    title_en: recipe?.title_en,
    image_uri: recipe?.image_uri,
  };
  mealPlansStore.push(entry);
  return entry.id;
}

export async function deleteMealPlan(id: number): Promise<void> {
  mealPlansStore = mealPlansStore.filter(m => m.id !== id);
}

// ── Collections (web in-memory) ────────────────────────────────────────────
export interface Collection { id: number; name_he: string; name_en?: string; color: string; icon: string; created_at?: string; recipe_count?: number; }
let collectionsStore: Collection[] = [];
let collectionRecipes: Array<{collection_id: number; recipe_id: number}> = [];
let collectionNextId = 1;

export async function getAllCollections(): Promise<Collection[]> {
  return collectionsStore.map(c => ({ ...c, recipe_count: collectionRecipes.filter(cr => cr.collection_id === c.id).length }));
}
export async function insertCollection(col: Omit<Collection, 'id' | 'created_at' | 'recipe_count'>): Promise<number> {
  const id = collectionNextId++;
  collectionsStore.push({ ...col, id, created_at: new Date().toISOString() });
  return id;
}
export async function updateCollection(id: number, col: Partial<Omit<Collection, 'id' | 'created_at' | 'recipe_count'>>): Promise<void> {
  collectionsStore = collectionsStore.map(c => c.id === id ? { ...c, ...col } : c);
}
export async function deleteCollection(id: number): Promise<void> {
  collectionsStore = collectionsStore.filter(c => c.id !== id);
  collectionRecipes = collectionRecipes.filter(cr => cr.collection_id !== id);
}
export async function addRecipeToCollection(collectionId: number, recipeId: number): Promise<void> {
  if (!collectionRecipes.find(cr => cr.collection_id === collectionId && cr.recipe_id === recipeId))
    collectionRecipes.push({ collection_id: collectionId, recipe_id: recipeId });
}
export async function removeRecipeFromCollection(collectionId: number, recipeId: number): Promise<void> {
  collectionRecipes = collectionRecipes.filter(cr => !(cr.collection_id === collectionId && cr.recipe_id === recipeId));
}
export async function getCollectionRecipes(collectionId: number): Promise<Recipe[]> {
  const ids = collectionRecipes.filter(cr => cr.collection_id === collectionId).map(cr => cr.recipe_id);
  return recipes.filter(r => r.id !== undefined && ids.includes(r.id!));
}
export async function getRecipeCollections(recipeId: number): Promise<Collection[]> {
  const ids = collectionRecipes.filter(cr => cr.recipe_id === recipeId).map(cr => cr.collection_id);
  return collectionsStore.filter(c => ids.includes(c.id));
}
