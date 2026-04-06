/**
 * themeStore — manages the user's explicit theme preference.
 *
 * 'system'  → follow the OS dark/light setting (default)
 * 'light'   → always light
 * 'dark'    → always dark
 *
 * Persisted to AsyncStorage under 'icook.theme'.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'icook.theme';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference: async (preference) => {
    set({ preference });
    await AsyncStorage.setItem(STORAGE_KEY, preference);
  },
}));

// Hydrate preference from storage on module load
AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
  if (saved === 'system' || saved === 'light' || saved === 'dark') {
    useThemeStore.setState({ preference: saved });
  }
});
