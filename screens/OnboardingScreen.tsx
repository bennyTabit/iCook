import React, { useEffect, useRef, useState } from "react";
import {
  I18nManager,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import i18n, { isHebrew } from "../lib/i18n";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

// ── Dietary chip definitions ─────────────────────────────────────────────────
type DietaryTag = "vegan" | "dairy-free" | "gluten-free" | "nut-free" | "meat";

const DIETARY_CHIPS: {
  tag: DietaryTag;
  emoji: string;
  labelHe: string;
  labelEn: string;
}[] = [
  { tag: "vegan", emoji: "🌱", labelHe: "טבעוני", labelEn: "Vegan" },
  { tag: "dairy-free", emoji: "🥛", labelHe: "ללא חלב", labelEn: "Dairy-free" },
  { tag: "gluten-free", emoji: "🌾", labelHe: "ללא גלוטן", labelEn: "Gluten-free" },
  { tag: "nut-free", emoji: "🥜", labelHe: "ללא אגוזים", labelEn: "Nut-free" },
  { tag: "meat", emoji: "🥩", labelHe: "בשרי", labelEn: "Meat" },
];

// ── Slide definitions ─────────────────────────────────────────────────────────
type Slide = {
  emoji: string;
  titleHe: string;
  titleEn: string;
  subHe: string;
  subEn: string;
};

const SLIDES: Slide[] = [
  {
    emoji: "🍳",
    titleHe: "ברוכים הבאים ל-iCook",
    titleEn: "Welcome to iCook",
    subHe: "שמור מתכונים, בשל ותכנן את הארוחות שלך",
    subEn: "Save recipes, cook and plan your meals",
  },
  {
    emoji: "👨‍🍳",
    titleHe: "מצב בישול",
    titleEn: "Cooking Mode",
    subHe: "בשל שלב אחר שלב עם טיימרים ומעקב התקדמות",
    subEn: "Cook step by step with timers and progress tracking",
  },
  {
    emoji: "📅",
    titleHe: "תכנן את השבוע",
    titleEn: "Plan your week",
    subHe: "ארגן ארוחות לכל ימות השבוע והוסף מרכיבים לרשימת קניות",
    subEn: "Organize meals for every day of the week and add ingredients to your shopping list",
  },
];

const TOTAL_PAGES = SLIDES.length + 1; // 3 slides + 1 prefs

export default function OnboardingScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [page, setPage] = useState(0);
  const [isHe, setIsHe] = useState(isHebrew());
  const [selected, setSelected] = useState<DietaryTag[]>([]);

  // Track language changes so the component re-renders
  useEffect(() => {
    const update = () => setIsHe(isHebrew());
    i18n.on("languageChanged", update);
    return () => {
      i18n.off("languageChanged", update);
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function goToPage(p: number) {
    scrollRef.current?.scrollTo({ x: p * width, animated: true });
    setPage(p);
  }

  function handleNext() {
    void Haptics.selectionAsync();
    if (page < TOTAL_PAGES - 1) {
      goToPage(page + 1);
    }
  }

  function handleSkip() {
    void Haptics.selectionAsync();
    void finishOnboarding();
  }

  function toggleDietary(tag: DietaryTag) {
    void Haptics.selectionAsync();
    setSelected((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function finishOnboarding() {
    await AsyncStorage.setItem(
      "icook.prefs.dietary",
      JSON.stringify(selected),
    );
    await AsyncStorage.setItem("icook.onboarding.done", "1");
    navigation.replace("Tabs");
  }

  async function changeLanguage(lang: "he" | "en") {
    void Haptics.selectionAsync();
    await i18n.changeLanguage(lang);
    I18nManager.forceRTL(lang === "he");
    await AsyncStorage.setItem("icook.lang", lang);
    setIsHe(lang === "he");
  }

  // ── Dots indicator ────────────────────────────────────────────────────────
  function Dots() {
    return (
      <View style={s.dotsRow}>
        {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === page ? s.dotActive : s.dotInactive,
            ]}
          />
        ))}
      </View>
    );
  }

  // ── Bottom nav bar (shared across slides) ────────────────────────────────
  function BottomBar() {
    const isLast = page === SLIDES.length - 1;
    const isPrefs = page === SLIDES.length;

    if (isPrefs) return null; // prefs page has its own button

    const nextLabel = isLast
      ? isHe
        ? "!בואו נתחיל"
        : "Start!"
      : isHe
        ? "הבא ←"
        : "Next →";

    return (
      <View style={[s.bottomBar, { flexDirection: isHe ? "row-reverse" : "row" }]}>
        <TouchableOpacity onPress={handleSkip} style={s.skipBtn} activeOpacity={0.75}>
          <Text style={s.skipText}>{isHe ? "דלג" : "Skip"}</Text>
        </TouchableOpacity>

        <Dots />

        <TouchableOpacity
          onPress={handleNext}
          style={s.nextBtn}
          activeOpacity={0.85}
        >
          <Text style={s.nextText}>{nextLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Slide page ────────────────────────────────────────────────────────────
  function SlidePage({ slide, index }: { slide: Slide; index: number }) {
    const isFirst = index === 0;
    return (
      <View style={[s.page, { width }]}>
        {/* illustration */}
        <View style={s.illustrationCircle}>
          <Text style={s.illustrationEmoji}>{slide.emoji}</Text>
        </View>

        {/* text */}
        <Text style={[s.slideTitle, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? slide.titleHe : slide.titleEn}
        </Text>
        <Text style={[s.slideSub, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? slide.subHe : slide.subEn}
        </Text>

        {/* language toggle only on slide 1 */}
        {isFirst && (
          <View style={s.langToggleRow}>
            <TouchableOpacity
              style={[s.langBtn, isHe && s.langBtnActive]}
              onPress={() => void changeLanguage("he")}
              activeOpacity={0.8}
            >
              <Text style={[s.langBtnText, isHe && s.langBtnTextActive]}>עברית</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.langBtn, !isHe && s.langBtnActive]}
              onPress={() => void changeLanguage("en")}
              activeOpacity={0.8}
            >
              <Text style={[s.langBtnText, !isHe && s.langBtnTextActive]}>English</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── Preferences page ──────────────────────────────────────────────────────
  function PrefsPage() {
    return (
      <View style={[s.page, { width }]}>
        <View style={s.illustrationCircle}>
          <Text style={s.illustrationEmoji}>⚙️</Text>
        </View>

        <Text style={[s.slideTitle, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "כמה העדפות" : "A few preferences"}
        </Text>
        <Text style={[s.slideSub, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "נוכל להתאים לך את החוויה" : "We'll personalize your experience"}
        </Text>

        {/* Dietary chips */}
        <View style={s.chipsWrap}>
          {DIETARY_CHIPS.map((chip) => {
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
        <TouchableOpacity
          style={s.doneBtn}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            void finishOnboarding();
          }}
          activeOpacity={0.88}
        >
          <Text style={s.doneBtnText}>{isHe ? "סיום" : "Done"}</Text>
        </TouchableOpacity>

        {/* Dots in prefs page */}
        <View style={s.prefsDots}>
          <Dots />
        </View>
      </View>
    );
  }

  // ── Root render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container} edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={s.scroll}
      >
        {SLIDES.map((slide, i) => (
          <SlidePage key={i} slide={slide} index={i} />
        ))}
        <PrefsPage />
      </ScrollView>

      <BottomBar />
    </SafeAreaView>
  );
}

const CORAL = "#FF6B6B";
const CORAL_TINT = "#FF6B6B20";
const BG = "#FCFAF5";

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },

  // ── Page layout ────────────────────────────────────────────────────────────
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 24,
  },

  // ── Illustration ──────────────────────────────────────────────────────────
  illustrationCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: CORAL_TINT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
  },
  illustrationEmoji: {
    fontSize: 80,
  },

  // ── Slide text ─────────────────────────────────────────────────────────────
  slideTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 12,
    alignSelf: "stretch",
  },
  slideSub: {
    fontSize: 16,
    color: "#6B6866",
    lineHeight: 24,
    alignSelf: "stretch",
  },

  // ── Language toggle ────────────────────────────────────────────────────────
  langToggleRow: {
    flexDirection: "row",
    marginTop: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E8E3",
    overflow: "hidden",
    alignSelf: "center",
  },
  langBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  langBtnActive: {
    backgroundColor: CORAL,
  },
  langBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B6866",
  },
  langBtnTextActive: {
    color: "#FFFFFF",
  },

  // ── Dietary chips ─────────────────────────────────────────────────────────
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
    alignSelf: "stretch",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E8E8E3",
  },
  chipActive: {
    backgroundColor: CORAL + "15",
    borderColor: CORAL,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B6866",
  },
  chipLabelActive: {
    color: CORAL,
  },

  // ── Done button ────────────────────────────────────────────────────────────
  doneBtn: {
    marginTop: 36,
    backgroundColor: CORAL,
    borderRadius: 18,
    paddingHorizontal: 48,
    paddingVertical: 16,
    alignSelf: "stretch",
    alignItems: "center",
    shadowColor: CORAL,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 5,
  },
  doneBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  prefsDots: {
    marginTop: 24,
  },

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BG,
  },

  // ── Dots ──────────────────────────────────────────────────────────────────
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    borderRadius: 6,
  },
  dotActive: {
    width: 12,
    height: 12,
    backgroundColor: CORAL,
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: "#E8E8E3",
  },

  // ── Skip / Next ────────────────────────────────────────────────────────────
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    color: "#6B6866",
    fontWeight: "500",
  },
  nextBtn: {
    backgroundColor: CORAL,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  nextText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
