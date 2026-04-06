/**
 * Firestore sync helpers.
 * Strategy: SQLite is the source of truth locally. On save → also write to
 * Firestore. On app open → pull any recipes newer than last sync timestamp.
 * Conflict resolution: last-write-wins via `updated_at`.
 */
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db as firestore } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FirestoreRecipe = {
  id: number;
  uid: string; // owner's Firebase UID
  title_he: string;
  title_en: string | null;
  description_he: string | null;
  description_en: string | null;
  category_id: number | null;
  difficulty: string | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  servings: number | null;
  source_type: string;
  source_url: string | null;
  image_uri: string | null;
  notes_he: string | null;
  notes_en: string | null;
  is_favorite: number;
  created_at: string;
  updated_at: string;
  synced_at?: Timestamp;
};

// ─── Write a single recipe to Firestore ──────────────────────────────────────

export async function syncRecipeToCloud(uid: string, recipe: Omit<FirestoreRecipe, "uid" | "synced_at">) {
  const ref = doc(firestore, "users", uid, "recipes", String(recipe.id));
  await setDoc(ref, { ...recipe, uid, synced_at: serverTimestamp() }, { merge: true });
}

// ─── Delete a recipe from Firestore ──────────────────────────────────────────

export async function deleteRecipeFromCloud(uid: string, recipeId: number) {
  const ref = doc(firestore, "users", uid, "recipes", String(recipeId));
  await deleteDoc(ref);
}

// ─── Pull all recipes for a user ─────────────────────────────────────────────

export async function fetchCloudRecipes(uid: string): Promise<FirestoreRecipe[]> {
  const col = collection(firestore, "users", uid, "recipes");
  const snap = await getDocs(col);
  return snap.docs.map(d => d.data() as FirestoreRecipe);
}
