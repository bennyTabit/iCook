import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  TextInput,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { useThemeColors } from "../hooks/useThemeColors";
import { isHebrew } from "../lib/i18n";
import { getRecipeById, insertRecipe, getRecipeUserData, upsertRecipeUserData, type RecipeUserData } from "../lib/db";
import { logCook } from '../lib/cookLog';
import { useRecipeStore } from "../store/recipeStore";
import { useShoppingStore } from "../store/shoppingStore";
import { useCollectionStore } from "../store/collectionStore";
import { shareRecipe } from "../lib/sharing";
import Toast from "../components/Toast";
import type { Recipe } from "../lib/db";

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

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  if (mixedUnicode)
    return Number(mixedUnicode[1]) + (UNICODE_FRACTIONS[mixedUnicode[2]] ?? 0);
  const mixedFraction = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFraction) {
    const whole = Number(mixedFraction[1]);
    const num = Number(mixedFraction[2]);
    const den = Number(mixedFraction[3]);
    if (den === 0) return null;
    return whole + num / den;
  }
  const fraction = t.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);
    if (den === 0) return null;
    return num / den;
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

// Extracts the leading quantity token from an ingredient string so we can
// display original vs scaled side-by-side when the ratio has changed.
// e.g. "2 cups flour" → { qtyStr: "2", value: 2, rest: " cups flour" }
// e.g. "1 1/2 כפות שמן" → { qtyStr: "1 1/2", value: 1.5, rest: " כפות שמן" }
function parseLeadingQty(text: string): { qtyStr: string; value: number; rest: string } | null {
  const m = text.match(
    /^(\d+\s+\d+\/\d+|\d+[¼½¾⅓⅔⅛⅜⅝⅞]|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|\d+(?:[.,]\d+)?)/,
  );
  if (!m) return null;
  const qtyStr = m[0];
  const value = parseNumericToken(qtyStr);
  if (value == null || value <= 0) return null;
  return { qtyStr, value, rest: text.slice(qtyStr.length) };
}

function parseMinutesFromStep(step: string) {
  const m = step.match(/(\d+)\s*(דקות|דקה|min|minutes)/i);
  if (!m) return null;
  const parsed = parseInt(m[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

// ─── Cooking Mode Overlay ─────────────────────────────────────────────────────

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
  const [current, setCurrent] = useState(0);
  const total = Math.max(steps.length, 1);
  const progress = (current + 1) / total;

  function goPrev() {
    void Haptics.selectionAsync();
    setCurrent((x) => Math.max(x - 1, 0));
  }

  function goNext() {
    void Haptics.selectionAsync();
    if (current < steps.length - 1) {
      setCurrent((x) => x + 1);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    }
  }

  const isLast = current >= steps.length - 1;
  const stepText = steps[current] ?? "";
  const stepMinutes = parseMinutesFromStep(stepText);

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={cm.container} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={cm.header}>
          <TouchableOpacity style={cm.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
          <Text style={cm.headerTitle}>
            {isHe ? "מצב בישול" : "Cooking Mode"}
          </Text>
          <Text style={cm.stepCounter}>
            {current + 1} / {total}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={cm.progressTrack}>
          <View style={[cm.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>

        {/* Step dots */}
        <View style={cm.dotsRow}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[cm.dot, i === current && cm.dotActive, i < current && cm.dotDone]}
            />
          ))}
        </View>

        {/* Step card */}
        <View style={cm.stepCard}>
          <View style={cm.stepBadge}>
            <Text style={cm.stepBadgeText}>
              {isHe ? "שלב" : "Step"} {current + 1}
            </Text>
          </View>
          <Text style={[cm.stepText, { textAlign: isHe ? "right" : "left" }]}>
            {stepText}
          </Text>
          {stepMinutes ? (
            <View style={cm.timerChip}>
              <Ionicons name="timer-outline" size={14} color={Colors.primary} />
              <Text style={cm.timerChipText}>
                {stepMinutes} {isHe ? "דקות" : "min"}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Navigation */}
        <View style={cm.navRow}>
          <TouchableOpacity
            style={[cm.navBtn, current <= 0 && cm.navBtnDisabled]}
            disabled={current <= 0}
            onPress={goPrev}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isHe ? "chevron-forward" : "chevron-back"}
              size={20}
              color={current <= 0 ? Colors.text.tertiary : Colors.text.primary}
            />
            <Text
              style={[
                cm.navBtnText,
                current <= 0 && cm.navBtnTextDisabled,
              ]}
            >
              {isHe ? "הקודם" : "Previous"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[cm.navBtnPrimary, isLast && cm.navBtnFinish]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={cm.navBtnPrimaryText}>
              {isLast
                ? isHe
                  ? "סיום בישול 🎉"
                  : "Done cooking 🎉"
                : isHe
                  ? "הבא"
                  : "Next"}
            </Text>
            {!isLast && (
              <Ionicons
                name={isHe ? "chevron-back" : "chevron-forward"}
                size={20}
                color="#fff"
              />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecipeDetailScreen({ route, navigation }: any) {
  const C = useThemeColors();
  const id: number | undefined = route.params?.id;
  const draft: DraftRecipe | undefined = route.params?.draft;
  const isDraft = !!draft;
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { toggleFav, removeRecipe, loadRecipes } = useRecipeStore();
  const { addFromRecipe } = useShoppingStore();
  const { collections, loadCollections, addRecipe: addToCol, removeRecipe: removeFromCol, getRecipeCollections } = useCollectionStore();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [toast, setToast] = useState("");
  const [ingredientDone, setIngredientDone] = useState<Record<number, boolean>>({});
  const [stepDone, setStepDone] = useState<Record<number, boolean>>({});
  const [checklistMode, setChecklistMode] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);
  const [timerLeftSec, setTimerLeftSec] = useState(0);
  const [servings, setServings] = useState(2);
  const [cookHistory, setCookHistory] = useState(0);
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [recipeCollectionIds, setRecipeCollectionIds] = useState<number[]>([]);
  const [userData, setUserData] = useState<RecipeUserData>({ recipe_id: 0, rating: null, personal_note: null, last_cooked_at: null });
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const noteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const favScale = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const timerWasRunningRef = useRef(false);
  const heroHeight = Math.max(240, Math.round(height * 0.36));

  async function loadRecipe() {
    if (!id) return;
    const fresh = await getRecipeById(id);
    setRecipe(fresh);
    if (id) {
      const ud = await getRecipeUserData(id);
      setUserData(ud);
      setNoteText(ud.personal_note ?? '');
    }
  }

  useEffect(() => {
    if (isDraft) return;
    void loadRecipe();
  }, [id, isDraft]);

  useFocusEffect(
    React.useCallback(() => {
      if (isDraft) return () => {};
      void loadRecipe();
      return () => {};
    }, [id, isDraft]),
  );

  useEffect(() => {
    if (isDraft) { setServings(2); return; }
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

  // Timer countdown
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const title = isDraft
    ? (draft?.title ?? "")
    : isHe
      ? (recipe?.title_he ?? "")
      : (recipe?.title_en ?? recipe?.title_he ?? "");

  const isFav = !isDraft && recipe ? recipe.is_favorite === 1 : false;

  const rawIngredients = useMemo(() => {
    if (isDraft) return draft?.ingredients ?? [];
    return parseSectionLines(
      isHe
        ? (recipe?.notes_he ?? "")
        : (recipe?.notes_en ?? recipe?.notes_he ?? ""),
      "ingredients",
    );
  }, [isDraft, draft?.ingredients, recipe?.notes_he, recipe?.notes_en, isHe]);

  const rawSteps = useMemo(() => {
    if (isDraft) return draft?.steps ?? [];
    return parseSectionLines(
      isHe
        ? (recipe?.notes_he ?? "")
        : (recipe?.notes_en ?? recipe?.notes_he ?? ""),
      "steps",
    );
  }, [isDraft, draft?.steps, recipe?.notes_he, recipe?.notes_en, isHe]);

  const baseServings = isDraft ? 2 : Math.max(recipe?.servings ?? 2, 1);
  const ratio = Math.max(servings, 1) / baseServings;

  const shownIngredients = useMemo(
    () => rawIngredients.map((ing) => scaleIngredientText(ing, ratio)),
    [rawIngredients, ratio],
  );

  const timerLabel = timerLeftSec > 0
    ? `${Math.floor(timerLeftSec / 60)}:${String(timerLeftSec % 60).padStart(2, "0")}`
    : null;

  // ── Handlers ────────────────────────────────────────────────────────────────

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

  async function handleOpenCollectionModal() {
    if (!id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loadCollections();
    const cols = await getRecipeCollections(id);
    setRecipeCollectionIds(cols.map((c) => c.id));
    setCollectionModalVisible(true);
  }

  async function handleToggleCollection(collectionId: number) {
    if (!id) return;
    void Haptics.selectionAsync();
    if (recipeCollectionIds.includes(collectionId)) {
      await removeFromCol(collectionId, id);
      setRecipeCollectionIds((prev) => prev.filter((x) => x !== collectionId));
    } else {
      await addToCol(collectionId, id);
      setRecipeCollectionIds((prev) => [...prev, collectionId]);
    }
  }

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
        draft.ingredients.length ? `מרכיבים:\n${draft.ingredients.join("\n")}` : "",
        draft.steps.length ? `\n\nשלבים:\n${draft.steps.join("\n")}` : "",
      ].join("").trim(),
      notes_en: [
        draft.ingredients.length ? `Ingredients:\n${draft.ingredients.join("\n")}` : "",
        draft.steps.length ? `\n\nSteps:\n${draft.steps.join("\n")}` : "",
      ].join("").trim(),
    });
    await loadRecipes();
    navigation.navigate("RecipeDetail", { id: newId });
  }

  async function handleCookedIt() {
    const next = cookHistory + 1;
    setCookHistory(next);
    await AsyncStorage.setItem(historyKey, String(next));
    // Log the cook date
    if (id && recipe) {
      void logCook({ id, title_he: recipe.title_he ?? '', title_en: recipe.title_en ?? null, category_name_en: (recipe as any).category_name_en ?? null });
      void upsertRecipeUserData(id, { last_cooked_at: new Date().toISOString() });
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(isHe ? "מעולה! סומן שבישלת את זה 👨‍🍳" : "Great! Marked as cooked 👨‍🍳");
  }

  async function handleRating(stars: number) {
    if (!id) return;
    void Haptics.selectionAsync();
    const newRating = userData.rating === stars ? null : stars; // tap same star = clear
    setUserData((prev) => ({ ...prev, rating: newRating }));
    await upsertRecipeUserData(id, { rating: newRating });
  }

  function handleNoteChange(text: string) {
    setNoteText(text);
    if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current);
    noteDebounceRef.current = setTimeout(async () => {
      if (!id) return;
      setNoteSaving(true);
      await upsertRecipeUserData(id, { personal_note: text.trim() || null });
      setNoteSaving(false);
    }, 600);
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
      Animated.spring(favScale, { toValue: 1.3, useNativeDriver: true, friction: 5 }),
      Animated.spring(favScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
    ]).start();
    toggleFav(id, recipe.is_favorite ?? 0);
    setRecipe((prev) =>
      prev ? { ...prev, is_favorite: prev.is_favorite ? 0 : 1 } : prev,
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function handleTimerStart(minutes?: number | null) {
    const mins = minutes ?? recipe?.cook_time_min ?? null;
    if (!mins || mins <= 0) {
      Alert.alert(isHe ? "אין זמן זמין" : "No time available");
      return;
    }
    timerWasRunningRef.current = true;
    setTimerLeftSec(mins * 60);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(isHe ? `הטיימר התחיל: ${mins} דקות` : `Timer started: ${mins} min`);
  }

  function handleAddToShopping() {
    if (!recipe) return;
    addFromRecipe(recipe, rawIngredients);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(isHe ? "נוסף לרשימת קניות 🛒" : "Added to shopping list 🛒");
  }

  if (!isDraft && !recipe) return <View style={[s.container, { backgroundColor: C.background }]} />;

  const cookTimeMin = recipe?.cook_time_min ?? 0;
  const prepTimeMin = recipe?.prep_time_min ?? 0;
  const totalMin = (cookTimeMin || 0) + (prepTimeMin || 0);

  const difficultyColor =
    recipe?.difficulty === "hard"
      ? Colors.difficulty.hard
      : recipe?.difficulty === "medium"
        ? Colors.difficulty.medium
        : Colors.difficulty.easy;

  // ── Render ──────────────────────────────────────────────────────────────────

  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange: [heroHeight - 70, heroHeight - 20],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      {/* ── Sticky title header (appears on scroll) ── */}
      <Animated.View
        style={[
          s.stickyHeader,
          { paddingTop: insets.top + 6, opacity: stickyHeaderOpacity },
        ]}
        pointerEvents="none"
      >
        <Text style={s.stickyHeaderTitle} numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        {/* ── Hero ── */}
        {recipe?.image_uri ? (
          /* ── Full photo hero ── */
          <View style={[s.hero, { height: heroHeight }]}>
            <Image
              source={{ uri: recipe.image_uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0)", "rgba(0,0,0,0.7)"]}
              style={StyleSheet.absoluteFill}
              locations={[0, 0.35, 1]}
            />
            <View
              style={[s.heroTopBar, { paddingTop: insets.top + 8, flexDirection: isHe ? "row-reverse" : "row" }]}
            >
              <TouchableOpacity style={s.heroIconBtn} onPress={() => { void Haptics.selectionAsync(); navigation.goBack(); }}>
                <Ionicons name={isHe ? "chevron-forward" : "chevron-back"} size={22} color="#fff" />
              </TouchableOpacity>
              <View style={[s.heroRightBtns, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                {!isDraft && (
                  <>
                    <TouchableOpacity style={s.heroIconBtn} onPress={() => recipe && void shareRecipe(recipe)}>
                      <Ionicons name="share-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.heroIconBtn} onPress={() => { void Haptics.selectionAsync(); navigation.navigate("EditRecipe", { id }); }}>
                      <Ionicons name="create-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ scale: favScale }] }}>
                      <TouchableOpacity style={s.heroIconBtn} onPress={onFavoritePress}>
                        <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? "#FF4757" : "#fff"} />
                      </TouchableOpacity>
                    </Animated.View>
                  </>
                )}
              </View>
            </View>
            <View style={[s.heroBottom, { paddingBottom: 20 }]}>
              {recipe?.source_type && recipe.source_type !== "manual" ? (
                <View style={s.sourceBadge}><Text style={s.sourceBadgeText}>{recipe.source_type.toUpperCase()}</Text></View>
              ) : null}
              <Text style={[s.heroTitle, { textAlign: isHe ? "right" : "left" }]} numberOfLines={2}>{title}</Text>
              {cookHistory > 0 ? (
                <Text style={[s.cookHistoryHero, { textAlign: isHe ? "right" : "left" }]}>
                  {isHe ? `בושל ${cookHistory} פעמים 👨‍🍳` : `Cooked ${cookHistory} times 👨‍🍳`}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          /* ── Compact no-photo header ── */
          <LinearGradient
            colors={["#FF6B6B", "#FF8E53"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.compactHero, { paddingTop: insets.top + 8 }]}
          >
            {/* Decorative emoji watermark */}
            <Text style={s.compactHeroWatermark}>🍽️</Text>

            {/* Top bar */}
            <View style={[s.heroTopBar, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <TouchableOpacity style={s.heroIconBtn} onPress={() => { void Haptics.selectionAsync(); navigation.goBack(); }}>
                <Ionicons name={isHe ? "chevron-forward" : "chevron-back"} size={22} color="#fff" />
              </TouchableOpacity>
              <View style={[s.heroRightBtns, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                {!isDraft && (
                  <>
                    <TouchableOpacity style={s.heroIconBtn} onPress={() => recipe && void shareRecipe(recipe)}>
                      <Ionicons name="share-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.heroIconBtn} onPress={() => { void Haptics.selectionAsync(); navigation.navigate("EditRecipe", { id }); }}>
                      <Ionicons name="create-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ scale: favScale }] }}>
                      <TouchableOpacity style={s.heroIconBtn} onPress={onFavoritePress}>
                        <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? "#FF4757" : "#fff"} />
                      </TouchableOpacity>
                    </Animated.View>
                  </>
                )}
              </View>
            </View>

            {/* Title block */}
            <View style={[s.compactHeroTitle, { alignItems: isHe ? "flex-end" : "flex-start" }]}>
              {recipe?.source_type && recipe.source_type !== "manual" ? (
                <View style={s.sourceBadge}><Text style={s.sourceBadgeText}>{recipe.source_type.toUpperCase()}</Text></View>
              ) : null}
              <Text style={[s.heroTitle, { textAlign: isHe ? "right" : "left" }]} numberOfLines={2}>{title}</Text>
              {cookHistory > 0 ? (
                <Text style={[s.cookHistoryHero, { textAlign: isHe ? "right" : "left" }]}>
                  {isHe ? `בושל ${cookHistory} פעמים 👨‍🍳` : `Cooked ${cookHistory} times 👨‍🍳`}
                </Text>
              ) : null}
            </View>
          </LinearGradient>
        )}

        {/* ── Info chips ── */}
        <View style={[s.infoStrip, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          {totalMin > 0 ? (
            <TouchableOpacity
              style={[s.infoChip, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
              onPress={() => handleTimerStart(cookTimeMin || totalMin)}
              activeOpacity={0.7}
            >
              <Ionicons name="timer-outline" size={15} color={Colors.primary} />
              <Text style={[s.infoChipText, { color: Colors.primary }]}>
                {totalMin} {isHe ? "דקות" : "min"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={[s.infoChip, { backgroundColor: C.surfaceElevated, borderColor: C.border }, ratio !== 1 && { borderColor: Colors.primary + "44", backgroundColor: Colors.primary + "12" }]}>
            <Ionicons name="people-outline" size={15} color={ratio !== 1 ? Colors.primary : Colors.text.secondary} />
            <Text style={[s.infoChipText, ratio !== 1 && { color: Colors.primary }]}>
              {formatScaled(servings)} {isHe ? "מנות" : "servings"}
              {ratio !== 1 ? ` (×${formatScaled(ratio)})` : ""}
            </Text>
          </View>

          {recipe?.difficulty ? (
            <View style={[s.infoChip, { borderColor: difficultyColor + "44", backgroundColor: difficultyColor + "18" }]}>
              <View style={[s.difficultyDot, { backgroundColor: difficultyColor }]} />
              <Text style={[s.infoChipText, { color: difficultyColor }]}>
                {t(recipe.difficulty as any)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Star rating ── */}
        {!isDraft && (
          <View style={[s.ratingRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <Text style={s.ratingLabel}>{isHe ? "דירוג:" : "Rating:"}</Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => void handleRating(star)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  style={s.starBtn}
                >
                  <Ionicons
                    name={(userData.rating ?? 0) >= star ? "star" : "star-outline"}
                    size={22}
                    color={(userData.rating ?? 0) >= star ? "#FFD700" : Colors.text.tertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {userData.last_cooked_at && (
              <Text style={[s.lastCookedText, { marginStart: "auto" }]}>
                {isHe
                  ? `בושל ב-${new Date(userData.last_cooked_at).toLocaleDateString('he-IL')}`
                  : `Cooked ${new Date(userData.last_cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </Text>
            )}
          </View>
        )}

        {/* ── Active timer banner ── */}
        {timerLabel ? (
          <View style={s.timerBanner}>
            <Ionicons name="timer" size={18} color="#fff" />
            <Text style={s.timerBannerText}>
              {isHe ? `טיימר: ${timerLabel}` : `Timer: ${timerLabel}`}
            </Text>
            <TouchableOpacity onPress={() => setTimerLeftSec(0)} style={s.timerCancelBtn}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={s.body}>
          {/* ── Servings stepper + cooked ── */}
          <View style={[s.servingsRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <View style={{ alignItems: isHe ? "flex-end" : "flex-start" }}>
              <Text style={s.servingsLabel}>{isHe ? "מנות" : "Servings"}</Text>
              {ratio !== 1 && (
                <TouchableOpacity
                  onPress={() => { void Haptics.selectionAsync(); setServings(baseServings); }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={s.servingsReset}>
                    {isHe ? "איפוס" : "Reset"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[s.stepper, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <TouchableOpacity
                style={s.stepperBtn}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setServings((x) => Math.max(0.5, parseFloat((x - 0.5).toFixed(1))));
                }}
              >
                <Ionicons name="remove" size={18} color={Colors.text.primary} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={s.stepperValue}>{formatScaled(servings)}</Text>
                {ratio !== 1 && (
                  <Text style={s.stepperRatio}>
                    ×{formatScaled(ratio)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={s.stepperBtn}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setServings((x) => parseFloat((x + 0.5).toFixed(1)));
                }}
              >
                <Ionicons name="add" size={18} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.cookedBtn} onPress={handleCookedIt} activeOpacity={0.8}>
              <Text style={s.cookedBtnText}>
                {isHe ? "בישלתי את זה ✓" : "I cooked this ✓"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Ingredients ── */}
          <View style={[s.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={[s.sectionHeader, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.sectionTitle}>{isHe ? "מרכיבים" : "Ingredients"}</Text>
                {shownIngredients.length > 0 && (
                  <View style={s.countBadge}>
                    <Text style={s.countBadgeText}>{shownIngredients.length}</Text>
                  </View>
                )}
              </View>
              <View style={[s.sectionHeaderActions, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                <TouchableOpacity
                  style={[s.pill, checklistMode && s.pillActive]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setChecklistMode((v) => !v);
                  }}
                >
                  <Ionicons
                    name={checklistMode ? "checkmark-circle" : "checkmark-circle-outline"}
                    size={13}
                    color={checklistMode ? "#fff" : Colors.text.secondary}
                  />
                  <Text style={[s.pillText, checklistMode && s.pillTextActive]}>
                    {isHe ? "סימון" : "Check"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.pillTeal}
                  onPress={() => {
                    if (!recipe) return;
                    addFromRecipe(recipe, rawIngredients);
                    showToast(isHe ? "נוסף לרשימת קניות 🛒" : "Added to shopping 🛒");
                  }}
                >
                  <Ionicons name="cart-outline" size={13} color="#2C756A" />
                  <Text style={s.pillTealText}>{isHe ? "לקניות" : "Shop"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {shownIngredients.length === 0 ? (
              <Text style={[s.emptyHint, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "אין מרכיבים — ערוך את המתכון להוספה" : "No ingredients — edit recipe to add"}
              </Text>
            ) : (
              shownIngredients.map((ing, i) => {
                const done = !!ingredientDone[i];
                // When scaled, parse the leading qty for side-by-side display
                const leadingQty = ratio !== 1 ? parseLeadingQty(rawIngredients[i]) : null;
                return (
                  <TouchableOpacity
                    key={`ing-${i}`}
                    style={[
                      s.ingredientRow,
                      done && s.ingredientRowDone,
                      { flexDirection: isHe ? "row-reverse" : "row" },
                    ]}
                    onPress={() => checklistMode && toggleIngredientDone(i)}
                    activeOpacity={checklistMode ? 0.7 : 1}
                  >
                    {checklistMode ? (
                      <View style={[s.checkbox, done && s.checkboxDone]}>
                        {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                      </View>
                    ) : (
                      <View style={s.bullet} />
                    )}
                    <Text
                      style={[
                        s.ingredientText,
                        done && s.ingredientTextDone,
                        { textAlign: isHe ? "right" : "left" },
                      ]}
                    >
                      {leadingQty ? (
                        <>
                          <Text style={[s.qtyOriginal, done && s.ingredientTextDone]}>
                            {leadingQty.qtyStr}
                          </Text>
                          <Text style={[s.qtyScaled, done && s.ingredientTextDone]}>
                            {" "}{formatScaled(leadingQty.value * ratio)}
                          </Text>
                          <Text style={done && s.ingredientTextDone}>
                            {leadingQty.rest}
                          </Text>
                        </>
                      ) : (
                        ing
                      )}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* ── Steps ── */}
          <View style={[s.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={[s.sectionHeader, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.sectionTitle}>{isHe ? "שלבי הכנה" : "Steps"}</Text>
                {rawSteps.length > 0 && (
                  <View style={s.countBadge}>
                    <Text style={s.countBadgeText}>{rawSteps.length}</Text>
                  </View>
                )}
              </View>
              {rawSteps.length > 0 && (
                <TouchableOpacity
                  style={s.pillCoral}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setCookingMode(true);
                  }}
                >
                  <Ionicons name="restaurant" size={13} color="#fff" />
                  <Text style={s.pillCoralText}>{isHe ? "מצב בישול" : "Cook mode"}</Text>
                </TouchableOpacity>
              )}
            </View>

            {rawSteps.length === 0 ? (
              <Text style={[s.emptyHint, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "אין שלבים — ערוך את המתכון להוספה" : "No steps — edit recipe to add"}
              </Text>
            ) : (
              rawSteps.map((step, i) => {
                const done = !!stepDone[i];
                const stepMins = parseMinutesFromStep(step);
                return (
                  <Swipeable
                    key={`step-${i}`}
                    friction={2}
                    rightThreshold={72}
                    overshootRight={false}
                    onSwipeableWillOpen={() =>
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    }
                    onSwipeableOpen={() => toggleStepDone(i)}
                    renderRightActions={() => (
                      <View style={s.swipeDoneAction}>
                        <Ionicons name="checkmark-done" size={20} color="#fff" />
                        <Text style={s.swipeDoneText}>{isHe ? "בוצע" : "Done"}</Text>
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
                      activeOpacity={0.85}
                    >
                      <View style={[s.stepNumber, done && s.stepNumberDone]}>
                        {done ? (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        ) : (
                          <Text style={s.stepNumberText}>{i + 1}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text
                          style={[
                            s.stepText,
                            done && s.stepTextDone,
                            { textAlign: isHe ? "right" : "left" },
                          ]}
                        >
                          {step}
                        </Text>
                        {stepMins ? (
                          <TouchableOpacity
                            style={[s.stepTimerChip, { alignSelf: isHe ? "flex-end" : "flex-start" }]}
                            onPress={() => handleTimerStart(stepMins)}
                          >
                            <Ionicons name="timer-outline" size={12} color={Colors.primary} />
                            <Text style={s.stepTimerChipText}>
                              {stepMins} {isHe ? "דקות" : "min"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </Swipeable>
                );
              })
            )}
          </View>

          {/* ── Personal notes ── */}
          {!isDraft && (
            <View style={[s.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View style={[s.sectionHeader, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                <Text style={s.sectionTitle}>{isHe ? "הערות אישיות" : "My notes"}</Text>
                {noteSaving && <Text style={s.noteSavingText}>{isHe ? "שומר..." : "Saving..."}</Text>}
              </View>
              <TextInput
                style={[s.noteInput, { textAlign: isHe ? "right" : "left" }]}
                value={noteText}
                onChangeText={handleNoteChange}
                placeholder={isHe ? "הוסף הערות אישיות, שינויים שעשית, ..." : "Add personal notes, changes you made, ..."}
                placeholderTextColor={Colors.text.tertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* ── Bottom action bar ── */}
      <View style={[s.actionBar, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: C.surfaceElevated, borderTopColor: C.border }]}>
        {isDraft ? (
          <View style={[s.actionRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <TouchableOpacity style={s.actionBtnPrimary} onPress={handleSaveDraft}>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={s.actionBtnPrimaryText}>{isHe ? "שמור מתכון" : "Save recipe"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtnSecondary, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => navigation.goBack()}>
              <Text style={[s.actionBtnSecondaryText, { color: C.text.secondary }]}>{isHe ? "ביטול" : "Cancel"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.actionRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <TouchableOpacity style={s.actionBtnPrimary} onPress={handleAddToShopping}>
              <Ionicons name="cart-outline" size={18} color="#fff" />
              <Text style={s.actionBtnPrimaryText}>{isHe ? "הוסף לקניות" : "Add to cart"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnIcon, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => void handleOpenCollectionModal()}
            >
              <Ionicons name="albums-outline" size={20} color={C.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnIcon, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => recipe && void shareRecipe(recipe)}
            >
              <Ionicons name="share-social-outline" size={20} color={C.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtnIcon, { backgroundColor: C.surface, borderColor: C.border }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color="#FF4757" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Cooking mode overlay ── */}
      {cookingMode && rawSteps.length > 0 ? (
        <CookingModeOverlay
          steps={rawSteps}
          isHe={isHe}
          onClose={() => setCookingMode(false)}
        />
      ) : null}

      {/* ── Collection picker modal ── */}
      <Modal
        visible={collectionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCollectionModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setCollectionModalVisible(false)}
        />
        <View style={[s.collectionSheet, { backgroundColor: C.surfaceElevated }]}>
          <View style={s.collectionHandle} />
          <Text style={[s.collectionTitle, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "הוסף לאוסף" : "Add to collection"}
          </Text>
          {collections.length === 0 ? (
            <Text style={[s.collectionEmpty, { textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "אין אוספים — צור אוסף מהתפריט" : "No collections — create one from the menu"}
            </Text>
          ) : (
            collections.map((col) => {
              const inCol = recipeCollectionIds.includes(col.id);
              const colName = isHe ? col.name_he : (col.name_en ?? col.name_he);
              return (
                <TouchableOpacity
                  key={col.id}
                  style={[s.collectionRow, { flexDirection: isHe ? "row-reverse" : "row" }]}
                  onPress={() => void handleToggleCollection(col.id)}
                  activeOpacity={0.75}
                >
                  <View style={[s.collectionIconWrap, { backgroundColor: col.color + "22" }]}>
                    <Text style={{ fontSize: 22 }}>{col.icon}</Text>
                  </View>
                  <Text style={[s.collectionRowName, { flex: 1, textAlign: isHe ? "right" : "left" }]}>
                    {colName}
                  </Text>
                  <Ionicons
                    name={inCol ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={inCol ? col.color : Colors.text.tertiary}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </Modal>

      <Toast message={toast} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Sticky header
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: Colors.background,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  stickyHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },

  // Hero
  hero: { width: "100%", overflow: "hidden" },
  compactHero: {
    width: "100%",
    paddingHorizontal: 12,
    paddingBottom: 18,
    gap: 12,
    overflow: "hidden",
  },
  compactHeroWatermark: {
    position: "absolute",
    right: 16,
    bottom: 10,
    fontSize: 80,
    opacity: 0.18,
  },
  compactHeroTitle: {
    paddingHorizontal: 4,
    gap: 6,
  },
  heroPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroEmoji: { fontSize: 72 },
  heroTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  heroIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroRightBtns: { gap: 8 },
  heroBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    gap: 6,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 34,
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cookHistoryHero: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },

  // Info strip
  infoStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  difficultyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // Timer banner
  timerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 14,
  },
  timerBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  timerCancelBtn: {
    padding: 4,
  },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  // Servings stepper
  servingsRow: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  servingsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  stepper: {
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text.primary,
    minWidth: 28,
    textAlign: "center",
  },
  stepperRatio: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
    textAlign: "center",
    marginTop: -2,
  },
  servingsReset: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
    textDecorationLine: "underline",
    marginTop: 2,
  },
  cookedBtn: {
    marginStart: "auto",
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#FFF0E8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD3BF",
  },
  cookedBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#C45E2A",
  },

  // Section card
  section: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  sectionHeaderActions: { gap: 6, alignItems: "center" },

  // Pills
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: Colors.text.secondary },
  pillTextActive: { color: "#fff" },
  pillTeal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C7E9E3",
    backgroundColor: "#EAF7F5",
  },
  pillTealText: { fontSize: 12, fontWeight: "700", color: "#2C756A" },
  pillCoral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  pillCoralText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Count badge (ingredient/step count in section header)
  countBadge: {
    backgroundColor: Colors.primary + "20",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Empty hint
  emptyHint: {
    fontSize: 13,
    color: Colors.text.tertiary,
    fontStyle: "italic",
    paddingVertical: 8,
  },

  // Ingredients
  ingredientRow: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + "80",
  },
  ingredientRowDone: { opacity: 0.5 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  checkboxDone: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginHorizontal: 8,
    opacity: 0.7,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 21,
  },
  ingredientTextDone: {
    textDecorationLine: "line-through",
    color: Colors.text.tertiary,
  },
  // Scaled quantity display: original (struck-out gray) → new (coral)
  qtyOriginal: {
    fontSize: 15,
    color: Colors.text.tertiary,
    textDecorationLine: "line-through",
  },
  qtyScaled: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Steps
  stepCard: {
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + "80",
    backgroundColor: Colors.surfaceElevated,
  },
  stepCardDone: { opacity: 0.5 },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumberDone: { backgroundColor: Colors.secondary },
  stepNumberText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  stepText: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  stepTextDone: {
    textDecorationLine: "line-through",
    color: Colors.text.tertiary,
  },
  stepTimerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFF0F0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFCACA",
  },
  stepTimerChipText: { fontSize: 12, fontWeight: "600", color: Colors.primary },

  // Swipe done
  swipeDoneAction: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.secondary,
    gap: 3,
  },
  swipeDoneText: { fontSize: 11, color: "#fff", fontWeight: "600" },

  // Action bar
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  actionRow: {
    alignItems: "center",
    gap: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    backgroundColor: Colors.primary,
    borderRadius: 14,
  },
  actionBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  actionBtnSecondary: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  actionBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  actionBtnIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  // Collection picker modal
  collectionSheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  collectionHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 18,
  },
  collectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 16,
  },
  collectionEmpty: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  collectionRow: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  collectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionRowName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text.primary,
  },

  // Rating & notes
  ratingRow: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  starBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  lastCookedText: {
    fontSize: 11,
    color: Colors.text.tertiary,
  },
  noteSavingText: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    minHeight: 80,
  },
});

// ─── Cooking Mode Styles ──────────────────────────────────────────────────────

const cm = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text.secondary,
    width: 36,
    textAlign: "right",
  },

  // Progress
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    marginBottom: 8,
    flexWrap: "wrap",
    paddingHorizontal: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    transform: [{ scale: 1.2 }],
  },
  dotDone: {
    backgroundColor: Colors.secondary,
  },

  // Step card
  stepCard: {
    flex: 1,
    margin: 16,
    padding: 24,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "center",
    gap: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  stepBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: Colors.primary + "18",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  stepText: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.text.primary,
    lineHeight: 32,
  },
  timerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFF0F0",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFCACA",
  },
  timerChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Navigation
  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  navBtnTextDisabled: { color: Colors.text.tertiary },
  navBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  navBtnFinish: { backgroundColor: Colors.secondary },
  navBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
