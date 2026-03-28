import { getAllRecipes, getCategoryName } from './db.web';

export type SortOrder = 'newest' | 'oldest' | 'fastest' | 'favorites' | 'last_used';

export type FilterState = {
  query: string;
  categoryId: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  maxCookTime: number | null;
  tagIds: number[];
  sourceType: string | null;
  sortBy: SortOrder;
  favoritesOnly: boolean;
};

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  categoryId: null,
  difficulty: null,
  maxCookTime: null,
  tagIds: [],
  sourceType: null,
  sortBy: 'newest',
  favoritesOnly: false,
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
  tag_ids: string;
};

export async function searchRecipes(filters: FilterState): Promise<RecipeSummary[]> {
  const q = filters.query.trim().toLowerCase();
  const all = await getAllRecipes();

  let rows: RecipeSummary[] = all.map(r => {
    const cat = getCategoryName(r.category_id);
    return {
      id: r.id ?? 0,
      title_he: r.title_he,
      title_en: r.title_en ?? '',
      image_uri: r.image_uri ?? null,
      servings: r.servings ?? null,
      cook_time_min: r.cook_time_min ?? null,
      prep_time_min: r.prep_time_min ?? null,
      difficulty: r.difficulty ?? null,
      is_favorite: r.is_favorite ?? 0,
      source_type: r.source_type ?? 'manual',
      category_name_he: cat.he,
      category_name_en: cat.en,
      tag_ids: '',
    };
  });

  if (q) {
    rows = rows.filter(r =>
      r.title_he.toLowerCase().includes(q)
      || r.title_en.toLowerCase().includes(q)
    );
  }

  if (filters.favoritesOnly) rows = rows.filter(r => r.is_favorite === 1);
  if (filters.categoryId) rows = rows.filter(r => all.find(x => x.id === r.id)?.category_id === filters.categoryId);
  if (filters.difficulty) rows = rows.filter(r => r.difficulty === filters.difficulty);
  if (filters.maxCookTime != null) {
    const maxCookTime = filters.maxCookTime;
    rows = rows.filter(r => (r.cook_time_min ?? Number.MAX_SAFE_INTEGER) <= maxCookTime);
  }
  if (filters.sourceType) rows = rows.filter(r => r.source_type === filters.sourceType);

  rows.sort((a, b) => {
    if (filters.sortBy === 'oldest') return a.id - b.id;
    if (filters.sortBy === 'fastest') return (a.cook_time_min ?? Number.MAX_SAFE_INTEGER) - (b.cook_time_min ?? Number.MAX_SAFE_INTEGER);
    if (filters.sortBy === 'favorites') return (b.is_favorite - a.is_favorite) || (b.id - a.id);
    if (filters.sortBy === 'last_used') return b.id - a.id;
    return b.id - a.id;
  });

  return rows;
}

export function highlight(text: string, query: string): Array<{ text: string; bold: boolean }> {
  if (!query.trim()) return [{ text, bold: false }];
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(regex).map(part => ({
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
  return n;
}
