import { formatScaled, parseNumericToken, scaleIngredientText, parseLeadingQty } from '../lib/scaling';

describe('formatScaled', () => {
  it('rounds to integer when close', () => {
    expect(formatScaled(2.02)).toBe('2');
    expect(formatScaled(1.97)).toBe('2');
    expect(formatScaled(3)).toBe('3');
  });
  it('shows one decimal for non-integers', () => {
    expect(formatScaled(1.5)).toBe('1.5');
    expect(formatScaled(2.3)).toBe('2.3');
  });
});

describe('parseNumericToken', () => {
  it('parses integers', () => expect(parseNumericToken('3')).toBe(3));
  it('parses decimals', () => expect(parseNumericToken('1.5')).toBe(1.5));
  it('parses comma-decimals', () => expect(parseNumericToken('1,5')).toBe(1.5));
  it('parses simple fractions', () => expect(parseNumericToken('1/2')).toBeCloseTo(0.5));
  it('parses mixed fractions', () => expect(parseNumericToken('1 1/2')).toBeCloseTo(1.5));
  it('parses unicode fractions', () => expect(parseNumericToken('½')).toBeCloseTo(0.5));
  it('parses mixed unicode fractions', () => expect(parseNumericToken('1½')).toBeCloseTo(1.5));
  it('returns null for empty string', () => expect(parseNumericToken('')).toBeNull());
  it('returns null for division by zero', () => expect(parseNumericToken('1/0')).toBeNull());
  it('returns null for non-numeric', () => expect(parseNumericToken('abc')).toBeNull());
});

describe('scaleIngredientText', () => {
  it('doubles a simple integer amount', () => {
    expect(scaleIngredientText('2 cups flour', 2)).toBe('4 cups flour');
  });
  it('halves a decimal amount', () => {
    expect(scaleIngredientText('200 grams butter', 0.5)).toBe('100 grams butter');
  });
  it('scales a fraction', () => {
    expect(scaleIngredientText('1/2 cup sugar', 2)).toBe('1 cup sugar');
  });
  it('scales a mixed fraction', () => {
    expect(scaleIngredientText('1 1/2 cups water', 2)).toBe('3 cups water');
  });
  it('scales unicode fraction', () => {
    expect(scaleIngredientText('¼ tsp salt', 4)).toBe('1 tsp salt');
  });
  it('leaves text-only ingredients unchanged', () => {
    expect(scaleIngredientText('salt to taste', 3)).toBe('salt to taste');
  });
  it('scales multiple numbers in one line', () => {
    expect(scaleIngredientText('2 eggs and 1 cup milk', 2)).toBe('4 eggs and 2 cup milk');
  });
});

describe('parseLeadingQty', () => {
  it('extracts leading integer', () => {
    const r = parseLeadingQty('2 cups flour');
    expect(r?.qtyStr).toBe('2');
    expect(r?.value).toBe(2);
    expect(r?.rest).toBe(' cups flour');
  });
  it('extracts leading fraction', () => {
    const r = parseLeadingQty('1/2 tsp salt');
    expect(r?.value).toBeCloseTo(0.5);
  });
  it('extracts leading mixed fraction', () => {
    const r = parseLeadingQty('1 1/2 cups water');
    expect(r?.value).toBeCloseTo(1.5);
    expect(r?.rest).toBe(' cups water');
  });
  it('returns null for text-only ingredient', () => {
    expect(parseLeadingQty('salt to taste')).toBeNull();
  });
});
