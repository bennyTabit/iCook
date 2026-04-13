/**
 * chefVoice.ts
 * Converts chef narration text to real human voice audio using ElevenLabs API.
 * Caches generated audio to expo-file-system so each step is only generated once.
 *
 * ⚠️  SECURITY NOTE: EXPO_PUBLIC_ keys are bundled into the client.
 *     For production, proxy these calls through a backend (Firebase Function, etc.)
 */

import * as FileSystem from 'expo-file-system/legacy';

const API_KEY  = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
const MODEL_ID = 'eleven_turbo_v2_5'; // supports language_code param including Hebrew

export type ChefGender = 'female' | 'male';

export const VOICE_FEMALE = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_FEMALE ?? 'ILc5yWuthKSyc7tYivz6';
export const VOICE_MALE   = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_MALE   ?? '2V5jPbyEsuNjvkjeM6OL';

export function getVoiceId(gender: ChefGender): string {
  return gender === 'male' ? VOICE_MALE : VOICE_FEMALE;
}

const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'chef_audio/';

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function makeCacheKey(text: string, voiceId: string): string {
  const slug = text.trim().slice(0, 40).replace(/[^a-zA-Z0-9א-ת]/g, '_');
  const hash = text.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
  return `${slug}_${voiceId.slice(0, 8)}_${hash}`;
}

// ── Text sanitizer — strips non-Hebrew/Latin characters ──────────────────────

/**
 * Removes any characters that are not Hebrew, Latin, digits, punctuation or spaces.
 * Prevents ElevenLabs from getting confused by mixed scripts (e.g. Korean chars
 * that Claude accidentally injects).
 */
function sanitizeText(text: string): string {
  // Allow: Hebrew (U+0590–U+05FF), Basic Latin, common punctuation, digits, whitespace
  return text
    .replace(/[^\u0590-\u05FF\u0020-\u007E\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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
  gender: ChefGender = 'female',
  _isHebrew: boolean = true, // kept for API compatibility, ElevenLabs is multilingual
  signal?: AbortSignal,
): Promise<string | null> {
  const voiceId = getVoiceId(gender);

  const cleanText = sanitizeText(text);
  console.log('[chefVoice] synthesizeAudio — voice:', voiceId, '| gender:', gender);
  console.log('[chefVoice] API_KEY set?', !!API_KEY);
  console.log('[chefVoice] FULL TEXT:', cleanText);

  if (!API_KEY || !cleanText) {
    console.warn('[chefVoice] ❌ Skipping — API_KEY empty or text empty after sanitization');
    return null;
  }

  const cacheKey = makeCacheKey(cleanText, voiceId);
  const filePath = CACHE_DIR + cacheKey + '.mp3';

  try {
    await ensureCacheDir();

    const cached = await FileSystem.getInfoAsync(filePath);
    if (cached.exists) {
      console.log('[chefVoice] ✅ Cache hit');
      return filePath;
    }

    if (signal?.aborted) return null;

    console.log('[chefVoice] 📡 Calling ElevenLabs...');
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: MODEL_ID,
          language_code: _isHebrew ? 'he' : 'en', // force correct language
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.80,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
        signal,
      },
    );

    console.log('[chefVoice] API response status:', res.status);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn('[chefVoice] ❌ ElevenLabs error:', res.status, errBody);
      return null;
    }

    const buffer = await res.arrayBuffer();
    console.log('[chefVoice] ✅ Audio received, bytes:', buffer.byteLength);
    const base64 = arrayBufferToBase64(buffer);

    await FileSystem.writeAsStringAsync(filePath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('[chefVoice] ✅ Saved to cache');
    return filePath;
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    console.warn('[chefVoice] ❌ error:', err);
    return null;
  }
}

/**
 * Deletes all cached chef audio (call when changing voice or clearing data).
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
