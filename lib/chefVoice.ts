/**
 * chefVoice.ts
 * Converts chef narration text to real human voice audio using Google Cloud TTS.
 * Caches generated audio to expo-file-system so each step is only generated once.
 *
 * Uses the same Google Cloud project as Vision API — just enable Cloud TTS API
 * in Google Cloud Console (no extra key needed).
 */

import * as FileSystem from 'expo-file-system/legacy';

// Same GCP project as Vision API — reuse that key
const API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_TTS_API_KEY ??
  process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY ??
  '';

const TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export type ChefGender = 'female' | 'male';

// ── Voice selection ───────────────────────────────────────────────────────────
// WaveNet = highest quality neural voices available on free tier

interface VoiceConfig {
  languageCode: string;
  name: string;
  ssmlGender: 'MALE' | 'FEMALE';
}

const VOICES: Record<'he' | 'en', Record<ChefGender, VoiceConfig>> = {
  he: {
    female: { languageCode: 'he-IL', name: 'he-IL-Wavenet-A', ssmlGender: 'FEMALE' },
    male:   { languageCode: 'he-IL', name: 'he-IL-Wavenet-B', ssmlGender: 'MALE'   },
  },
  en: {
    female: { languageCode: 'en-US', name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' },
    male:   { languageCode: 'en-US', name: 'en-US-Wavenet-D', ssmlGender: 'MALE'   },
  },
};

const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'chef_audio/';

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function makeCacheKey(text: string, voiceName: string): string {
  const slug = text.trim().slice(0, 40).replace(/[^a-zA-Z0-9א-ת]/g, '_');
  const hash = text.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
  return `${slug}_${voiceName.replace(/-/g, '_')}_${hash}`;
}

// ── Main synthesis function ───────────────────────────────────────────────────

/**
 * Converts text to speech using Google Cloud TTS and caches the result.
 * Returns a local file URI (playable with expo-av) or null on failure.
 */
export async function synthesizeAudio(
  text: string,
  gender: ChefGender = 'female',
  isHebrew: boolean = true,
  signal?: AbortSignal,
): Promise<string | null> {
  const lang = isHebrew ? 'he' : 'en';
  const voice = VOICES[lang][gender];

  console.log('[chefVoice] synthesizeAudio — voice:', voice.name);
  console.log('[chefVoice] API_KEY set?', !!API_KEY);
  console.log('[chefVoice] text (first 60):', text.slice(0, 60));

  if (!API_KEY || !text.trim()) {
    console.warn('[chefVoice] ❌ Skipping — API_KEY empty or text empty');
    return null;
  }

  const cacheKey = makeCacheKey(text, voice.name);
  const filePath = CACHE_DIR + cacheKey + '.mp3';

  try {
    await ensureCacheDir();

    const cached = await FileSystem.getInfoAsync(filePath);
    if (cached.exists) {
      console.log('[chefVoice] ✅ Cache hit');
      return filePath;
    }

    if (signal?.aborted) return null;

    console.log('[chefVoice] 📡 Calling Google Cloud TTS...');
    const res = await fetch(`${TTS_URL}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice,
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 0.92,   // slightly slower = clearer for cooking instructions
          pitch: 0.0,
          volumeGainDb: 2.0,    // a bit louder in kitchen noise
        },
      }),
      signal,
    });

    console.log('[chefVoice] API response status:', res.status);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.warn('[chefVoice] ❌ Google TTS error:', res.status, errBody);
      return null;
    }

    // Google returns base64 directly — no arrayBuffer conversion needed!
    const data = await res.json() as { audioContent: string };
    if (!data.audioContent) {
      console.warn('[chefVoice] ❌ No audioContent in response');
      return null;
    }

    await FileSystem.writeAsStringAsync(filePath, data.audioContent, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('[chefVoice] ✅ Saved to:', filePath);
    return filePath;
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    console.warn('[chefVoice] ❌ error:', err);
    return null;
  }
}

/**
 * Deletes all cached chef audio (call when clearing data or changing voice).
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
  // Now using Google TTS — keep same function name so no breaking changes
  return !!API_KEY;
}
