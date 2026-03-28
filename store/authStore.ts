import { create } from 'zustand';

type User = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

type AuthStore = {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  setUser: (user) => set({ user, loading: false }),

  signOut: async () => {
    // v1.5: await auth().signOut();
    set({ user: null });
  },
}));
