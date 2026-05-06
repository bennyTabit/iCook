import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors } from '../constants/colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { isHebrew } from '../lib/i18n';
import { useCollectionStore } from '../store/collectionStore';
import RecipePickerModal from '../components/RecipePickerModal';
import type { Recipe } from '../lib/db';
import type { RecipeSummary } from '../lib/search';

// ── Recipe Row ────────────────────────────────────────────────────────────────

function RecipeRow({
  recipe,
  isHe,
  onPress,
}: {
  recipe: Recipe;
  isHe: boolean;
  onPress: () => void;
}) {
  const C = useThemeColors();
  const title = isHe ? recipe.title_he : (recipe.title_en ?? recipe.title_he);
  return (
    <TouchableOpacity
      style={[r.card, { backgroundColor: C.surfaceElevated }]}
      onPress={() => { void Haptics.selectionAsync(); onPress(); }}
      activeOpacity={0.8}
    >
      {recipe.image_uri ? (
        <Image source={{ uri: recipe.image_uri }} style={r.thumb} />
      ) : (
        <View style={[r.iconWrap, { backgroundColor: C.surface }]}>
          <Text style={{ fontSize: 26 }}>🍽️</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[r.title, { textAlign: isHe ? 'right' : 'left', color: C.text.primary }]} numberOfLines={2}>
          {title}
        </Text>
        {recipe.cook_time_min != null && (
          <View style={[r.chipRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
            <Ionicons name="timer-outline" size={12} color={C.text.tertiary} />
            <Text style={[r.chipText, { color: C.text.tertiary }]}>
              {recipe.cook_time_min} {isHe ? "דק׳" : 'min'}
            </Text>
          </View>
        )}
      </View>
      <Ionicons
        name={isHe ? 'chevron-back-outline' : 'chevron-forward-outline'}
        size={16}
        color={C.text.tertiary}
      />
    </TouchableOpacity>
  );
}

const r = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  thumb: { width: 52, height: 52, borderRadius: 12 },
  iconWrap: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  chipRow: { alignItems: 'center', gap: 4, marginTop: 4 },
  chipText: { fontSize: 12 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CollectionDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const C = useThemeColors();
  const isHe = isHebrew();
  const { id, name } = route.params as { id: number; name: string };
  const { addRecipe, getRecipes } = useCollectionStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  async function refresh() {
    const list = await getRecipes(id);
    setRecipes(list);
  }

  useEffect(() => { void refresh(); }, [id]);

  const addedIds = useMemo(() => new Set(recipes.map((r) => r.id).filter((id): id is number => id != null)), [recipes]);

  async function handleAdd(recipe: RecipeSummary) {
    await addRecipe(id, recipe.id);
    await refresh();
    // keep picker open so user can keep adding
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[s.header, { flexDirection: isHe ? 'row-reverse' : 'row', borderBottomColor: C.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isHe ? 'חזור' : 'Back'}
        >
          <Ionicons name={isHe ? 'chevron-forward' : 'chevron-back'} size={26} color={C.text.primary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: C.text.primary, flex: 1, textAlign: isHe ? 'right' : 'left' }]} numberOfLines={1}>
          {name}
        </Text>
        <TouchableOpacity
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPickerVisible(true); }}
          style={[s.addBtn, { backgroundColor: Colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={isHe ? 'הוסף מתכון' : 'Add recipe'}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {recipes.length === 0 ? (
        /* ── Empty state ── */
        <View style={s.empty}>
          <View style={[s.emptyIllustration, { backgroundColor: Colors.primary + '15' }]}>
            <Text style={{ fontSize: 52 }}>📂</Text>
          </View>
          <Text style={[s.emptyTitle, { color: C.text.primary }]}>
            {isHe ? 'האוסף ריק' : 'This collection is empty'}
          </Text>
          <Text style={[s.emptySub, { color: C.text.secondary }]}>
            {isHe
              ? 'הוסף מתכונים לאוסף זה ותמצא אותם כאן במהירות'
              : 'Add recipes here to find them quickly in one place'}
          </Text>
          <TouchableOpacity
            style={[s.emptyAddBtn, { backgroundColor: Colors.primary }]}
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPickerVisible(true); }}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={s.emptyAddBtnText}>
              {isHe ? 'הוסף מתכון ראשון' : 'Add your first recipe'}
            </Text>
          </TouchableOpacity>
          <Text style={[s.emptyHint, { color: C.text.tertiary }]}>
            {isHe ? 'ניתן גם להוסיף מתוך דף המתכון' : 'You can also add from any recipe page'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <RecipeRow
              recipe={item}
              isHe={isHe}
              onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
            />
          )}
        />
      )}

      <RecipePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(recipe) => { void handleAdd(recipe); }}
        alreadyAdded={addedIds}
        title={isHe ? `הוסף ל${name}` : `Add to ${name}`}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 12 },
  emptyIllustration: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  emptyAddBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyHint: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
