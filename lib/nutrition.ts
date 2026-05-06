const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

export type NutritionData = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  servings: number;
  prep_tip_he: string;
  prep_tip_en: string;
};

export type MacrosPerServing = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export function isNutritionConfigured(): boolean {
  return !!CLAUDE_API_KEY;
}

export function parseNutrition(json: string | null | undefined): NutritionData | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as Partial<NutritionData>;
    if (!d.calories || !d.servings) return null;
    return {
      calories: Number(d.calories) || 0,
      protein: Number(d.protein) || 0,
      carbs: Number(d.carbs) || 0,
      fat: Number(d.fat) || 0,
      fiber: Number(d.fiber) || 0,
      servings: Number(d.servings) || 1,
      prep_tip_he: d.prep_tip_he ?? '',
      prep_tip_en: d.prep_tip_en ?? '',
    };
  } catch {
    return null;
  }
}

export function perServing(n: NutritionData): MacrosPerServing {
  const s = Math.max(n.servings, 1);
  return {
    calories: Math.round(n.calories / s),
    protein: Math.round(n.protein / s),
    carbs: Math.round(n.carbs / s),
    fat: Math.round(n.fat / s),
    fiber: Math.round(n.fiber / s),
  };
}

export async function generateNutrition(recipe: {
  title_he: string;
  title_en?: string | null;
  notes_he?: string | null;
  servings?: number | null;
}): Promise<NutritionData | null> {
  if (!CLAUDE_API_KEY) return null;

  const title = recipe.title_en ?? recipe.title_he;
  const servings = recipe.servings ?? 4;
  const ingredients = extractIngredients(recipe.notes_he ?? '');

  const prompt = `You are a nutritionist. Estimate the nutritional content for this recipe.

Recipe: ${title}
Servings: ${servings}
Ingredients:
${ingredients || 'Not specified — use typical values for this dish'}

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "calories": <total kcal for ENTIRE recipe>,
  "protein": <total grams for entire recipe>,
  "carbs": <total grams for entire recipe>,
  "fat": <total grams for entire recipe>,
  "fiber": <total grams for entire recipe>,
  "servings": ${servings},
  "prep_tip_he": "<1-2 sentence meal prep tip in Hebrew>",
  "prep_tip_en": "<1-2 sentence meal prep tip in English>"
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json() as { content?: Array<{ type: string; text: string }> };
    const text = data.content?.find(b => b.type === 'text')?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return parseNutrition(jsonMatch[0]);
  } catch {
    return null;
  }
}

function extractIngredients(notes: string): string {
  if (!notes.trim()) return '';
  const lines = notes.split('\n').map(l => l.trim()).filter(Boolean);
  const markers = ['מרכיבים', 'ingredients'];
  const stopMarkers = ['שלבים', 'steps', 'הוראות', 'הערות', 'notes'];
  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    const norm = line.toLowerCase().replace(/[:：]/g, '').trim();
    if (markers.some(m => norm.includes(m))) { inSection = true; continue; }
    if (inSection && stopMarkers.some(m => norm.includes(m))) break;
    if (!inSection) continue;
    out.push(line.replace(/^([-*•]\s*|\d+[.)]\s*)/, '').trim());
  }
  return out.filter(Boolean).slice(0, 30).join('\n');
}
