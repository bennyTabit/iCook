import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { importFromUrl } from "../lib/importer";
import { insertRecipe } from "../lib/db";
import { useRecipeStore } from "../store/recipeStore";
import { isHebrew } from "../lib/i18n";
import { Colors } from "../constants/colors";
import { Typography } from "../constants/typography";
import { Spacing } from "../constants/spacing";
import { useThemeColors } from "../hooks/useThemeColors";
import type { ImportedRecipe } from "../lib/importer";
import WebViewImporter from "../components/WebViewImporter";
import ScreenHeader from "../components/ScreenHeader";

function isValidHttpUrl(text: string) {
  try {
    const u = new URL(text.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ImportLinkScreen({ route, navigation }: any) {
  const C = useThemeColors();
  const isHe = isHebrew();
  const { loadRecipes, syncToCloud } = useRecipeStore();
  const autoTriggered = useRef(false);

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);

  // Handle URL passed via deep link (icook://import?url=...) or navigation param
  useEffect(() => {
    const paramUrl = route.params?.url;
    if (paramUrl && isValidHttpUrl(paramUrl) && !autoTriggered.current) {
      autoTriggered.current = true;
      setUrl(paramUrl);
      setClipboardUrl(null);
    }
    // Browse mode: open the in-app browser immediately (no URL required)
    if (route.params?.browse && !autoTriggered.current) {
      autoTriggered.current = true;
      setShowWebView(true);
    }
  }, [route.params?.url, route.params?.browse]);

  // Check clipboard on every focus — show banner if it has a URL not already loaded
  useFocusEffect(
    useCallback(() => {
      void Clipboard.getStringAsync().then((text) => {
        const trimmed = text?.trim() ?? "";
        if (isValidHttpUrl(trimmed) && trimmed !== url) {
          setClipboardUrl(trimmed);
        } else {
          setClipboardUrl(null);
        }
      });
    }, [url]),
  );

  const urlValidationError = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return null; // no input yet — no error shown
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return isHe ? "כתובת חייבת להתחיל ב-http או https" : "URL must start with http or https";
      }
      return null;
    } catch {
      return isHe ? "כתובת URL לא תקינה" : "Invalid URL format";
    }
  }, [url, isHe]);

  const canImport = useMemo(
    () => url.trim().length > 0 && !loading && urlValidationError === null,
    [url, loading, urlValidationError],
  );

  async function handlePaste() {
    const text = await Clipboard.getStringAsync();
    if (text?.trim()) {
      setUrl(text.trim());
      setClipboardUrl(null);
    }
  }

  function handleClipboardBannerPress() {
    if (!clipboardUrl) return;
    setUrl(clipboardUrl);
    setClipboardUrl(null);
  }

  async function handleFetch() {
    if (!canImport) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const imported = await importFromUrl(url.trim());
      if (imported.ingredients.length === 0 && imported.steps.length === 0) {
        // Site loaded but no recipe content found — open WebView so the
        // user can extract from the fully-rendered live page
        setLoading(false);
        setShowWebView(true);
        return;
      }
      setResult(imported);
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      if (msg === "BLOCKED") {
        // Site blocks automated fetch → use WebView (real browser)
        setLoading(false);
        setShowWebView(true);
        return;
      }
      setError(msg || (isHe ? "לא הצלחנו לקרוא את המתכון" : "Could not parse recipe"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result || saving) return;
    setSaving(true);

    const normalizedTitle = result.title.trim();
    const id = await insertRecipe({
      title_he: normalizedTitle,
      title_en: normalizedTitle,
      source_type: "url",
      source_url: result.sourceUrl,
      source_name: result.sourceName,
      image_uri: result.imageUrl,
      prep_time_min: result.prepTime,
      cook_time_min: result.cookTime,
      servings: result.servings,
      notes_he: [
        result.ingredients.length
          ? `מרכיבים:\n${result.ingredients.join("\n")}`
          : "",
        result.steps.length ? `\n\nשלבים:\n${result.steps.join("\n")}` : "",
      ]
        .join("")
        .trim(),
      notes_en: [
        result.ingredients.length
          ? `Ingredients:\n${result.ingredients.join("\n")}`
          : "",
        result.steps.length ? `\n\nSteps:\n${result.steps.join("\n")}` : "",
      ]
        .join("")
        .trim(),
    });

    syncToCloud(id).catch(() => {});
    try {
      await loadRecipes();
      Alert.alert(
        isHe ? "🎉 המתכון נוסף בהצלחה!" : "🎉 Recipe added successfully!",
        undefined,
        [
          {
            text: isHe ? "לצפייה במתכון" : "View recipe",
            onPress: () => navigation.navigate("RecipeDetail", { id }),
          },
        ],
      );
    } finally {
      setSaving(false);
    }
  }

  function handleWebViewResult(recipe: ImportedRecipe) {
    setShowWebView(false);
    // Keep the address bar in sync with whatever page the user imported from
    if (recipe.sourceUrl) setUrl(recipe.sourceUrl);
    if (recipe.ingredients.length === 0 && recipe.steps.length === 0) {
      setError("EMPTY");
    } else {
      setResult(recipe);
    }
  }

  return (
    <View style={[s.wrapper, { backgroundColor: C.background }]}>
      <ScreenHeader
        title={isHe ? "ייבוא מהאינטרנט" : "Import from Web"}
        subtitle={isHe ? "הדבק קישור ואנחנו נמלא הכל עבורך" : "Paste a link and we'll auto-fill it for you"}
        leftAction={
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={isHe ? "chevron-forward" : "chevron-back"} size={26} color={C.text.primary} />
          </TouchableOpacity>
        }
      />
    {showWebView && (
      <WebViewImporter
        initialUrl={url.trim() || undefined}
        isHe={isHe}
        onResult={handleWebViewResult}
        onCancel={() => setShowWebView(false)}
      />
    )}
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >

      {/* ── Clipboard URL banner ── */}
      {clipboardUrl ? (
        <TouchableOpacity
          style={[s.clipBanner, { flexDirection: isHe ? "row-reverse" : "row" }]}
          onPress={handleClipboardBannerPress}
          activeOpacity={0.82}
        >
          <View style={s.clipBannerIcon}>
            <Ionicons name="clipboard-outline" size={18} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.clipBannerTitle, { textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "זיהינו קישור בלוח — להשתמש בו?" : "Detected a link in clipboard — use it?"}
            </Text>
            <Text
              style={[s.clipBannerUrl, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]}
              numberOfLines={1}
            >
              {clipboardUrl}
            </Text>
          </View>
          <Ionicons
            name={isHe ? "chevron-back" : "chevron-forward"}
            size={16}
            color={Colors.primary}
          />
        </TouchableOpacity>
      ) : null}

      <View style={s.urlWrap}>
        <TextInput
          style={[s.input, { textAlign: isHe ? "right" : "left", borderColor: C.border, backgroundColor: C.surfaceElevated, color: C.text.primary }]}
          value={url}
          onChangeText={setUrl}
          placeholder={
            isHe
              ? "הדבק כאן קישור למתכון (למשל: מאקו, וואלה, בלוגים...)"
              : "Paste recipe URL here (blog, food site, etc...)"
          }
          placeholderTextColor={C.text.tertiary}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TouchableOpacity style={[s.pasteBtn, { backgroundColor: C.surface, borderColor: C.border }]} onPress={handlePaste}>
          <Text style={[s.pasteBtnText, { color: C.text.secondary }]}>{isHe ? "הדבק" : "Paste"}</Text>
        </TouchableOpacity>
      </View>

      {urlValidationError !== null && (
        <Text style={s.urlError}>{urlValidationError}</Text>
      )}

      <TouchableOpacity
        style={[s.cta, !canImport && s.ctaDisabled]}
        disabled={!canImport}
        onPress={handleFetch}
      >
        {loading ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={s.ctaText}>
              {isHe ? "מייבא מתכון..." : "Importing recipe..."}
            </Text>
          </View>
        ) : (
          <Text style={s.ctaText}>{isHe ? "ייבא מתכון" : "Import recipe"}</Text>
        )}
      </TouchableOpacity>

      {/* ── Browse & Import ── */}
      <TouchableOpacity
        style={[s.browseBtn, { borderColor: C.border, backgroundColor: C.surfaceElevated }]}
        onPress={() => setShowWebView(true)}
        activeOpacity={0.78}
      >
        <Text style={s.browseIcon}>🌐</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.browseBtnTitle, { color: C.text.primary, textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "גלישה וייבוא" : "Browse & Import"}
          </Text>
          <Text style={[s.browseBtnSub, { color: C.text.secondary, textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "גלוש לכל אתר מתכונים ולחץ ייבא" : "Navigate to any recipe site and tap Import"}
          </Text>
        </View>
        <Ionicons
          name={isHe ? "chevron-back" : "chevron-forward"}
          size={16}
          color={C.text.tertiary}
        />
      </TouchableOpacity>

      {error && (
        <View style={s.errorBox}>
          <Text style={[s.errorTitle, { textAlign: isHe ? "right" : "left" }]}>
            {error === "EMPTY"
              ? (isHe ? "לא הצלחנו לחלץ מרכיבים 😕" : "Could not extract recipe data 😕")
              : (isHe ? "לא הצלחנו לקרוא את המתכון 😕" : "Could not parse this recipe 😕")}
          </Text>
          <Text style={[s.errorSub, { textAlign: isHe ? "right" : "left" }]}>
            {error === "EMPTY"
              ? (isHe
                  ? "האתר נטען אך לא הצלחנו לחלץ מרכיבים. נסה לסרוק עם המצלמה."
                  : "The page loaded but we couldn't extract ingredients. Try scanning with camera instead.")
              : error}
          </Text>
          <View style={s.errorActions}>
            <TouchableOpacity
              style={[s.errorAction, s.errorActionPrimary]}
              onPress={() => navigation.navigate("AddRecipe")}
            >
              <Text style={[s.errorActionText, { color: Colors.text.inverse }]}>
                {isHe ? "סרוק עם מצלמה" : "Scan with camera"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.errorAction}
              onPress={() => navigation.navigate("EditRecipe", { id: null })}
            >
              <Text style={s.errorActionText}>
                {isHe ? "הזנה ידנית" : "Manual entry"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {result && (
        <View style={[s.preview, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <Text
            style={[s.previewTitle, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]}
          >
            {isHe ? "תצוגה לפני שמירה" : "Preview before save"}
          </Text>

          {result.ingredients.length === 0 && result.steps.length === 0 && (
            <View style={s.warnBox}>
              <Text style={[s.warnText, { textAlign: isHe ? "right" : "left" }]}>
                {isHe
                  ? "⚠️ האתר הזה חוסם ייבוא אוטומטי — לא הצלחנו לחלץ מרכיבים ושלבים. אפשר לסרוק צילום מסך עם המצלמה."
                  : "⚠️ This site blocks automated import — ingredients and steps could not be extracted. Try scanning a screenshot instead."}
              </Text>
              <TouchableOpacity
                style={s.warnAction}
                onPress={() => navigation.navigate("AddRecipe")}
              >
                <Text style={s.warnActionText}>
                  {isHe ? "סרוק עם מצלמה" : "Scan with camera"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {result.imageUrl ? (
            <Image
              source={{ uri: result.imageUrl }}
              style={[s.previewImage, { backgroundColor: C.surface }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[s.previewImageFallback, { backgroundColor: C.surface }]}>
              <Text style={s.previewFallbackText}>🍲</Text>
            </View>
          )}

          <Text
            style={[s.recipeTitle, { textAlign: isHe ? "right" : "left", color: C.text.primary }]}
            numberOfLines={2}
          >
            {result.title}
          </Text>

          <Text style={[s.meta, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]}>
            ⏱ {result.cookTime ?? 0} {isHe ? "דקות" : "min"} | 🍽{" "}
            {result.servings ?? 2} {isHe ? "מנות" : "servings"}
          </Text>

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={s.saveBtnText}>
              {saving
                ? (isHe ? "שומר..." : "Saving...")
                : (isHe ? "שמור מתכון" : "Save recipe")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: 14,
  },
  urlWrap: {
    position: "relative",
    marginBottom: 12,
  },
  input: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingRight: 84,
    ...Typography.bodySmall,
    color: Colors.text.primary,
  },
  pasteBtn: {
    position: "absolute",
    right: 10,
    top: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pasteBtnText: {
    ...Typography.label,
    color: Colors.text.secondary,
    fontSize: 12,
  },
  // Clipboard banner
  clipBanner: {
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.primary + "14",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
    padding: 12,
    marginBottom: 12,
  },
  clipBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  clipBannerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  clipBannerUrl: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  cta: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  urlError: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  ctaText: {
    ...Typography.button,
    color: "#fff",
    fontSize: 15,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  browseIcon: { fontSize: 22 },
  browseBtnTitle: { fontSize: 14, fontWeight: "600" },
  browseBtnSub: { fontSize: 12, marginTop: 1 },
  errorBox: {
    marginTop: Spacing.md,
    borderRadius: 14,
    padding: Spacing.md,
    backgroundColor: Colors.errorSurface,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  errorTitle: {
    ...Typography.label,
    color: Colors.text.error,
    marginBottom: 4,
  },
  errorSub: {
    ...Typography.caption,
    color: Colors.text.error,
  },
  errorActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: "wrap",
  },
  errorAction: {
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  errorActionPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  errorActionText: {
    ...Typography.label,
    color: Colors.text.error,
    fontSize: 12,
  },
  preview: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  previewTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: 10,
  },
  previewImage: {
    width: "100%",
    height: 170,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    marginBottom: 10,
  },
  previewImageFallback: {
    width: "100%",
    height: 170,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  previewFallbackText: { fontSize: 36 },
  recipeTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: 6,
  },
  meta: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  warnBox: {
    borderRadius: 12,
    padding: Spacing.md,
    backgroundColor: Colors.warningSurface,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  warnText: {
    ...Typography.caption,
    color: Colors.text.warning,
    lineHeight: 17,
  },
  warnAction: {
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  warnActionText: {
    ...Typography.label,
    color: Colors.text.warning,
    fontSize: 12,
  },
  saveBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    ...Typography.button,
    color: Colors.text.inverse,
    fontSize: 15,
  },
});
