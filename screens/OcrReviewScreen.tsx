import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { insertRecipe, insertRecipeImage } from "../lib/db";
import { isHebrew } from "../lib/i18n";
import { useRecipeStore } from "../store/recipeStore";
import type { OcrResult } from "../lib/ocr";
import { Colors } from "../constants/colors";
import { Typography } from "../constants/typography";
import { useThemeColors } from "../hooks/useThemeColors";
import ScreenHeader from "../components/ScreenHeader";

type Props = {
  route: { params?: { ocr?: OcrResult; scannedImages?: string[] } };
  navigation: any;
};

export default function OcrReviewScreen({ route, navigation }: Props) {
  const C = useThemeColors();
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { loadRecipes } = useRecipeStore();
  const ocr = route.params?.ocr;
  const scannedImages = route.params?.scannedImages ?? [];

  if (!ocr) {
    Alert.alert(
      isHe ? "אין נתוני סריקה" : "No scan data",
      isHe
        ? "יש להתחיל סריקה ממסך הוספת מתכון."
        : "Start scanning from the Add Recipe screen.",
      [{ text: isHe ? "חזרה" : "Back", onPress: () => navigation.goBack() }],
    );
    return <View style={s.container} />;
  }

  const [title, setTitle] = useState(ocr.title);
  const [ingredients, setIngredients] = useState(ocr.ingredients.join("\n"));
  const [steps, setSteps] = useState(ocr.steps.join("\n"));
  const [confirmed, setConfirmed] = useState(ocr.confidence === "high");
  const [saving, setSaving] = useState(false);

  const confidenceColor =
    ocr.confidence === "high"
      ? "#4ECDC4"
      : ocr.confidence === "medium"
        ? "#FFE66D"
        : "#FF6B6B";

  const allLines = [...ingredients.split("\n"), ...steps.split("\n")]
    .map((line) => line.trim())
    .filter(Boolean);

  const uncertainLines = allLines.filter((line) => {
    if (line.length <= 2) return true;
    if (/[?@#$%^*_=+<>]/.test(line)) return true;
    if (/^[\d\s.,:/-]+$/.test(line)) return true;
    return false;
  });

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert(t("error"), t("titleRequired"));
      return;
    }

    if (!confirmed) {
      Alert.alert(
        isHe ? "נדרש אישור" : "Confirmation required",
        isHe
          ? "סמן שאישרת את הטקסט שזוהה לפני שמירה"
          : "Please confirm the recognized text before saving",
      );
      return;
    }

    const ingredientsList = ingredients
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const stepsList = steps
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!ingredientsList.length || !stepsList.length) {
      Alert.alert(
        isHe ? "חסרים נתונים" : "Missing data",
        isHe
          ? "כדאי למלא לפחות מרכיב אחד ושלב אחד"
          : "Please add at least one ingredient and one step",
      );
      return;
    }

    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(
        isHe ? "לאשר ולשמור?" : "Confirm and save?",
        isHe
          ? "עברו על הכותרת, המרכיבים והשלבים לפני שמירה"
          : "Please review title, ingredients and steps before saving",
        [
          {
            text: isHe ? "ביטול" : "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          { text: isHe ? "שמור" : "Save", onPress: () => resolve(true) },
        ],
      );
    });

    if (!ok) return;

    setSaving(true);
    const normalizedTitle = title.trim();
    try {
      const notesHe = `מרכיבים:\n${ingredientsList.join("\n")}\n\nשלבים:\n${stepsList.join("\n")}`;
      const notesEn = `Ingredients:\n${ingredientsList.join("\n")}\n\nSteps:\n${stepsList.join("\n")}`;
      const id = await insertRecipe({
        title_he: normalizedTitle,
        title_en: normalizedTitle,
        source_type: "ocr",
        notes_he: notesHe,
        notes_en: notesEn,
        // Use first scanned image as the primary image_uri
        image_uri: scannedImages[0] ?? undefined,
      });
      // Save all scanned images to recipe_images table so they appear in the gallery
      for (let i = 0; i < scannedImages.length; i++) {
        await insertRecipeImage(id, scannedImages[i], i);
      }
      await loadRecipes();
      navigation.navigate("RecipeDetail", { id });
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <ScreenHeader
        title={isHe ? "סקירת סריקה" : "Review Scan"}
        subtitle={isHe ? "בדוק את הטקסט לפני השמירה" : "Check the text before saving"}
        leftAction={
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={isHe ? "chevron-forward" : "chevron-back"} size={26} color={C.text.primary} />
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={s.tipCard}>
        <Text style={[s.tipTitle, { textAlign: isHe ? "right" : "left" }]}>
          {isHe
            ? "לפני שמירה, כדאי לעבור על הטקסט"
            : "Quick review before saving"}
        </Text>
        <Text style={[s.tipText, { textAlign: isHe ? "right" : "left" }]}>
          {isHe
            ? "בדקו שגיאות נפוצות בזיהוי: כמויות, שמות רכיבים ותווים מוזרים."
            : "Check common OCR issues: quantities, ingredient names and odd symbols."}
        </Text>
      </View>

      <View
        style={[
          s.badge,
          {
            backgroundColor: confidenceColor + "22",
            borderColor: confidenceColor,
          },
        ]}
      >
        <Text style={[s.badgeText, { color: confidenceColor }]}>
          {ocr.confidence === "high"
            ? isHe
              ? "זיהוי טוב"
              : "Good recognition"
            : ocr.confidence === "medium"
              ? isHe
                ? "זיהוי בינוני"
                : "Partial recognition"
              : isHe
                ? "זיהוי חלש — נא לתקן"
                : "Weak recognition — please correct"}
        </Text>
      </View>

      {uncertainLines.length > 0 ? (
        <View style={s.warnCard}>
          <Text style={[s.warnTitle, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "קטעים שדורשים תשומת לב" : "Parts that may need correction"}
          </Text>
          <View style={s.warnChipsWrap}>
            {uncertainLines.slice(0, 5).map((line, idx) => (
              <View key={`${line}-${idx}`} style={s.warnChip}>
                <Text style={s.warnChipText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Text style={[s.label, { color: C.text.secondary }]}>{isHe ? "כותרת" : "Title"}</Text>
      <TextInput
        style={[s.input, { borderColor: C.border, color: C.text.primary, backgroundColor: C.surfaceElevated }]}
        value={title}
        onChangeText={setTitle}
        textAlign={isHe ? "right" : "left"}
      />

      <Text style={[s.label, { color: C.text.secondary }]}>
        {isHe ? "מרכיבים (שורה לכל מרכיב)" : "Ingredients (one per line)"}
      </Text>
      <TextInput
        style={[
          s.input,
          s.multiline,
          { writingDirection: isHe ? "rtl" : "ltr", borderColor: C.border, color: C.text.primary, backgroundColor: C.surfaceElevated },
        ]}
        multiline
        value={ingredients}
        onChangeText={setIngredients}
        textAlign={isHe ? "right" : "left"}
        textAlignVertical="top"
      />

      <Text style={[s.label, { color: C.text.secondary }]}>
        {isHe ? "שלבים (שורה לכל שלב)" : "Steps (one per line)"}
      </Text>
      <TextInput
        style={[
          s.input,
          s.multiline,
          { writingDirection: isHe ? "rtl" : "ltr", borderColor: C.border, color: C.text.primary, backgroundColor: C.surfaceElevated },
        ]}
        multiline
        value={steps}
        onChangeText={setSteps}
        textAlign={isHe ? "right" : "left"}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[s.confirmRow, { borderColor: C.border, backgroundColor: C.surface }, confirmed && s.confirmRowChecked]}
        onPress={() => setConfirmed((prev) => !prev)}
        activeOpacity={0.8}
      >
        <View style={[s.checkbox, { borderColor: C.border }, confirmed && s.checkboxChecked]}>
          {confirmed ? <Text style={s.checkboxTick}>✓</Text> : null}
        </View>
        <Text style={[s.confirmText, { color: C.text.secondary }, confirmed && s.confirmTextChecked]}>
          {isHe
            ? "עברתי על הטקסט ואני מאשר/ת שהוא מוכן לשמירה"
            : "I reviewed the text and confirm it is ready to save"}
        </Text>
      </TouchableOpacity>

      <View style={s.row}>
        <TouchableOpacity
          style={[s.btnPrimary, (!confirmed || saving) && s.btnDisabled]}
          onPress={handleSave}
          disabled={!confirmed || saving}
        >
          {saving ? <ActivityIndicator color="#fff" size="small" /> : null}
          <Text style={s.btnPrimaryText}>
            {saving
              ? isHe
                ? "שומר..."
                : "Saving..."
              : isHe
                ? "שמור מתכון"
                : "Save recipe"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btnSecondary, { borderColor: C.border, backgroundColor: C.surfaceElevated }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[s.btnSecondaryText, { color: C.text.secondary }]}>{isHe ? "ביטול" : "Cancel"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  tipCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E2D5",
    backgroundColor: "#FFF8EA",
    padding: 12,
    marginBottom: 12,
  },
  tipTitle: {
    ...Typography.label,
    color: "#7A5A19",
    marginBottom: 4,
  },
  tipText: {
    ...Typography.caption,
    color: "#92753A",
  },
  badge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  badgeText: { ...Typography.caption, fontWeight: "700" },
  warnCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD3D3",
    backgroundColor: "#FFF4F4",
    padding: 10,
    marginBottom: 8,
  },
  warnTitle: {
    ...Typography.caption,
    color: "#C03535",
    fontWeight: "700",
    marginBottom: 6,
  },
  warnChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  warnChip: {
    borderRadius: 10,
    backgroundColor: "#FFE2E2",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  warnChipText: {
    ...Typography.caption,
    color: "#A03939",
  },
  label: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 10,
    ...Typography.bodySmall,
    color: Colors.text.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  multiline: { minHeight: 110 },
  confirmRow: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  confirmRowChecked: {
    borderColor: "#9ED9CD",
    backgroundColor: "#EEF9F6",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxTick: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  confirmText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    flex: 1,
  },
  confirmTextChecked: {
    color: "#2A6B60",
    fontWeight: "600",
  },
  row: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 40 },
  btnPrimary: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: { ...Typography.button, color: "#fff", fontSize: 14 },
  btnSecondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
  },
  btnSecondaryText: {
    ...Typography.button,
    color: Colors.text.secondary,
    fontSize: 14,
  },
});
