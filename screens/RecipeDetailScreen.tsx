import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  UIManager,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { Typography } from "../constants/typography";
import { isHebrew } from "../lib/i18n";
import { getRecipeById, insertRecipe } from "../lib/db";
import { useRecipeStore } from "../store/recipeStore";
import { useShoppingStore } from "../store/shoppingStore";
import { shareRecipe } from "../lib/sharing";
import Toast from "../components/Toast";
import type { Recipe } from "../lib/db";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type DraftRecipe = {
  title: string;
  ingredients: string[];
  steps: string[];
  source_type?: "ocr" | "url" | "manual";
};

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function parseSectionLines(notes: string, section: "ingredients" | "steps") {
  if (!notes.trim()) return [];
  const lines = notes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const ingredientMarkers = ["מרכיבים", "ingredients"];
  const stepMarkers = ["שלבים", "steps", "הוראות"];
  const markers = section === "ingredients" ? ingredientMarkers : stepMarkers;
  const stopMarkers =
    section === "ingredients" ? stepMarkers : ingredientMarkers;

  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[:：]/g, "").trim();
    if (markers.some((m) => normalized.includes(m))) {
      inSection = true;
      continue;
    }
    if (inSection && stopMarkers.some((m) => normalized.includes(m))) break;
    if (!inSection) continue;
    out.push(line.replace(/^([-*•]\s*|\d+[.)]\s*)/, "").trim());
  }
  return out.filter(Boolean);
}

function formatScaled(value: number) {
  if (Math.abs(value - Math.round(value)) < 0.05)
    return String(Math.round(value));
  return value.toFixed(1).replace(/\.0$/, "");
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

function parseNumericToken(token: string) {
  const t = token.trim();
  if (!t) return null;

  if (UNICODE_FRACTIONS[t] != null) return UNICODE_FRACTIONS[t];

  const mixedUnicode = t.match(/^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (mixedUnicode) {
    return Number(mixedUnicode[1]) + (UNICODE_FRACTIONS[mixedUnicode[2]] ?? 0);
  }

  const mixedFraction = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFraction) {
    const whole = Number(mixedFraction[1]);
    const numerator = Number(mixedFraction[2]);
    const denominator = Number(mixedFraction[3]);
    if (denominator === 0) return null;
    return whole + numerator / denominator;
  }

  const fraction = t.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  const decimal = Number(t.replace(",", "."));
  return Number.isNaN(decimal) ? null : decimal;
}

function scaleIngredientText(text: string, factor: number) {
  return text.replace(
    /\d+\s+\d+\/\d+|\d+[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?/g,
    (match) => {
      const n = parseNumericToken(match);
      if (n == null) return match;
      return formatScaled(n * factor);
    },
  );
}

function parseMinutesFromStep(step: string) {
  const m = step.match(/(\d+)\s*(דקות|דקה|min|minutes)/i);
  if (!m) return null;
  const parsed = parseInt(m[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function CookingModeOverlay({
  steps,
  isHe,
  onClose,
}: {
  steps: string[];
  isHe: boolean;
  onClose: () => void;
}) {
  useKeepAwake();
  const [currentStep, setCurrentStep] = useState(0);

  const stepText = steps[currentStep] ?? "";

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.cookContainer} edges={["top", "bottom"]}>
        <View
          style={[s.cookTop, { flexDirection: isHe ? "row-reverse" : "row" }]}
        >
          <Text style={s.cookProgress}>
            {isHe ? "שלב" : "Step"} {currentStep + 1}/
            {Math.max(steps.length, 1)}
          </Text>
          <TouchableOpacity onPress={onClose} style={s.cookCloseBtn}>
            <Ionicons name="close" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={s.cookStepCard}>
          <Text
            style={[s.cookStepText, { textAlign: isHe ? "right" : "left" }]}
          >
            {stepText}
          </Text>
        </View>

        <View
          style={[s.cookNav, { flexDirection: isHe ? "row-reverse" : "row" }]}
        >
          <TouchableOpacity
            style={[s.cookBtn, currentStep <= 0 && s.cookBtnDisabled]}
            disabled={currentStep <= 0}
            onPress={() => setCurrentStep((x) => Math.max(x - 1, 0))}
          >
            <Text style={s.cookBtnText}>{isHe ? "הקודם" : "Previous"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.cookBtn,
              currentStep >= steps.length - 1 && s.cookBtnDisabled,
            ]}
            disabled={currentStep >= steps.length - 1}
            onPress={() =>
              setCurrentStep((x) => Math.min(x + 1, steps.length - 1))
            }
          >
            <Text style={s.cookBtnText}>{isHe ? "הבא" : "Next"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.cookExitBtn}
          onPress={onClose}
          activeOpacity={0.9}
        >
          <Text style={s.cookExitBtnText}>
            {isHe ? "חזרה למתכון" : "Back to recipe"}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

export default function RecipeDetailScreen({ route, navigation }: any) {
  const id: number | undefined = route.params?.id;
  const draft: DraftRecipe | undefined = route.params?.draft;
  const isDraft = !!draft;
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { toggleFav, removeRecipe, loadRecipes } = useRecipeStore();
  const { addFromRecipe } = useShoppingStore();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [toast, setToast] = useState("");
  const [ingredientDone, setIngredientDone] = useState<Record<number, boolean>>(
    {},
  );
  const [stepDone, setStepDone] = useState<Record<number, boolean>>({});
  const [shoppingMode, setShoppingMode] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);
  const [timerLeftSec, setTimerLeftSec] = useState(0);
  const [servings, setServings] = useState(2);
  const [cookHistory, setCookHistory] = useState(0);
  const favScale = useRef(new Animated.Value(1)).current;
  const timerWasRunningRef = useRef(false);
  const heroHeight = Math.max(280, Math.round(height * 0.4));

  async function loadRecipe() {
    if (!id) return;
    const fresh = await getRecipeById(id);
    setRecipe(fresh);
  }

  useEffect(() => {
    if (isDraft) return;
    loadRecipe();
  }, [id, isDraft]);

  useFocusEffect(
    React.useCallback(() => {
      if (isDraft) return () => {};
      void loadRecipe();
      return () => {};
    }, [id, isDraft]),
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  useEffect(() => {
    if (isDraft) {
      setServings(2);
      return;
    }
    setServings(recipe?.servings ?? 2);
  }, [recipe?.servings, isDraft]);

  const historyKey = useMemo(
    () => `icook.cooked.${id ?? draft?.title ?? "draft"}`,
    [id, draft?.title],
  );

  useEffect(() => {
    async function hydrateCookHistory() {
      const raw = await AsyncStorage.getItem(historyKey);
      setCookHistory(raw ? parseInt(raw, 10) || 0 : 0);
    }
    void hydrateCookHistory();
  }, [historyKey]);

  useEffect(() => {
    if (timerLeftSec <= 0) return;
    const timer = setInterval(
      () => setTimerLeftSec((s) => Math.max(s - 1, 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, [timerLeftSec]);

  useEffect(() => {
    if (timerLeftSec > 0) return;
    if (!timerWasRunningRef.current) return;
    timerWasRunningRef.current = false;
    showToast(isHe ? "הטיימר הסתיים ⏰" : "Timer finished ⏰");
  }, [timerLeftSec, isHe]);

  function handleDelete() {
    if (!id) return;
    Alert.alert(
      isHe ? "מחיקת מתכון" : "Delete recipe",
      isHe ? "האם למחוק את המתכון?" : "Delete this recipe?",
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            await removeRecipe(id);
            navigation.goBack();
          },
        },
      ],
    );
  }

  const title = isDraft
    ? (draft?.title ?? "")
    : isHe
      ? (recipe?.title_he ?? "")
      : (recipe?.title_en ?? recipe?.title_he ?? "");
  const isFav = !isDraft && recipe ? recipe.is_favorite === 1 : false;

  const rawIngredients = useMemo(() => {
    if (isDraft) return draft?.ingredients ?? [];
    const fromNotes = parseSectionLines(
      isHe
        ? (recipe?.notes_he ?? "")
        : (recipe?.notes_en ?? recipe?.notes_he ?? ""),
      "ingredients",
    );
    return fromNotes.length
      ? fromNotes
      : [
          "ספגטי 400 גרם",
          "בשר טחון 300 גרם",
          "רסק עגבניות 2 כוסות",
          "בצל גדול",
          "שום 3 שיניים",
        ];
  }, [isDraft, draft?.ingredients, recipe?.notes_he, recipe?.notes_en, isHe]);

  const rawSteps = useMemo(() => {
    if (isDraft) return draft?.steps ?? [];
    const fromNotes = parseSectionLines(
      isHe
        ? (recipe?.notes_he ?? "")
        : (recipe?.notes_en ?? recipe?.notes_he ?? ""),
      "steps",
    );
    return fromNotes.length
      ? fromNotes
      : [
          "בשל פסטה במים מומלחים.",
          "טגן בצל ושום, הוסף בשר.",
          "הוסף רסק, בשל 20 דקות.",
        ];
  }, [isDraft, draft?.steps, recipe?.notes_he, recipe?.notes_en, isHe]);

  const baseServings = isDraft ? 2 : Math.max(recipe?.servings ?? 2, 1);
  const ratio = Math.max(servings, 1) / baseServings;

  const shownIngredients = useMemo(
    () => rawIngredients.map((ing) => scaleIngredientText(ing, ratio)),
    [rawIngredients, ratio],
  );

  const shownSteps = rawSteps;
  const timerLabel =
    timerLeftSec > 0
      ? `${Math.floor(timerLeftSec / 60)}:${String(timerLeftSec % 60).padStart(2, "0")}`
      : null;

  async function handleSaveDraft() {
    if (!draft || !title.trim()) {
      Alert.alert(t("error"), t("titleRequired"));
      return;
    }
    const newId = await insertRecipe({
      title_he: title.trim(),
      title_en: title.trim(),
      source_type: draft.source_type ?? "ocr",
      notes_he: [
        draft.ingredients.length
          ? `מרכיבים:\n${draft.ingredients.join("\n")}`
          : "",
        draft.steps.length ? `\n\nשלבים:\n${draft.steps.join("\n")}` : "",
      ]
        .join("")
        .trim(),
      notes_en: [
        draft.ingredients.length
          ? `Ingredients:\n${draft.ingredients.join("\n")}`
          : "",
        draft.steps.length ? `\n\nSteps:\n${draft.steps.join("\n")}` : "",
      ]
        .join("")
        .trim(),
    });
    await loadRecipes();
    navigation.navigate("RecipeDetail", { id: newId });
  }

  async function handleCookedIt() {
    const next = cookHistory + 1;
    setCookHistory(next);
    await AsyncStorage.setItem(historyKey, String(next));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(
      isHe ? "מעולה! סומן שבישלת את זה 👨‍🍳" : "Great! Marked as cooked 👨‍🍳",
    );
  }

  function toggleIngredientDone(index: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIngredientDone((prev) => ({ ...prev, [index]: !prev[index] }));
    void Haptics.selectionAsync();
  }

  function toggleStepDone(index: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepDone((prev) => ({ ...prev, [index]: !prev[index] }));
    void Haptics.selectionAsync();
  }

  function onFavoritePress() {
    if (!recipe || !id) return;
    Animated.sequence([
      Animated.spring(favScale, {
        toValue: 1.28,
        useNativeDriver: true,
        friction: 5,
      }),
      Animated.spring(favScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
      }),
    ]).start();
    toggleFav(id, recipe.is_favorite ?? 0);
    setRecipe((prev) =>
      prev ? { ...prev, is_favorite: prev.is_favorite ? 0 : 1 } : prev,
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleTimerStart(minutes?: number | null) {
    const mins = minutes ?? recipe?.cook_time_min ?? null;
    if (!mins || mins <= 0) {
      Alert.alert(isHe ? "אין זמן זמין" : "No time available");
      return;
    }
    timerWasRunningRef.current = true;
    setTimerLeftSec(mins * 60);
    showToast(
      isHe ? `הטיימר התחיל: ${mins} דקות` : `Timer started: ${mins} min`,
    );
  }

  if (!isDraft && !recipe) return <View style={s.container} />;

  return (
    <SafeAreaView style={s.container} edges={["left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <View style={[s.hero, { height: heroHeight }]}>
          {recipe?.image_uri ? (
            <Image
              source={{ uri: recipe.image_uri }}
              style={s.heroImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient colors={["#FFD8CD", "#FFE1B6"]} style={s.heroImage}>
              <Text style={s.heroEmoji}>🍽️</Text>
            </LinearGradient>
          )}

          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.65)"]}
            style={s.heroOverlay}
          />

          <View style={s.heroTitleWrap}>
            <Text
              style={[s.heroTitle, { textAlign: isHe ? "right" : "left" }]}
              numberOfLines={2}
            >
              {title}
            </Text>
          </View>

          {!isDraft && (
            <Animated.View
              style={[s.favBtn, { transform: [{ scale: favScale }] }]}
            >
              <TouchableOpacity onPress={onFavoritePress} style={s.favInnerBtn}>
                <Ionicons
                  name={isFav ? "heart" : "heart-outline"}
                  size={21}
                  color={isFav ? "#F1545C" : "#fff"}
                />
              </TouchableOpacity>
            </Animated.View>
          )}

          {!isDraft && (
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => navigation.navigate("EditRecipe", { id })}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={Colors.text.primary}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.body}>
          <View
            style={[
              s.quickInfoRow,
              { flexDirection: isHe ? "row-reverse" : "row" },
            ]}
          >
            <Pressable
              onPress={() => handleTimerStart(recipe?.cook_time_min)}
              style={s.quickInfoItem}
            >
              <Ionicons
                name="time-outline"
                size={16}
                color={Colors.text.secondary}
              />
              <Text style={s.quickInfoText}>
                {recipe?.cook_time_min ?? 0} {isHe ? "דקות" : "min"}
              </Text>
            </Pressable>
            <View style={s.quickInfoItem}>
              <Ionicons
                name="restaurant-outline"
                size={16}
                color={Colors.text.secondary}
              />
              <Text style={s.quickInfoText}>
                {servings} {isHe ? "מנות" : "servings"}
              </Text>
            </View>
            <View style={s.quickInfoItem}>
              <Ionicons
                name="flash-outline"
                size={16}
                color={Colors.text.secondary}
              />
              <Text style={s.quickInfoText}>
                {recipe?.difficulty
                  ? t(recipe.difficulty as any)
                  : isHe
                    ? "קל"
                    : "easy"}
              </Text>
            </View>
          </View>

          <View style={s.infoDivider} />

          <View
            style={[
              s.servingsAdjuster,
              { flexDirection: isHe ? "row-reverse" : "row" },
            ]}
          >
            <Text style={s.servingsLabel}>{isHe ? "מנות:" : "Servings:"}</Text>
            <TouchableOpacity
              style={s.servingsBtn}
              onPress={() => setServings((x) => Math.max(1, x - 1))}
            >
              <Text style={s.servingsBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={s.servingsValue}>{servings}</Text>
            <TouchableOpacity
              style={s.servingsBtn}
              onPress={() => setServings((x) => x + 1)}
            >
              <Text style={s.servingsBtnText}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cookedBtn} onPress={handleCookedIt}>
              <Text style={s.cookedBtnText}>
                {isHe ? "בישלתי את זה" : "I cooked this"}
              </Text>
            </TouchableOpacity>
          </View>

          {cookHistory > 0 ? (
            <Text
              style={[s.cookHistory, { textAlign: isHe ? "right" : "left" }]}
            >
              {isHe
                ? `בושל ${cookHistory} פעמים`
                : `Cooked ${cookHistory} times`}
            </Text>
          ) : null}

          {timerLabel ? (
            <Text style={[s.timerLive, { textAlign: isHe ? "right" : "left" }]}>
              ⏱ {isHe ? "טיימר פעיל:" : "Timer:"} {timerLabel}
            </Text>
          ) : null}

          <View style={s.sectionCard}>
            <View
              style={[
                s.sectionHeader,
                { flexDirection: isHe ? "row-reverse" : "row" },
              ]}
            >
              <Text style={s.sectionTitle}>
                {isHe ? "מרכיבים" : "Ingredients"}
              </Text>
              <TouchableOpacity
                style={[s.togglePill, shoppingMode && s.togglePillActive]}
                onPress={() => setShoppingMode((prev) => !prev)}
              >
                <Text
                  style={[
                    s.togglePillText,
                    shoppingMode && s.togglePillTextActive,
                  ]}
                >
                  {isHe ? "סימון מרכיבים" : "Checklist mode"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.addIngredientsPill}
                onPress={() => {
                  if (!recipe) return;
                  addFromRecipe(recipe, rawIngredients);
                  showToast(
                    isHe
                      ? "המרכיבים נוספו לרשימת קניות 🛒"
                      : "Ingredients added to shopping list 🛒",
                  );
                }}
              >
                <Text style={s.addIngredientsPillText}>
                  {isHe ? "הוסף לקניות" : "Add to shopping"}
                </Text>
              </TouchableOpacity>
            </View>

            {shownIngredients.map((ing, i) => {
              const done = !!ingredientDone[i];
              return (
                <TouchableOpacity
                  key={`${ing}-${i}`}
                  style={[
                    s.ingredientRow,
                    done && s.ingredientRowDone,
                    { flexDirection: isHe ? "row-reverse" : "row" },
                  ]}
                  onPress={() => shoppingMode && toggleIngredientDone(i)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[s.ingredientCheck, done && s.ingredientCheckDone]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      s.ingredientText,
                      done && s.ingredientTextDone,
                      { textAlign: isHe ? "right" : "left" },
                    ]}
                  >
                    {ing}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.sectionCard}>
            <View
              style={[
                s.sectionHeader,
                { flexDirection: isHe ? "row-reverse" : "row" },
              ]}
            >
              <Text style={s.sectionTitle}>{isHe ? "שלבי הכנה" : "Steps"}</Text>
              <TouchableOpacity
                style={s.cookModeBtn}
                onPress={() => setCookingMode(true)}
              >
                <Text style={s.cookModeBtnText}>
                  {isHe ? "מצב בישול" : "Cooking mode"}
                </Text>
              </TouchableOpacity>
            </View>

            {shownSteps.map((step, i) => {
              const done = !!stepDone[i];
              const stepMinutes = parseMinutesFromStep(step);
              return (
                <Swipeable
                  key={`${step}-${i}`}
                  friction={2}
                  rightThreshold={72}
                  overshootRight={false}
                  onSwipeableWillOpen={() =>
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  }
                  onSwipeableOpen={() => toggleStepDone(i)}
                  renderRightActions={() => (
                    <View style={s.swipeDone}>
                      <Ionicons name="checkmark-done" size={19} color="#fff" />
                    </View>
                  )}
                >
                  <TouchableOpacity
                    style={[
                      s.stepCard,
                      done && s.stepCardDone,
                      { flexDirection: isHe ? "row-reverse" : "row" },
                    ]}
                    onPress={() => toggleStepDone(i)}
                    activeOpacity={0.9}
                  >
                    <View style={[s.stepBubble, done && s.stepBubbleDone]}>
                      <Text style={s.stepBubbleText}>{done ? "✓" : i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          s.stepText,
                          done && s.stepTextDone,
                          { textAlign: isHe ? "right" : "left" },
                        ]}
                      >
                        {step}
                      </Text>
                      {stepMinutes ? (
                        <TouchableOpacity
                          onPress={() => handleTimerStart(stepMinutes)}
                        >
                          <Text
                            style={[
                              s.stepTimerLink,
                              { textAlign: isHe ? "right" : "left" },
                            ]}
                          >
                            ⏱ {stepMinutes} {isHe ? "דקות" : "min"}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            })}
          </View>

          {!isDraft && recipe?.notes_he ? (
            <View style={s.notesBox}>
              <Text
                style={[s.notesTitle, { textAlign: isHe ? "right" : "left" }]}
              >
                💡 {isHe ? "הערות" : "Notes"}
              </Text>
              <Text style={[s.notes, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? recipe.notes_he : recipe.notes_en}
              </Text>
            </View>
          ) : null}

          <View style={{ height: 140 + insets.bottom }} />
        </View>
      </ScrollView>

      <View
        style={[s.actionBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      >
        {isDraft ? (
          <View
            style={[
              s.actionRow,
              { flexDirection: isHe ? "row-reverse" : "row" },
            ]}
          >
            <TouchableOpacity style={s.primaryAction} onPress={handleSaveDraft}>
              <Text style={s.primaryActionText}>
                {isHe ? "שמור מתכון" : "Save recipe"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.secondaryAction}
              onPress={() => navigation.goBack()}
            >
              <Text style={s.secondaryActionText}>
                {isHe ? "ביטול" : "Cancel"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              s.actionRow,
              { flexDirection: isHe ? "row-reverse" : "row" },
            ]}
          >
            <TouchableOpacity
              style={s.primaryAction}
              onPress={() => {
                if (!recipe) return;
                addFromRecipe(recipe, rawIngredients);
                showToast(
                  isHe ? "נוסף לרשימת קניות 🛒" : "Added to shopping list 🛒",
                );
              }}
            >
              <Text style={s.primaryActionText}>
                {isHe ? "הוסף לרשימת קניות" : "Add to shopping list"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.secondaryAction}
              onPress={() => recipe && shareRecipe(recipe)}
            >
              <Text style={s.secondaryActionText}>
                {isHe ? "שתף" : "Share"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.deleteAction} onPress={handleDelete}>
              <Ionicons
                name="trash-outline"
                size={20}
                color={Colors.text.primary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {cookingMode ? (
        <CookingModeOverlay
          steps={shownSteps}
          isHe={isHe}
          onClose={() => setCookingMode(false)}
        />
      ) : null}

      <Toast message={toast} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 0 },
  hero: { width: "100%", position: "relative" },
  heroImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: { fontSize: 60 },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroTitleWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
  },
  heroTitle: {
    ...Typography.h1,
    color: "#fff",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
  },
  favBtn: {
    position: "absolute",
    top: 16,
    right: 12,
  },
  favInnerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    position: "absolute",
    top: 16,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 14, paddingTop: 12 },

  quickInfoRow: {
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  quickInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickInfoText: {
    ...Typography.label,
    color: Colors.text.primary,
  },
  infoDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 12,
    marginBottom: 12,
  },

  servingsAdjuster: {
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  servingsLabel: {
    ...Typography.label,
    color: Colors.text.secondary,
  },
  servingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsBtnText: {
    ...Typography.h3,
    color: Colors.text.primary,
    fontSize: 18,
  },
  servingsValue: {
    ...Typography.h3,
    minWidth: 20,
    textAlign: "center",
    color: Colors.text.primary,
  },
  cookedBtn: {
    marginStart: "auto",
    borderRadius: 10,
    backgroundColor: "#FFECE3",
    borderWidth: 1,
    borderColor: "#FFD3BF",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cookedBtnText: {
    ...Typography.caption,
    color: "#A8512F",
    fontWeight: "700",
  },
  cookHistory: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  timerLive: {
    ...Typography.label,
    color: Colors.primary,
    marginBottom: 8,
  },

  sectionCard: {
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  sectionHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
  },
  togglePill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  togglePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  togglePillText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: "600",
  },
  togglePillTextActive: { color: "#fff" },
  addIngredientsPill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C7E9E3",
    backgroundColor: "#EAF7F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addIngredientsPillText: {
    ...Typography.caption,
    color: "#2C756A",
    fontWeight: "700",
  },

  ingredientRow: {
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingVertical: 8,
  },
  ingredientRowDone: {
    opacity: 0.65,
  },
  ingredientCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientCheckDone: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  ingredientText: {
    ...Typography.body,
    flex: 1,
    color: Colors.text.primary,
    lineHeight: 24,
  },
  ingredientTextDone: {
    textDecorationLine: "line-through",
  },

  cookModeBtn: {
    borderRadius: 10,
    backgroundColor: "#EAF7F5",
    borderWidth: 1,
    borderColor: "#C7E9E3",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cookModeBtnText: {
    ...Typography.caption,
    color: "#2C756A",
    fontWeight: "700",
  },
  swipeDone: {
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    width: 64,
    marginBottom: 8,
  },
  stepCard: {
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    gap: 10,
    marginBottom: 8,
    alignItems: "flex-start",
  },
  stepCardDone: {
    opacity: 0.68,
  },
  stepBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepBubbleDone: {
    backgroundColor: Colors.secondary,
  },
  stepBubbleText: {
    ...Typography.label,
    color: "#fff",
    fontWeight: "700",
  },
  stepText: {
    ...Typography.body,
    color: Colors.text.primary,
    lineHeight: 24,
  },
  stepTextDone: {
    textDecorationLine: "line-through",
  },
  stepTimerLink: {
    ...Typography.caption,
    color: Colors.primary,
    marginTop: 4,
  },

  notesBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FBFBF8",
    marginBottom: 12,
  },
  notesTitle: {
    ...Typography.label,
    color: Colors.text.secondary,
    marginBottom: 6,
  },
  notes: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    lineHeight: 21,
  },

  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 16,
  },
  actionRow: {
    gap: 8,
    alignItems: "center",
  },
  primaryAction: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryActionText: {
    ...Typography.button,
    color: "#fff",
    fontSize: 14,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryActionText: {
    ...Typography.button,
    color: Colors.text.primary,
    fontSize: 14,
  },
  deleteAction: {
    width: 48,
    height: 48,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },

  cookContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
  },
  cookTop: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cookProgress: {
    ...Typography.label,
    color: Colors.text.secondary,
  },
  cookCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cookStepCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    padding: 20,
    justifyContent: "center",
  },
  cookStepText: {
    ...Typography.h2,
    color: Colors.text.primary,
    fontSize: 28,
    lineHeight: 38,
  },
  cookNav: {
    gap: 10,
    marginTop: 14,
  },
  cookBtn: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  cookBtnDisabled: {
    opacity: 0.45,
  },
  cookBtnText: {
    ...Typography.button,
    color: "#fff",
  },
  cookExitBtn: {
    marginTop: 10,
    alignSelf: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cookExitBtnText: {
    ...Typography.label,
    color: Colors.text.primary,
  },
});
