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
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      meal_type  TEXT NOT NULL,
      recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_plans_slot
      ON meal_plans(date, meal_type, recipe_id);

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
const TARGET_VERSION = 1;

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

  // Detect old placeholder demo data and replace it once with real recipes.
  // After replacement the new titles exist and future startups skip the block.
  const oldDemo = await db.getAllAsync(
    "SELECT id FROM recipes WHERE title_he = 'פסטה רוזה מהירה' LIMIT 1",
  );
  const newDemo = await db.getAllAsync(
    "SELECT id FROM recipes WHERE title_he = 'מרק בצל' LIMIT 1",
  );
  if (oldDemo.length > 0) {
    await db.execAsync("DELETE FROM recipes;");
  } else if (newDemo.length > 0) {
    return; // already seeded with real recipes
  }

  const onionSoupHe = [
    "מרכיבים:",
    "- 4 בצלים גדולים, פרוסים דק",
    "- 3 כפות חמאה",
    "- 1 כף שמן זית",
    "- 1 כפית סוכר",
    "- 1 כוס יין לבן יבש",
    "- 1.5 ליטר מרק עוף או ירקות",
    "- מלח ופלפל שחור לפי הטעם",
    "- 4 פרוסות לחם שאור קלויות",
    "- 150 גרם גבינת גרויר מגוררת",
    "",
    "שלבים:",
    "- לחמם חמאה ושמן זית בסיר כבד על אש בינונית-נמוכה",
    "- להוסיף את הבצלים עם קמצוץ מלח ולבשל 45 דקות תוך ערבוב תדיר עד שמתקרמלים ומשחימים לחלוטין",
    "- להוסיף את הסוכר ולערבב עוד 5 דקות",
    "- לשפוך את היין הלבן ולבשל 3 דקות עד שמתאדה",
    "- להוסיף את המרק, להביא לרתיחה ולבשל 15 דקות על אש נמוכה. לתבל במלח ופלפל",
    "- לחלק למנות בקערות חסינות חום, להניח פרוסת לחם קלוי מעל ולפזר גבינה בנדיבות",
    "- להכניס לתנור על גריל ב-200° כ-5 דקות עד שהגבינה מבעבעת ומשחימה",
  ].join("\n");

  const pumpkinSoupHe = [
    "מרכיבים:",
    "- 1 ק\"ג דלעת, קלופה וחתוכה לקוביות",
    "- 2 גזרים, קלופים וחתוכים",
    "- 1 בצל גדול, קצוץ",
    "- 3 שיני שום כתושות",
    "- 2 כפות שמן זית",
    "- 1 ליטר מרק ירקות",
    "- 1/2 כפית כמון",
    "- מלח ופלפל לפי הטעם",
    "- קרם קוקוס וגרעיני דלעת להגשה",
    "",
    "שלבים:",
    "- לחמם שמן זית בסיר גדול ולטגן את הבצל 5 דקות עד שמזהיב",
    "- להוסיף שום, גזרים ודלעת ולטגן עוד 3 דקות תוך ערבוב",
    "- לשפוך את מרק הירקות ולהביא לרתיחה",
    "- לבשל על אש נמוכה 30 דקות עד שהירקות מתרככים לגמרי",
    "- לטחון עם בלנדר מוט עד לקבלת מרקם קטיפתי וחלק",
    "- לתבל במלח, פלפל וכמון",
    "- להגיש עם פיזור קרם קוקוס וגרעיני דלעת קלויים מעל",
  ].join("\n");

  const tofuNoodlesHe = [
    "מרכיבים:",
    "- 250 גרם אטריות אורז",
    "- 400 גרם טופו קשה, חתוך לקוביות",
    "- 3 כפות רוטב סויה",
    "- 1 כף שמן שומשום",
    "- 2 כפות מיץ לימון",
    "- 2 שיני שום כתושות",
    "- 1 כפית ג'ינג'ר טרי מגורר",
    "- 2 כפות שמן קוקוס",
    "- 2 גבעולי בצל ירוק, קצוץ",
    "- שומשום קלוי לקישוט",
    "",
    "שלבים:",
    "- לבשל את האטריות לפי הוראות האריזה, לסנן ולשמור בצד",
    "- לייבש את הטופו היטב עם נייר מטבח לחות",
    "- לחמם שמן קוקוס במחבת גדולה על אש גבוהה ולטגן את הטופו 8-10 דקות עד שמשחים מכל הצדדים",
    "- לערבב בקערה קטנה: רוטב סויה, שמן שומשום, מיץ לימון, שום וג'ינג'ר",
    "- להוסיף את האטריות למחבת עם הטופו, לשפוך את הרוטב ולבחוש 2-3 דקות על אש בינונית",
    "- להגיש מיד עם פיזור בצל ירוק ושומשום קלוי מעל",
  ].join("\n");

  const tahinicookiesHe = [
    "מרכיבים:",
    "- 1 כוס טחינה גולמית",
    "- 3/4 כוס סוכר",
    "- 1 ביצה גדולה",
    "- 1 כפית תמצית וניל",
    "- 1/2 כפית אבקת אפייה",
    "- קמצוץ מלח",
    "- שומשום לקישוט",
    "",
    "שלבים:",
    "- לחמם תנור ל-170° ולרפד תבנית בנייר אפייה",
    "- לערבב בקערה טחינה, סוכר, ביצה, וניל, אבקת אפייה ומלח עד לבצק אחיד ורך",
    "- לגלגל כפות בצק לכדורים בקוטר 3 ס\"מ ולהניח על התבנית במרווחים",
    "- להשטיח מעט עם כף ולפזר שומשום מעל כל עוגייה",
    "- לאפות 13-15 דקות עד שהשוליים מזהיבים — המרכז ייראה עוד רך",
    "- להניח לצינון מלא על התבנית — העוגיות מתקשות בזמן הצינון",
  ].join("\n");

  const sahrononimHe = [
    "מרכיבים:",
    "- 250 גרם חמאה רכה בטמפרטורת החדר",
    "- 200 גרם גבינת שמנת",
    "- 2 כוסות קמח לבן",
    "- קמצוץ מלח",
    "- 1/2 כוס ריבת משמש",
    "- 1/2 כוס אגוזי מלך כתושים גס",
    "- 1/2 כוס צימוקים",
    "- 1 כפית קינמון",
    "- 1/4 כוס סוכר",
    "- 1 ביצה טרופה לסיכה",
    "",
    "שלבים:",
    "- לערבב חמאה רכה וגבינת שמנת עד לתערובת חלקה ואחידה",
    "- להוסיף קמח ומלח ולגבש לבצק. לעטוף בניילון ולקרר במקרר שעה לפחות",
    "- לחמם תנור ל-180° ולרפד שתי תבניות בנייר אפייה",
    "- לחלק את הבצק ל-3 חלקים. לפרוס כל חלק על משטח מקומח לעיגול דק",
    "- למרוח שכבה דקה של ריבה ולפזר אגוזים, צימוקים, סוכר וקינמון",
    "- לחתוך לחתיכות משולשות (כמו פרוסות פיצה) ולגלגל כל משולש מהקצה הרחב פנימה לצורת סהר",
    "- לסדר על התבניות, לסוך בביצה טרופה ולאפות 20-22 דקות עד הזהבה יפה",
  ].join("\n");

  const cheesecakeHe = [
    "מרכיבים:",
    "- 200 גרם ביסקוויטים (לוטוס או פתי-בר)",
    "- 100 גרם חמאה מומסת",
    "- 800 גרם גבינת שמנת (קרם צ'יז) בטמפרטורת החדר",
    "- 200 גרם שמנת חמוצה 15%",
    "- 4 ביצים גדולות",
    "- 150 גרם סוכר",
    "- 2 כפות קמח",
    "- 1 כפית תמצית וניל",
    "- גרידת לימון אחד",
    "",
    "שלבים:",
    "- לטחון ביסקוויטים למחית עדינה ולערבב עם חמאה מומסת",
    "- להדק את תערובת הביסקוויטים לתחתית תבנית קפיץ 24 ס\"מ ולקרר 20 דקות במקפיא",
    "- לחמם תנור ל-160° (חום עליון ותחתון, לא טורבו)",
    "- לטרוף גבינת שמנת עם סוכר עד לתערובת חלקה — לא לערבב יתר על המידה",
    "- להוסיף ביצה אחת בכל פעם ולערבב בעדינות אחרי כל אחת",
    "- להוסיף שמנת חמוצה, קמח, וניל וגרידת לימון ולערבב בעדינות רק עד לאיחוד",
    "- לשפוך על הקרסט הקר ולהחליק את הפני השטח",
    "- לאפות 55-60 דקות עד שהשוליים מוצקים והמרכז עוד רוטט מעט כשמנענעים",
    "- לכבות את התנור ולהשאיר את העוגה בפנים עם דלת פתוחה חצי שעה",
    "- לצנן לטמפרטורת החדר ואז לקרר במקרר לפחות 4 שעות — עדיף ללילה",
  ].join("\n");

  await db.runAsync(
    `INSERT INTO recipes (title_he, title_en, description_he, description_en, category_id,
      difficulty, prep_time_min, cook_time_min, servings, source_type, notes_he, is_favorite)
     VALUES (?,?,?,?,
       (SELECT id FROM categories WHERE name_en = 'Soups'),
       ?,?,?,?,?,?,?)`,
    [
      "מרק בצל", "French Onion Soup",
      "מרק בצל צרפתי קלאסי עם גבינה מבעבעת", "Classic French onion soup with bubbling cheese",
      "medium", 15, 60, 4, "manual", onionSoupHe, 1,
    ],
  );

  await db.runAsync(
    `INSERT INTO recipes (title_he, title_en, description_he, description_en, category_id,
      difficulty, prep_time_min, cook_time_min, servings, source_type, notes_he, is_favorite)
     VALUES (?,?,?,?,
       (SELECT id FROM categories WHERE name_en = 'Soups'),
       ?,?,?,?,?,?,?)`,
    [
      "מרק דלעת", "Pumpkin Soup",
      "מרק דלעת קטיפתי ומנחם עם קרם קוקוס", "Silky comforting pumpkin soup with coconut cream",
      "easy", 15, 40, 6, "manual", pumpkinSoupHe, 0,
    ],
  );

  await db.runAsync(
    `INSERT INTO recipes (title_he, title_en, description_he, description_en, category_id,
      difficulty, prep_time_min, cook_time_min, servings, source_type, notes_he, is_favorite)
     VALUES (?,?,?,?,
       (SELECT id FROM categories WHERE name_en = 'Veggie'),
       ?,?,?,?,?,?,?)`,
    [
      "נודלס טופו", "Tofu Noodles",
      "נודלס אורז עם טופו מוזהב ורוטב אסייתי", "Rice noodles with golden tofu and Asian sauce",
      "easy", 15, 20, 3, "manual", tofuNoodlesHe, 0,
    ],
  );

  await db.runAsync(
    `INSERT INTO recipes (title_he, title_en, description_he, description_en, category_id,
      difficulty, prep_time_min, cook_time_min, servings, source_type, notes_he, is_favorite)
     VALUES (?,?,?,?,
       (SELECT id FROM categories WHERE name_en = 'Desserts'),
       ?,?,?,?,?,?,?)`,
    [
      "עוגיות טחינה", "Tahini Cookies",
      "עוגיות טחינה פריכות ועשירות בטעם", "Rich and crispy tahini cookies",
      "easy", 10, 15, 24, "manual", tahinicookiesHe, 1,
    ],
  );

  await db.runAsync(
    `INSERT INTO recipes (title_he, title_en, description_he, description_en, category_id,
      difficulty, prep_time_min, cook_time_min, servings, source_type, notes_he, is_favorite)
     VALUES (?,?,?,?,
       (SELECT id FROM categories WHERE name_en = 'Desserts'),
       ?,?,?,?,?,?,?)`,
    [
      "סהרונים", "Rugelach",
      "סהרונים מתפוררים במילוי ריבה ואגוזים", "Crumbly rugelach with jam and walnut filling",
      "medium", 30, 22, 30, "manual", sahrononimHe, 1,
    ],
  );

  await db.runAsync(
    `INSERT INTO recipes (title_he, title_en, description_he, description_en, category_id,
      difficulty, prep_time_min, cook_time_min, servings, source_type, notes_he, is_favorite)
     VALUES (?,?,?,?,
       (SELECT id FROM categories WHERE name_en = 'Desserts'),
       ?,?,?,?,?,?,?)`,
    [
      "עוגת גבינה אפויה", "Baked Cheesecake",
      "עוגת גבינה אפויה קלאסית עם קרסט ביסקוויטים", "Classic baked cheesecake with biscuit crust",
      "hard", 20, 60, 12, "manual", cheesecakeHe, 1,
    ],
  );
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

export default db;
