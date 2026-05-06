/**
 * Full-screen recipe picker — category browsing + search.
 * Used by CollectionDetailScreen, MealPlannerScreen, and anywhere
 * a recipe selection is needed.
 *
 * Props:
 *   visible      — show/hide
 *   onClose      — called when user taps X or hardware back
 *   onSelect     — called with the chosen RecipeSummary
 *   alreadyAdded — optional set of recipe IDs already in the target
 *                  (shown with a checkmark, still tappable to confirm)
 *   title        — optional header title override
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '../constants/colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { isHebrew } from '../lib/i18n';
import { getCategories, type Category } from '../lib/db';
import { CATEGORY_EMOJI, FALLBACK_EMOJI, CATEGORY_BG, FALLBACK_BG } from '../constants/recipes';
import { useRecipeStore } from '../store/recipeStore';
import type { RecipeSummary } from '../lib/search';

// ── Types ─────────────────────────────────────────────────────────────────────

export type { RecipeSummary };

export interface RecipePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (recipe: RecipeSummary) => void;
  alreadyAdded?: Set<number>;
  title?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecipePickerModal({
  visible,
  onClose,
  onSelect,
  alreadyAdded,
  title,
}: RecipePickerModalProps) {
  const C = useThemeColors();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { recipes, loadRecipes } = useRecipeStore();

  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;

  // ── Open / close animation ──────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setQuery('');
      setSelectedCat(null);
      void getCategories().then(setCategories);
      void loadRecipes();
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 80, friction: 14, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 30, duration: 180, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  // Hardware back
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedCat) { setSelectedCat(null); return true; }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, selectedCat]);

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = recipes;
    if (selectedCat) {
      list = list.filter(
        (r) =>
          r.category_name_en?.toLowerCase() === selectedCat.name_en.toLowerCase() ||
          r.category_name_he === selectedCat.name_he,
      );
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) => r.title_he?.toLowerCase().includes(q) || r.title_en?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [recipes, query, selectedCat]);

  const showBrowse = !query.trim() && !selectedCat;

  if (!mounted) return null;

  const screenTitle =
    title ?? (isHe ? 'בחר מתכון' : 'Choose a recipe');

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={mounted}
      transparent={false}
      animationType="none"
      onRequestClose={() => {
        if (selectedCat) { setSelectedCat(null); return; }
        onClose();
      }}
    >
      <Animated.View
        style={[
          s.container,
          { backgroundColor: C.background, opacity: fade, transform: [{ translateY }] },
          { paddingTop: insets.top },
        ]}
      >
        {/* ── Header ── */}
        <View style={[s.header, { flexDirection: isHe ? 'row-reverse' : 'row', borderBottomColor: C.border }]}>
          {/* Breadcrumb back arrow — visible when a category is selected */}
          {selectedCat ? (
            <TouchableOpacity
              style={s.headerSideBtn}
              onPress={() => { void Haptics.selectionAsync(); setSelectedCat(null); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isHe ? 'חזור לקטגוריות' : 'Back to categories'}
            >
              <Ionicons
                name={isHe ? 'chevron-forward' : 'chevron-back'}
                size={26}
                color={C.text.primary}
              />
            </TouchableOpacity>
          ) : (
            <View style={s.headerSideBtn} />
          )}

          <Text style={[s.headerTitle, { color: C.text.primary }]} numberOfLines={1}>
            {selectedCat
              ? (isHe ? selectedCat.name_he : selectedCat.name_en)
              : screenTitle}
          </Text>

          {/* Close X */}
          <TouchableOpacity
            style={[s.closeBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isHe ? 'סגור' : 'Close'}
          >
            <Ionicons name="close" size={20} color={C.text.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Search bar ── */}
        <View style={[s.searchRow, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Ionicons name="search-outline" size={18} color={C.text.tertiary} />
          <TextInput
            style={[s.searchInput, { color: C.text.primary, textAlign: isHe ? 'right' : 'left' }]}
            placeholder={isHe ? 'חיפוש מתכון...' : 'Search recipes...'}
            placeholderTextColor={C.text.tertiary}
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              if (v.trim() && selectedCat) setSelectedCat(null);
            }}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={C.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Active category breadcrumb chip ── */}
        {selectedCat && (
          <View style={s.breadcrumbRow}>
            <TouchableOpacity
              style={[s.breadcrumbChip, { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '44' }]}
              onPress={() => { void Haptics.selectionAsync(); setSelectedCat(null); }}
            >
              <Text style={{ fontSize: 16 }}>
                {CATEGORY_EMOJI[selectedCat.name_en.toLowerCase()] ?? FALLBACK_EMOJI}
              </Text>
              <Text style={[s.breadcrumbText, { color: Colors.primary }]}>
                {isHe ? selectedCat.name_he : selectedCat.name_en}
              </Text>
              <Ionicons name="close-circle" size={15} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Body ── */}
        {showBrowse ? (
          <CategoryGrid
            categories={categories}
            isHe={isHe}
            C={C}
            onSelect={(cat) => {
              void Haptics.selectionAsync();
              setSelectedCat(cat);
            }}
          />
        ) : (
          <RecipeList
            recipes={filtered}
            isHe={isHe}
            C={C}
            alreadyAdded={alreadyAdded}
            insets={insets}
            onSelect={(recipe) => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onSelect(recipe);
            }}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Category Grid ─────────────────────────────────────────────────────────────

function CategoryGrid({
  categories,
  isHe,
  C,
  onSelect,
}: {
  categories: Category[];
  isHe: boolean;
  C: ReturnType<typeof useThemeColors>;
  onSelect: (cat: Category) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={s.catGrid}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[s.sectionLabel, { color: C.text.tertiary, textAlign: isHe ? 'right' : 'left' }]}>
        {isHe ? 'עיון לפי קטגוריה' : 'Browse by category'}
      </Text>
      <View style={s.catTileRow}>
        {categories.map((cat) => {
          const key = cat.name_en.toLowerCase();
          const emoji = CATEGORY_EMOJI[key] ?? FALLBACK_EMOJI;
          const bg = CATEGORY_BG[key] ?? FALLBACK_BG;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[s.catTile, { backgroundColor: C.surfaceElevated }]}
              onPress={() => onSelect(cat)}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={isHe ? cat.name_he : cat.name_en}
            >
              <View style={[s.catEmojiWrap, { backgroundColor: bg }]}>
                <Text style={s.catEmoji}>{emoji}</Text>
              </View>
              <Text style={[s.catName, { color: C.text.primary }]} numberOfLines={2}>
                {isHe ? cat.name_he : cat.name_en}
              </Text>
              <Ionicons
                name={isHe ? 'chevron-back' : 'chevron-forward'}
                size={14}
                color={C.text.tertiary}
                style={{ marginTop: 2 }}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Recipe List ───────────────────────────────────────────────────────────────

function RecipeList({
  recipes,
  isHe,
  C,
  alreadyAdded,
  insets,
  onSelect,
}: {
  recipes: RecipeSummary[];
  isHe: boolean;
  C: ReturnType<typeof useThemeColors>;
  alreadyAdded?: Set<number>;
  insets: { bottom: number };
  onSelect: (r: RecipeSummary) => void;
}) {
  return (
    <FlatList
      data={recipes}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={[s.recipeListContent, { paddingBottom: insets.bottom + 20 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={s.emptyWrap}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🔍</Text>
          <Text style={[s.emptyText, { color: C.text.secondary }]}>
            {isHe ? 'לא נמצאו מתכונים' : 'No recipes found'}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const added = alreadyAdded?.has(item.id) ?? false;
        return (
          <TouchableOpacity
            style={[
              s.recipeCard,
              { backgroundColor: C.surfaceElevated, flexDirection: isHe ? 'row-reverse' : 'row' },
              added && { opacity: 0.55 },
            ]}
            onPress={() => onSelect(item)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={isHe ? item.title_he : (item.title_en ?? item.title_he)}
            accessibilityState={{ selected: added }}
          >
            {/* Thumbnail */}
            {item.image_uri ? (
              <Image source={{ uri: item.image_uri }} style={s.recipeThumb} />
            ) : (
              <View style={[s.recipeThumb, s.recipeThumbPlaceholder, { backgroundColor: C.surface }]}>
                <Text style={{ fontSize: 28 }}>🍳</Text>
              </View>
            )}

            {/* Info */}
            <View style={s.recipeInfo}>
              <Text
                style={[s.recipeTitle, { color: C.text.primary, textAlign: isHe ? 'right' : 'left' }]}
                numberOfLines={2}
              >
                {isHe ? item.title_he : (item.title_en ?? item.title_he)}
              </Text>
              <View style={[s.recipeMeta, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
                {item.cook_time_min != null && (
                  <View style={[s.metaChip, { backgroundColor: C.surface }]}>
                    <Ionicons name="timer-outline" size={13} color={C.text.tertiary} />
                    <Text style={[s.metaText, { color: C.text.tertiary }]}>
                      {item.cook_time_min}{isHe ? " דק׳" : ' min'}
                    </Text>
                  </View>
                )}
                {item.difficulty != null && (
                  <View style={[s.metaChip, { backgroundColor: C.surface }]}>
                    <Text style={[s.metaText, { color: C.text.tertiary }]}>
                      {item.difficulty === 'easy' ? (isHe ? 'קל' : 'Easy')
                        : item.difficulty === 'medium' ? (isHe ? 'בינוני' : 'Medium')
                        : (isHe ? 'קשה' : 'Hard')}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Action indicator */}
            {added ? (
              <View style={[s.addedBadge, { backgroundColor: Colors.primary + '20' }]}>
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              </View>
            ) : (
              <View style={[s.addCircle, { backgroundColor: Colors.primary }]}>
                <Ionicons name="add" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerSideBtn: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },

  // Breadcrumb
  breadcrumbRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2,
  },
  breadcrumbChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  breadcrumbText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Category grid
  catGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  catTileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  catTile: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  catEmojiWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  catEmoji: {
    fontSize: 26,
  },
  catName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },

  // Recipe list
  recipeListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  recipeCard: {
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  recipeThumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    flexShrink: 0,
  },
  recipeThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeInfo: {
    flex: 1,
    gap: 6,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  recipeMeta: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
