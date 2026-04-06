// Mock fetch globally
global.fetch = jest.fn();

describe('importFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws on invalid URL', async () => {
    const { importFromUrl } = require('../lib/importer');
    await expect(importFromUrl('not-a-url')).rejects.toThrow();
  });

  it('throws HTTP error message when site returns non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '',
      url: 'https://example.com/recipe',
    });
    const { importFromUrl } = require('../lib/importer');
    await expect(importFromUrl('https://example.com/recipe')).rejects.toThrow('HTTP 403');
  });

  it('throws BLOCKED when response redirected to googleads', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://googleads.g.doubleclick.net/something',
      text: async () => '<html></html>',
    });
    const { importFromUrl } = require('../lib/importer');
    await expect(importFromUrl('https://example.com/recipe')).rejects.toThrow('BLOCKED');
  });

  it('parses JSON-LD Recipe schema', async () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {"@type":"Recipe","name":"Test Pasta","recipeIngredient":["200g pasta","1 clove garlic"],
      "recipeInstructions":[{"@type":"HowToStep","text":"Boil water"},{"@type":"HowToStep","text":"Cook pasta"}],
      "totalTime":"PT30M","recipeYield":"2"}
      </script>
      </head></html>
    `;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/recipe',
      text: async () => html,
    });
    const { importFromUrl } = require('../lib/importer');
    const result = await importFromUrl('https://example.com/recipe');
    expect(result.title).toBe('Test Pasta');
    expect(result.ingredients).toContain('200g pasta');
    expect(result.steps).toContain('Boil water');
    expect(result.parseMethod).toBe('json-ld');
  });

  it('returns servings parsed from recipeYield', async () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {"@type":"Recipe","name":"Soup","recipeIngredient":["water"],
      "recipeInstructions":["Boil"],"recipeYield":"4 servings"}
      </script>
      </head></html>
    `;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/soup',
      text: async () => html,
    });
    const { importFromUrl } = require('../lib/importer');
    const result = await importFromUrl('https://example.com/soup');
    expect(result.servings).toBe(4);
  });

  it('falls back gracefully when no JSON-LD and no recognizable structure', async () => {
    const html = `<html><head><title>My Recipe</title></head><body><p>Hello</p></body></html>`;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      url: 'https://example.com/recipe',
      text: async () => html,
    });
    const { importFromUrl } = require('../lib/importer');
    const result = await importFromUrl('https://example.com/recipe');
    expect(result.parseMethod).toBe('fallback');
    expect(result.title).toBe('My Recipe');
  });
});
