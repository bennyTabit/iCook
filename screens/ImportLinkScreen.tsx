import React, { useMemo, useState } from "react";
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

import { importFromUrl } from "../lib/importer";
import { insertRecipe } from "../lib/db";
import { useRecipeStore } from "../store/recipeStore";
import { isHebrew } from "../lib/i18n";
import { Colors } from "../constants/colors";
import { Typography } from "../constants/typography";
import type { ImportedRecipe } from "../lib/importer";

export default function ImportLinkScreen({ navigation }: any) {
  const isHe = isHebrew();
  const { loadRecipes } = useRecipeStore();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canImport = useMemo(
    () => url.trim().length > 0 && !loading,
    [url, loading],
  );

  async function handlePaste() {
    const text = await Clipboard.getStringAsync();
    if (text?.trim()) setUrl(text.trim());
  }

  async function handleFetch() {
    if (!canImport) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const imported = await importFromUrl(url.trim());
      setResult(imported);
    } catch (e: any) {
      setError(
        e?.message ??
          (isHe ? "לא הצלחנו לקרוא את המתכון 😕" : "Could not parse recipe 😕"),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;

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
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[s.title, { textAlign: isHe ? "right" : "left" }]}>
        {isHe ? "ייבוא מתכון מהאינטרנט" : "Import recipe from the web"}
      </Text>
      <Text style={[s.subtitle, { textAlign: isHe ? "right" : "left" }]}>
        {isHe
          ? "הדבק קישור ואנחנו נמלא הכל עבורך"
          : "Paste a link and we will auto-fill it for you"}
      </Text>

      <View style={s.urlWrap}>
        <TextInput
          style={[s.input, { textAlign: isHe ? "right" : "left" }]}
          value={url}
          onChangeText={setUrl}
          placeholder={
            isHe
              ? "הדבק כאן קישור למתכון (למשל: מאקו, וואלה, בלוגים...)"
              : "Paste recipe URL here (blog, food site, etc...)"
          }
          placeholderTextColor={Colors.text.tertiary}
          autoCapitalize="none"
          keyboardType="url"
        />
        <TouchableOpacity style={s.pasteBtn} onPress={handlePaste}>
          <Text style={s.pasteBtnText}>{isHe ? "הדבק" : "Paste"}</Text>
        </TouchableOpacity>
      </View>

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

      {error && (
        <View style={s.errorBox}>
          <Text style={[s.errorTitle, { textAlign: isHe ? "right" : "left" }]}>
            {isHe
              ? "לא הצלחנו לקרוא את המתכון 😕"
              : "Could not parse this recipe 😕"}
          </Text>
          <Text style={[s.errorSub, { textAlign: isHe ? "right" : "left" }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={s.errorAction}
            onPress={() => navigation.navigate("EditRecipe", { id: null })}
          >
            <Text style={s.errorActionText}>
              {isHe ? "עבר להזנה ידנית" : "Switch to manual entry"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <View style={s.preview}>
          <Text
            style={[s.previewTitle, { textAlign: isHe ? "right" : "left" }]}
          >
            {isHe ? "תצוגה לפני שמירה" : "Preview before save"}
          </Text>

          {result.imageUrl ? (
            <Image
              source={{ uri: result.imageUrl }}
              style={s.previewImage}
              resizeMode="cover"
            />
          ) : (
            <View style={s.previewImageFallback}>
              <Text style={s.previewFallbackText}>🍲</Text>
            </View>
          )}

          <Text
            style={[s.recipeTitle, { textAlign: isHe ? "right" : "left" }]}
            numberOfLines={2}
          >
            {result.title}
          </Text>

          <Text style={[s.meta, { textAlign: isHe ? "right" : "left" }]}>
            ⏱ {result.cookTime ?? 0} {isHe ? "דקות" : "min"} | 🍽{" "}
            {result.servings ?? 2} {isHe ? "מנות" : "servings"}
          </Text>

          <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
            <Text style={s.saveBtnText}>
              {isHe ? "שמור מתכון" : "Save recipe"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  errorBox: {
    marginTop: 14,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FFF0ED",
    borderWidth: 1,
    borderColor: "#FFC7BC",
  },
  errorTitle: {
    ...Typography.label,
    color: "#B33F31",
    marginBottom: 4,
  },
  errorSub: {
    ...Typography.caption,
    color: "#9D5447",
  },
  errorAction: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#F3B8AD",
  },
  errorActionText: {
    ...Typography.label,
    color: "#B33F31",
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
  saveBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    ...Typography.button,
    color: "#fff",
    fontSize: 15,
  },
});
