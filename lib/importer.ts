export type ImportedRecipe = {
  title: string;
  description?: string;
  ingredients: string[];
  steps: string[];
  imageUrl?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  sourceUrl: string;
  sourceName: string;
  parseMethod: "json-ld" | "scrape" | "fallback";
};

export async function importFromUrl(url: string): Promise<ImportedRecipe> {
  validateUrl(url);

  const html = await fetchHtml(url);
  const sourceName = extractDomain(url);

  const jsonLd = tryJsonLd(html);
  if (jsonLd)
    return { ...jsonLd, sourceUrl: url, sourceName, parseMethod: "json-ld" };

  const scraped = tryScrape(html);
  if (scraped.ingredients.length > 0)
    return { ...scraped, sourceUrl: url, sourceName, parseMethod: "scrape" };

  return {
    title: extractTitle(html) ?? url,
    ingredients: [],
    steps: [],
    imageUrl: extractOgImage(html),
    sourceUrl: url,
    sourceName,
    parseMethod: "fallback",
  };
}

function validateUrl(url: string) {
  try {
    new URL(url);
  } catch {
    throw new Error("כתובת URL לא תקינה / Invalid URL");
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  if (
    res.url.includes("googleads.g.doubleclick.net") ||
    /NO_DATA/i.test(html)
  ) {
    throw new Error(
      "Source blocked automated fetch. Try another URL or use Scan OCR.",
    );
  }
  return html;
}

function tryJsonLd(
  html: string,
): Omit<ImportedRecipe, "sourceUrl" | "sourceName" | "parseMethod"> | null {
  const matches = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const match of matches) {
    try {
      const json = JSON.parse(match[1]);
      const recipes = findRecipeNodes(Array.isArray(json) ? json : [json]);

      for (const node of recipes) {
        if (node["@type"] !== "Recipe") continue;

        return {
          title: node.name ?? "",
          description: node.description ?? "",
          ingredients: normalizeArray(node.recipeIngredient),
          steps: normalizeSteps(node.recipeInstructions),
          imageUrl: extractImage(node.image),
          prepTime: parseDuration(node.prepTime),
          cookTime: parseDuration(node.cookTime),
          servings: parseServings(node.recipeYield),
        };
      }
    } catch {
      /* malformed JSON-LD, try next */
    }
  }
  return null;
}

function findRecipeNodes(nodes: any[]): any[] {
  const result: any[] = [];
  for (const node of nodes) {
    if (!node) continue;
    if (node["@type"] === "Recipe") result.push(node);
    if (node["@graph"]) result.push(...findRecipeNodes(node["@graph"]));
  }
  return result;
}

function normalizeArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val))
    return val.map((v) =>
      typeof v === "string" ? v : (v.text ?? v.name ?? ""),
    );
  if (typeof val === "string") return val.split("\n").filter(Boolean);
  return [];
}

function normalizeSteps(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((s) => {
        if (typeof s === "string") return s;
        if (s["@type"] === "HowToStep") return s.text ?? "";
        if (s["@type"] === "HowToSection")
          return normalizeSteps(s.itemListElement).join(" ");
        return s.text ?? "";
      })
      .filter(Boolean);
  }
  if (typeof val === "string") return val.split("\n").filter(Boolean);
  return [];
}

function extractImage(img: any): string | undefined {
  if (!img) return undefined;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return extractImage(img[0]);
  return img.url ?? img["@id"];
}

// ISO 8601 duration: PT1H30M → 90 min, also handles P0DT30M (with day prefix)
function parseDuration(iso?: string): number | undefined {
  if (!iso) return undefined;
  const d = iso.match(/(\d+)D/)?.[1] ?? "0";
  const h = iso.match(/(\d+)H/)?.[1] ?? "0";
  const m = iso.match(/(\d+)M/)?.[1] ?? "0";
  return parseInt(d) * 24 * 60 + parseInt(h) * 60 + parseInt(m) || undefined;
}

function parseServings(val: any): number | undefined {
  if (!val) return undefined;
  const n = parseInt(Array.isArray(val) ? val[0] : val);
  return isNaN(n) ? undefined : n;
}

function tryScrape(
  html: string,
): Omit<ImportedRecipe, "sourceUrl" | "sourceName" | "parseMethod"> {
  return {
    title: extractTitle(html) ?? "",
    description: extractMeta(html, "description"),
    ingredients: scrapeIngredients(html),
    steps: scrapeSteps(html),
    imageUrl: extractOgImage(html),
  };
}

function extractTitle(html: string): string | undefined {
  return (
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim()
  );
}

function extractMeta(html: string, name: string): string | undefined {
  return html.match(
    new RegExp(
      `<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ),
  )?.[1];
}

function extractOgImage(html: string): string | undefined {
  return html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  )?.[1];
}

function scrapeIngredients(html: string): string[] {
  const byClass = extractItemsByClass(
    html,
    /(ingredient|wprm-recipe-ingredient|recipe-ingredient)/i,
  );
  if (byClass.length) return byClass;

  const ingSection =
    html.match(
      /(?:ingredients?|recipe ingredients|מרכיבים|רכיבים)[^]*?(<ul[^>]*>[\s\S]*?<\/ul>)/i,
    )?.[1] ?? "";
  const items = extractListItems(ingSection);
  if (items.length) return items;

  return extractParagraphLinesNearHeading(
    html,
    /(?:ingredients?|recipe ingredients|מרכיבים|רכיבים)/i,
  );
}

function scrapeSteps(html: string): string[] {
  const byClass = extractItemsByClass(
    html,
    /(instruction|step|direction|method|wprm-recipe-instruction)/i,
  );
  if (byClass.length) return byClass;

  const stepsSection =
    html.match(
      /(?:instructions?|directions?|method|how to|הכנה|אופן הכנה|שלבים?)[^]*?(<ol[^>]*>[\s\S]*?<\/ol>)/i,
    )?.[1] ?? "";
  const items = extractListItems(stepsSection);
  if (items.length) return items;

  return extractParagraphLinesNearHeading(
    html,
    /(?:instructions?|directions?|method|how to|הכנה|אופן הכנה|שלבים?)/i,
  );
}

function extractListItems(html: string): string[] {
  return [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
}

function extractItemsByClass(html: string, classRegex: RegExp): string[] {
  const out: string[] = [];
  const matches = [
    ...html.matchAll(/<li[^>]*class=["']([^"']+)["'][^>]*>([\s\S]*?)<\/li>/gi),
  ];
  for (const m of matches) {
    const classes = m[1] ?? "";
    if (!classRegex.test(classes)) continue;
    const text = m[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) out.push(text);
  }
  return dedupe(out);
}

function extractParagraphLinesNearHeading(
  html: string,
  headingRegex: RegExp,
): string[] {
  const headingMatch = html.match(
    new RegExp(
      `(<h[1-6][^>]*>[^<]*${headingRegex.source}[^<]*<\\/h[1-6]>)`,
      "i",
    ),
  );
  if (!headingMatch || headingMatch.index == null) return [];

  const tail = html.slice(headingMatch.index, headingMatch.index + 5000);
  const lines = [...tail.matchAll(/<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/gi)]
    .map((m) =>
      m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .filter((line) => line.length > 2 && line.length < 220);

  return dedupe(lines.slice(0, 15));
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}
