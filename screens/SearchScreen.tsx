import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Colors } from "../constants/colors";
import { isHebrew } from "../lib/i18n";
import { useRecipeStore } from "../store/recipeStore";
import { useDebounce } from "../hooks/useDebounce";
import { countActiveFilters } from "../lib/search";
import FilterSheet from "../components/FilterSheet";
import RecipeCard from "../components/RecipeCard";
import type { FilterState } from "../lib/search";

const SORT_OPTIONS: {
  key: FilterState["sortBy"];
  label_he: string;
  label_en: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  { key: "newest",    label_he: "חדש",     label_en: "Newest",   icon: "sparkles-outline" },
  { key: "fastest",   label_he: "מהיר",    label_en: "Fastest",  icon: "flash-outline" },
  { key: "favorites", label_he: "מועדפים", label_en: "Saved",    icon: "heart-outline" },
  { key: "last_used", label_he: "אחרון",   label_en: "Recent",   icon: "time-outline" },
];

export default function SearchScreen({ navigation }: any) {
  const {
    recipes,
    filters,
    loading,
    setFilter,
    resetFilters,
    loadRecipes,
    toggleFav,
    removeRecipe,
  } = useRecipeStore();

  const [rawQuery, setRawQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const debouncedQuery = useDebounce(rawQuery, 280);
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const activeCount = countActiveFilters(filters);
  const inputRef = useRef<TextInput>(null);

  // Animate search box focus
  const focusAnim = useRef(new Animated.Value(0)).current;

  function onSearchFocus() {
    Animated.spring(focusAnim, { toValue: 1, useNativeDriver: false, friction: 8 }).start();
  }
  function onSearchBlur() {
    Animated.spring(focusAnim, { toValue: 0, useNativeDriver: false, friction: 8 }).start();
  }

  const searchBorderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.primary],
  });

  useEffect(() => { void loadRecipes(); }, []);
  useEffect(() => { setFilter("query", debouncedQuery); }, [debouncedQuery]);

  const resultLabel = loading
    ? ""
    : recipes.length === 0
      ? (isHe ? "אין תוצאות" : "No results")
      : isHe
        ? `${recipes.length} מתכונים`
        : `${recipes.length} recipes`;

  return (
    <View style={s.container}>
      {/* ── Hero gradient header ── */}
      <LinearGradient
        colors={["#FF6B6B", "#FF8E53"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingTop: insets.top + 10 }]}
      >
        <Text style={[s.heroTitle, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "חיפוש מתכונים" : "Find a Recipe"}
        </Text>
        <Text style={[s.heroSub, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "חפש לפי שם, מצרכים, קטגוריה..." : "Search by name, ingredients, category..."}
        </Text>

        {/* Search bar embedded in hero */}
        <Animated.View
          style={[
            s.searchBox,
            { flexDirection: isHe ? "row-reverse" : "row", borderColor: searchBorderColor },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={Colors.text.tertiary}
            style={isHe ? { marginLeft: 4 } : { marginRight: 4 }}
          />
          <TextInput
            ref={inputRef}
            style={[s.searchInput, { textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" }]}
            placeholder={isHe ? "מה מחפשים?" : "What are you looking for?"}
            placeholderTextColor={Colors.text.tertiary}
            value={rawQuery}
            onChangeText={setRawQuery}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            autoCorrect={false}
            returnKeyType="search"
          />
          {rawQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                void Haptics.selectionAsync();
                setRawQuery("");
                setFilter("query", "");
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}

          {/* Filter button */}
          <TouchableOpacity
            style={[s.filterBtn, activeCount > 0 && s.filterBtnActive]}
            onPress={() => {
              void Haptics.selectionAsync();
              setShowFilters(true);
            }}
          >
            <Ionicons
              name="options-outline"
              size={17}
              color={activeCount > 0 ? Colors.primary : Colors.text.secondary}
            />
            {activeCount > 0 && (
              <View style={s.filterBadge}>
                <Text style={s.filterBadgeText}>{activeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>

      {/* ── Sort pills ── */}
      <View style={s.sortWrap}>
        <View style={[s.sortRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          {SORT_OPTIONS.map((o) => {
            const active = filters.sortBy === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[s.sortPill, active && s.sortPillActive]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setFilter("sortBy", o.key);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={o.icon}
                  size={12}
                  color={active ? "#fff" : Colors.text.secondary}
                />
                <Text style={[s.sortPillText, active && s.sortPillTextActive]}>
                  {isHe ? o.label_he : o.label_en}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Active filter chips ── */}
      {activeCount > 0 && (
        <View style={[s.activeRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          {filters.favoritesOnly && (
            <FilterChip
              label={isHe ? "מועדפים" : "Favorites"}
              onRemove={() => setFilter("favoritesOnly", false)}
            />
          )}
          {filters.difficulty && (
            <FilterChip
              label={isHe
                ? filters.difficulty === "easy" ? "קל" : filters.difficulty === "medium" ? "בינוני" : "קשה"
                : filters.difficulty}
              onRemove={() => setFilter("difficulty", null)}
            />
          )}
          {filters.maxCookTime && (
            <FilterChip
              label={`≤${filters.maxCookTime}${isHe ? " דקות" : " min"}`}
              onRemove={() => setFilter("maxCookTime", null)}
            />
          )}
          <TouchableOpacity
            onPress={() => {
              void Haptics.selectionAsync();
              resetFilters();
            }}
            style={s.clearAllBtn}
          >
            <Text style={s.clearAllText}>{isHe ? "נקה הכל" : "Clear all"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Results header ── */}
      <View style={[s.resultsHeader, { flexDirection: isHe ? "row-reverse" : "row" }]}>
        <Text style={s.resultsCount}>{resultLabel}</Text>
        {recipes.length > 0 && (
          <Text style={s.resultsHint}>
            {isHe ? "החלק שמאלה למחיקה" : "Swipe left to delete"}
          </Text>
        )}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : recipes.length === 0 ? (
        <EmptyState
          isHe={isHe}
          hasQuery={rawQuery.length > 0 || activeCount > 0}
          onReset={() => {
            setRawQuery("");
            resetFilters();
          }}
        />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              query={rawQuery}
              onPress={() => {
                void Haptics.selectionAsync();
                navigation.navigate("RecipeDetail", { id: item.id });
              }}
              onFav={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                toggleFav(item.id, item.is_favorite);
              }}
              onDelete={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Alert.alert(
                  isHe ? "מחיקת מתכון" : "Delete recipe",
                  isHe ? "האם למחוק את המתכון?" : "Delete this recipe?",
                  [
                    { text: isHe ? "ביטול" : "Cancel", style: "cancel" },
                    {
                      text: isHe ? "מחק" : "Delete",
                      style: "destructive",
                      onPress: () => void removeRecipe(item.id),
                    },
                  ],
                );
              }}
              isHe={isHe}
            />
          )}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: 90 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Filter sheet ── */}
      {showFilters && (
        <FilterSheet
          filters={filters}
          onUpdate={(key: any, val: any) => setFilter(key, val)}
          onClose={() => setShowFilters(false)}
          onReset={resetFilters}
          isHe={isHe}
        />
      )}
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <TouchableOpacity style={s.filterChip} onPress={onRemove} activeOpacity={0.75}>
      <Text style={s.filterChipText}>{label}</Text>
      <Ionicons name="close" size={11} color="#c94040" />
    </TouchableOpacity>
  );
}

function EmptyState({
  isHe,
  hasQuery,
  onReset,
}: {
  isHe: boolean;
  hasQuery: boolean;
  onReset: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIconWrap}>
        <Text style={s.emptyEmoji}>🍽️</Text>
      </View>
      <Text style={s.emptyTitle}>
        {isHe ? "לא נמצאו מתכונים" : "No recipes found"}
      </Text>
      <Text style={s.emptySub}>
        {hasQuery
          ? isHe ? "נסה מילות חיפוש אחרות" : "Try different search terms"
          : isHe ? "הוסף מתכונים כדי להתחיל" : "Add recipes to get started"}
      </Text>
      {hasQuery && (
        <TouchableOpacity style={s.emptyBtn} onPress={onReset} activeOpacity={0.85}>
          <Text style={s.emptyBtnText}>{isHe ? "נקה חיפוש" : "Clear search"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F0EB" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Hero
  hero: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    gap: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 14,
  },

  // Search box (inside hero)
  searchBox: {
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    paddingVertical: 0,
  },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary + "18",
    borderColor: Colors.primary + "66",
  },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { fontSize: 9, color: "#fff", fontWeight: "700" },

  // Sort pills
  sortWrap: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sortRow: {
    gap: 8,
  },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sortPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  sortPillTextActive: { color: "#fff" },

  // Active filter chips row
  activeRow: {
    flexWrap: "wrap",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: "center",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#FFE8E8",
    borderWidth: 1,
    borderColor: "#FFBCBC",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#c94040",
  },
  clearAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
    textDecorationLine: "underline",
  },

  // Results header
  resultsHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text.secondary,
    letterSpacing: 0.2,
  },
  resultsHint: {
    fontSize: 11,
    color: Colors.text.tertiary,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFE8D6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text.primary,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 6,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
