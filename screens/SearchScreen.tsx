import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, I18nManager,
} from 'react-native';
import { useRecipeStore } from '../store/recipeStore';
import { useDebounce } from '../hooks/useDebounce';
import { countActiveFilters } from '../lib/search';
import FilterSheet from '../components/FilterSheet';
import RecipeCard from '../components/RecipeCard';
import type { FilterState } from '../lib/search';

const SORT_OPTIONS: { key: FilterState['sortBy']; label_he: string; label_en: string }[] = [
  { key: 'newest',    label_he: 'חדש',     label_en: 'Newest' },
  { key: 'fastest',   label_he: 'מהיר',    label_en: 'Fastest' },
  { key: 'favorites', label_he: 'מועדפים', label_en: 'Favorites' },
  { key: 'last_used', label_he: 'אחרון',   label_en: 'Recent' },
];

export default function SearchScreen({ navigation }: any) {
  const { recipes, filters, loading, setFilter, resetFilters, loadRecipes, toggleFav } = useRecipeStore();
  const [rawQuery, setRawQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const debouncedQuery = useDebounce(rawQuery, 280);
  const isHe = I18nManager.isRTL;
  const activeCount = countActiveFilters(filters);

  useEffect(() => { loadRecipes(); }, []);
  useEffect(() => { setFilter('query', debouncedQuery); }, [debouncedQuery]);

  return (
    <View style={s.container}>
      {/* Search bar */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder={isHe ? 'חיפוש מתכונים...' : 'Search recipes...'}
            value={rawQuery}
            onChangeText={setRawQuery}
            textAlign={isHe ? 'right' : 'left'}
            autoCorrect={false}
          />
          {rawQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setRawQuery(''); setFilter('query', ''); }}>
              <Text style={s.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.filterBtn, activeCount > 0 && s.filterBtnActive]}
          onPress={() => setShowFilters(true)}
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
      <View style={s.sortRow}>
        {SORT_OPTIONS.map(o => (
          <TouchableOpacity
            key={o.key}
            style={[s.sortChip, filters.sortBy === o.key && s.sortChipActive]}
            onPress={() => setFilter('sortBy', o.key)}
          >
            <Text style={[s.sortChipText, filters.sortBy === o.key && s.sortChipTextActive]}>
              {isHe ? o.label_he : o.label_en}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <View style={s.activeFiltersRow}>
          {filters.favoritesOnly && <ActiveChip label={isHe ? 'מועדפים' : 'Favorites'} onRemove={() => setFilter('favoritesOnly', false)} />}
          {filters.difficulty    && <ActiveChip label={filters.difficulty} onRemove={() => setFilter('difficulty', null)} />}
          {filters.maxCookTime   && <ActiveChip label={`≤${filters.maxCookTime}${isHe ? ' דקות' : ' min'}`} onRemove={() => setFilter('maxCookTime', null)} />}
          <TouchableOpacity onPress={resetFilters}>
            <Text style={s.clearAll}>{isHe ? 'נקה הכל' : 'Clear all'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={s.resultCount}>
        {loading ? '' : `${recipes.length} ${isHe ? 'תוצאות' : 'results'}`}
      </Text>

      {loading ? (
        <ActivityIndicator color="#FF6B6B" style={{ marginTop: 40 }} />
      ) : recipes.length === 0 ? (
        <EmptyState isHe={isHe} hasFilters={activeCount > 0 || rawQuery.length > 0} onReset={resetFilters} />
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={r => String(r.id)}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              query={rawQuery}
              onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
              onFav={() => toggleFav(item.id, item.is_favorite)}
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

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <TouchableOpacity style={s.activeChip} onPress={onRemove}>
      <Text style={s.activeChipText}>{label} ✕</Text>
    </TouchableOpacity>
  );
}

function EmptyState({ isHe, hasFilters, onReset }: any) {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyEmoji}>🍽</Text>
      <Text style={s.emptyTitle}>{isHe ? 'לא נמצאו מתכונים' : 'No recipes found'}</Text>
      {hasFilters && (
        <TouchableOpacity onPress={onReset} style={s.emptyBtn}>
          <Text style={s.emptyBtnText}>{isHe ? 'נקה פילטרים' : 'Clear filters'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#FFFDF7' },
  searchRow:          { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 6 },
  searchBox:          { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F0', borderRadius: 20, paddingHorizontal: 12, height: 38, borderWidth: 0.5, borderColor: '#E0E0DC' },
  searchIcon:         { fontSize: 14, marginRight: 6 },
  searchInput:        { flex: 1, fontSize: 13, color: '#222' },
  clearBtn:           { fontSize: 12, color: '#999', paddingLeft: 6 },
  filterBtn:          { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F5F5F0', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#E0E0DC' },
  filterBtnActive:    { backgroundColor: '#FF6B6B22', borderColor: '#FF6B6B88' },
  filterIcon:         { fontSize: 16 },
  filterBadge:        { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF6B6B', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText:    { color: '#fff', fontSize: 9, fontWeight: '600' },
  sortRow:            { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  sortChip:           { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#F0F0EB', borderWidth: 0.5, borderColor: '#E0E0DC' },
  sortChipActive:     { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  sortChipText:       { fontSize: 11, color: '#666', fontWeight: '500' },
  sortChipTextActive: { color: '#fff' },
  activeFiltersRow:   { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 6, flexWrap: 'wrap', alignItems: 'center' },
  activeChip:         { backgroundColor: '#FF6B6B22', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: '#FF6B6B55' },
  activeChipText:     { fontSize: 11, color: '#c94040', fontWeight: '500' },
  clearAll:           { fontSize: 11, color: '#FF6B6B', textDecorationLine: 'underline' },
  resultCount:        { fontSize: 11, color: '#999', paddingHorizontal: 14, paddingBottom: 4 },
  emptyState:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyEmoji:         { fontSize: 40 },
  emptyTitle:         { fontSize: 15, color: '#999', fontWeight: '500' },
  emptyBtn:           { marginTop: 8, backgroundColor: '#FF6B6B', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 9 },
  emptyBtnText:       { color: '#fff', fontWeight: '500', fontSize: 13 },
});
