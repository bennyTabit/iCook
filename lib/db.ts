import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SEED_RECIPES } from "./seedRecipes";

/** Bump this key whenever you want the seed to re-run on existing installs. */
const SEED_DONE_KEY = "icook.seed.v2";

const db = SQLite.openDatabaseSync("icook.db");

export async function initDB() {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name_he     TEXT NOT NULL,
      name_en     TEXT NOT NULL,
      icon        TEXT,
      sort_order  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      name_he TEXT NOT NULL,
      name_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name_he         TEXT NOT NULL,
      name_en         TEXT NOT NULL,
      normalized_name TEXT
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      title_he         TEXT NOT NULL,
      title_en         TEXT,
      description_he   TEXT,
      description_en   TEXT,
      category_id      INTEGER REFERENCES categories(id),
      difficulty       TEXT CHECK(difficulty IN ('easy','medium','hard')),
      prep_time_min    INTEGER,
      cook_time_min    INTEGER,
      servings         INTEGER,
      source_type      TEXT CHECK(source_type IN ('manual','ocr','url','instagram','ai')),
      source_url       TEXT,
      source_name      TEXT,
      image_uri        TEXT,
      notes_he         TEXT,
      notes_en         TEXT,
      is_favorite      INTEGER DEFAULT 0,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      ingredient_id INTEGER REFERENCES ingredients(id),
      free_text_he  TEXT,
      free_text_en  TEXT,
      quantity      REAL,
      unit_he       TEXT,
      unit_en       TEXT,
      sort_order    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS recipe_steps (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      step_number   INTEGER NOT NULL,
      text_he       TEXT NOT NULL,
      text_en       TEXT,
      timer_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS recipe_tags (
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      tag_id    INTEGER NOT NULL REFERENCES tags(id),
      PRIMARY KEY (recipe_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS recipe_images (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      image_uri  TEXT NOT NULL,
      caption_he TEXT,
      caption_en TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shopping_lists (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title_he   TEXT,
      title_en   TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      is_archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id          INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
      ingredient_id    INTEGER REFERENCES ingredients(id),
      free_text_he     TEXT,
      free_text_en     TEXT,
      quantity         REAL,
      unit_he          TEXT,
      unit_en          TEXT,
      is_checked       INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS import_jobs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type  TEXT,
      source_url   TEXT,
      status       TEXT CHECK(status IN ('pending','success','failed')),
      raw_payload  TEXT,
      error_msg    TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_favorite ON recipes(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_recipe_steps ON recipe_steps(recipe_id);
    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients ON recipe_ingredients(recipe_id);
  `);

  await runMigrations();
  await seedDefaults();
}

/**
 * Schema migrations using PRAGMA user_version.
 * Bump TARGET_VERSION and add a case whenever the schema changes.
 */
const TARGET_VERSION = 3;

async function runMigrations() {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= TARGET_VERSION) return;

  if (current < 1) {
    // v1: recreate meal_plans with correct schema (adds `date` column)
    await db.execAsync(`
      DROP TABLE IF EXISTS meal_plans;
      CREATE TABLE meal_plans (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        date       TEXT NOT NULL,
        meal_type  TEXT NOT NULL,
        recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_plans_slot
        ON meal_plans(date, meal_type, recipe_id);
      PRAGMA user_version = 1;
    `);
  }

  if (current < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS collections (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name_he    TEXT NOT NULL,
        name_en    TEXT,
        color      TEXT DEFAULT '#FF6B6B',
        icon       TEXT DEFAULT '📁',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS collection_recipes (
        collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        added_at      TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (collection_id, recipe_id)
      );
      PRAGMA user_version = 2;
    `);
  }

  if (current < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recipe_user_data (
        recipe_id    INTEGER PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
        rating       INTEGER CHECK(rating BETWEEN 1 AND 5),
        personal_note TEXT,
        last_cooked_at TEXT
      );
      PRAGMA user_version = 3;
    `);
  }
}

async function seedDefaults() {
  // ── Categories ─────────────────────────────────────────────────────────────
  const cats = await db.getAllAsync("SELECT id FROM categories LIMIT 1");
  if (cats.length === 0) {
    // Fresh install — insert all categories and tags
    await db.execAsync(`
      INSERT INTO categories (name_he, name_en, icon, sort_order) VALUES
        ('הכל',        'All',       '🍽',  0),
        ('ישראלי',     'Israeli',   '🇮🇱',  1),
        ('ארוחות בוקר','Breakfast', '🍳',  2),
        ('מרקים',      'Soups',     '🍜',  3),
        ('סלטים',      'Salads',    '🥗',  4),
        ('פסטה',       'Pasta',     '🍝',  5),
        ('בשר',        'Meat',      '🥩',  6),
        ('דגים',       'Fish',      '🐟',  7),
        ('צמחוני',     'Veggie',    '🥦',  8),
        ('קינוחים',    'Desserts',  '🍰',  9),
        ('אפייה',      'Baking',    '🥐', 10);

      INSERT INTO tags (name_he, name_en) VALUES
        ('טבעוני',      'Vegan'),
        ('צמחוני',      'Vegetarian'),
        ('ללא גלוטן',   'Gluten-free'),
        ('ללא לקטוז',   'Dairy-free'),
        ('חלבי',        'Dairy'),
        ('בשרי',        'Meat'),
        ('פרווה',       'Parve'),
        ('כשר',         'Kosher'),
        ('קטו',         'Keto'),
        ('מהיר',        'Quick');
    `);
  } else {
    // Existing install — add new categories if missing
    const isrCat = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE name_en = 'Israeli' LIMIT 1",
    );
    if (!isrCat) {
      await db.runAsync(
        "INSERT INTO categories (name_he, name_en, icon, sort_order) VALUES (?,?,?,?)",
        ['ישראלי', 'Israeli', '🇮🇱', 1],
      );
    }
    const bakingCat = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM categories WHERE name_en = 'Baking' LIMIT 1",
    );
    if (!bakingCat) {
      await db.runAsync(
        "INSERT INTO categories (name_he, name_en, icon, sort_order) VALUES (?,?,?,?)",
        ['אפייה', 'Baking', '🥐', 10],
      );
    }
  }

  // ── Recipe seed guard ──────────────────────────────────────────────────────
  // AsyncStorage flag is set after a successful seed run and never cleared,
  // so deleting individual recipes never triggers a re-seed.
  const seedDone = await AsyncStorage.getItem(SEED_DONE_KEY).catch(() => null);
  if (seedDone) return;

  // Delete any old starter recipes (v1 seed had no source_name — match by title).
  const OLD_TITLES = [
    'מרק בצל', 'מרק דלעת', 'נודלס טופו',
    'עוגיות טחינה', 'סהרונים', 'עוגת גבינה אפויה',
    'פסטה רוזה מהירה', // even older placeholder
  ];
  for (const title of OLD_TITLES) {
    await db.runAsync(
      "DELETE FROM recipes WHERE title_he = ? AND (source_name IS NULL OR source_name = 'iCook Starter')",
      [title],
    );
  }

  // ── Insert all seed recipes ────────────────────────────────────────────────
  for (const recipe of SEED_RECIPES) {
    await db.runAsync(
      `INSERT INTO recipes
        (title_he, title_en, description_he, description_en, category_id,
         difficulty, prep_time_min, cook_time_min, servings,
         source_type, source_name, notes_he, is_favorite)
       VALUES (?,?,?,?,
         (SELECT id FROM categories WHERE name_en = ?),
         ?,?,?,?,
         'manual','iCook Starter',?,?)`,
      [
        recipe.title_he,
        recipe.title_en,
        recipe.description_he,
        recipe.description_en,
        recipe.category_en,
        recipe.difficulty,
        recipe.prep_time_min,
        recipe.cook_time_min,
        recipe.servings,
        recipe.notes_he,
        recipe.is_favorite,
      ],
    );
  }

  // Mark seed as done — checked on every subsequent boot, never cleared.
  await AsyncStorage.setItem(SEED_DONE_KEY, "1").catch(() => {});
}

export type Recipe = {
  id?: number;
  title_he: string;
  title_en?: string;
  description_he?: string;
  description_en?: string;
  category_id?: number;
  difficulty?: "easy" | "medium" | "hard";
  prep_time_min?: number;
  cook_time_min?: number;
  servings?: number;
  source_type?: "manual" | "ocr" | "url" | "instagram" | "ai";
  source_url?: string;
  source_name?: string;
  image_uri?: string;
  notes_he?: string;
  notes_en?: string;
  is_favorite?: number;
  created_at?: string;
  updated_at?: string;
};

export async function getAllRecipes(): Promise<Recipe[]> {
  return db.getAllAsync<Recipe>(`
    SELECT r.*, c.name_he as category_name
    FROM recipes r
    LEFT JOIN categories c ON r.category_id = c.id
    ORDER BY r.created_at DESC
  `);
}

export async function getRecipeById(id: number): Promise<Recipe | null> {
  return db.getFirstAsync<Recipe>("SELECT * FROM recipes WHERE id = ?", [id]);
}

export async function insertRecipe(recipe: Recipe): Promise<number> {
  if (!recipe.title_he?.trim()) {
    throw new Error("כותרת המתכון לא יכולה להיות ריקה / Recipe title cannot be empty");
  }
  const res = await db.runAsync(
    `INSERT INTO recipes
      (title_he, title_en, description_he, description_en, category_id, difficulty,
       prep_time_min, cook_time_min, servings, source_type, source_url, source_name,
       image_uri, notes_he, notes_en)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      recipe.title_he,
      recipe.title_en ?? null,
      recipe.description_he ?? null,
      recipe.description_en ?? null,
      recipe.category_id ?? null,
      recipe.difficulty ?? null,
      recipe.prep_time_min ?? null,
      recipe.cook_time_min ?? null,
      recipe.servings ?? null,
      recipe.source_type ?? "manual",
      recipe.source_url ?? null,
      recipe.source_name ?? null,
      recipe.image_uri ?? null,
      recipe.notes_he ?? null,
      recipe.notes_en ?? null,
    ],
  );
  return res.lastInsertRowId;
}

export async function updateRecipe(
  id: number,
  recipe: Partial<Recipe>,
): Promise<void> {
  await db.runAsync(
    `UPDATE recipes SET
      title_he = COALESCE(?, title_he),
      title_en = COALESCE(?, title_en),
      description_he = COALESCE(?, description_he),
      description_en = COALESCE(?, description_en),
      category_id = COALESCE(?, category_id),
      difficulty = COALESCE(?, difficulty),
      prep_time_min = COALESCE(?, prep_time_min),
      cook_time_min = COALESCE(?, cook_time_min),
      servings = COALESCE(?, servings),
      notes_he = COALESCE(?, notes_he),
      notes_en = COALESCE(?, notes_en),
      updated_at = datetime('now')
     WHERE id = ?`,
    [
      recipe.title_he ?? null,
      recipe.title_en ?? null,
      recipe.description_he ?? null,
      recipe.description_en ?? null,
      recipe.category_id ?? null,
      recipe.difficulty ?? null,
      recipe.prep_time_min ?? null,
      recipe.cook_time_min ?? null,
      recipe.servings ?? null,
      recipe.notes_he ?? null,
      recipe.notes_en ?? null,
      id,
    ],
  );
}

export async function updateRecipeImageUri(id: number, uri: string): Promise<void> {
  await db.runAsync(
    'UPDATE recipes SET image_uri = ?, updated_at = datetime("now") WHERE id = ?',
    [uri, id],
  );
}

export async function toggleFavorite(id: number, current: number) {
  await db.runAsync(
    'UPDATE recipes SET is_favorite = ?, updated_at = datetime("now") WHERE id = ?',
    [current ? 0 : 1, id],
  );
}

export async function deleteRecipe(id: number) {
  await db.runAsync("DELETE FROM recipes WHERE id = ?", [id]);
}

/**
 * Associate a tag with a recipe. Safe to call multiple times — the PRIMARY KEY
 * constraint on recipe_tags means a duplicate is silently ignored (INSERT OR IGNORE).
 */
export async function insertRecipeTag(recipeId: number, tagId: number): Promise<void> {
  await db.runAsync(
    "INSERT OR IGNORE INTO recipe_tags (recipe_id, tag_id) VALUES (?, ?)",
    [recipeId, tagId],
  );
}

/** Remove all tag associations for a recipe then re-insert the given set. */
export async function setRecipeTags(recipeId: number, tagIds: number[]): Promise<void> {
  await db.runAsync("DELETE FROM recipe_tags WHERE recipe_id = ?", [recipeId]);
  for (const tagId of tagIds) {
    await insertRecipeTag(recipeId, tagId);
  }
}

export async function searchRecipes(query: string): Promise<Recipe[]> {
  const q = `%${query}%`;
  return db.getAllAsync<Recipe>(
    `SELECT * FROM recipes
     WHERE title_he LIKE ? OR title_en LIKE ? OR description_he LIKE ?
     ORDER BY created_at DESC`,
    [q, q, q],
  );
}

export async function getRecipesByFilter(filters: {
  categoryId?: number;
  difficulty?: string;
  maxCookTime?: number;
  tagIds?: number[];
}): Promise<Recipe[]> {
  let sql = "SELECT DISTINCT r.* FROM recipes r";
  const params: any[] = [];

  if (filters.tagIds?.length) {
    sql += " JOIN recipe_tags rt ON r.id = rt.recipe_id";
  }
  sql += " WHERE 1=1";

  if (filters.categoryId) {
    sql += " AND r.category_id = ?";
    params.push(filters.categoryId);
  }
  if (filters.difficulty) {
    sql += " AND r.difficulty = ?";
    params.push(filters.difficulty);
  }
  if (filters.maxCookTime) {
    sql += " AND r.cook_time_min <= ?";
    params.push(filters.maxCookTime);
  }
  if (filters.tagIds?.length) {
    sql += ` AND rt.tag_id IN (${filters.tagIds.map(() => "?").join(",")})`;
    params.push(...filters.tagIds);
  }

  sql += " ORDER BY r.created_at DESC";
  return db.getAllAsync<Recipe>(sql, params);
}

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

export async function getMealPlanForWeek(
  weekStart: string,
  weekEnd: string,
): Promise<MealPlanEntry[]> {
  const rows = await db.getAllAsync<MealPlanEntry>(
    `SELECT mp.id, mp.date, mp.meal_type, mp.recipe_id,
            r.title_he, r.title_en, r.image_uri
     FROM meal_plans mp
     JOIN recipes r ON r.id = mp.recipe_id
     WHERE mp.date >= ? AND mp.date <= ?
     ORDER BY mp.date, mp.meal_type`,
    [weekStart, weekEnd],
  );
  return rows;
}

export async function insertMealPlan(
  date: string,
  mealType: MealType,
  recipeId: number,
): Promise<number> {
  const result = await db.runAsync(
    'INSERT OR IGNORE INTO meal_plans (date, meal_type, recipe_id) VALUES (?, ?, ?)',
    [date, mealType, recipeId],
  );
  return result.lastInsertRowId;
}

export async function deleteMealPlan(id: number): Promise<void> {
  await db.runAsync('DELETE FROM meal_plans WHERE id = ?', [id]);
}

// ── Collections ────────────────────────────────────────────────────────────

export interface Collection {
  id: number;
  name_he: string;
  name_en?: string;
  color: string;
  icon: string;
  created_at?: string;
  recipe_count?: number;
}

export async function getAllCollections(): Promise<Collection[]> {
  return db.getAllAsync<Collection>(
    `SELECT c.*, COUNT(cr.recipe_id) as recipe_count
     FROM collections c
     LEFT JOIN collection_recipes cr ON cr.collection_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  );
}

export async function insertCollection(col: Omit<Collection, 'id' | 'created_at' | 'recipe_count'>): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO collections (name_he, name_en, color, icon) VALUES (?, ?, ?, ?)',
    [col.name_he, col.name_en ?? col.name_he, col.color, col.icon]
  );
  return result.lastInsertRowId;
}

export async function updateCollection(id: number, col: Partial<Omit<Collection, 'id' | 'created_at' | 'recipe_count'>>): Promise<void> {
  await db.runAsync(
    `UPDATE collections SET name_he = COALESCE(?, name_he), name_en = COALESCE(?, name_en), color = COALESCE(?, color), icon = COALESCE(?, icon) WHERE id = ?`,
    [col.name_he ?? null, col.name_en ?? null, col.color ?? null, col.icon ?? null, id]
  );
}

export async function deleteCollection(id: number): Promise<void> {
  await db.runAsync('DELETE FROM collections WHERE id = ?', [id]);
}

export async function addRecipeToCollection(collectionId: number, recipeId: number): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO collection_recipes (collection_id, recipe_id) VALUES (?, ?)',
    [collectionId, recipeId]
  );
}

export async function removeRecipeFromCollection(collectionId: number, recipeId: number): Promise<void> {
  await db.runAsync(
    'DELETE FROM collection_recipes WHERE collection_id = ? AND recipe_id = ?',
    [collectionId, recipeId]
  );
}

export async function getCollectionRecipes(collectionId: number): Promise<Recipe[]> {
  return db.getAllAsync<Recipe>(
    `SELECT r.* FROM recipes r
     JOIN collection_recipes cr ON cr.recipe_id = r.id
     WHERE cr.collection_id = ?
     ORDER BY cr.added_at DESC`,
    [collectionId]
  );
}

export async function getRecipeCollections(recipeId: number): Promise<Collection[]> {
  return db.getAllAsync<Collection>(
    `SELECT c.* FROM collections c
     JOIN collection_recipes cr ON cr.collection_id = c.id
     WHERE cr.recipe_id = ?`,
    [recipeId]
  );
}

export interface RecipeUserData {
  recipe_id: number;
  rating: number | null;
  personal_note: string | null;
  last_cooked_at: string | null;
}

export async function getRecipeUserData(recipeId: number): Promise<RecipeUserData> {
  const row = await db.getFirstAsync<RecipeUserData>(
    'SELECT * FROM recipe_user_data WHERE recipe_id = ?',
    [recipeId],
  );
  return row ?? { recipe_id: recipeId, rating: null, personal_note: null, last_cooked_at: null };
}

export async function upsertRecipeUserData(
  recipeId: number,
  data: Partial<Omit<RecipeUserData, 'recipe_id'>>,
): Promise<void> {
  const existing = await db.getFirstAsync<{ recipe_id: number }>(
    'SELECT recipe_id FROM recipe_user_data WHERE recipe_id = ?',
    [recipeId],
  );
  if (existing) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.rating !== undefined) { sets.push('rating = ?'); vals.push(data.rating); }
    if (data.personal_note !== undefined) { sets.push('personal_note = ?'); vals.push(data.personal_note); }
    if (data.last_cooked_at !== undefined) { sets.push('last_cooked_at = ?'); vals.push(data.last_cooked_at); }
    if (!sets.length) return;
    vals.push(recipeId);
    await db.runAsync(`UPDATE recipe_user_data SET ${sets.join(', ')} WHERE recipe_id = ?`, vals as any);
  } else {
    await db.runAsync(
      'INSERT INTO recipe_user_data (recipe_id, rating, personal_note, last_cooked_at) VALUES (?, ?, ?, ?)',
      [recipeId, data.rating ?? null, data.personal_note ?? null, data.last_cooked_at ?? null],
    );
  }
}

export default db;
