import AsyncStorage from '@react-native-async-storage/async-storage';
import { logCook, getCookLog } from '../lib/cookLog';

describe('cookLog', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('starts with an empty log', async () => {
    const log = await getCookLog();
    expect(log).toEqual([]);
  });

  it('logs a cook entry', async () => {
    await logCook({ id: 1, title_he: 'פסטה', title_en: 'Pasta', category_name_en: 'pasta' });
    const log = await getCookLog();
    expect(log).toHaveLength(1);
    expect(log[0].id).toBe(1);
    expect(log[0].title_he).toBe('פסטה');
    expect(log[0].cookedAt).toBeTruthy();
  });

  it('moves re-cooked recipe to the top', async () => {
    await logCook({ id: 1, title_he: 'פסטה', title_en: 'Pasta', category_name_en: null });
    await logCook({ id: 2, title_he: 'סלט', title_en: 'Salad', category_name_en: null });
    await logCook({ id: 1, title_he: 'פסטה', title_en: 'Pasta', category_name_en: null });
    const log = await getCookLog();
    expect(log[0].id).toBe(1);
    expect(log).toHaveLength(2); // no duplicate
  });

  it('caps at 20 entries', async () => {
    for (let i = 0; i < 25; i++) {
      await logCook({ id: i, title_he: `מתכון ${i}`, title_en: `Recipe ${i}`, category_name_en: null });
    }
    const log = await getCookLog();
    expect(log).toHaveLength(20);
    // Most recent should be first
    expect(log[0].id).toBe(24);
  });
});
