import db from "./db";

export type SortOrder =
  | "newest"
  | "oldest"
  | "fastest"
  | "favorites"
  | "last_used";

export type CaloriesMode = "per_serving" | "total";

export type FilterState = {
  query: string;
  categoryId: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  maxCookTime: number | null;
  tagIds: number[];
  sourceType: string | null;
  sortBy: SortOrder;
  favoritesOnly: boolean;
  maxCalories: number | null;
  caloriesMode: CaloriesMode;
};

export const DEFAULT_FILTERS: FilterState = {
  query: "",
  categoryId: null,
  difficulty: null,
  maxCookTime: null,
  tagIds: [],
  sourceType: null,
  sortBy: "newest",
  favoritesOnly: false,
  maxCalories: null,
  caloriesMode: "per_serving",
};

export type RecipeSummary = {
  id: number;
  title_he: string;
  title_en: string;
  image_uri: string | null;
  servings: number | null;
  cook_time_min: number | null;
  prep_time_min: number | null;
  difficulty: string | null;
  is_favorite: number;
  source_type: string;
  category_name_he: string;
  category_name_en: string;
  tag_ids: string; // comma-separated from GROUP_CONCAT
  ai_nutrition: string | null;
};

// Full-text + filter search — tag filtering done in JS (SQLite has no FIND_IN_SET)
export async function searchRecipes(
  filters: FilterState,
): Promise<RecipeSummary[]> {
  const params: (string | number)[] = [];
  const hasQuery = filters.query.trim().length > 0;

  let sql = `
    SELECT
      r.id, r.title_he, r.title_en, r.image_uri,
      r.servings,
      r.cook_time_min, r.prep_time_min, r.difficulty,
      r.is_favorite, r.source_type, r.ai_nutrition, r.created_at, r.updated_at,
      (SELECT c.name_he FROM recipe_categories rc JOIN categories c ON rc.category_id = c.id WHERE rc.recipe_id = r.id LIMIT 1) AS category_name_he,
      (SELECT c.name_en FROM recipe_categories rc JOIN categories c ON rc.category_id = c.id WHERE rc.recipe_id = r.id LIMIT 1) AS category_name_en,
      GROUP_CONCAT(rt.tag_id) AS tag_ids
    FROM recipes r
    LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
  `;

  if (hasQuery) {
    sql += " LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id";
  }

  sql += " WHERE 1=1";

  if (hasQuery) {
    const q = `%${filters.query.trim()}%`;
    sql += ` AND (
      r.title_he LIKE ? OR r.title_en LIKE ?
      OR r.description_he LIKE ? OR r.description_en LIKE ?
      OR ri.free_text_he LIKE ? OR ri.free_text_en LIKE ?
    )`;
    params.push(q, q, q, q, q, q);
  }

  if (filters.favoritesOnly) {
    sql += " AND r.is_favorite = 1";
  }
  if (filters.categoryId) {
    sql += " AND r.id IN (SELECT recipe_id FROM recipe_categories WHERE category_id = ?)";
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
  if (filters.sourceType) {
    sql += " AND r.source_type = ?";
    params.push(filters.sourceType);
  }
  if (filters.maxCalories) {
    // Only include recipes that have nutrition data and match the calorie limit.
    // json_extract returns NULL for rows where ai_nutrition is NULL, so the
    // comparison fails safely and those rows are excluded.
    sql += " AND r.ai_nutrition IS NOT NULL";
    if (filters.caloriesMode === "per_serving") {
      sql += ` AND (
        CAST(json_extract(r.ai_nutrition, '$.calories') AS REAL)
        / MAX(CAST(json_extract(r.ai_nutrition, '$.servings') AS REAL), 1)
      ) <= ?`;
    } else {
      sql += " AND CAST(json_extract(r.ai_nutrition, '$.calories') AS REAL) <= ?";
    }
    params.push(filters.maxCalories);
  }

  sql += " GROUP BY r.id";

  const sortMap: Record<SortOrder, string> = {
    newest: "ORDER BY r.created_at DESC",
    oldest: "ORDER BY r.created_at ASC",
    fastest:
      "ORDER BY CASE WHEN r.cook_time_min IS NULL THEN 1 ELSE 0 END, r.cook_time_min ASC",
    favorites: "ORDER BY r.is_favorite DESC, r.created_at DESC",
    last_used: "ORDER BY r.updated_at DESC",
  };
  sql += ` ${sortMap[filters.sortBy]}`;

  let results = await db.getAllAsync<RecipeSummary>(sql, params);

  // Tag filtering in JS (SQLite has no FIND_IN_SET)
  if (filters.tagIds.length > 0) {
    results = results.filter((r) => {
      if (!r.tag_ids) return false;
      const recipeTags = r.tag_ids.split(",").map(Number);
      return filters.tagIds.every((tagId) => recipeTags.includes(tagId));
    });
  }

  return results;
}

export function highlight(
  text: string,
  query: string,
): Array<{ text: string; bold: boolean }> {
  if (!query.trim()) return [{ text, bold: false }];
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  return text.split(regex).map((part) => ({
    text: part,
    bold: regex.test(part),
  }));
}

export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.categoryId) n++;
  if (f.difficulty) n++;
  if (f.maxCookTime) n++;
  if (f.tagIds.length) n += f.tagIds.length;
  if (f.sourceType) n++;
  if (f.favoritesOnly) n++;
  if (f.maxCalories) n++;
  return n;
}
