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

  const chefName  = isHe ? 'אביב' : 'Aviv';
  const stepsText = rawSteps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const ingList   = ingredients.length > 0 ? ingredients.join('\n') : '';

  const systemPrompt = isHe
    ? `אתה ${chefName}, שף ביתי חם שמדריך בבישול. אתה מדבר אך ורק בעברית תקנית ונכונה.

חוקים מחייבים:
- השתמש אך ורק במילים עבריות שקיימות במילון — אל תמציא מילים או צורות פועל שאינן קיימות.
- אם אינך בטוח בצורה הנכונה של מילה — בחר מילה פשוטה יותר שאתה בטוח בה.
- ללא אנגלית, ללא קוריאנית, ללא שום שפה זרה — עברית בלבד בכל מילה.
- כמויות: "שתי כפות שמן זית", "מאה גרם חמאה", "חצי כוס קמח" — מילים ולא ספרות.
- פעלים בצורות פשוטות ונפוצות — לא צורות נדירות או מגומגמות.
- גוף ראשון רבים "אנחנו מוסיפים" או ציווי ישיר "הוסיפו", "ערבבו".
- שפה חמה, ברורה ויומיומית של המטבח הביתי — לא ספרותית ולא רשמית מדי.

פעלי בישול נפוצים — השתמש בדיוק בצורות אלו:
מוסיפים, מערבבים, מחממים, מקררים, מכבים (את התנור/האש), מדליקים, מטגנים, אופים, מבשלים, קוצצים, פורסים, מתבלים, שופכים, מסננים, מגרדים, מרדדים, מקפלים, מוזגים, מפזרים, מכסים, חושפים, מסירים.`
    : `You are ${chefName}, a warm home chef guiding someone through cooking. You speak ONLY in English — no mixing of other languages. Use clear, natural spoken language as if talking to a friend in the kitchen. Be warm, encouraging, and precise with measurements.`;

  const ingredientsSection = ingList
    ? `\nIngredients with exact quantities:\n${ingList}\n`
    : '';

  const userPrompt = isHe
    ? `מתכון: "${recipeName}"
${ingredientsSection}
שלבים:
${stepsText}

החזר JSON תקני בלבד — ללא markdown, ללא גרשיים כפולים בתוך ערכים:
{
  "ingredientIntro": "...",
  "intro": "...",
  "steps": ["...", ...],
  "outro": "..."
}

כללים:
- ingredientIntro: משפט פתיחה חם כמו "לפני שנתחיל, בואו נוודא שיש לנו הכל מוכן!" ואז קרא כל מרכיב עם הכמות המדויקת שלו בצורה טבעית. מקסימום 80 מילים.
- intro: ברכה חמה, שם המתכון, כמה שלבים. מקסימום 20 מילים.
- steps: לכל שלב — תאר מה עושים, תמיד ציין את הכמות המדויקת של כל מרכיב שמשתמשים בו. הוסף טיפ קצר או עידוד. מקסימום 40 מילים לשלב.
- outro: ברכות חמות בסיום. מקסימום 15 מילים.
- החזר בדיוק ${rawSteps.length} נרציות לשלבים.
- משפטים טבעיים לדיבור בלבד — ללא רשימות, ללא נקודות.`
    : `Recipe: "${recipeName}"
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
- ingredientIntro: Warm sentence like "Before we start, let's make sure we have everything ready!" then read EVERY ingredient with its exact quantity naturally, one by one. Max 80 words.
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
        model: 'claude-sonnet-4-5',
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
