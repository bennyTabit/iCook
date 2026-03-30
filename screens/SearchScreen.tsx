import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Colors } from "../constants/colors";
import { Typography } from "../constants/typography";
import { LinearGradient } from "expo-linear-gradient";
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
}[] = [
  { key: "newest", label_he: "חדש", label_en: "Newest" },
  { key: "fastest", label_he: "מהיר", label_en: "Fastest" },
  { key: "favorites", label_he: "מועדפים", label_en: "Favorites" },
  { key: "last_used", label_he: "אחרון", label_en: "Recent" },
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
  } = useRecipeStore();
  const [rawQuery, setRawQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const debouncedQuery = useDebounce(rawQuery, 280);
  const isHe = isHebrew();
  const activeCount = countActiveFilters(filters);

  function tap() {
    void Haptics.selectionAsync();
  }

  useEffect(() => {
    loadRecipes();
  }, []);
  useEffect(() => {
    setFilter("query", debouncedQuery);
  }, [debouncedQuery]);

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#FF8A6B", "#FFC16B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.banner}
      >
        <Text style={[s.bannerTitle, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "חיפוש חכם" : "Smart Search"}
        </Text>
        <Text style={[s.bannerSub, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "מצא/י מתכון בשניות" : "Find any recipe in seconds"}
        </Text>
      </LinearGradient>

      {/* Search bar */}
      <View
        style={[s.searchRow, { flexDirection: isHe ? "row-reverse" : "row" }]}
      >
        <View
          style={[s.searchBox, { flexDirection: isHe ? "row-reverse" : "row" }]}
        >
          <Text
            style={[
              s.searchIcon,
              isHe ? { marginLeft: 6 } : { marginRight: 6 },
            ]}
          >
            🔍
          </Text>
          <TextInput
            style={[
              s.searchInput,
              {
                textAlign: isHe ? "right" : "left",
                writingDirection: isHe ? "rtl" : "ltr",
              },
            ]}
            placeholder={isHe ? "חיפוש מתכונים..." : "Search recipes..."}
            value={rawQuery}
            onChangeText={setRawQuery}
            autoCorrect={false}
          />
          {rawQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                tap();
                setRawQuery("");
                setFilter("query", "");
              }}
            >
              <Text style={s.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.filterBtn, activeCount > 0 && s.filterBtnActive]}
          onPress={() => {
            tap();
            setShowFilters(true);
          }}
        >
          <Text style={s.filterIcon}>⚙️</Text>
          {activeCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Sort chips */}
      <View
        style={[s.sortRow, { flexDirection: isHe ? "row-reverse" : "row" }]}
      >
        {SORT_OPTIONS.map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[s.sortChip, filters.sortBy === o.key && s.sortChipActive]}
            onPress={() => {
              tap();
              setFilter("sortBy", o.key);
            }}
            activeOpacity={0.85}
          >
            <Text
              style={[
                s.sortChipText,
                filters.sortBy === o.key && s.sortChipTextActive,
              ]}
            >
              {isHe ? o.label_he : o.label_en}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <View
          style={[
            s.activeFiltersRow,
            { flexDirection: isHe ? "row-reverse" : "row" },
          ]}
        >
          {filters.favoritesOnly && (
            <ActiveChip
              label={isHe ? "מועדפים" : "Favorites"}
              onRemove={() => setFilter("favoritesOnly", false)}
            />
          )}
          {filters.difficulty && (
            <ActiveChip
              label={filters.difficulty}
              onRemove={() => setFilter("difficulty", null)}
            />
          )}
          {filters.maxCookTime && (
            <ActiveChip
              label={`≤${filters.maxCookTime}${isHe ? " דקות" : " min"}`}
              onRemove={() => setFilter("maxCookTime", null)}
            />
          )}
          <TouchableOpacity
            onPress={() => {
              tap();
              resetFilters();
            }}
          >
            <Text style={s.clearAll}>{isHe ? "נקה הכל" : "Clear all"}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[s.resultCount, { textAlign: isHe ? "right" : "left" }]}>
        {loading ? "" : `${recipes.length} ${isHe ? "תוצאות" : "results"}`}
      </Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : recipes.length === 0 ? (
        <EmptyState
          isHe={isHe}
          hasFilters={activeCount > 0 || rawQuery.length > 0}
          onReset={resetFilters}
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
                tap();
                navigation.navigate("RecipeDetail", { id: item.id });
              }}
              onFav={() => {
                tap();
                toggleFav(item.id, item.is_favorite);
              }}
              isHe={isHe}
            />
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}

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

function ActiveChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  const isHe = isHebrew();
  return (
    <TouchableOpacity style={s.activeChip} onPress={onRemove}>
      <Text style={s.activeChipText}>{isHe ? `✕ ${label}` : `${label} ✕`}</Text>
    </TouchableOpacity>
  );
}

function EmptyState({ isHe, hasFilters, onReset }: any) {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyEmoji}>🍽</Text>
      <Text style={s.emptyTitle}>
        {isHe ? "לא נמצאו מתכונים" : "No recipes found"}
      </Text>
      {hasFilters && (
        <TouchableOpacity onPress={onReset} style={s.emptyBtn}>
          <Text style={s.emptyBtnText}>
            {isHe ? "נקה פילטרים" : "Clear filters"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  banner: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerTitle: {
    ...Typography.h3,
    color: "#fff",
    fontWeight: "700",
    marginBottom: 2,
  },
  bannerSub: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.9)",
  },
  searchRow: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 8 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { ...Typography.bodySmall, flex: 1, color: Colors.text.primary },
  clearBtn: {
    ...Typography.label,
    color: Colors.text.tertiary,
    paddingLeft: 6,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  filterBtnActive: { backgroundColor: "#FF6B6B22", borderColor: "#FF6B6B88" },
  filterIcon: { fontSize: 16 },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { color: "#fff", fontSize: 9, fontWeight: "600" },
  sortRow: {
    gap: 7,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexWrap: "wrap",
  },
  sortChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sortChipText: {
    ...Typography.caption,
    color: Colors.text.secondary,
    fontWeight: "600",
  },
  sortChipTextActive: { color: "#fff" },
  activeFiltersRow: {
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },
  activeChip: {
    backgroundColor: "#FF6B6B22",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#FF6B6B55",
  },
  activeChipText: {
    ...Typography.caption,
    color: "#c94040",
    fontWeight: "600",
  },
  clearAll: {
    ...Typography.caption,
    color: Colors.primary,
    textDecorationLine: "underline",
  },
  resultCount: {
    ...Typography.caption,
    color: Colors.text.tertiary,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: "600",
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyBtnText: { ...Typography.button, color: "#fff" },
});
