import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../lib/firebase";

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
  /** Sign in with a Google idToken obtained from expo-auth-session */
  signInWithGoogle: (idToken: string, accessToken: string) => Promise<void>;
  /** Sign in with an Apple credential obtained from expo-apple-authentication */
  signInWithApple: (identityToken: string, displayName: string | null, email: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  /** Internal — called by Firebase auth listener */
  _setFromFirebase: (fbUser: FirebaseUser | null, provider: "google" | "apple") => void;
};

function mapFirebaseUser(fbUser: FirebaseUser, provider: "google" | "apple"): AuthUser {
  return {
    uid: fbUser.uid,
    displayName: fbUser.displayName,
    email: fbUser.email,
    photoURL: fbUser.photoURL,
    provider,
  };
}

export const useAuthStore = create<AuthStore>((set, get) => {
  // Listen to Firebase auth state changes — this fires immediately on boot
  // if the user has a persisted session (Firebase handles token refresh).
  onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      // Determine provider from Firebase user profile
      const providerId = fbUser.providerData[0]?.providerId ?? "";
      const provider: "google" | "apple" =
        providerId.includes("apple") ? "apple" : "google";
      set({ user: mapFirebaseUser(fbUser, provider), loading: false });
    } else {
      set({ user: null, loading: false });
    }
  });

  return {
    user: null,
    loading: true,

    signInWithGoogle: async (idToken, accessToken) => {
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const result = await signInWithCredential(auth, credential);
      set({ user: mapFirebaseUser(result.user, "google"), loading: false });
    },

    signInWithApple: async (identityToken, displayName, email) => {
      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({ idToken: identityToken });
      const result = await signInWithCredential(auth, credential);

      // Apple only sends name/email on first auth — persist them permanently
      const savedRaw = await AsyncStorage.getItem(APPLE_PROFILE_KEY).catch(() => null);
      const saved = savedRaw ? JSON.parse(savedRaw) : null;
      const finalName = displayName ?? saved?.displayName ?? result.user.displayName;
      const finalEmail = email ?? saved?.email ?? result.user.email;

      if (displayName || email) {
        await AsyncStorage.setItem(
          APPLE_PROFILE_KEY,
          JSON.stringify({ displayName: finalName, email: finalEmail }),
        ).catch(() => {});
      }

      const user: AuthUser = {
        uid: result.user.uid,
        displayName: finalName,
        email: finalEmail,
        photoURL: null,
        provider: "apple",
      };
      set({ user, loading: false });
    },

    signOut: async () => {
      await firebaseSignOut(auth).catch(err =>
        console.warn("[authStore] Firebase sign-out error:", err)
      );
      set({ user: null });
    },

    _setFromFirebase: (fbUser, provider) => {
      set({ user: fbUser ? mapFirebaseUser(fbUser, provider) : null, loading: false });
    },
  };
});
