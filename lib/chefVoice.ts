/**
 * chefVoice.ts
 * Converts chef narration text to real human voice audio using ElevenLabs API.
 * Caches generated audio to expo-file-system so each step is only generated once.
 *
 * ⚠️  SECURITY NOTE: EXPO_PUBLIC_ keys are bundled into the client.
 *     For production, proxy these calls through a backend (Firebase Function, etc.)
 */

import * as FileSystem from 'expo-file-system/legacy';

const API_KEY   = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
// Default: "Rachel" — warm, natural female voice (multilingual)
// Override with EXPO_PUBLIC_ELEVENLABS_VOICE_ID in your .env
const VOICE_ID  = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';
const MODEL_ID  = 'eleven_multilingual_v2'; // supports Hebrew + English + more

const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'chef_audio/';

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function makeCacheKey(raw: string): string {
  // Create a short deterministic key from the text + voice
  const slug = raw.trim().slice(0, 50).replace(/[^a-zA-Z0-9א-ת]/g, '_');
  const hash = raw.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
  return `${slug}_${VOICE_ID.slice(0, 8)}_${hash}`;
}

// ── ArrayBuffer → base64 (safe for long audio) ───────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// ── Main synthesis function ───────────────────────────────────────────────────

/**
 * Converts text to speech using ElevenLabs and caches the result.
 * Returns a local file URI (playable with expo-av) or null on failure.
 */
export async function synthesizeAudio(
  text: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!API_KEY || !text.trim()) return null;

  const cacheKey = makeCacheKey(text);
  const filePath = CACHE_DIR + cacheKey + '.mp3';

  try {
    await ensureCacheDir();

    // Return cached file if it exists
    const cached = await FileSystem.getInfoAsync(filePath);
    if (cached.exists) return filePath;

    if (signal?.aborted) return null;

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.45,        // 0–1: lower = more expressive
            similarity_boost: 0.80, // 0–1: voice consistency
            style: 0.25,            // 0–1: speaking style exaggeration
            use_speaker_boost: true,
          },
        }),
        signal,
      },
    );

    if (!res.ok) {
      console.warn('[chefVoice] ElevenLabs error:', res.status);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    await FileSystem.writeAsStringAsync(filePath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return filePath;
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    console.warn('[chefVoice] error:', err);
    return null;
  }
}

/**
 * Deletes all cached chef audio for a recipe (call after recipe is deleted).
 */
export async function clearChefAudioCache(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
    }
  } catch (err) {
    console.warn('[chefVoice] clearCache error:', err);
  }
}

export function isElevenLabsConfigured(): boolean {
  return !!API_KEY;
}
