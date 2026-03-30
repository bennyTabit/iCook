import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { Colors } from "../constants/colors";
import { Typography } from "../constants/typography";
import { isHebrew } from "../lib/i18n";
import { useGreeting } from "../hooks/useGreeting";
import { useRecipeStore } from "../store/recipeStore";

const CATEGORIES = [
  { key: "all", emoji: "🍽", labelKey: "catAll" },
  { key: "pasta", emoji: "🍝", labelKey: "catPasta" },
  { key: "salads", emoji: "🥗", labelKey: "catSalads" },
  { key: "desserts", emoji: "🍰", labelKey: "catDesserts" },
  { key: "soups", emoji: "🍜", labelKey: "catSoups" },
  { key: "meat", emoji: "🥩", labelKey: "catMeat" },
  { key: "breakfast", emoji: "🍳", labelKey: "catBreakfast" },
];

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const greeting = useGreeting();
  const { recipes, loadRecipes, setFilter, filters, toggleFav } =
    useRecipeStore();

  const heroAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadRecipes();
  }, []);

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 430,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bodyAnim, {
        toValue: 1,
        duration: 430,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroAnim, searchAnim, bodyAnim]);

  const favorites = recipes.filter((r) => r.is_favorite === 1);
  const recent = recipes.slice(0, 6);

  function tap() {
    void Haptics.selectionAsync();
  }

  function openRecipe(id: number) {
    tap();
    navigation.navigate("RecipeDetail", { id });
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        <Animated.View
          style={{
            opacity: heroAnim,
            transform: [
              {
                translateY: heroAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <View style={s.heroWrap}>
            <LinearGradient
              colors={["#FF7A6B", "#FFA66F", "#FFD06F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.heroCard}
            >
              <View style={s.heroBlobA} />
              <View style={s.heroBlobB} />

              <View
                style={[
                  s.heroTopRow,
                  { flexDirection: isHe ? "row-reverse" : "row" },
                ]}
              >
                <View>
                  <Text style={s.heroGreeting}>{greeting}</Text>
                  <Text style={s.heroHeadline}>{t("whatCook")}</Text>
                  <Text style={s.heroSub}>
                    {isHe
                      ? "לחיצה אחת לארוחה הבאה"
                      : "One tap to your next meal"}
                  </Text>
                </View>
                <View style={s.heroAvatar}>
                  <Text style={s.heroAvatarText}>{isHe ? "א" : "A"}</Text>
                </View>
              </View>

              <View
                style={[
                  s.heroActions,
                  { flexDirection: isHe ? "row-reverse" : "row" },
                ]}
              >
                <TouchableOpacity
                  style={s.heroPrimaryBtn}
                  onPress={() => {
                    tap();
                    navigation.navigate("AddRecipe");
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={s.heroPrimaryBtnText}>
                    {isHe ? "+ מתכון חדש" : "+ New Recipe"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.heroGhostBtn}
                  onPress={() => {
                    tap();
                    navigation.navigate("Search");
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={s.heroGhostBtnText}>
                    {isHe ? "חפש רעיון" : "Find Ideas"}
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: searchAnim,
            transform: [
              {
                translateY: searchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <TouchableOpacity
            style={s.searchBar}
            onPress={() => {
              tap();
              navigation.navigate("Search");
            }}
            activeOpacity={0.85}
          >
            <Text style={s.searchIcon}>🔎</Text>
            <Text style={s.searchPlaceholder}>{t("searchPlaceholder")}</Text>
            <View style={s.searchPill}>
              <Text style={s.searchPillText}>{isHe ? "סנן" : "Filter"}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={{
            opacity: bodyAnim,
            transform: [
              {
                translateY: bodyAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          }}
        >
          <Text
            style={[s.sectionTitle, { textAlign: isHe ? "right" : "left" }]}
          >
            {t("categories")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.catScroll}
            contentContainerStyle={s.catContent}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  s.catChip,
                  filters.categoryId?.toString() === cat.key && s.catChipActive,
                ]}
                onPress={() => {
                  tap();
                  setFilter(
                    "categoryId",
                    cat.key === "all" ? null : Number(cat.key),
                  );
                  navigation.navigate("Search");
                }}
                activeOpacity={0.82}
              >
                <Text style={s.catEmoji}>{cat.emoji}</Text>
                <Text
                  style={[
                    s.catLabel,
                    filters.categoryId?.toString() === cat.key &&
                      s.catLabelActive,
                  ]}
                >
                  {t(cat.labelKey as any)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {favorites.length > 0 && (
            <>
              <View
                style={[
                  s.sectionRow,
                  { flexDirection: isHe ? "row-reverse" : "row" },
                ]}
              >
                <Text style={s.sectionTitle}>{t("favorites")} ❤️</Text>
                <TouchableOpacity
                  onPress={() => {
                    tap();
                    setFilter("favoritesOnly", true);
                    navigation.navigate("Search");
                  }}
                >
                  <Text style={s.seeAll}>{t("seeAll")}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.favContent}
              >
                {favorites.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={s.favCard}
                    onPress={() => openRecipe(r.id)}
                    activeOpacity={0.86}
                  >
                    <LinearGradient
                      colors={["#FFE66D", "#FFD56B"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.favImg}
                    >
                      <Text style={s.favEmoji}>🍝</Text>
                    </LinearGradient>
                    <Text style={s.favTitle} numberOfLines={2}>
                      {isHe ? r.title_he : r.title_en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <View
            style={[
              s.sectionRow,
              { flexDirection: isHe ? "row-reverse" : "row" },
            ]}
          >
            <Text style={s.sectionTitle}>{t("recentRecipes")}</Text>
            <TouchableOpacity
              onPress={() => {
                tap();
                navigation.navigate("Search");
              }}
            >
              <Text style={s.seeAll}>{t("seeAll")}</Text>
            </TouchableOpacity>
          </View>

          {recent.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyEmoji}>🍳</Text>
              <Text style={s.emptyText}>
                {isHe ? "עדיין אין מתכונים" : "No recipes yet"}
              </Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => {
                  tap();
                  navigation.navigate("AddRecipe");
                }}
                activeOpacity={0.88}
              >
                <Text style={s.emptyBtnText}>{t("addRecipe")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recent.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={s.recipeCard}
                onPress={() => openRecipe(r.id)}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={["#FFE66D", "#FFD56B"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.cardImg}
                >
                  <Text style={s.cardEmoji}>🍝</Text>
                </LinearGradient>
                <View style={s.cardBody}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {isHe ? r.title_he : r.title_en}
                  </Text>
                  <View
                    style={[
                      s.cardMeta,
                      { flexDirection: isHe ? "row-reverse" : "row" },
                    ]}
                  >
                    {r.cook_time_min != null && (
                      <Text style={s.metaText}>
                        ⏱ {r.cook_time_min} {t("minutes")}
                      </Text>
                    )}
                    {r.servings != null && (
                      <Text style={s.metaText}>
                        🍽 {r.servings} {t("servings")}
                      </Text>
                    )}
                    {r.difficulty && (
                      <Text
                        style={[
                          s.diffBadge,
                          {
                            backgroundColor:
                              (Colors.difficulty as any)[r.difficulty] + "33",
                          },
                        ]}
                      >
                        {t(r.difficulty as any)}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={s.favBtn}
                  onPress={() => {
                    tap();
                    toggleFav(r.id, r.is_favorite);
                  }}
                >
                  <Text style={s.favHeart}>{r.is_favorite ? "❤️" : "🤍"}</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 24 },

  heroWrap: { paddingHorizontal: 16, paddingTop: 8, marginBottom: 8 },
  heroCard: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: "hidden",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  heroBlobA: {
    position: "absolute",
    top: -18,
    right: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  heroBlobB: {
    position: "absolute",
    bottom: -28,
    left: -18,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  heroTopRow: { alignItems: "center", justifyContent: "space-between" },
  heroGreeting: { ...Typography.bodySmall, color: "rgba(255,255,255,0.92)" },
  heroHeadline: { ...Typography.h2, color: "#fff", marginTop: 2 },
  heroSub: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  heroAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarText: { ...Typography.label, color: "#fff", fontWeight: "700" },
  heroActions: { marginTop: 14, gap: 10 },
  heroPrimaryBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  heroPrimaryBtnText: {
    ...Typography.button,
    color: "#E45353",
    fontWeight: "700",
    fontSize: 14,
  },
  heroGhostBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  heroGhostBtnText: { ...Typography.button, color: "#fff", fontSize: 14 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    flex: 1,
  },
  searchPill: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  searchPillText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: "600",
  },

  sectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 2,
  },
  seeAll: { ...Typography.label, color: Colors.primary },

  catScroll: { marginBottom: 18 },
  catContent: { paddingHorizontal: 16, gap: 10 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catEmoji: { fontSize: 14 },
  catLabel: { ...Typography.label, color: Colors.text.secondary },
  catLabelActive: { color: "#fff" },

  favContent: { paddingHorizontal: 16, gap: 12 },
  favCard: {
    width: 112,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  favImg: { height: 70, alignItems: "center", justifyContent: "center" },
  favEmoji: { fontSize: 22 },
  favTitle: {
    ...Typography.caption,
    padding: 8,
    color: Colors.text.primary,
    fontWeight: "600",
    lineHeight: 15,
  },

  recipeCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,
  },
  cardImg: {
    width: 78,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
  },
  cardEmoji: { fontSize: 28 },
  cardBody: { flex: 1, padding: 11, justifyContent: "center" },
  cardTitle: {
    ...Typography.body,
    fontWeight: "600",
    color: Colors.text.primary,
    marginBottom: 4,
  },
  cardMeta: { gap: 6, alignItems: "center" },
  metaText: { ...Typography.caption, color: Colors.text.secondary },
  diffBadge: {
    ...Typography.caption,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    color: Colors.text.secondary,
    overflow: "hidden",
  },
  favBtn: { padding: 12, alignItems: "center", justifyContent: "center" },
  favHeart: { fontSize: 18 },

  emptyState: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { ...Typography.body, color: Colors.text.tertiary },
  emptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 11,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyBtnText: { ...Typography.button, color: "#fff" },
});
