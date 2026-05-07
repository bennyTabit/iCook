import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";

import { useTranslation } from "react-i18next";
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
  const { i18n } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { recipes, loadRecipes, setFilter, resetFilters } = useRecipeStore();
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

  // Reset any active search/category filters whenever Home is focused,
  // so the recipe count and "recipe of the day" always reflect the full list.
  useFocusEffect(
    useCallback(() => {
      resetFilters();
    }, []),
  );

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
    <View style={[s.root, { backgroundColor: C.background }]}>
      <ScreenHeader
        title={`${getGreeting()}${firstName ? `، ${firstName}` : ""}! 👨‍🍳`}
        subtitle={isHe ? "מה נבשל היום?" : "What shall we cook today?"}
      >
        {/* Stats pill */}
        {recipes.length > 0 && (
          <View style={[s.statsPill, { flexDirection: isHe ? "row-reverse" : "row", alignSelf: isHe ? "flex-end" : "flex-start", backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.statsText, { color: C.text.secondary }]}>
              📖 {recipes.length} {isHe ? "מתכונים" : "recipes"}
            </Text>
            <View style={[s.statsDot, { backgroundColor: C.border }]} />
            <Text style={[s.statsText, { color: C.text.secondary }]}>
              ❤️ {favorites.length} {isHe ? "מועדפים" : "favorites"}
            </Text>
          </View>
        )}

        {/* Clipboard import chip */}
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
      </ScreenHeader>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 32 + insets.bottom }]}>

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
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const TILE_GAP = 12;
const SCREEN_W = Dimensions.get("window").width;
const GRID_H_PAD = 20; // matches scroll padding
const TILE_W = Math.floor((SCREEN_W - GRID_H_PAD * 2 - TILE_GAP) / 2);

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
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
    justifyContent: "space-between",
    rowGap: TILE_GAP,
  },
  tile: {
    width: TILE_W,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  tileIconWrap: {
    alignSelf: "stretch",
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  tileEmoji: { fontSize: 44 },
  tileLabel: { fontSize: 15, fontWeight: "700", textAlign: "center", paddingVertical: 12, paddingHorizontal: 10 },

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
