import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_KEY = "@icook_auth_user";
// Separate key that is NEVER deleted — persists Apple name/email across sign-outs
export const APPLE_PROFILE_KEY = "@icook_apple_profile";

export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  provider: "google" | "apple";
};

type AuthStore = {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => {
  // Hydrate persisted session on store creation
  AsyncStorage.getItem(AUTH_KEY)
    .then((raw) => {
      if (raw) {
        try {
          set({ user: JSON.parse(raw) as AuthUser, loading: false });
        } catch (parseErr) {
          // Corrupted stored value — clear it and continue as signed-out
          console.warn('[authStore] Corrupted auth data, clearing.', parseErr);
          AsyncStorage.removeItem(AUTH_KEY).catch(() => {});
          set({ loading: false });
        }
      } else {
        set({ loading: false });
      }
    })
    .catch((err) => {
      console.warn('[authStore] AsyncStorage read failed, continuing as signed-out.', err);
      set({ loading: false });
    });

  return {
    user: null,
    loading: true,

    setUser: (user) => {
      if (user) {
        AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user)).catch((err) => {
          console.warn('[authStore] Failed to persist auth user.', err);
        });
      }
      set({ user, loading: false });
    },

    signOut: async () => {
      try {
        await AsyncStorage.removeItem(AUTH_KEY);
      } catch (err) {
        console.warn('[authStore] Failed to remove auth key on sign-out.', err);
      }
      set({ user: null });
    },
  };
});
