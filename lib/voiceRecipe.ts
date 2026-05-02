/**
 * voiceRecipe.ts
 * Two-step voice-to-recipe pipeline:
 *  1. OpenAI Whisper: audio file → transcript
 *  2. Claude Haiku: transcript → structured recipe JSON
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export interface VoiceRecipeResult {
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  servings?: number;
  prep_time_min?: number;
  cook_time_min?: number;
}

export function isWhisperConfigured(): boolean {
  return !!OPENAI_API_KEY;
}

export function isVoiceConfigured(): boolean {
  return !!OPENAI_API_KEY && !!CLAUDE_API_KEY;
}

/**
 * Upload an audio file to OpenAI Whisper and get back a transcript.
 * @param uri  Local file URI (e.g. file:///…/recording.m4a)
 * @param language  BCP-47 language hint — improves accuracy for non-English
 */
export async function transcribeAudio(
  uri: string,
  language: 'he' | 'en' = 'he',
): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  // React Native FormData expects the file as a plain object with uri/name/type
  const form = new FormData();
  form.append('file', { uri, name: 'recording.m4a', type: 'audio/m4a' } as unknown as Blob);
  form.append('model', 'whisper-1');
  form.append('language', language);
  form.append('response_format', 'json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Whisper ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as { text: string };
  return (data.text ?? '').trim();
}

/**
 * Send a transcript to Claude Haiku and get back a structured recipe object.
 */
export async function structureRecipe(
  transcript: string,
  isHe: boolean,
): Promise<VoiceRecipeResult> {
  if (!CLAUDE_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const systemPrompt = isHe
    ? `אתה עוזר בישול שמחלץ מתכונים מתמלילים קוליים בעברית.
החזר JSON תקני בלבד — ללא markdown, ללא גרשיים בתוך ערכים.
מבנה ה-JSON הנדרש:
{
  "title": "שם המתכון",
  "description": "תיאור קצר",
  "ingredients": ["מרכיב 1 עם כמות", "מרכיב 2 עם כמות"],
  "steps": ["שלב 1", "שלב 2"],
  "servings": 4,
  "prep_time_min": 15,
  "cook_time_min": 30
}
אם ערך לא ברור — השמט אותו. ingredients ו-steps חובה.`
    : `You are a cooking assistant that extracts structured recipes from voice transcripts.
Return ONLY valid JSON — no markdown, no code fences.
Required JSON structure:
{
  "title": "Recipe name",
  "description": "Short description",
  "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "steps": ["step 1", "step 2"],
  "servings": 4,
  "prep_time_min": 15,
  "cook_time_min": 30
}
Omit fields that are unclear. ingredients and steps are required.`;

  const userPrompt = isHe
    ? `תמליל: "${transcript}"\n\nחלץ את המתכון מהתמליל הזה.`
    : `Transcript: "${transcript}"\n\nExtract the recipe from this transcript.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-client-side-keys': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude ${res.status}: ${await res.text().catch(() => '').then(t => t.slice(0, 100))}`);
  }

  const data = (await res.json()) as { content: Array<{ text: string }> };
  const raw = data.content?.[0]?.text ?? '';

  // Strip any accidental markdown fences
  const stripped = raw.replace(/```(?:json)?/gi, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in Claude response');

  // Multi-strategy parse — tolerate trailing commas
  let parsed: VoiceRecipeResult | null = null;
  for (const candidate of [match[0], match[0].replace(/,\s*([}\]])/g, '$1')]) {
    try {
      parsed = JSON.parse(candidate) as VoiceRecipeResult;
      break;
    } catch {
      // try next candidate
    }
  }
  if (!parsed) throw new Error('Failed to parse Claude JSON response');

  // Normalise — ensure required fields exist
  if (!Array.isArray(parsed.ingredients)) parsed.ingredients = [];
  if (!Array.isArray(parsed.steps)) parsed.steps = [];
  if (!parsed.title?.trim()) parsed.title = isHe ? 'מתכון חדש' : 'New Recipe';
  if (!parsed.description) parsed.description = '';

  return parsed;
}
