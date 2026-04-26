import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  I18nManager,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import i18n, { isHebrew } from "../lib/i18n";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;
type DietaryTag = "vegan" | "dairy-free" | "gluten-free" | "nut-free" | "meat";
type ChefGender = "female" | "male";

// ── Data ──────────────────────────────────────────────────────────────────────

const DIETARY_CHIPS: { tag: DietaryTag; emoji: string; labelHe: string; labelEn: string }[] = [
  { tag: "vegan",       emoji: "🌱", labelHe: "טבעוני",    labelEn: "Vegan" },
  { tag: "dairy-free",  emoji: "🥛", labelHe: "ללא חלב",   labelEn: "Dairy-free" },
  { tag: "gluten-free", emoji: "🌾", labelHe: "ללא גלוטן",  labelEn: "Gluten-free" },
  { tag: "nut-free",    emoji: "🥜", labelHe: "ללא אגוזים", labelEn: "Nut-free" },
  { tag: "meat",        emoji: "🥩", labelHe: "בשרי",       labelEn: "Meat" },
];

// Each slide: gradient colors (top→bottom), emoji, title, subtitle, optional extras
const SLIDES = [
  {
    key: "welcome",
    gradient: ["#FF6B6B", "#FF8E53"] as [string, string],
    emoji: "🍳",
    titleHe: "ברוכים הבאים ל-iCook",
    titleEn: "Welcome to iCook",
    subHe: "אפליקציית הבישול האישית שלך.\nשמור מתכונים, בשל ותכנן ארוחות.",
    subEn: "Your personal cooking companion.\nSave recipes, cook, and plan meals.",
  },
  {
    key: "recipes",
    gradient: ["#4ECDC4", "#44B5AE"] as [string, string],
    emoji: "📱",
    titleHe: "שמור מתכונים מכל מקום",
    titleEn: "Save recipes from anywhere",
    subHe: "צלם תמונה של מתכון, ייבא מקישור,\nאו הוסף ידנית.",
    subEn: "Snap a photo of a recipe, import from\na link, or add manually.",
  },
  {
    key: "chef",
    gradient: ["#A78BFA", "#7C3AED"] as [string, string],
    emoji: "🎙️",
    titleHe: "השף הוירטואלי שלך",
    titleEn: "Your Virtual AI Chef",
    subHe: "קבל הנחיות קוליות שלב אחר שלב\nמשף AI אישי — בעברית!",
    subEn: "Get step-by-step voice guidance\nfrom a personal AI chef.",
  },
  {
    key: "shopping",
    gradient: ["#F59E0B", "#D97706"] as [string, string],
    emoji: "🛒",
    titleHe: "רשימת קניות חכמה",
    titleEn: "Smart shopping list",
    subHe: "הוסף מרכיבים ממתכון בלחיצה אחת.\nשתף עם WhatsApp בקלות.",
    subEn: "Add ingredients from any recipe\nin one tap. Share via WhatsApp.",
  },
];

const TOTAL_PAGES = SLIDES.length + 1; // 4 slides + 1 prefs page

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingScreen({ navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [page, setPage] = useState(0);
  const [isHe, setIsHe] = useState(isHebrew());
  const [selected, setSelected] = useState<DietaryTag[]>([]);
  const [chefGender, setChefGender] = useState<ChefGender>("female");

  // Per-page emoji bounce animation
  const emojiScale = useRef(new Animated.Value(0.5)).current;
  const emojiOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // ── Language sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => setIsHe(isHebrew());
    i18n.on("languageChanged", update);
    return () => { i18n.off("languageChanged", update); };
  }, []);

  // ── Animate in when page changes ──────────────────────────────────────────
  useEffect(() => {
    emojiScale.setValue(0.5);
    emojiOpacity.setValue(0);
    contentSlide.setValue(24);
    contentOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(emojiScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
      Animated.timing(emojiOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(contentSlide, { toValue: 0, duration: 350, delay: 120, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 350, delay: 120, useNativeDriver: true }),
    ]).start();
  }, [page]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function goToPage(p: number) {
    scrollRef.current?.scrollTo({ x: p * width, animated: true });
    setPage(p);
  }

  function handleNext() {
    void Haptics.selectionAsync();
    if (page < TOTAL_PAGES - 1) goToPage(page + 1);
  }

  function handleSkip() {
    void Haptics.selectionAsync();
    goToPage(TOTAL_PAGES - 1); // jump to prefs
  }

  async function finishOnboarding() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Promise.all([
      AsyncStorage.setItem("icook.prefs.dietary", JSON.stringify(selected)),
      AsyncStorage.setItem("icook.prefs.chefGender", chefGender),
      AsyncStorage.setItem("icook.onboarding.done", "1"),
    ]);
    navigation.replace("Tabs");
  }

  async function changeLanguage(lang: "he" | "en") {
    void Haptics.selectionAsync();
    await i18n.changeLanguage(lang);
    I18nManager.forceRTL(lang === "he");
    await AsyncStorage.setItem("icook.lang", lang);
    setIsHe(lang === "he");
  }

  function toggleDietary(tag: DietaryTag) {
    void Haptics.selectionAsync();
    setSelected(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  // ── Current slide gradient ────────────────────────────────────────────────
  const slide = SLIDES[page];
  const gradient: [string, string] = slide
    ? slide.gradient
    : ["#FF6B6B", "#FF8E53"];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {/* Gradient background — covers the whole screen and transitions with page */}
      <LinearGradient
        colors={[gradient[0], gradient[1], "#FCFAF5"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        {/* Skip button — top right (except prefs page) */}
        {page < SLIDES.length && (
          <TouchableOpacity
            style={[s.skipTopBtn, { alignSelf: isHe ? "flex-start" : "flex-end" }]}
            onPress={handleSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.skipTopText}>{isHe ? "דלג" : "Skip"}</Text>
          </TouchableOpacity>
        )}

        {/* Scrollable pages */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {/* ── Feature slides ── */}
          {SLIDES.map((sl, i) => (
            <View key={sl.key} style={[s.page, { width }]}>
              {/* Emoji */}
              <Animated.Text style={[s.emoji, {
                opacity: page === i ? emojiOpacity : 1,
                transform: [{ scale: page === i ? emojiScale : 1 }],
              }]}>
                {sl.emoji}
              </Animated.Text>

              {/* Text block */}
              <Animated.View style={[s.textBlock, {
                opacity: page === i ? contentOpacity : 1,
                transform: [{ translateY: page === i ? contentSlide : 0 }],
              }]}>
                <Text style={[s.title, { textAlign: isHe ? "right" : "left" }]}>
                  {isHe ? sl.titleHe : sl.titleEn}
                </Text>
                <Text style={[s.sub, { textAlign: isHe ? "right" : "left" }]}>
                  {isHe ? sl.subHe : sl.subEn}
                </Text>

                {/* Slide 1 extras: language picker */}
                {sl.key === "welcome" && (
                  <View style={s.langRow}>
                    {(["he", "en"] as const).map(lang => (
                      <TouchableOpacity
                        key={lang}
                        style={[s.langBtn, (lang === "he") === isHe && s.langBtnActive]}
                        onPress={() => void changeLanguage(lang)}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.langBtnText, (lang === "he") === isHe && s.langBtnTextActive]}>
                          {lang === "he" ? "🇮🇱  עברית" : "🇺🇸  English"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Slide 3 (chef) extras: gender selector */}
                {sl.key === "chef" && (
                  <View style={s.genderRow}>
                    {(["female", "male"] as ChefGender[]).map(g => (
                      <TouchableOpacity
                        key={g}
                        style={[s.genderBtn, chefGender === g && s.genderBtnActive]}
                        onPress={() => { void Haptics.selectionAsync(); setChefGender(g); }}
                        activeOpacity={0.8}
                      >
                        <Text style={s.genderEmoji}>{g === "female" ? "👩‍🍳" : "👨‍🍳"}</Text>
                        <Text style={[s.genderLabel, chefGender === g && s.genderLabelActive]}>
                          {g === "female"
                            ? (isHe ? "שפית" : "Female chef")
                            : (isHe ? "שף" : "Male chef")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Animated.View>
            </View>
          ))}

          {/* ── Preferences page ── */}
          <View style={[s.page, { width }]}>
            <Animated.Text style={[s.emoji, {
              opacity: page === SLIDES.length ? emojiOpacity : 1,
              transform: [{ scale: page === SLIDES.length ? emojiScale : 1 }],
            }]}>
              ⚙️
            </Animated.Text>

            <Animated.View style={[s.textBlock, {
              opacity: page === SLIDES.length ? contentOpacity : 1,
              transform: [{ translateY: page === SLIDES.length ? contentSlide : 0 }],
            }]}>
              <Text style={[s.title, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "כמה העדפות" : "A few preferences"}
              </Text>
              <Text style={[s.sub, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "נוכל להתאים לך את החוויה (אפשר לשנות מאוחר יותר)" : "We'll personalize your experience (you can change this later)"}
              </Text>

              {/* Dietary chips */}
              <View style={[s.chipsWrap, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                {DIETARY_CHIPS.map(chip => {
                  const active = selected.includes(chip.tag);
                  return (
                    <TouchableOpacity
                      key={chip.tag}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => toggleDietary(chip.tag)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.chipEmoji}>{chip.emoji}</Text>
                      <Text style={[s.chipLabel, active && s.chipLabelActive]}>
                        {isHe ? chip.labelHe : chip.labelEn}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Done button */}
              <TouchableOpacity style={s.doneBtn} onPress={() => void finishOnboarding()} activeOpacity={0.88}>
                <Text style={s.doneBtnText}>{isHe ? "!בואו נבשל" : "Let's cook!"}</Text>
                <Ionicons name={isHe ? "arrow-back" : "arrow-forward"} size={20} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>

        {/* ── Bottom bar: dots + Next button ── */}
        {page < SLIDES.length && (
          <View style={s.bottomBar}>
            {/* Progress dots */}
            <View style={[s.dotsRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.dot,
                    i === page ? s.dotActive : s.dotInactive,
                    i < page && s.dotDone,
                  ]}
                />
              ))}
            </View>

            {/* Next button */}
            <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.85}>
              <Text style={s.nextText}>
                {page === SLIDES.length - 1
                  ? (isHe ? "כמעט שם!" : "Almost there!")
                  : (isHe ? "הבא" : "Next")}
              </Text>
              <Ionicons name={isHe ? "arrow-back" : "arrow-forward"} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CORAL   = "#FF6B6B";
const WHITE   = "#FFFFFF";
const DARK    = "#1A1A1A";
const MUTED   = "#6B6866";

const s = StyleSheet.create({
  safe: {
    flex: 1,
  },
  skipTopBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipTopText: {
    fontSize: 15,
    color: WHITE,
    fontWeight: "600",
    opacity: 0.85,
  },

  // ── Page ──────────────────────────────────────────────────────────────────
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  emoji: {
    fontSize: 90,
    marginBottom: 32,
  },
  textBlock: {
    alignSelf: "stretch",
    alignItems: "stretch",
  },

  // ── Text ──────────────────────────────────────────────────────────────────
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: DARK,
    marginBottom: 12,
    lineHeight: 36,
  },
  sub: {
    fontSize: 16,
    color: MUTED,
    lineHeight: 26,
    marginBottom: 8,
  },

  // ── Language toggle ────────────────────────────────────────────────────────
  langRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E8E8E3",
    backgroundColor: WHITE,
    alignItems: "center",
  },
  langBtnActive: {
    borderColor: CORAL,
    backgroundColor: CORAL + "12",
  },
  langBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: MUTED,
  },
  langBtnTextActive: {
    color: CORAL,
  },

  // ── Chef gender selector ────────────────────────────────────────────────
  genderRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#E8E8E3",
    backgroundColor: WHITE,
    alignItems: "center",
    gap: 6,
  },
  genderBtnActive: {
    borderColor: "#A78BFA",
    backgroundColor: "#A78BFA15",
  },
  genderEmoji: {
    fontSize: 36,
  },
  genderLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: MUTED,
  },
  genderLabelActive: {
    color: "#7C3AED",
  },

  // ── Dietary chips ─────────────────────────────────────────────────────────
  chipsWrap: {
    flexWrap: "wrap",
    gap: 10,
    marginTop: 24,
    marginBottom: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: "#E8E8E3",
  },
  chipActive: {
    backgroundColor: CORAL + "15",
    borderColor: CORAL,
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: MUTED,
  },
  chipLabelActive: { color: CORAL },

  // ── Done button ────────────────────────────────────────────────────────────
  doneBtn: {
    marginTop: 32,
    backgroundColor: CORAL,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  doneBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: WHITE,
  },

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  // ── Dots ──────────────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: { borderRadius: 6 },
  dotActive: {
    width: 20,
    height: 8,
    backgroundColor: CORAL,
    borderRadius: 4,
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: "#D1D1CC",
  },
  dotDone: {
    backgroundColor: "#4ECDC4",
  },

  // ── Next button ────────────────────────────────────────────────────────────
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: CORAL,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextText: {
    fontSize: 16,
    fontWeight: "700",
    color: WHITE,
  },
});
