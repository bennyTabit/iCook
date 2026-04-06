// Extracted from RecipeDetailScreen for testability
export const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1/3, "⅔": 2/3,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

export function formatScaled(value: number): string {
  if (Math.abs(value - Math.round(value)) < 0.05) return String(Math.round(value));
  return value.toFixed(1).replace(/\.0$/, "");
}

export function parseNumericToken(token: string): number | null {
  const t = token.trim();
  if (!t) return null;
  if (UNICODE_FRACTIONS[t] != null) return UNICODE_FRACTIONS[t] ?? null;
  const mixedUnicode = t.match(/^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (mixedUnicode) return Number(mixedUnicode[1]) + (UNICODE_FRACTIONS[mixedUnicode[2] ?? ""] ?? 0);
  const mixedFraction = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFraction) {
    const den = Number(mixedFraction[3]);
    if (den === 0) return null;
    return Number(mixedFraction[1]) + Number(mixedFraction[2]) / den;
  }
  const fraction = t.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const den = Number(fraction[2]);
    if (den === 0) return null;
    return Number(fraction[1]) / den;
  }
  const decimal = Number(t.replace(",", "."));
  return Number.isNaN(decimal) ? null : decimal;
}

export function scaleIngredientText(text: string, factor: number): string {
  return text.replace(
    /\d+\s+\d+\/\d+|\d+[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?/g,
    (match) => {
      const n = parseNumericToken(match);
      if (n == null) return match;
      return formatScaled(n * factor);
    },
  );
}

export function parseLeadingQty(text: string): { qtyStr: string; value: number; rest: string } | null {
  const m = text.match(/^(\d+\s+\d+\/\d+|\d+[¼½¾⅓⅔⅛⅜⅝⅞]|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const qtyStr = m[0];
  const value = parseNumericToken(qtyStr);
  if (value == null || value <= 0) return null;
  return { qtyStr, value, rest: text.slice(qtyStr.length) };
}
