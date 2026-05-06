import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { structureRecipe } from "./voiceRecipe";

export type OcrResult = {
  rawText: string;
  title: string;
  ingredients: string[];
  steps: string[];
  confidence: "high" | "medium" | "low";
};

export async function requestMediaPermissions(): Promise<boolean> {
  const cam = await ImagePicker.requestCameraPermissionsAsync();
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return cam.granted && lib.granted;
}

export async function pickRecipeImage(
  source: "camera" | "gallery",
): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    // Preserve original resolution for better OCR on handwriting.
    quality: 1,
    allowsEditing: false,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

  return result.canceled ? null : result.assets[0].uri;
}

async function imageToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function runOCR(imageUri: string): Promise<OcrResult> {
  const visionApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY ??
    process.env.GOOGLE_VISION_API_KEY;

  if (!visionApiKey) {
    throw new Error(
      "Missing Google Vision API key. Set EXPO_PUBLIC_GOOGLE_VISION_API_KEY and restart Expo.",
    );
  }

  const base64 = await imageToBase64(imageUri);

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [
              { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 },
              { type: "TEXT_DETECTION", maxResults: 1 },
            ],
            imageContext: { languageHints: ["he", "iw", "en"] },
          },
        ],
      }),
    },
  );

  const data = await response.json();
  const apiError =
    data?.error?.message ?? data?.responses?.[0]?.error?.message ?? null;

  if (!response.ok || apiError) {
    throw new Error(
      apiError ?? `Vision API request failed (${response.status})`,
    );
  }

  const rawText: string =
    data.responses?.[0]?.fullTextAnnotation?.text ??
    data.responses?.[0]?.textAnnotations?.[0]?.description ??
    "";

  if (!rawText) {
    throw new Error(
      "No text detected. For handwritten recipes, use a close, bright photo with high contrast and minimal background.",
    );
  }

  const claudeKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (claudeKey) {
    try {
      const result = await structureRecipe(rawText, true);
      const confidence: OcrResult["confidence"] =
        result.ingredients.length > 2 && result.steps.length > 1
          ? "high"
          : result.ingredients.length > 0 || result.steps.length > 0
            ? "medium"
            : "low";
      return {
        rawText,
        title: result.title,
        ingredients: result.ingredients,
        steps: result.steps,
        confidence,
      };
    } catch {
      // fall through to regex parser
    }
  }

  return parseOcrText(rawText);
}

export function parseOcrText(raw: string): OcrResult {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0); // Bug fix: guard against empty lines

  if (lines.length === 0) {
    return {
      rawText: raw,
      title: "",
      ingredients: [],
      steps: [],
      confidence: "low",
    };
  }

  const title = lines[0] ?? "";

  const ingMarkers =
    /(\d[\d/.]*\s*(כוס|כף|כפית|גרם|ק"ג|מ"ל|יח|cup|tbsp|tsp|g\b|ml|oz|lb|cloves|bunch))/i;
  const stepMarkers = /^(\d+[\.\)]\s|שלב\s*\d|step\s*\d)/i;

  const ingredients: string[] = [];
  const steps: string[] = [];

  let inIngredients = false;
  let inSteps = false;

  for (const line of lines.slice(1)) {
    if (/^(מרכיבים|רכיבים|ingredients?)[:：]?$/i.test(line)) {
      inIngredients = true;
      inSteps = false;
      continue;
    }
    if (
      /^(הוראות|אופן הכנה|שלבים|הכנה|directions?|instructions?|steps?|method)[:：]?$/i.test(
        line,
      )
    ) {
      inSteps = true;
      inIngredients = false;
      continue;
    }

    if (inIngredients || ingMarkers.test(line) || /^[-•*–]\s/.test(line)) {
      ingredients.push(line.replace(/^[-•*–]\s*/, ""));
    } else if (inSteps || stepMarkers.test(line)) {
      steps.push(line.replace(/^\d+[\.\)]\s*/, ""));
    }
  }

  if (!ingredients.length && !steps.length) {
    const mid = Math.floor(lines.length / 2);
    lines.slice(1, mid).forEach((l) => ingredients.push(l));
    lines.slice(mid).forEach((l) => steps.push(l));
  }

  const confidence =
    ingredients.length > 2 && steps.length > 1
      ? "high"
      : ingredients.length > 0 || steps.length > 0
        ? "medium"
        : "low";

  return { rawText: raw, title, ingredients, steps, confidence };
}
