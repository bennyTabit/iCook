import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Colors } from "../constants/colors";
import { Typography } from "../constants/typography";
import { isHebrew } from "../lib/i18n";
import { useRecipeStore } from "../store/recipeStore";

type QuickCategory = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export default function HomeFeedScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const {
    recipes,
    loadRecipes,
    toggleFav,
    setFilter,
    resetFilters,
    filters,
  } = useRecipeStore();

  const [selectedCat, setSelectedCat] = useState("all");

  const heroAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void loadRecipes();
  }, []);

  useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroAnim, searchAnim, contentAnim]);

  const favorites = recipes.filter((r) => r.is_favorite === 1);
  const recent = recipes.slice(0, 6);
  const continueRecipe = recent[0] ?? null;

  const smartSuggestions = useMemo(() => {
    if (!favorites.length) return recipes.slice(0, 4);
    const favCategory = favorites[0]?.category_name_en;
    return recipes
      .filter((r) => r.category_name_en === favCategory && r.is_favorite !== 1)
      .slice(0, 4);
  }, [favorites, recipes]);

  function tap() {
    void Haptics.selectionAsync();
  }

  function applyCategory(category: string) {
    tap();
    setSelectedCat(category);
    resetFilters();

    if (category === "all") {
      navigation.navigate("Search");
      return;
    }
    if (category === "quick") {
      setFilter("maxCookTime", 20);
      navigation.navigate("Search");
      return;
    }
    if (category === "healthy") {
      setFilter("query", isHe ? "סלט" : "salad");
      navigation.navigate("Search");
      return;
    }
    if (category === "kids") {
      setFilter("query", isHe ? "ילדים" : "kids");
      navigation.navigate("Search");
      return;
    }
    if (category === "dinner") {
      setFilter("query", isHe ? "ערב" : "dinner");
      navigation.navigate("Search");
      return;
    }
  }

  const quickCategories: QuickCategory[] = [
    {
      key: "all",
      label: isHe ? "הכל" : "All",
      icon: "apps-outline",
      onPress: () => applyCategory("all"),
    },
    {
      key: "quick",
      label: isHe ? "מהיר" : "Quick",
      icon: "flash-outline",
      onPress: () => applyCategory("quick"),
    },
    {
      key: "healthy",
      label: isHe ? "בריא" : "Healthy",
      icon: "leaf-outline",
      onPress: () => applyCategory("healthy"),
    },
    {
      key: "kids",
      label: isHe ? "לילדים" : "For kids",
      icon: "happy-outline",
      onPress: () => applyCategory("kids"),
    },
    {
      key: "dinner",
      label: isHe ? "ארוחות ערב" : "Dinner",
      icon: "moon-outline",
      onPress: () => applyCategory("dinner"),
    },
  ];

  return (
    <SafeAreaView style={s.container} edges={["left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <Animated.View
          style={{
            opacity: heroAnim,
            transform: [
              {
                translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
              },
            ],
          }}
        >
          <LinearGradient
            colors={["#FFD8CD", "#FFE9DA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            <Text style={[s.heroTitle, { textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "מה בא לך לבשל היום, אבי?" : "What do you feel like cooking today, Avi?"}
            </Text>
            <Text style={[s.heroSub, { textAlign: isHe ? "right" : "left" }]}>
              {isHe
                ? "מצא מתכון לפי מצרכים או קטגוריות"
                : "Find a recipe by ingredients or categories"}
            </Text>

            <View style={[s.heroActions, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => {
                  tap();
                  navigation.navigate("AddRecipe");
                }}
                activeOpacity={0.9}
              >
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={s.primaryBtnText}>{isHe ? "צור מתכון" : "Create recipe"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.secondaryBtn}
                onPress={() => {
                  tap();
                  setFilter("query", "");
                  navigation.navigate("Search");
                }}
                activeOpacity={0.9}
              >
                <Ionicons name="search-outline" size={16} color={Colors.text.primary} />
                <Text style={s.secondaryBtnText}>{isHe ? "חפש לפי מצרכים" : "Search by ingredients"}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          style={{
            opacity: searchAnim,
            transform: [
              {
                translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
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
            activeOpacity={0.9}
          >
            <TouchableOpacity
              onPress={() => {
                tap();
                navigation.navigate("Search");
              }}
              style={s.searchSideIcon}
            >
              <Ionicons name="options-outline" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>

            <Text
              style={[s.searchText, { textAlign: isHe ? "right" : "left" }]}
              numberOfLines={1}
            >
              {isHe ? "חפש מתכון, מצרכים או רעיון..." : "Search recipe, ingredient or idea..."}
            </Text>

            <TouchableOpacity
              onPress={() => {
                tap();
                navigation.navigate("Search");
              }}
              style={s.searchSideIcon}
            >
              <Ionicons name="mic-outline" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={{
            opacity: contentAnim,
            transform: [
              {
                translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
              },
            ],
          }}
        >
          {continueRecipe && (
            <>
              <Text style={[s.sectionTitle, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "המשך מאיפה שהפסקת" : "Continue where you left off"}
              </Text>
              <TouchableOpacity
                style={[s.continueCard, { flexDirection: isHe ? "row-reverse" : "row" }]}
                onPress={() => {
                  tap();
                  navigation.navigate("RecipeDetail", { id: continueRecipe.id });
                }}
                activeOpacity={0.92}
              >
                <View style={s.continueThumb}>
                  <Ionicons name="restaurant-outline" size={24} color="#9C6B5A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.continueName, { textAlign: isHe ? "right" : "left" }]} numberOfLines={1}>
                    {isHe ? continueRecipe.title_he : continueRecipe.title_en}
                  </Text>
                  <Text style={[s.continueMeta, { textAlign: isHe ? "right" : "left" }]}>
                    {isHe ? "הקש כדי להמשיך" : "Tap to continue"}
                  </Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          <Text style={[s.sectionTitle, { textAlign: isHe ? "right" : "left" }]}>
            {t("categories")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsWrap}
          >
            {quickCategories.map((cat) => {
              const selected = selectedCat === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[s.chip, selected && s.chipSelected]}
                  onPress={cat.onPress}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={selected ? "#fff" : Colors.text.secondary}
                  />
                  <Text style={[s.chipText, selected && s.chipTextSelected]}>{cat.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={[s.sectionRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <Text style={s.sectionTitle}>{isHe ? "המתכונים שלך ❤️" : "Your recipes ❤️"}</Text>
            <TouchableOpacity
              onPress={() => {
                tap();
                setFilter("favoritesOnly", true);
                navigation.navigate("Search");
              }}
            >
              <Text style={s.seeAll}>{isHe ? "ראה הכל" : "See all"}</Text>
            </TouchableOpacity>
          </View>

          {favorites.length === 0 ? (
            <View style={s.favEmptyBox}>
              <Text style={s.favEmptyEmoji}>🍲</Text>
              <Text style={s.favEmptyTitle}>{isHe ? "עדיין אין לך מתכונים מועדפים" : "You do not have favorite recipes yet"}</Text>
              <TouchableOpacity
                style={s.favEmptyBtn}
                onPress={() => {
                  tap();
                  navigation.navigate("Search");
                }}
              >
                <Text style={s.favEmptyBtnText}>{isHe ? "גלה מתכונים" : "Discover recipes"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.favoritesWrap}>
              {favorites.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={s.favoriteCard}
                  onPress={() => {
                    tap();
                    navigation.navigate("RecipeDetail", { id: r.id });
                  }}
                  activeOpacity={0.9}
                >
                  <View style={s.favoriteImage}>
                    <Ionicons name="restaurant-outline" size={30} color="#B2714D" />
                  </View>
                  <Text style={[s.favoriteName, { textAlign: isHe ? "right" : "left" }]} numberOfLines={2}>
                    {isHe ? r.title_he : r.title_en}
                  </Text>
                  <Text style={[s.favoriteMeta, { textAlign: isHe ? "right" : "left" }]}>
                    ⏱ {r.cook_time_min ?? 0} {isHe ? "דק׳" : "min"}  |  🍽 {r.servings ?? 2}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={[s.sectionTitle, { textAlign: isHe ? "right" : "left", marginTop: 20 }]}>
            {isHe ? "מבוסס על מה שאהבת" : "Based on what you liked"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestionWrap}>
            {smartSuggestions.map((r) => (
              <TouchableOpacity
                key={`s-${r.id}`}
                style={s.suggestionCard}
                onPress={() => {
                  tap();
                  navigation.navigate("RecipeDetail", { id: r.id });
                }}
                activeOpacity={0.9}
              >
                <Text style={s.suggestionIcon}>🥘</Text>
                <Text style={[s.suggestionText, { textAlign: isHe ? "right" : "left" }]} numberOfLines={1}>
                  {isHe ? r.title_he : r.title_en}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[s.sectionRow, { flexDirection: isHe ? "row-reverse" : "row", marginTop: 16 }]}>
            <Text style={s.sectionTitle}>{isHe ? "בישלת לאחרונה" : "Recently cooked"}</Text>
            <TouchableOpacity
              onPress={() => {
                tap();
                navigation.navigate("Search");
              }}
            >
              <Text style={s.seeAll}>{isHe ? "ראה הכל" : "See all"}</Text>
            </TouchableOpacity>
          </View>

          {recent.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[s.recentCard, { flexDirection: isHe ? "row-reverse" : "row" }]}
              onPress={() => {
                tap();
                navigation.navigate("RecipeDetail", { id: r.id });
              }}
              activeOpacity={0.92}
            >
              <View style={s.recentThumb}>
                <Ionicons name="restaurant-outline" size={24} color="#A26D58" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[s.recentTitle, { textAlign: isHe ? "right" : "left" }]} numberOfLines={1}>
                  {isHe ? r.title_he : r.title_en}
                </Text>
                <Text style={[s.recentMeta, { textAlign: isHe ? "right" : "left" }]}>
                  ⏱ {r.cook_time_min ?? 0} {isHe ? "דקות" : "min"}  |  🍽 {r.servings ?? 2} {isHe ? "מנות" : "servings"}  |  ⚡ {isHe ? "קל" : "easy"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  tap();
                  toggleFav(r.id, r.is_favorite);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.recentFav}>{r.is_favorite ? "❤️" : "🤍"}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24 },

  hero: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  heroTitle: {
    ...Typography.h2,
    color: Colors.text.primary,
    fontSize: 26,
  },
  heroSub: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  heroActions: {
    marginTop: 16,
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  primaryBtnText: {
    ...Typography.button,
    color: "#fff",
    fontSize: 14,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    ...Typography.label,
    color: Colors.text.primary,
  },

  searchBar: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DFDFD9",
    minHeight: 54,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchSideIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  searchText: {
    ...Typography.body,
    color: Colors.text.tertiary,
    flex: 1,
    marginHorizontal: 10,
    fontSize: 15,
  },

  sectionTitle: {
    ...Typography.h3,
    color: Colors.text.primary,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionRow: {
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  seeAll: {
    ...Typography.label,
    color: Colors.primary,
  },

  continueCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    gap: 10,
  },
  continueThumb: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FFE6DA",
    alignItems: "center",
    justifyContent: "center",
  },
  continueName: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: "600",
  },
  continueMeta: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  chipsWrap: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    ...Typography.label,
    color: Colors.text.secondary,
    fontSize: 12,
  },
  chipTextSelected: {
    color: "#fff",
  },

  favoritesWrap: {
    paddingHorizontal: 16,
    gap: 12,
  },
  favoriteCard: {
    width: 172,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    paddingBottom: 10,
  },
  favoriteImage: {
    height: 98,
    backgroundColor: "#FFE8D5",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteName: {
    ...Typography.bodySmall,
    color: Colors.text.primary,
    fontWeight: "600",
    paddingHorizontal: 10,
    marginTop: 8,
  },
  favoriteMeta: {
    ...Typography.caption,
    color: Colors.text.secondary,
    paddingHorizontal: 10,
    marginTop: 4,
  },

  favEmptyBox: {
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
  },
  favEmptyEmoji: { fontSize: 34 },
  favEmptyTitle: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginTop: 8,
    marginBottom: 12,
  },
  favEmptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  favEmptyBtnText: {
    ...Typography.label,
    color: "#fff",
  },

  suggestionWrap: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionCard: {
    minWidth: 146,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionIcon: { fontSize: 18, marginBottom: 4 },
  suggestionText: {
    ...Typography.caption,
    color: Colors.text.primary,
    fontWeight: "600",
  },

  recentCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    gap: 10,
  },
  recentThumb: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: "#FFE8D5",
    alignItems: "center",
    justifyContent: "center",
  },
  recentTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: "600",
  },
  recentMeta: {
    ...Typography.caption,
    color: Colors.text.secondary,
    marginTop: 3,
  },
  recentFav: { fontSize: 20 },
});
