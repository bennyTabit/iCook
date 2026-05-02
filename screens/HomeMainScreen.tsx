import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";

import { Colors } from "../constants/colors";
import { useThemeColors } from "../hooks/useThemeColors";
import { isHebrew } from "../lib/i18n";
import { useRecipeStore } from "../store/recipeStore";
import { useAuthStore } from "../store/authStore";
import {
  CATEGORY_EMOJI,
  CATEGORY_BG,
  FALLBACK_EMOJI,
  FALLBACK_BG,
} from "../constants/recipes";

// ── Tile definition ───────────────────────────────────────────────────────────

type Tile = {
  emoji: string;
  color: string;
  labelHe: string;
  labelEn: string;
  onPress: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeMainScreen({ navigation }: any) {
  const C = useThemeColors();
  const isHe = isHebrew();
  const { recipes, loadRecipes, setFilter } = useRecipeStore();
  const { user } = useAuthStore();

  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);

  const resolvedName = user
    ? (user.displayName ??
        (user.email ? user.email.split("@")[0] : null) ??
        null)
    : null;
  const firstName = resolvedName?.split(" ")[0] ?? null;

  useEffect(() => {
    void loadRecipes();
  }, []);

  // Check clipboard on every focus
  useFocusEffect(
    useCallback(() => {
      void Clipboard.getStringAsync().then((text) => {
        const trimmed = text?.trim() ?? "";
        try {
          const u = new URL(trimmed);
          if (u.protocol === "http:" || u.protocol === "https:") {
            setClipboardUrl(trimmed);
            return;
          }
        } catch {}
        setClipboardUrl(null);
      });
    }, []),
  );

  function tap() {
    void Haptics.selectionAsync();
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return isHe ? "בוקר טוב" : "Good morning";
    if (h < 17) return isHe ? "צהריים טובים" : "Good afternoon";
    return isHe ? "ערב טוב" : "Good evening";
  }

  const favorites = recipes.filter((r) => r.is_favorite === 1);

  // Recipe of the day — deterministic pick by day of year
  const recipeOfDay = (() => {
    if (!recipes.length) return null;
    const now = new Date();
    const doy = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
    );
    return recipes[doy % recipes.length] ?? null;
  })();

  const TILES: Tile[] = [
    {
      emoji: "🔍",
      color: "#FF6B6B",
      labelHe: "חיפוש מתכון",
      labelEn: "Search recipes",
      onPress: () => { tap(); navigation.navigate("Search"); },
    },
    {
      emoji: "➕",
      color: "#4ECDC4",
      labelHe: "הוסף מתכון",
      labelEn: "Add recipe",
      onPress: () => { tap(); navigation.navigate("AddRecipe"); },
    },
    {
      emoji: "❤️",
      color: "#FF4B6E",
      labelHe: "מועדפים",
      labelEn: "Favorites",
      onPress: () => {
        tap();
        setFilter("favoritesOnly", true);
        navigation.navigate("Search");
      },
    },
    {
      emoji: "🛒",
      color: "#FF9B6B",
      labelHe: "רשימת קניות",
      labelEn: "Shopping list",
      onPress: () => { tap(); navigation.navigate("Shopping"); },
    },
    {
      emoji: "📅",
      color: "#5B8EFF",
      labelHe: "תכנון ארוחות",
      labelEn: "Meal planner",
      onPress: () => { tap(); navigation.navigate("MealPlanner"); },
    },
    {
      emoji: "🗂",
      color: "#6BCB77",
      labelHe: "אוספים",
      labelEn: "Collections",
      onPress: () => { tap(); navigation.navigate("Collections"); },
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.background }]} edges={["left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Greeting ── */}
        <View style={s.greetWrap}>
          <Text style={[s.greet, { color: C.text.primary, textAlign: isHe ? "right" : "left" }]}>
            {getGreeting()}{firstName ? `، ${firstName}` : ""}! 👨‍🍳
          </Text>
          <Text style={[s.greetSub, { color: C.text.secondary, textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "מה נבשל היום?" : "What shall we cook today?"}
          </Text>

          {/* Stats pill */}
          {recipes.length > 0 && (
            <View style={[s.statsPill, { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[s.statsText, { color: C.text.secondary }]}>
                📖 {recipes.length} {isHe ? "מתכונים" : "recipes"}
              </Text>
              <View style={[s.statsDot, { backgroundColor: C.border }]} />
              <Text style={[s.statsText, { color: C.text.secondary }]}>
                ❤️ {favorites.length} {isHe ? "מועדפים" : "favorites"}
              </Text>
            </View>
          )}
        </View>

        {/* ── Clipboard import chip ── */}
        {clipboardUrl ? (
          <TouchableOpacity
            style={[s.clipChip, { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: Colors.primary + "12", borderColor: Colors.primary + "30" }]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setClipboardUrl(null);
              navigation.navigate("ImportLink", { url: clipboardUrl });
            }}
            activeOpacity={0.82}
          >
            <View style={s.clipIcon}>
              <Ionicons name="link" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.clipTitle, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "זיהינו קישור — ייבא מתכון?" : "Recipe link detected — import it?"}
              </Text>
              <Text style={[s.clipUrl, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]} numberOfLines={1}>
                {clipboardUrl}
              </Text>
            </View>
            <Ionicons name={isHe ? "chevron-back" : "chevron-forward"} size={16} color={Colors.primary} />
          </TouchableOpacity>
        ) : null}

        {/* ── Action grid ── */}
        <View style={s.grid}>
          {TILES.map((tile, i) => (
            <TouchableOpacity
              key={i}
              style={[s.tile, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
              onPress={tile.onPress}
              activeOpacity={0.78}
            >
              {/* Colored circle background for emoji */}
              <View style={[s.tileIconWrap, { backgroundColor: tile.color + "18" }]}>
                <Text style={s.tileEmoji}>{tile.emoji}</Text>
              </View>
              <Text style={[s.tileLabel, { color: C.text.primary, textAlign: "center" }]}>
                {isHe ? tile.labelHe : tile.labelEn}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recipe of the day ── */}
        {recipeOfDay && (
          <TouchableOpacity
            style={[s.rotd, { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: C.surfaceElevated, borderColor: C.border }]}
            onPress={() => { tap(); navigation.navigate("RecipeDetail", { id: recipeOfDay.id }); }}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={["#FF6B6B", "#FF9B6B"]}
              style={s.rotdThumb}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={{ fontSize: 26 }}>
                {CATEGORY_EMOJI[recipeOfDay.category_name_en?.toLowerCase() ?? ""] ?? FALLBACK_EMOJI}
              </Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.rotdBadge, { textAlign: isHe ? "right" : "left" }]}>
                🌟 {isHe ? "מתכון היום" : "Recipe of the day"}
              </Text>
              <Text style={[s.rotdTitle, { textAlign: isHe ? "right" : "left", color: C.text.primary }]} numberOfLines={1}>
                {isHe ? recipeOfDay.title_he : recipeOfDay.title_en}
              </Text>
              <Text style={[s.rotdMeta, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]}>
                ⏱ {recipeOfDay.cook_time_min ?? 0} {isHe ? "דקות" : "min"}
              </Text>
            </View>
            <Ionicons name={isHe ? "chevron-back" : "chevron-forward"} size={18} color={C.text.tertiary} />
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const TILE_GAP = 12;

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 32, gap: 16 },

  // Greeting
  greetWrap: { gap: 6 },
  greet: { fontSize: 26, fontWeight: "800", lineHeight: 32 },
  greetSub: { fontSize: 15, lineHeight: 20 },
  statsPill: {
    alignSelf: "flex-start",
    marginTop: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    gap: 8,
  },
  statsText: { fontSize: 13, fontWeight: "500" },
  statsDot: { width: 4, height: 4, borderRadius: 2 },

  // Clipboard chip
  clipChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 10,
  },
  clipIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  clipTitle: { fontSize: 13, fontWeight: "600", color: Colors.primary },
  clipUrl: { fontSize: 11, marginTop: 1 },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TILE_GAP,
  },
  tile: {
    // 2 columns with gap
    width: `${(100 - TILE_GAP / 4) / 2}%` as unknown as number,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  tileIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tileEmoji: { fontSize: 26 },
  tileLabel: { fontSize: 14, fontWeight: "700", lineHeight: 18 },

  // Recipe of the day
  rotd: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  rotdThumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rotdBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  rotdTitle: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  rotdMeta: { fontSize: 12, marginTop: 2 },
});
