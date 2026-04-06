import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'icook.search_history';
const MAX = 10;

export async function addSearchHistory(query: string): Promise<void> {
  const q = query.trim();
  if (!q || q.length < 2) return;
  try {
    const existing = await getSearchHistory();
    const filtered = existing.filter((e) => e !== q);
    const updated = [q, ...filtered].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
}

export async function getSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function clearSearchHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function removeSearchHistoryItem(query: string): Promise<void> {
  const existing = await getSearchHistory();
  await AsyncStorage.setItem(KEY, JSON.stringify(existing.filter((e) => e !== query)));
}
