import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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

function parseFreeNotes(notes: string) {
  if (!notes.trim()) return "";
  const lines = notes.split("\n").map((l) => l.trim());
  const noteMarkers = ["הערות", "notes"];
  let inNotes = false;
  const out: string[] = [];
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[:：]/g, "").trim();
    if (noteMarkers.some((m) => normalized.includes(m))) { inNotes = true; continue; }
    if (inNotes) out.push(line);
  }
  return out.join("\n").trim();
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const CATEGORIES = [
  { key: "pasta",     labelHe: "פסטה",         labelEn: "Pasta",      id: 2 },
  { key: "salads",    labelHe: "סלטים",         labelEn: "Salads",     id: 3 },
  { key: "desserts",  labelHe: "קינוחים",       labelEn: "Desserts",   id: 4 },
  { key: "soups",     labelHe: "מרקים",         labelEn: "Soups",      id: 5 },
  { key: "meat",      labelHe: "בשר",           labelEn: "Meat",       id: 6 },
  { key: "fish",      labelHe: "דגים",          labelEn: "Fish",       id: 7 },
  { key: "veggie",    labelHe: "צמחוני",        labelEn: "Veggie",     id: 8 },
  { key: "breakfast", labelHe: "ארוחות בוקר",   labelEn: "Breakfast",  id: 9 },
];

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
    categoryKey: "",
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

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  isHe,
}: {
  title: string;
  count?: number;
  isHe?: boolean;
}) {
  return (
    <View style={[s.sectionHeaderRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
      <View style={s.sectionAccent} />
      <Text style={[s.sectionTitle, { textAlign: isHe ? "right" : "left" }]}>
        {title}
      </Text>
      {count != null && count > 0 && (
        <View style={s.sectionCountBadge}>
          <Text style={s.sectionCountText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EditRecipeScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { loadRecipes } = useRecipeStore();

  const [state, setState] = useState<DraftState>(createInitialState());
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const initialSnapshotRef = useRef<string>(JSON.stringify(createInitialState()));

  const isDirty = useMemo(
    () => JSON.stringify(state) !== initialSnapshotRef.current,
    [state],
  );

  // ── Unsaved-changes guard ───────────────────────────────────────────────────
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

  // ── Hydrate from DB (edit) or AsyncStorage (draft) ─────────────────────────
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
            title: isHe ? recipe.title_he : (recipe.title_en ?? recipe.title_he),
            imageUri: recipe.image_uri ?? "",
            categoryKey: "pasta",
            ingredients: parsedIngredients.length ? parsedIngredients : [""],
            steps: parsedSteps.length ? parsedSteps : [""],
            prepTime: recipe.prep_time_min ? String(recipe.prep_time_min) : "",
            cookTime: recipe.cook_time_min ? String(recipe.cook_time_min) : "",
            servings: recipe.servings ? String(recipe.servings) : "",
            difficulty: recipe.difficulty ?? "",
            favorite: recipe.is_favorite === 1,
            notes: parseFreeNotes(notesSrc),
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

  // ── Auto-save draft (new recipe only) ──────────────────────────────────────
  useEffect(() => {
    if (!hydrated || id) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    }, 350);
    return () => clearTimeout(timer);
  }, [state, hydrated, id]);

  const insets = useSafeAreaInsets();

  // ── State helpers ───────────────────────────────────────────────────────────
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
      return { ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) };
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
        isHe ? "נדרשת הרשאה לגלריה/מצלמה" : "Camera/library permission is required",
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

  async function handleSave() {
    if (!state.title.trim()) {
      Alert.alert(t("error"), t("titleRequired"));
      return;
    }

    setSaving(true);
    try {
      const cat = CATEGORIES.find((c) => c.key === state.categoryKey);
      const ingredients = state.ingredients.map((s) => s.trim()).filter(Boolean);
      const steps = state.steps.map((s) => s.trim()).filter(Boolean);

      const notesBlockHe = [
        ingredients.length ? `מרכיבים:\n${ingredients.join("\n")}` : "",
        steps.length ? `\n\nשלבים:\n${steps.join("\n")}` : "",
        state.notes.trim() ? `\n\nהערות:\n${state.notes.trim()}` : "",
      ].join("").trim();

      const notesBlockEn = [
        ingredients.length ? `Ingredients:\n${ingredients.join("\n")}` : "",
        steps.length ? `\n\nSteps:\n${steps.join("\n")}` : "",
        state.notes.trim() ? `\n\nNotes:\n${state.notes.trim()}` : "",
      ].join("").trim();

      const payload = {
        title_he: state.title.trim(),
        title_en: state.title.trim(),
        category_id: cat?.id,
        image_uri: state.imageUri || undefined,
        prep_time_min: state.prepTime ? parseInt(state.prepTime, 10) : undefined,
        cook_time_min: state.cookTime ? parseInt(state.cookTime, 10) : undefined,
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
        id
          ? (isHe ? "✅ השינויים נשמרו!" : "✅ Changes saved!")
          : (isHe ? "🎉 המתכון נוסף בהצלחה!" : "🎉 Recipe added successfully!"),
        undefined,
        [
          {
            text: isHe ? "לצפייה במתכון" : "View recipe",
            onPress: () => {
              if (!recipeId) return;
              navigation.navigate("RecipeDetail", { id: recipeId });
            },
          },
        ],
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={["left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={64}
      >
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 90 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Screen title */}
        <Text style={[s.screenTitle, { textAlign: isHe ? "right" : "left" }]}>
          {id
            ? (isHe ? "עריכת מתכון" : "Edit recipe")
            : (isHe ? "מתכון חדש" : "New recipe")}
        </Text>

        {/* ── Recipe name ── */}
        <TextInput
          style={[s.titleInput, { textAlign: isHe ? "right" : "left" }]}
          value={state.title}
          onChangeText={(v) => patch({ title: v })}
          placeholder={isHe ? "שם המתכון..." : "Recipe name..."}
          placeholderTextColor={Colors.text.tertiary}
          autoFocus={!id}
        />

        {/* ── Photo ── */}
        <TouchableOpacity style={s.imageArea} onPress={handlePickImage} activeOpacity={0.85}>
          {state.imageUri ? (
            <>
              <Image
                source={{ uri: state.imageUri }}
                style={s.imagePreview}
                resizeMode="cover"
              />
              <View style={[s.imageChangeBadge, isHe ? { left: 10, right: undefined } : { right: 10 }]}>
                <Ionicons name="camera" size={14} color={Colors.text.inverse} />
              </View>
            </>
          ) : (
            <View style={s.imagePlaceholder}>
              <Ionicons name="camera-outline" size={28} color={Colors.text.tertiary} />
              <Text style={s.imagePlaceholderText}>
                {isHe ? "הוסף תמונה" : "Add photo"}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Category ── */}
        <SectionHeader title={isHe ? "קטגוריה" : "Category"} isHe={isHe} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipScroll}
          style={isHe ? { transform: [{ scaleX: -1 }] } : undefined}
        >
          {CATEGORIES.map((c) => {
            const selected = c.key === state.categoryKey;
            return (
              <TouchableOpacity
                key={c.key}
                style={[s.chip, selected && s.chipActive, isHe ? { transform: [{ scaleX: -1 }] } : undefined]}
                onPress={() => patch({ categoryKey: c.key })}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, selected && s.chipTextActive]}>
                  {isHe ? c.labelHe : c.labelEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Details card ── */}
        <SectionHeader title={isHe ? "פרטים" : "Details"} isHe={isHe} />
        <View style={[s.tripleRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          <View style={s.tripleCell}>
            <Text style={s.tripleLabel}>
              {isHe ? "הכנה (דק׳)" : "Prep (min)"}
            </Text>
            <TextInput
              style={s.tripleInput}
              value={state.prepTime}
              onChangeText={(v) => patch({ prepTime: v })}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.text.tertiary}
              textAlign="center"
            />
          </View>
          <View style={s.tripleDivider} />
          <View style={s.tripleCell}>
            <Text style={s.tripleLabel}>
              {isHe ? "בישול (דק׳)" : "Cook (min)"}
            </Text>
            <TextInput
              style={s.tripleInput}
              value={state.cookTime}
              onChangeText={(v) => patch({ cookTime: v })}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.text.tertiary}
              textAlign="center"
            />
          </View>
          <View style={s.tripleDivider} />
          <View style={s.tripleCell}>
            <Text style={s.tripleLabel}>{isHe ? "מנות" : "Servings"}</Text>
            <TextInput
              style={s.tripleInput}
              value={state.servings}
              onChangeText={(v) => patch({ servings: v })}
              keyboardType="number-pad"
              placeholder="2"
              placeholderTextColor={Colors.text.tertiary}
              textAlign="center"
            />
          </View>
        </View>

        {/* Difficulty */}
        <Text style={[s.fieldLabel, { textAlign: isHe ? "right" : "left", marginTop: 16 }]}>
          {isHe ? "רמת קושי" : "Difficulty"}
        </Text>
        <View style={[s.diffRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          {DIFFICULTIES.map((d) => {
            const selected = state.difficulty === d;
            const color =
              d === "easy"   ? Colors.difficulty.easy
              : d === "medium" ? Colors.difficulty.medium
              : Colors.difficulty.hard;
            return (
              <TouchableOpacity
                key={d}
                style={[s.diffChip, selected && { backgroundColor: color, borderColor: color }]}
                onPress={() => patch({ difficulty: selected ? "" : d })}
                activeOpacity={0.8}
              >
                <View style={[s.diffDot, { backgroundColor: selected ? Colors.text.inverse : color }]} />
                <Text style={[s.diffChipText, selected && { color: Colors.text.inverse }]}>
                  {t(d as any)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Ingredients ── */}
        <SectionHeader
          title={isHe ? "מרכיבים" : "Ingredients"}
          count={state.ingredients.filter(Boolean).length}
          isHe={isHe}
        />
        {state.ingredients.map((item, i) => (
          <View
            key={`ing-${i}`}
            style={[s.listRow, { flexDirection: isHe ? "row-reverse" : "row" }]}
          >
            <View style={s.listBullet}>
              <Text style={s.listBulletText}>•</Text>
            </View>
            <TextInput
              style={[s.listInput, { textAlign: isHe ? "right" : "left" }]}
              value={item}
              onChangeText={(v) => patchIngredient(i, v)}
              placeholder={isHe ? `רכיב ${i + 1}` : `Ingredient ${i + 1}`}
              placeholderTextColor={Colors.text.tertiary}
              returnKeyType="next"
            />
            <TouchableOpacity style={s.removeBtn} onPress={() => removeIngredient(i)}>
              <Ionicons name="close" size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.addRowBtn} onPress={addIngredient}>
          <Ionicons name="add-circle-outline" size={16} color={Colors.secondary} />
          <Text style={s.addRowBtnText}>
            {isHe ? "הוסף רכיב" : "Add ingredient"}
          </Text>
        </TouchableOpacity>

        {/* ── Instructions ── */}
        <SectionHeader
          title={isHe ? "שלבי הכנה" : "Instructions"}
          count={state.steps.filter(Boolean).length}
          isHe={isHe}
        />
        {state.steps.map((item, i) => (
          <View
            key={`step-${i}`}
            style={[s.listRow, { flexDirection: isHe ? "row-reverse" : "row" }]}
          >
            <View style={s.stepNum}>
              <Text style={s.stepNumText}>{i + 1}</Text>
            </View>
            <TextInput
              style={[s.listInput, s.listInputMulti, { textAlign: isHe ? "right" : "left" }]}
              value={item}
              onChangeText={(v) => patchStep(i, v)}
              placeholder={isHe ? `שלב ${i + 1}` : `Step ${i + 1}`}
              placeholderTextColor={Colors.text.tertiary}
              multiline
              scrollEnabled={false}
            />
            <TouchableOpacity style={s.removeBtn} onPress={() => removeStep(i)}>
              <Ionicons name="close" size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={s.addRowBtn} onPress={addStep}>
          <Ionicons name="add-circle-outline" size={16} color={Colors.secondary} />
          <Text style={s.addRowBtnText}>{isHe ? "הוסף שלב" : "Add step"}</Text>
        </TouchableOpacity>

        {/* ── Notes ── */}
        <SectionHeader title={isHe ? "הערות" : "Notes"} isHe={isHe} />
        <TextInput
          style={[s.notesInput, { textAlign: isHe ? "right" : "left" }]}
          value={state.notes}
          onChangeText={(v) => patch({ notes: v })}
          placeholder={isHe ? "הערות, טיפים, וריאציות..." : "Notes, tips, variations..."}
          placeholderTextColor={Colors.text.tertiary}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
        />

        {/* ── Favorite toggle ── */}
        <TouchableOpacity
          style={[
            s.favoriteToggle,
            { flexDirection: isHe ? "row-reverse" : "row" },
            state.favorite && s.favoriteToggleActive,
          ]}
          onPress={() => patch({ favorite: !state.favorite })}
          activeOpacity={0.85}
        >
          <Ionicons
            name={state.favorite ? "heart" : "heart-outline"}
            size={18}
            color={state.favorite ? Colors.text.inverse : Colors.primary}
          />
          <Text style={[s.favoriteToggleText, state.favorite && { color: Colors.text.inverse }]}>
            {isHe ? "מתכון מועדף" : "Favorite recipe"}
          </Text>
        </TouchableOpacity>

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.65 }]}
          disabled={saving}
          onPress={handleSave}
        >
          <Text style={s.saveBtnText}>
            {saving
              ? (isHe ? "שומר..." : "Saving...")
              : id
                ? (isHe ? "שמור שינויים" : "Save changes")
                : (isHe ? "שמור מתכון" : "Save recipe")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 100 },

  // Screen heading
  screenTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: 16,
  },

  // Prominent title input — no box, just an underline
  titleInput: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary + "55",
    paddingBottom: 10,
    paddingHorizontal: 0,
    marginBottom: 14,
  },

  // Photo area
  imageArea: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imagePlaceholderText: {
    ...Typography.caption,
    color: Colors.text.tertiary,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  imageChangeBadge: {
    position: "absolute",
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Section header
  sectionHeaderRow: {
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 10,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  sectionCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.text.secondary,
  },

  // Category chips (horizontal scroll)
  chipScroll: { gap: 8 },
  chip: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  chipTextActive: { color: Colors.text.inverse },

  // Details card (3-column)
  tripleRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    overflow: "hidden",
  },
  tripleCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
  },
  tripleLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  tripleInput: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text.primary,
    minWidth: 40,
    textAlign: "center",
  },
  tripleDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },

  // Difficulty pills
  fieldLabel: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  diffRow: { gap: 8 },
  diffChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  diffDot: { width: 7, height: 7, borderRadius: 4 },
  diffChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text.secondary,
  },

  // List rows (ingredients & steps)
  listRow: {
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  listBullet: {
    width: 28,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  listBulletText: {
    fontSize: 22,
    color: Colors.primary,
    lineHeight: 28,
  },
  listInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Typography.bodySmall,
    color: Colors.text.primary,
  },
  listInputMulti: {
    minHeight: 56,
  },
  removeBtn: {
    width: 34,
    height: 34,
    marginTop: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.secondary + "20",
    borderWidth: 1,
    borderColor: Colors.secondary + "40",
    marginTop: 2,
    marginBottom: 4,
  },
  addRowBtnText: {
    ...Typography.caption,
    color: Colors.secondary,
    fontWeight: "700",
  },
  stepNum: {
    width: 28,
    height: 28,
    marginTop: 7,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumText: {
    ...Typography.caption,
    color: Colors.text.inverse,
    fontWeight: "700",
    fontSize: 11,
  },

  // Notes textarea
  notesInput: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    ...Typography.bodySmall,
    color: Colors.text.primary,
  },

  // Favorite toggle
  favoriteToggle: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "55",
    backgroundColor: Colors.primary + "0D",
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10,
  },
  favoriteToggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  favoriteToggleText: {
    ...Typography.label,
    color: Colors.primary,
  },

  // Save button
  saveBtn: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    ...Typography.button,
    color: Colors.text.inverse,
    fontSize: 16,
  },
});
