/**
 * Cook log: tracks which recipes were cooked and when.
 * Stored in AsyncStorage as JSON under 'icook.cook_log'.
 * Max 20 entries, newest first.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CookLogEntry {
  id: number;
  title_he: string;
  title_en: string | null;
  cookedAt: string; // ISO date string
  category_name_en?: string | null;
}

const KEY = 'icook.cook_log';
const MAX = 20;

export async function logCook(entry: Omit<CookLogEntry, 'cookedAt'>): Promise<void> {
  try {
    const existing = await getCookLog();
    // Remove previous entry for same recipe (so it moves to top)
    const filtered = existing.filter((e) => e.id !== entry.id);
    const newEntry: CookLogEntry = { ...entry, cookedAt: new Date().toISOString() };
    const updated = [newEntry, ...filtered].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // non-fatal
  }
}

export async function getCookLog(): Promise<CookLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CookLogEntry[];
  } catch {
    return [];
  }
}
