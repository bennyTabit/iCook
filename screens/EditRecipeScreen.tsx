import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Colors } from "../constants/colors";
import { Typography } from "../constants/typography";
import { isHebrew } from "../lib/i18n";
import { getRecipeById, insertRecipe, updateRecipe } from "../lib/db";
import { pickRecipeImage, requestMediaPermissions } from "../lib/ocr";
import { useRecipeStore } from "../store/recipeStore";

const DRAFT_KEY = "icook.manual.draft.v1";

function parseSectionLines(notes: string, section: "ingredients" | "steps") {
  if (!notes.trim()) return [];
  const lines = notes.split("\n").map((l) => l.trim()).filter(Boolean);
  const ingredientMarkers = ["מרכיבים", "ingredients"];
  const stepMarkers = ["שלבים", "steps", "הוראות"];
  const markers = section === "ingredients" ? ingredientMarkers : stepMarkers;
  const stopMarkers = section === "ingredients" ? stepMarkers : ingredientMarkers;
  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[:：]/g, "").trim();
    if (markers.some((m) => normalized.includes(m))) { inSection = true; continue; }
    if (inSection && stopMarkers.some((m) => normalized.includes(m))) break;
    if (!inSection) continue;
    out.push(line.replace(/^([-*•]\s*|\d+[.)]\s*)/, "").trim());
  }
  return out.filter(Boolean);
}
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const CATEGORIES = [
  { key: "pasta", labelHe: "פסטה", labelEn: "Pasta", id: 2 },
  { key: "salads", labelHe: "סלטים", labelEn: "Salads", id: 3 },
  { key: "desserts", labelHe: "קינוחים", labelEn: "Desserts", id: 4 },
  { key: "soups", labelHe: "מרקים", labelEn: "Soups", id: 5 },
  { key: "meat", labelHe: "בשר", labelEn: "Meat", id: 6 },
  { key: "fish", labelHe: "דגים", labelEn: "Fish", id: 7 },
  { key: "veggie", labelHe: "צמחוני", labelEn: "Veggie", id: 8 },
  { key: "breakfast", labelHe: "ארוחות בוקר", labelEn: "Breakfast", id: 9 },
];

type WizardStep = 0 | 1 | 2 | 3 | 4;

type DraftState = {
  title: string;
  imageUri: string;
  categoryKey: string;
  ingredients: string[];
  steps: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  difficulty: string;
  favorite: boolean;
  notes: string;
};

function createInitialState(): DraftState {
  return {
    title: "",
    imageUri: "",
    categoryKey: "pasta",
    ingredients: [""],
    steps: [""],
    prepTime: "",
    cookTime: "",
    servings: "",
    difficulty: "",
    favorite: false,
    notes: "",
  };
}

export default function EditRecipeScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { loadRecipes } = useRecipeStore();

  const [step, setStep] = useState<WizardStep>(0);
  const [state, setState] = useState<DraftState>(createInitialState());
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const initialSnapshotRef = useRef<string>(
    JSON.stringify(createInitialState()),
  );

  const tagSuggestions = useMemo(() => {
    const sourceText =
      `${state.title} ${state.ingredients.join(" ")} ${state.steps.join(" ")}`.toLowerCase();
    const tags: string[] = [];
    if (/פסטה|pasta|italian|איטלק/.test(sourceText))
      tags.push(isHe ? "איטלקי" : "Italian");
    if (/מהיר|quick|15|20/.test(sourceText)) tags.push(isHe ? "מהיר" : "Quick");
    if (/גבינה|שמנת|milk|cream|cheese/.test(sourceText))
      tags.push(isHe ? "חלבי" : "Dairy");
    if (/סלט|ירק|healthy|בריא/.test(sourceText))
      tags.push(isHe ? "בריא" : "Healthy");
    return tags.slice(0, 3);
  }, [state, isHe]);

  const isDirty = useMemo(
    () => JSON.stringify(state) !== initialSnapshotRef.current,
    [state],
  );

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e: any) => {
      if (!isDirty || saving) return;
      e.preventDefault();
      Alert.alert(
        isHe ? "לצאת בלי לשמור?" : "Leave without saving?",
        isHe ? "יש לך שינויים שלא נשמרו" : "You have unsaved changes",
        [
          { text: isHe ? "הישאר" : "Stay", style: "cancel" },
          {
            text: isHe ? "צא" : "Leave",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsub;
  }, [navigation, isDirty, saving, isHe]);

  useEffect(() => {
    async function hydrate() {
      if (id) {
        const recipe = await getRecipeById(id);
        if (recipe) {
          const notesSrc = isHe
            ? (recipe.notes_he ?? "")
            : (recipe.notes_en ?? recipe.notes_he ?? "");
          const parsedIngredients = parseSectionLines(notesSrc, "ingredients");
          const parsedSteps = parseSectionLines(notesSrc, "steps");
          const nextState: DraftState = {
            title: isHe
              ? recipe.title_he
              : (recipe.title_en ?? recipe.title_he),
            imageUri: recipe.image_uri ?? "",
            categoryKey: "pasta",
            ingredients: parsedIngredients.length ? parsedIngredients : [""],
            steps: parsedSteps.length ? parsedSteps : [""],
            prepTime: recipe.prep_time_min ? String(recipe.prep_time_min) : "",
            cookTime: recipe.cook_time_min ? String(recipe.cook_time_min) : "",
            servings: recipe.servings ? String(recipe.servings) : "",
            difficulty: recipe.difficulty ?? "",
            favorite: recipe.is_favorite === 1,
            notes: isHe ? (recipe.notes_he ?? "") : (recipe.notes_en ?? ""),
          };
          setState(nextState);
          initialSnapshotRef.current = JSON.stringify(nextState);
        }
        setHydrated(true);
        return;
      }

      const raw = await AsyncStorage.getItem(DRAFT_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as DraftState;
          setState(parsed);
          initialSnapshotRef.current = JSON.stringify(parsed);
        } catch {
          initialSnapshotRef.current = JSON.stringify(createInitialState());
        }
      }
      setHydrated(true);
    }

    void hydrate();
  }, [id, isHe]);

  useEffect(() => {
    if (!hydrated || id) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    }, 350);
    return () => clearTimeout(timer);
  }, [state, hydrated, id]);

  function patch(next: Partial<DraftState>) {
    setState((prev) => ({ ...prev, ...next }));
  }

  function patchIngredient(index: number, value: string) {
    setState((prev) => {
      const next = [...prev.ingredients];
      next[index] = value;
      return { ...prev, ingredients: next };
    });
  }

  function addIngredient() {
    setState((prev) => ({ ...prev, ingredients: [...prev.ingredients, ""] }));
  }

  function removeIngredient(index: number) {
    setState((prev) => {
      if (prev.ingredients.length <= 1) return prev;
      return {
        ...prev,
        ingredients: prev.ingredients.filter((_, i) => i !== index),
      };
    });
  }

  function patchStep(index: number, value: string) {
    setState((prev) => {
      const next = [...prev.steps];
      next[index] = value;
      return { ...prev, steps: next };
    });
  }

  function addStep() {
    setState((prev) => ({ ...prev, steps: [...prev.steps, ""] }));
  }

  function removeStep(index: number) {
    setState((prev) => {
      if (prev.steps.length <= 1) return prev;
      return { ...prev, steps: prev.steps.filter((_, i) => i !== index) };
    });
  }

  async function handlePickImage() {
    const granted = await requestMediaPermissions();
    if (!granted) {
      Alert.alert(
        isHe ? "אין הרשאות" : "Permissions required",
        isHe
          ? "נדרשת הרשאה לגלריה/מצלמה"
          : "Camera/library permission is required",
      );
      return;
    }

    Alert.alert(
      isHe ? "הוספת תמונה" : "Add image",
      isHe ? "בחר מקור תמונה" : "Choose image source",
      [
        {
          text: isHe ? "מצלמה" : "Camera",
          onPress: async () => {
            const uri = await pickRecipeImage("camera");
            if (uri) patch({ imageUri: uri });
          },
        },
        {
          text: isHe ? "גלריה" : "Gallery",
          onPress: async () => {
            const uri = await pickRecipeImage("gallery");
            if (uri) patch({ imageUri: uri });
          },
        },
        { text: isHe ? "ביטול" : "Cancel", style: "cancel" },
      ],
    );
  }

  function validateStep(current: WizardStep): boolean {
    if (current === 0 && !state.title.trim()) {
      Alert.alert(t("error"), t("titleRequired"));
      return false;
    }
    if (current === 1 && state.ingredients.every((x) => !x.trim())) {
      Alert.alert(isHe ? "הוסף לפחות רכיב אחד" : "Add at least one ingredient");
      return false;
    }
    if (current === 2 && state.steps.every((x) => !x.trim())) {
      Alert.alert(isHe ? "הוסף לפחות שלב אחד" : "Add at least one instruction");
      return false;
    }
    return true;
  }

  async function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => (s < 4 ? ((s + 1) as WizardStep) : s));
  }

  function goBack() {
    setStep((s) => (s > 0 ? ((s - 1) as WizardStep) : s));
  }

  async function handleSave() {
    if (!state.title.trim()) {
      Alert.alert(t("error"), t("titleRequired"));
      return;
    }

    setSaving(true);
    try {
      const cat = CATEGORIES.find((c) => c.key === state.categoryKey);
      const ingredients = state.ingredients
        .map((s) => s.trim())
        .filter(Boolean);
      const steps = state.steps.map((s) => s.trim()).filter(Boolean);

      const notesBlockHe = [
        ingredients.length ? `מרכיבים:\n${ingredients.join("\n")}` : "",
        steps.length ? `\n\nשלבים:\n${steps.join("\n")}` : "",
        state.notes.trim() ? `\n\nהערות:\n${state.notes.trim()}` : "",
      ]
        .join("")
        .trim();

      const notesBlockEn = [
        ingredients.length ? `Ingredients:\n${ingredients.join("\n")}` : "",
        steps.length ? `\n\nSteps:\n${steps.join("\n")}` : "",
        state.notes.trim() ? `\n\nNotes:\n${state.notes.trim()}` : "",
      ]
        .join("")
        .trim();

      const payload = {
        title_he: state.title.trim(),
        title_en: state.title.trim(),
        category_id: cat?.id,
        image_uri: state.imageUri || undefined,
        prep_time_min: state.prepTime
          ? parseInt(state.prepTime, 10)
          : undefined,
        cook_time_min: state.cookTime
          ? parseInt(state.cookTime, 10)
          : undefined,
        servings: state.servings ? parseInt(state.servings, 10) : undefined,
        difficulty: (state.difficulty || undefined) as any,
        notes_he: notesBlockHe || undefined,
        notes_en: notesBlockEn || undefined,
        source_type: "manual" as const,
        is_favorite: state.favorite ? 1 : 0,
      };

      let recipeId = id;
      if (id) {
        await updateRecipe(id, payload);
      } else {
        recipeId = await insertRecipe(payload);
      }

      await loadRecipes();
      if (!id) await AsyncStorage.removeItem(DRAFT_KEY);
      initialSnapshotRef.current = JSON.stringify(state);

      Alert.alert(
        isHe ? "🎉 המתכון נוסף בהצלחה!" : "🎉 Recipe added successfully!",
        undefined,
        [
          {
            text: isHe ? "לצפייה במתכון" : "View recipe",
            onPress: () => {
              if (!recipeId) {
                Alert.alert(
                  isHe ? "שגיאה" : "Error",
                  isHe ? "לא הצלחנו לפתוח את המתכון" : "Could not open recipe",
                );
                return;
              }
              navigation.navigate("RecipeDetail", { id: recipeId });
            },
          },
        ],
      );
    } finally {
      setSaving(false);
    }
  }

  function renderProgress() {
    const total = 5;
    return (
      <View
        style={[s.progressRow, { flexDirection: isHe ? "row-reverse" : "row" }]}
      >
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[s.dot, i <= step && s.dotActive]} />
        ))}
      </View>
    );
  }

  function renderStep() {
    if (step === 0) {
      return (
        <View>
          <Text style={[s.stepTitle, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "שלב 1: מידע בסיסי" : "Step 1: Basic info"}
          </Text>

          <TextInput
            style={[s.input, { textAlign: isHe ? "right" : "left" }]}
            value={state.title}
            onChangeText={(v) => patch({ title: v })}
            placeholder={isHe ? "שם המתכון" : "Recipe name"}
            placeholderTextColor={Colors.text.tertiary}
          />

          <TouchableOpacity style={s.imageBtn} onPress={handlePickImage}>
            <Ionicons
              name="image-outline"
              size={18}
              color={Colors.text.secondary}
            />
            <Text style={s.imageBtnText}>
              {isHe ? "העלה תמונה" : "Upload image"}
            </Text>
          </TouchableOpacity>

          {state.imageUri ? (
            <Image source={{ uri: state.imageUri }} style={s.previewImage} />
          ) : null}

          <Text style={[s.fieldLabel, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "קטגוריה" : "Category"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipWrap}
          >
            {CATEGORIES.map((c) => {
              const selected = c.key === state.categoryKey;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[s.chip, selected && s.chipActive]}
                  onPress={() => patch({ categoryKey: c.key })}
                >
                  <Text style={[s.chipText, selected && s.chipTextActive]}>
                    {isHe ? c.labelHe : c.labelEn}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    if (step === 1) {
      return (
        <View>
          <Text style={[s.stepTitle, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "שלב 2: מרכיבים" : "Step 2: Ingredients"}
          </Text>
          {state.ingredients.map((item, i) => (
            <View key={`ing-${i}`} style={s.rowItem}>
              <TextInput
                style={[
                  s.input,
                  { flex: 1, textAlign: isHe ? "right" : "left" },
                ]}
                value={item}
                onChangeText={(v) => patchIngredient(i, v)}
                placeholder={isHe ? `רכיב ${i + 1}` : `Ingredient ${i + 1}`}
                placeholderTextColor={Colors.text.tertiary}
              />
              <TouchableOpacity
                style={s.removeBtn}
                onPress={() => removeIngredient(i)}
              >
                <Ionicons
                  name="close"
                  size={16}
                  color={Colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={s.addRowBtn} onPress={addIngredient}>
            <Text style={s.addRowBtnText}>
              {isHe ? "הוסף רכיב +" : "Add ingredient +"}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View>
          <Text style={[s.stepTitle, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "שלב 3: הוראות הכנה" : "Step 3: Instructions"}
          </Text>
          {state.steps.map((item, i) => (
            <View key={`step-${i}`} style={s.rowItem}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{i + 1}</Text>
              </View>
              <TextInput
                style={[
                  s.input,
                  { flex: 1, textAlign: isHe ? "right" : "left" },
                ]}
                value={item}
                onChangeText={(v) => patchStep(i, v)}
                placeholder={isHe ? `שלב ${i + 1}` : `Step ${i + 1}`}
                placeholderTextColor={Colors.text.tertiary}
              />
              <TouchableOpacity
                style={s.removeBtn}
                onPress={() => removeStep(i)}
              >
                <Ionicons
                  name="close"
                  size={16}
                  color={Colors.text.secondary}
                />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={s.addRowBtn} onPress={addStep}>
            <Text style={s.addRowBtnText}>
              {isHe ? "הוסף שלב +" : "Add step +"}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View>
          <Text style={[s.stepTitle, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "שלב 4: פרטים" : "Step 4: Details"}
          </Text>

          <View style={s.tripleRow}>
            <TextInput
              style={[s.input, s.compactInput]}
              value={state.prepTime}
              onChangeText={(v) => patch({ prepTime: v })}
              placeholder={isHe ? "זמן הכנה" : "Prep time"}
              keyboardType="number-pad"
              placeholderTextColor={Colors.text.tertiary}
            />
            <TextInput
              style={[s.input, s.compactInput]}
              value={state.cookTime}
              onChangeText={(v) => patch({ cookTime: v })}
              placeholder={isHe ? "זמן בישול" : "Cook time"}
              keyboardType="number-pad"
              placeholderTextColor={Colors.text.tertiary}
            />
            <TextInput
              style={[s.input, s.compactInput]}
              value={state.servings}
              onChangeText={(v) => patch({ servings: v })}
              placeholder={isHe ? "מנות" : "Servings"}
              keyboardType="number-pad"
              placeholderTextColor={Colors.text.tertiary}
            />
          </View>

          <Text style={[s.fieldLabel, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "רמת קושי" : "Difficulty"}
          </Text>
          <View style={s.chipWrap}>
            {DIFFICULTIES.map((d) => {
              const selected = state.difficulty === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.chip, selected && s.chipActive]}
                  onPress={() => patch({ difficulty: selected ? "" : d })}
                >
                  <Text style={[s.chipText, selected && s.chipTextActive]}>
                    {t(d as any)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[s.favoriteToggle, state.favorite && s.favoriteToggleActive]}
            onPress={() => patch({ favorite: !state.favorite })}
          >
            <Ionicons
              name={state.favorite ? "heart" : "heart-outline"}
              size={16}
              color={state.favorite ? "#fff" : Colors.text.secondary}
            />
            <Text
              style={[
                s.favoriteToggleText,
                state.favorite && { color: "#fff" },
              ]}
            >
              {isHe ? "הוסף למועדפים" : "Add to favorites"}
            </Text>
          </TouchableOpacity>

          <TextInput
            style={[
              s.input,
              s.notesInput,
              { textAlign: isHe ? "right" : "left" },
            ]}
            value={state.notes}
            onChangeText={(v) => patch({ notes: v })}
            placeholder={isHe ? "הערות (אופציונלי)" : "Notes (optional)"}
            placeholderTextColor={Colors.text.tertiary}
            multiline
            textAlignVertical="top"
          />
        </View>
      );
    }

    return (
      <View>
        <Text style={[s.stepTitle, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "שלב 5: סקירה" : "Step 5: Review"}
        </Text>

        <View style={s.reviewCard}>
          <Text style={[s.reviewTitle, { textAlign: isHe ? "right" : "left" }]}>
            {state.title || (isHe ? "ללא כותרת" : "Untitled")}
          </Text>
          <Text style={[s.reviewMeta, { textAlign: isHe ? "right" : "left" }]}>
            ⏱ {state.cookTime || "0"} {isHe ? "דקות" : "min"} | 🍽{" "}
            {state.servings || "2"} {isHe ? "מנות" : "servings"} | ⚡{" "}
            {state.difficulty
              ? t(state.difficulty as any)
              : isHe
                ? "לא צוין"
                : "N/A"}
          </Text>

          <Text
            style={[s.reviewSection, { textAlign: isHe ? "right" : "left" }]}
          >
            {isHe ? "תגים מוצעים:" : "Suggested tags:"}
          </Text>
          <View style={s.chipWrap}>
            {tagSuggestions.length ? (
              tagSuggestions.map((tag) => (
                <View
                  key={tag}
                  style={[s.chip, { backgroundColor: "#F0F8FF" }]}
                >
                  <Text style={s.chipText}>{tag}</Text>
                </View>
              ))
            ) : (
              <Text style={s.smallMuted}>
                {isHe ? "אין תגים מוצעים כרגע" : "No suggestions yet"}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={s.aiBtn}
            onPress={() =>
              Alert.alert(
                isHe ? "שפר מתכון ✨" : "Improve recipe ✨",
                isHe ? "פיצ'ר זה יגיע בקרוב" : "This feature is coming soon",
              )
            }
          >
            <Text style={s.aiBtnText}>
              {isHe ? "שפר מתכון ✨" : "Improve recipe ✨"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.65 }]}
          disabled={saving}
          onPress={handleSave}
        >
          <Text style={s.saveBtnText}>
            {saving
              ? isHe
                ? "שומר..."
                : "Saving..."
              : isHe
                ? "שמור מתכון"
                : "Save recipe"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.topTitle, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "בוא נכניס את המתכון שלך 🍝" : "Let us add your recipe 🍝"}
        </Text>
        {renderProgress()}
        {renderStep()}

        <View
          style={[s.navRow, { flexDirection: isHe ? "row-reverse" : "row" }]}
        >
          {step > 0 ? (
            <TouchableOpacity style={s.navSecondary} onPress={goBack}>
              <Text style={s.navSecondaryText}>{isHe ? "חזרה" : "Back"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {step < 4 ? (
            <TouchableOpacity style={s.navPrimary} onPress={goNext}>
              <Text style={s.navPrimaryText}>{isHe ? "המשך" : "Continue"}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 28 },
  topTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: 10,
  },
  progressRow: {
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E2E2DE",
  },
  dotActive: {
    backgroundColor: Colors.primary,
  },
  stepTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: "700",
    marginBottom: 10,
  },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    ...Typography.bodySmall,
    color: Colors.text.primary,
  },
  imageBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    marginBottom: 8,
  },
  imageBtnText: {
    ...Typography.label,
    color: Colors.text.secondary,
  },
  previewImage: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: Colors.surface,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: "600",
  },
  chipTextActive: { color: "#fff" },

  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addRowBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#EAF7F5",
    borderWidth: 1,
    borderColor: "#C9E9E4",
  },
  addRowBtnText: {
    ...Typography.caption,
    color: "#2B7B70",
    fontWeight: "700",
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    ...Typography.caption,
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },

  tripleRow: {
    flexDirection: "row",
    gap: 8,
  },
  compactInput: {
    flex: 1,
    minHeight: 44,
  },
  favoriteToggle: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favoriteToggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  favoriteToggleText: {
    ...Typography.label,
    color: Colors.text.secondary,
  },
  notesInput: {
    minHeight: 96,
    marginTop: 12,
    paddingTop: 10,
  },

  reviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    padding: 12,
  },
  reviewTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  reviewMeta: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: 10,
  },
  reviewSection: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: 6,
  },
  smallMuted: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  aiBtn: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5D3FF",
    backgroundColor: "#F8F0FF",
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBtnText: {
    ...Typography.label,
    color: "#7246A6",
  },
  saveBtn: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    ...Typography.button,
    color: "#fff",
    fontSize: 15,
  },

  navRow: {
    marginTop: 16,
    gap: 10,
    alignItems: "center",
  },
  navPrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  navPrimaryText: {
    ...Typography.button,
    color: "#fff",
    fontSize: 14,
  },
  navSecondary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  navSecondaryText: {
    ...Typography.button,
    color: Colors.text.secondary,
    fontSize: 14,
  },
});
