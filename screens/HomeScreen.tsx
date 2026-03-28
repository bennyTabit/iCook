import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';
import { useRecipeStore } from '../store/recipeStore';
import { isHebrew } from '../lib/i18n';
import { useGreeting } from '../hooks/useGreeting';

const CATEGORIES = [
  { key: 'all',       emoji: '🍽', labelKey: 'catAll'       },
  { key: 'pasta',     emoji: '🍝', labelKey: 'catPasta'     },
  { key: 'salads',    emoji: '🥗', labelKey: 'catSalads'    },
  { key: 'desserts',  emoji: '🍰', labelKey: 'catDesserts'  },
  { key: 'soups',     emoji: '🍜', labelKey: 'catSoups'     },
  { key: 'meat',      emoji: '🥩', labelKey: 'catMeat'      },
  { key: 'breakfast', emoji: '🍳', labelKey: 'catBreakfast' },
];

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const greeting = useGreeting();
  const { recipes, loadRecipes, toggleFav, setFilter, filters } = useRecipeStore();

  useEffect(() => { loadRecipes(); }, []);

  const favorites = recipes.filter(r => r.is_favorite === 1);
  const recent    = recipes.slice(0, 6);

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[s.header, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
          <View>
            <Text style={s.greeting}>{greeting}</Text>
            <Text style={s.headline}>{t('whatCook')} 🍳</Text>
          </View>
          <View style={s.avatar}><Text style={s.avatarText}>{isHe ? 'א' : 'A'}</Text></View>
        </View>

        {/* Search bar (tappable) */}
        <TouchableOpacity style={s.searchBar} onPress={() => navigation.navigate('Search')} activeOpacity={0.7}>
          <Text style={s.searchIcon}>🔍</Text>
          <Text style={s.searchPlaceholder}>{t('searchPlaceholder')}</Text>
        </TouchableOpacity>

        {/* Category chips */}
        <Text style={[s.sectionTitle, { textAlign: isHe ? 'right' : 'left' }]}>{t('categories')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[s.catChip, filters.categoryId?.toString() === cat.key && s.catChipActive]}
              onPress={() => { setFilter('categoryId', cat.key === 'all' ? null : Number(cat.key)); navigation.navigate('Search'); }}
            >
              <Text style={s.catEmoji}>{cat.emoji}</Text>
              <Text style={[s.catLabel, filters.categoryId?.toString() === cat.key && s.catLabelActive]}>{t(cat.labelKey as any)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Favorites row */}
        {favorites.length > 0 && (
          <>
            <View style={[s.sectionRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
              <Text style={s.sectionTitle}>{t('favorites')} ❤️</Text>
              <TouchableOpacity onPress={() => { setFilter('favoritesOnly', true); navigation.navigate('Search'); }}>
                <Text style={s.seeAll}>{t('seeAll')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {favorites.map(r => (
                <TouchableOpacity key={r.id} style={s.favCard} onPress={() => navigation.navigate('RecipeDetail', { id: r.id })}>
                  <View style={[s.favImg, { backgroundColor: '#FFE66D' }]}>
                    <Text style={{ fontSize: 22 }}>🍝</Text>
                  </View>
                  <Text style={s.favTitle} numberOfLines={2}>{isHe ? r.title_he : r.title_en}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* Recent recipes */}
        <View style={[s.sectionRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
          <Text style={s.sectionTitle}>{t('recentRecipes')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Text style={s.seeAll}>{t('seeAll')}</Text>
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 36 }}>🍳</Text>
            <Text style={s.emptyText}>{isHe ? 'עדיין אין מתכונים' : 'No recipes yet'}</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('AddRecipe')}>
              <Text style={s.emptyBtnText}>{t('addRecipe')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recent.map(r => (
            <TouchableOpacity key={r.id} style={s.recipeCard} onPress={() => navigation.navigate('RecipeDetail', { id: r.id })} activeOpacity={0.85}>
              <View style={[s.cardImg, { backgroundColor: '#FFE66D' }]}>
                <Text style={{ fontSize: 28 }}>🍝</Text>
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle} numberOfLines={1}>{isHe ? r.title_he : r.title_en}</Text>
                <View style={[s.cardMeta, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
                  {r.cook_time_min != null && <Text style={s.metaText}>⏱ {r.cook_time_min} {t('minutes')}</Text>}
                  {r.servings != null && <Text style={s.metaText}>🍽 {r.servings} {t('servings')}</Text>}
                  {r.difficulty && (
                    <Text style={[s.diffBadge, { backgroundColor: (Colors.difficulty as any)[r.difficulty] + '33' }]}>
                      {t(r.difficulty as any)}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity style={s.favBtn} onPress={() => toggleFav(r.id, r.is_favorite)}>
                <Text style={{ fontSize: 18 }}>{r.is_favorite ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background },
  header:         { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  greeting:       { fontSize: 12, color: Colors.text.secondary },
  headline:       { fontSize: 18, fontWeight: '500', color: Colors.text.primary },
  avatar:         { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 14, color: '#fff', fontWeight: '500' },
  searchBar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 22, marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 0.5, borderColor: Colors.border, gap: 8 },
  searchIcon:     { fontSize: 14 },
  searchPlaceholder: { fontSize: 13, color: Colors.text.tertiary, flex: 1 },
  sectionTitle:   { fontSize: 14, fontWeight: '500', color: Colors.text.primary, paddingHorizontal: 16, marginBottom: 8 },
  sectionRow:     { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  seeAll:         { fontSize: 12, color: Colors.primary },
  catScroll:      { marginBottom: 16 },
  catChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.surface, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 0.5, borderColor: Colors.border },
  catChipActive:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catEmoji:       { fontSize: 14 },
  catLabel:       { fontSize: 12, color: Colors.text.secondary, fontWeight: '500' },
  catLabelActive: { color: '#fff' },
  favCard:        { width: 80, borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.background },
  favImg:         { height: 52, alignItems: 'center', justifyContent: 'center' },
  favTitle:       { fontSize: 10, padding: 5, color: Colors.text.primary, fontWeight: '500', lineHeight: 13 },
  recipeCard:     { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.background },
  cardImg:        { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  cardBody:       { flex: 1, padding: 10, justifyContent: 'center' },
  cardTitle:      { fontSize: 13, fontWeight: '500', color: Colors.text.primary, marginBottom: 4 },
  cardMeta:       { gap: 6, alignItems: 'center' },
  metaText:       { fontSize: 11, color: Colors.text.secondary },
  diffBadge:      { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, color: Colors.text.secondary, overflow: 'hidden' },
  favBtn:         { padding: 12, alignItems: 'center', justifyContent: 'center' },
  emptyState:     { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText:      { fontSize: 14, color: Colors.text.tertiary },
  emptyBtn:       { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText:   { color: '#fff', fontWeight: '500', fontSize: 13 },
});
