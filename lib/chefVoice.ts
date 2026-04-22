/**
 * chefVoice.ts
 * Hybrid TTS engine:
 *   Hebrew  → Google Cloud TTS (he-IL WaveNet) — reliable, correct pronunciation
 *   English → ElevenLabs (custom voices)        — warm, human quality
 *
 * All audio cached locally — zero API calls on replay.
 */

import * as FileSystem from 'expo-file-system/legacy';

// ── ElevenLabs (English) ──────────────────────────────────────────────────────
const EL_API_KEY  = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
const EL_MODEL    = 'eleven_multilingual_v2';

export type ChefGender = 'female' | 'male';

export const VOICE_FEMALE = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_FEMALE ?? '21m00Tcm4TlvDq8ikWAM';
export const VOICE_MALE   = process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_MALE   ?? 'TxGEqnHWrfWFTfGW9XjX';

export function getVoiceId(gender: ChefGender): string {
  return gender === 'male' ? VOICE_MALE : VOICE_FEMALE;
}

// ── Google Cloud TTS (Hebrew) ─────────────────────────────────────────────────
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_TTS_API_KEY
  ?? process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY
  ?? '';

const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

// Best Hebrew WaveNet voices
const HE_VOICES: Record<ChefGender, { name: string; ssmlGender: string }> = {
  female: { name: 'he-IL-Wavenet-A', ssmlGender: 'FEMALE' },
  male:   { name: 'he-IL-Wavenet-B', ssmlGender: 'MALE'   },
};

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_DIR = (FileSystem.documentDirectory ?? '') + 'chef_audio/';

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

function makeCacheKey(text: string, voiceId: string): string {
  const slug = text.trim().slice(0, 40).replace(/[^a-zA-Z0-9א-ת]/g, '_');
  const hash = text.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
  return `${slug}_${voiceId.slice(0, 8)}_${hash}`;
}

// ── Text sanitizer ────────────────────────────────────────────────────────────
function sanitizeText(text: string): string {
  return text
    .replace(/[^\u0590-\u05FF\u0020-\u007E\s]/g, '') // keep Hebrew + Latin only
    .replace(/\s+/g, ' ')
    .trim();
}

// ── ArrayBuffer → base64 ──────────────────────────────────────────────────────
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// ── Hebrew synthesis via Google Cloud TTS ────────────────────────────────────
async function synthesizeHebrew(
  text: string,
  gender: ChefGender,
  filePath: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('[chefVoice] ❌ No Google API key for Hebrew TTS');
    return null;
  }

  const voice = HE_VOICES[gender];
  console.log('[chefVoice] 🇮🇱 Google TTS — voice:', voice.name);

  const res = await fetch(`${GOOGLE_TTS_URL}?key=${GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'he-IL', name: voice.name, ssmlGender: voice.ssmlGender },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.90,
        pitch: 0.0,
        volumeGainDb: 2.0,
      },
    }),
    signal,
  });

  console.log('[chefVoice] Google TTS status:', res.status);

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.warn('[chefVoice] ❌ Google TTS error:', res.status, err);
    return null;
  }

  const data = await res.json() as { audioContent: string };
  if (!data.audioContent) { console.warn('[chefVoice] ❌ No audioContent'); return null; }

  await FileSystem.writeAsStringAsync(filePath, data.audioContent, {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log('[chefVoice] ✅ Hebrew audio saved');
  return filePath;
}

// ── English synthesis via ElevenLabs ─────────────────────────────────────────
async function synthesizeEnglish(
  text: string,
  gender: ChefGender,
  filePath: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!EL_API_KEY) {
    console.warn('[chefVoice] ❌ No ElevenLabs key for English TTS');
    return null;
  }

  const voiceId = getVoiceId(gender);
  console.log('[chefVoice] 🇺🇸 ElevenLabs — voice:', voiceId);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': EL_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: EL_MODEL,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.80,
        style: 0.25,
        use_speaker_boost: true,
      },
    }),
    signal,
  });

  console.log('[chefVoice] ElevenLabs status:', res.status);

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.warn('[chefVoice] ❌ ElevenLabs error:', res.status, err);
    return null;
  }

  const buffer = await res.arrayBuffer();
  console.log('[chefVoice] ✅ English audio received, bytes:', buffer.byteLength);

  await FileSystem.writeAsStringAsync(filePath, arrayBufferToBase64(buffer), {
    encoding: FileSystem.EncodingType.Base64,
  });

  console.log('[chefVoice] ✅ English audio saved');
  return filePath;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synthesizes text to audio and caches it locally.
 * Routes Hebrew → Google Cloud TTS, English → ElevenLabs.
 */
export async function synthesizeAudio(
  text: string,
  gender: ChefGender = 'female',
  isHebrew: boolean = false,
  signal?: AbortSignal,
): Promise<string | null> {
  const cleanText = sanitizeText(text);
  if (!cleanText) return null;

  const cacheVoiceKey = isHebrew ? HE_VOICES[gender].name : getVoiceId(gender);
  const cacheKey = makeCacheKey(cleanText, cacheVoiceKey);
  const filePath = CACHE_DIR + cacheKey + '.mp3';

  try {
    await ensureCacheDir();

    const cached = await FileSystem.getInfoAsync(filePath);
    if (cached.exists) {
      console.log('[chefVoice] ✅ Cache hit');
      return filePath;
    }

    if (signal?.aborted) return null;

    if (isHebrew) {
      return await synthesizeHebrew(cleanText, gender, filePath, signal);
    } else {
      return await synthesizeEnglish(cleanText, gender, filePath, signal);
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    console.warn('[chefVoice] ❌ error:', err);
    return null;
  }
}

export async function clearChefAudioCache(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (info.exists) await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  } catch (err) {
    console.warn('[chefVoice] clearCache error:', err);
  }
}

export function isElevenLabsConfigured(): boolean {
  return !!EL_API_KEY || !!GOOGLE_API_KEY;
}
