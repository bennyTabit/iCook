/**
 * Firebase Storage helpers for recipe images.
 * Strategy: compress locally → upload → return permanent HTTPS URL.
 * Fallback: if upload fails, caller keeps the local URI and retries later.
 */
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImageManipulator from "expo-image-manipulator";
import { storage } from "./firebase";

// Max dimension (px) and JPEG quality for uploaded images
const MAX_SIZE = 1200;
const JPEG_QUALITY = 0.75;

/**
 * Compress a local image URI then upload it to Firebase Storage.
 * Returns the permanent HTTPS download URL.
 *
 * Storage path: users/{uid}/recipes/{recipeId}.jpg
 */
export async function uploadRecipeImage(
  uid: string,
  localUri: string,
  recipeId: number,
): Promise<string> {
  // Compress: resize to MAX_SIZE on the longest edge, convert to JPEG
  const compressed = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: MAX_SIZE } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  // Fetch the compressed file as a blob (works on both iOS and Android)
  const response = await fetch(compressed.uri);
  const blob = await response.blob();

  const storageRef = ref(storage, `users/${uid}/recipes/${recipeId}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return await getDownloadURL(storageRef);
}

/** Returns true if the URI is a local file that needs uploading */
export function isLocalUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return uri.startsWith("file://") || uri.startsWith("content://") || uri.startsWith("/");
}
