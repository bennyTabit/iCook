import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  nutritionEnabled: boolean;
  setNutritionEnabled: (val: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  nutritionEnabled: false,
  setNutritionEnabled: async (val) => {
    set({ nutritionEnabled: val });
    await AsyncStorage.setItem('icook.feature.nutrition', val ? 'true' : 'false');
  },
}));

// Hydrate from storage on module load
AsyncStorage.getItem('icook.feature.nutrition').then((saved) => {
  if (saved !== null) {
    useSettingsStore.setState({ nutritionEnabled: saved === 'true' });
  }
});
