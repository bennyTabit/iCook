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
  editMode,
  onPress,
  onRemove,
}: {
  recipe: Recipe;
  isHe: boolean;
  editMode: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  const C = useThemeColors();
  const title = isHe ? recipe.title_he : (recipe.title_en ?? recipe.title_he);

  return (
    <View style={[r.card, { backgroundColor: C.surfaceElevated, flexDirection: isHe ? 'row-reverse' : 'row' }]}>
      {/* ── Remove button (edit mode only) ── */}
      {editMode && (
        <TouchableOpacity
          style={r.removeBtn}
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRemove(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isHe ? 'הסר מתכון' : 'Remove recipe'}
        >
          <Ionicons name="remove-circle" size={22} color={Colors.error} />
        </TouchableOpacity>
      )}

      {/* ── Thumbnail ── */}
      {recipe.image_uri ? (
        <Image source={{ uri: recipe.image_uri }} style={r.thumb} />
      ) : (
        <View style={[r.iconWrap, { backgroundColor: C.surface }]}>
          <Text style={{ fontSize: 26 }}>🍽️</Text>
        </View>
      )}

      {/* ── Text ── */}
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => { void Haptics.selectionAsync(); onPress(); }}
        activeOpacity={0.8}
        disabled={editMode}
      >
        <Text
          style={[r.title, { textAlign: isHe ? 'right' : 'left', color: C.text.primary }]}
          numberOfLines={2}
        >
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
      </TouchableOpacity>

      {/* ── Trailing chevron (normal mode only) ── */}
      {!editMode && (
        <Ionicons
          name={isHe ? 'chevron-back-outline' : 'chevron-forward-outline'}
          size={16}
          color={C.text.tertiary}
        />
      )}
    </View>
  );
}

const r = StyleSheet.create({
  card: {
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
  removeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
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
  const { addRecipe, removeRecipe, getRecipes } = useCollectionStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);

  async function refresh() {
    const list = await getRecipes(id);
    setRecipes(list);
  }

  useEffect(() => { void refresh(); }, [id]);

  const addedIds = useMemo(
    () => new Set(recipes.map((r) => r.id).filter((id): id is number => id != null)),
    [recipes],
  );

  async function handleAdd(recipe: RecipeSummary) {
    await addRecipe(id, recipe.id);
    await refresh();
  }

  async function handleRemove(recipeId: number) {
    await removeRecipe(id, recipeId);
    const updated = await getRecipes(id);
    setRecipes(updated);
    // auto-exit edit mode when the list is emptied
    if (updated.length === 0) setEditMode(false);
  }

  function toggleEditMode() {
    void Haptics.selectionAsync();
    setEditMode((prev) => !prev);
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.background }]} edges={['top', 'left', 'right']}>
      {/* ── Header ── */}
      <View style={[s.header, { flexDirection: isHe ? 'row-reverse' : 'row', borderBottomColor: C.border }]}>
        {/* Back */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isHe ? 'חזור' : 'Back'}
        >
          <Ionicons name={isHe ? 'chevron-forward' : 'chevron-back'} size={26} color={C.text.primary} />
        </TouchableOpacity>

        {/* Title */}
        <Text
          style={[s.headerTitle, { color: C.text.primary, flex: 1, textAlign: isHe ? 'right' : 'left' }]}
          numberOfLines={1}
        >
          {name}
        </Text>

        {/* Edit / Done toggle (only when there are recipes) */}
        {recipes.length > 0 && (
          <TouchableOpacity
            onPress={toggleEditMode}
            style={[
              s.iconBtn,
              { backgroundColor: editMode ? Colors.secondary : '#8E8E93' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={editMode ? (isHe ? 'סיום' : 'Done') : (isHe ? 'עריכה' : 'Edit')}
          >
            <Ionicons
              name={editMode ? 'checkmark' : 'pencil'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        )}

        {/* Add recipe button (hidden in edit mode) */}
        {!editMode && (
          <TouchableOpacity
            onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setPickerVisible(true); }}
            style={[s.addBtn, { backgroundColor: Colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel={isHe ? 'הוסף מתכון' : 'Add recipe'}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Edit mode hint bar ── */}
      {editMode && (
        <View style={[s.editHint, { backgroundColor: Colors.error + '10', borderBottomColor: Colors.error + '25' }]}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.error} />
          <Text style={[s.editHintText, { color: Colors.error }]}>
            {isHe ? 'הקש על ○ האדום להסרת מתכון מהאוסף' : 'Tap the red ○ to remove a recipe from this collection'}
          </Text>
        </View>
      )}

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
              editMode={editMode}
              onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
              onRemove={() => { void handleRemove(item.id!); }}
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Edit hint banner
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  editHintText: { fontSize: 12, fontWeight: '500', flex: 1 },
  // Empty state
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
