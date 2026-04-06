import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';
import { isHebrew } from '../lib/i18n';
import { useCollectionStore } from '../store/collectionStore';
import type { Recipe } from '../lib/db';

function RecipeRow({
  recipe,
  isHe,
  onPress,
}: {
  recipe: Recipe;
  isHe: boolean;
  onPress: () => void;
}) {
  const title = isHe ? recipe.title_he : (recipe.title_en ?? recipe.title_he);
  return (
    <TouchableOpacity
      style={r.card}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.8}
    >
      <View style={r.iconWrap}>
        <Text style={{ fontSize: 26 }}>🍽️</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[r.title, { textAlign: isHe ? 'right' : 'left' }]} numberOfLines={2}>
          {title}
        </Text>
        {recipe.cook_time_min != null && (
          <View style={[r.chipRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
            <Ionicons name="timer-outline" size={12} color={Colors.text.tertiary} />
            <Text style={r.chipText}>
              {recipe.cook_time_min} {isHe ? "דק׳" : 'min'}
            </Text>
          </View>
        )}
      </View>
      <Ionicons
        name={isHe ? 'chevron-back-outline' : 'chevron-forward-outline'}
        size={16}
        color={Colors.text.tertiary}
      />
    </TouchableOpacity>
  );
}

const r = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    lineHeight: 20,
  },
  chipRow: {
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  chipText: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
});

export default function CollectionDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { id } = route.params as { id: number; name: string };
  const { getRecipes } = useCollectionStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    getRecipes(id).then(setRecipes).catch(console.warn);
  }, [id]);

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      {recipes.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>🍽️</Text>
          <Text style={s.emptyText}>
            {isHe ? 'אין מתכונים באוסף זה' : 'No recipes in this collection'}
          </Text>
          <Text style={s.emptySub}>
            {isHe ? 'הוסף מתכונים מדף המתכון' : 'Add recipes from the recipe page'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
          renderItem={({ item }) => (
            <RecipeRow
              recipe={item}
              isHe={isHe}
              onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, textAlign: 'center', marginBottom: 6 },
  emptySub: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center' },
});
