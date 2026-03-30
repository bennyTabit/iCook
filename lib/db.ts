import * as SQLite from "expo-sqlite";

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

    CREATE TABLE IF NOT EXISTS meal_plans (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_date   TEXT NOT NULL,
      meal_type   TEXT CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
      recipe_id   INTEGER REFERENCES recipes(id) ON DELETE SET NULL
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

  await seedDefaults();
}

async function seedDefaults() {
  const cats = await db.getAllAsync("SELECT id FROM categories LIMIT 1");
  if (cats.length === 0) {
    await db.execAsync(`
      INSERT INTO categories (name_he, name_en, icon, sort_order) VALUES
        ('הכל',        'All',       '🍽', 0),
        ('פסטה',       'Pasta',     '🍝', 1),
        ('סלטים',      'Salads',    '🥗', 2),
        ('קינוחים',    'Desserts',  '🍰', 3),
        ('מרקים',      'Soups',     '🍜', 4),
        ('בשר',        'Meat',      '🥩', 5),
        ('דגים',       'Fish',      '🐟', 6),
        ('צמחוני',     'Veggie',    '🥦', 7),
        ('ארוחות בוקר','Breakfast', '🍳', 8);

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
  }

  const recipes = await db.getAllAsync("SELECT id FROM recipes LIMIT 1");
  if (recipes.length > 0) return;

  await db.execAsync(`
    INSERT INTO recipes (
      title_he, title_en, description_he, description_en, category_id,
      difficulty, prep_time_min, cook_time_min, servings, source_type,
      notes_he, notes_en, is_favorite
    ) VALUES
      (
        'פסטה רוזה מהירה', 'Quick Rose Pasta',
        'פסטה שמנת-עגבניות זריזה לארוחת ערב.', 'Creamy tomato pasta for a fast dinner.',
        (SELECT id FROM categories WHERE name_en = 'Pasta'),
        'easy', 10, 20, 4, 'manual',
        'להגיש עם בזיליקום טרי.', 'Serve with fresh basil.', 1
      ),
      (
        'סלט קינואה ועשבי תיבול', 'Herb Quinoa Salad',
        'סלט רענן עם ירקות, עשבים ולימון.', 'Fresh salad with herbs, vegetables and lemon.',
        (SELECT id FROM categories WHERE name_en = 'Salads'),
        'easy', 15, 15, 3, 'manual',
        'טעים גם קר מהמקרר.', 'Great served chilled.', 0
      ),
      (
        'בראוניז שוקולד רכים', 'Fudgy Chocolate Brownies',
        'בראוניז עשירים עם מרכז רך.', 'Rich brownies with a soft center.',
        (SELECT id FROM categories WHERE name_en = 'Desserts'),
        'medium', 15, 28, 8, 'manual',
        'לא לאפות יותר מדי.', 'Do not overbake.', 1
      ),
      (
        'מרק כתום ביתי', 'Roasted Orange Soup',
        'מרק גזר ובטטה סמיך ומנחם.', 'Comforting carrot and sweet potato soup.',
        (SELECT id FROM categories WHERE name_en = 'Soups'),
        'easy', 15, 35, 5, 'manual',
        'להוסיף קרם קוקוס להגשה.', 'Finish with coconut cream.', 0
      ),
      (
        'קציצות ברוטב עגבניות', 'Meatballs in Tomato Sauce',
        'קציצות עסיסיות לארוחה משפחתית.', 'Juicy meatballs for a family meal.',
        (SELECT id FROM categories WHERE name_en = 'Meat'),
        'medium', 20, 40, 5, 'manual',
        'מומלץ ליד אורז לבן.', 'Best served with rice.', 0
      ),
      (
        'דג אפוי עם לימון', 'Baked Lemon Fish',
        'פילה דג בתנור עם עשבי תיבול ולימון.', 'Oven baked fish fillet with herbs and lemon.',
        (SELECT id FROM categories WHERE name_en = 'Fish'),
        'easy', 10, 18, 2, 'manual',
        'להגיש עם סלט ירוק.', 'Serve with a green salad.', 0
      ),
      (
        'קציצות עדשים אפויות', 'Baked Lentil Patties',
        'קציצות עדשים וצמחי תבלין בתנור.', 'Lentil patties with herbs baked in the oven.',
        (SELECT id FROM categories WHERE name_en = 'Veggie'),
        'medium', 20, 25, 4, 'manual',
        'מעולה עם טחינה.', 'Excellent with tahini.', 1
      ),
      (
        'שקשוקה קלאסית', 'Classic Shakshuka',
        'ארוחת בוקר ישראלית עם ביצים ברוטב עגבניות.', 'Israeli breakfast with eggs in tomato sauce.',
        (SELECT id FROM categories WHERE name_en = 'Breakfast'),
        'easy', 10, 15, 2, 'manual',
        'להגיש עם חלה או לחם טוב.', 'Serve with challah or crusty bread.', 1
      ),
      (
        'פסטה פטריות ושום', 'Garlic Mushroom Pasta',
        'פסטה מהירה עם פטריות, שום ושמן זית.', 'Quick pasta with mushrooms, garlic and olive oil.',
        (SELECT id FROM categories WHERE name_en = 'Pasta'),
        'easy', 10, 18, 3, 'manual',
        'להוסיף פרמזן בהגשה.', 'Finish with parmesan.', 0
      ),
      (
        'סלט קצוץ ישראלי', 'Israeli Chopped Salad',
        'סלט קלאסי עם עגבניות, מלפפון, בצל ולימון.', 'Classic chopped salad with tomato, cucumber, onion and lemon.',
        (SELECT id FROM categories WHERE name_en = 'Salads'),
        'easy', 12, 0, 4, 'manual',
        'להוסיף נענע אם יש.', 'Add mint if available.', 0
      );
  `);
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

export async function toggleFavorite(id: number, current: number) {
  await db.runAsync(
    'UPDATE recipes SET is_favorite = ?, updated_at = datetime("now") WHERE id = ?',
    [current ? 0 : 1, id],
  );
}

export async function deleteRecipe(id: number) {
  await db.runAsync("DELETE FROM recipes WHERE id = ?", [id]);
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

export default db;
