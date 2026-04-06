/**
 * Parse natural-language search queries into structured filter intent.
 * Examples:
 *   "עוף ללא חלב" → { query: "עוף", dietary: "dairy-free" }
 *   "pasta quick"  → { query: "pasta", maxCookTime: 20 }
 *   "easy salad"   → { query: "salad", difficulty: "easy" }
 */

export interface SearchIntent {
  query: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  maxCookTime?: number;
  dietaryHint?: string; // a hint shown to user — actual filtering is manual
}

const QUICK_PATTERNS = [
  /\b(מהיר|quick|fast|under\s*\d+\s*min|עד\s*\d+\s*דק)/i,
];

const DIFFICULTY_PATTERNS: { pattern: RegExp; difficulty: 'easy' | 'medium' | 'hard' }[] = [
  { pattern: /\b(קל|קלה|easy|simple|simple)\b/i, difficulty: 'easy' },
  { pattern: /\b(בינוני|בינונית|medium)\b/i, difficulty: 'medium' },
  { pattern: /\b(קשה|hard|difficult|advanced)\b/i, difficulty: 'hard' },
];

const DAIRY_FREE_PATTERNS = [/\b(ללא חלב|parve|פרווה|dairy.free|no dairy)\b/i];
const GLUTEN_FREE_PATTERNS = [/\b(ללא גלוטן|gluten.free)\b/i];
const VEGAN_PATTERNS = [/\b(טבעוני|vegan)\b/i];

const TIME_PATTERNS = [/עד\s*(\d+)\s*דק/i, /under\s*(\d+)\s*min/i, /(\d+)\s*minute/i];

export function parseSearchIntent(raw: string): SearchIntent {
  let query = raw.trim();
  const intent: SearchIntent = { query };

  // Extract cook time
  for (const p of TIME_PATTERNS) {
    const m = query.match(p);
    if (m) {
      intent.maxCookTime = parseInt(m[1], 10);
      query = query.replace(m[0], '').trim();
      break;
    }
  }

  // Quick flag (no explicit time — default 20 min)
  if (!intent.maxCookTime) {
    for (const p of QUICK_PATTERNS) {
      if (p.test(query)) {
        intent.maxCookTime = 20;
        query = query.replace(p, '').trim();
        break;
      }
    }
  }

  // Difficulty
  for (const { pattern, difficulty } of DIFFICULTY_PATTERNS) {
    if (pattern.test(query)) {
      intent.difficulty = difficulty;
      query = query.replace(pattern, '').trim();
      break;
    }
  }

  // Dietary hints
  for (const p of DAIRY_FREE_PATTERNS) {
    if (p.test(query)) { intent.dietaryHint = 'dairy-free'; query = query.replace(p, '').trim(); break; }
  }
  for (const p of GLUTEN_FREE_PATTERNS) {
    if (p.test(query)) { intent.dietaryHint = 'gluten-free'; query = query.replace(p, '').trim(); break; }
  }
  for (const p of VEGAN_PATTERNS) {
    if (p.test(query)) { intent.dietaryHint = 'vegan'; query = query.replace(p, '').trim(); break; }
  }

  // Clean up extra whitespace/punctuation
  intent.query = query.replace(/\s+/g, ' ').trim();
  return intent;
}
