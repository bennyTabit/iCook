/**
 * chefAI.ts
 * Uses Claude API to generate warm, natural chef narrations for each recipe step.
 *
 * ⚠️  SECURITY NOTE: EXPO_PUBLIC_ keys are bundled into the client.
 *     For production, proxy these calls through a backend (Firebase Function, etc.)
 */

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export interface ChefScript {
  intro: string;
  steps: string[];
  outro: string;
}

/**
 * Generates a full chef script (intro + per-step narrations + outro)
 * from raw recipe step text using Claude.
 *
 * Returns null if the API key is missing or the call fails —
 * callers should fall back to raw step text in that case.
 */
export async function generateChefScript(
  recipeName: string,
  rawSteps: string[],
  isHe: boolean,
  signal?: AbortSignal,
): Promise<ChefScript | null> {
  if (!CLAUDE_API_KEY) return null;

  const lang = isHe ? 'Hebrew' : 'English';
  const chefName = isHe ? 'אביב' : 'Aviv';
  const stepsText = rawSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `You are ${chefName}, a warm and encouraging home chef narrating a cooking session.

Recipe: "${recipeName}"
Steps to narrate:
${stepsText}

Respond with ONLY valid JSON — no markdown, no extra text:
{
  "intro": "...",
  "steps": ["narration for step 1", "narration for step 2", ...],
  "outro": "..."
}

Rules:
- Language: ${lang} ONLY. Every single word must be in ${lang}. NEVER mix in characters from other languages (no Korean, Japanese, Chinese, Arabic, or any other script).
- intro: Greet warmly, say the recipe name, mention how many steps. Max 25 words.
- steps: Narrate EACH step naturally. Add 1 practical tip or encouragement when it fits. Max 35 words per step. Sound like a knowledgeable friend, not a recipe book.
- outro: Congratulate and wish them enjoyment. Max 18 words.
- Return exactly ${rawSteps.length} step narrations in the array.
- No lists, no markdown — pure natural spoken sentences.
- CRITICAL: Output ONLY ${lang} characters. No foreign scripts whatsoever.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        // Acknowledges client-side key usage — replace with backend proxy in production
        'anthropic-dangerous-client-side-keys': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
    });

    if (!res.ok) {
      console.warn('[chefAI] API error:', res.status);
      return null;
    }

    const data = await res.json() as { content: Array<{ text: string }> };
    const raw = data.content?.[0]?.text ?? '';
    console.log('[chefAI] Raw response:', raw.slice(0, 300));

    // Extract JSON even if Claude wraps it in text
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn('[chefAI] No JSON found in response');
      return null;
    }

    const parsed = JSON.parse(match[0]) as ChefScript;

    if (
      typeof parsed.intro !== 'string' ||
      !Array.isArray(parsed.steps) ||
      typeof parsed.outro !== 'string'
    ) {
      console.warn('[chefAI] Invalid response structure');
      return null;
    }

    // Ensure we have the right number of steps (pad with raw if needed)
    while (parsed.steps.length < rawSteps.length) {
      parsed.steps.push(rawSteps[parsed.steps.length] ?? '');
    }
    parsed.steps = parsed.steps.slice(0, rawSteps.length);

    return parsed;
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    console.warn('[chefAI] error:', err);
    return null;
  }
}

export function isClaudeConfigured(): boolean {
  return !!CLAUDE_API_KEY;
}
