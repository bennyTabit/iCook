import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'icook.recurring_items';

export async function getRecurringItems(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

export async function addRecurringItem(name: string): Promise<void> {
  const existing = await getRecurringItems();
  if (existing.includes(name.trim())) return;
  await AsyncStorage.setItem(KEY, JSON.stringify([...existing, name.trim()]));
}

export async function removeRecurringItem(name: string): Promise<void> {
  const existing = await getRecurringItems();
  await AsyncStorage.setItem(KEY, JSON.stringify(existing.filter((i) => i !== name.trim())));
}

export async function applyRecurringItems(addItem: (name: string) => void, currentItems: string[]): Promise<void> {
  const recurring = await getRecurringItems();
  for (const name of recurring) {
    if (!currentItems.some((i) => i.toLowerCase() === name.toLowerCase())) {
      addItem(name);
    }
  }
}
