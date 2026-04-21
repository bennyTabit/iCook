/**
 * chefAI.ts
 * Uses Claude API to generate warm, natural chef narrations for each recipe step.
 * Language is always forced to match the app's current UI language (he/en).
 * Ingredients with quantities are passed so Claude embeds exact amounts in narrations.
 */

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export interface ChefScript {
  ingredientIntro: string; // chef reads the ingredient list before cooking
  intro: string;           // welcome + recipe name + step count
  steps: string[];         // per-step narration with quantities
  outro: string;           // congratulations at the end
}

export async function generateChefScript(
  recipeName: string,
  rawSteps: string[],
  ingredients: string[],
  isHe: boolean,
  signal?: AbortSignal,
): Promise<ChefScript | null> {
  if (!CLAUDE_API_KEY) return null;

  const chefName     = isHe ? 'אביב' : 'Aviv';
  const stepsText    = rawSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const ingList      = ingredients.length > 0 ? ingredients.join('\n') : '';

  const systemPrompt = isHe
    ? `אתה ${chefName}, שף ביתי חם שמנחה בישול. אתה מדבר אך ורק בעברית. אסור בהחלט לשלב מילים, אותיות או תווים משפות אחרות — לא אנגלית, לא קוריאנית, לא יפנית ולא כל שפה אחרת. עברית בלבד, בכל מילה ובכל משפט.`
    : `You are ${chefName}, a warm home chef guiding someone through cooking. You speak ONLY in English. Never mix in words, letters, or characters from any other language. English only, in every word and sentence.`;

  const ingredientsSection = ingList
    ? `\nIngredients with exact quantities:\n${ingList}\n`
    : '';

  const userPrompt = `Recipe: "${recipeName}"
${ingredientsSection}
Steps:
${stepsText}

Respond with ONLY valid JSON — no markdown, no code fences:
{
  "ingredientIntro": "...",
  "intro": "...",
  "steps": ["...", ...],
  "outro": "..."
}

Rules:
- ingredientIntro: Warm sentence like "Before we start, let's make sure we have everything ready!" then read EVERY ingredient with its exact quantity naturally, one by one. Max 80 words. Sound like a friendly chef doing a prep check, not reading a list robotically.
- intro: Greet warmly, say the recipe name, say how many steps. Max 20 words.
- steps: Narrate EACH step. ALWAYS say the EXACT quantity when an ingredient is used — "add 3 tablespoons of butter" not "add butter". Add 1 tip or encouragement. Max 40 words per step.
- outro: Congratulate warmly. Max 15 words.
- Return exactly ${rawSteps.length} step narrations.
- Pure natural spoken sentences only — no lists, no markdown, no bullet points.`;

  try {
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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal,
    });

    if (!res.ok) {
      console.warn('[chefAI] API error:', res.status);
      return null;
    }

    const data = await res.json() as { content: Array<{ text: string }> };
    const raw  = data.content?.[0]?.text ?? '';
    console.log('[chefAI] Raw response (first 300):', raw.slice(0, 300));

    const stripped = raw.replace(/```(?:json)?/gi, '').trim();
    const match    = stripped.match(/\{[\s\S]*\}/);
    if (!match) { console.warn('[chefAI] No JSON found'); return null; }

    const parsed = JSON.parse(match[0]) as ChefScript;

    if (
      typeof parsed.ingredientIntro !== 'string' ||
      typeof parsed.intro !== 'string' ||
      !Array.isArray(parsed.steps) ||
      typeof parsed.outro !== 'string'
    ) {
      console.warn('[chefAI] Invalid structure');
      return null;
    }

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
