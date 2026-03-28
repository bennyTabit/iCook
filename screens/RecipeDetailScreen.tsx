import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';
import { isHebrew } from '../lib/i18n';
import { getRecipeById } from '../lib/db';
import { useRecipeStore } from '../store/recipeStore';
import { useShoppingStore } from '../store/shoppingStore';
import { shareRecipe } from '../lib/sharing';
import IngredientRow from '../components/IngredientRow';
import StepRow from '../components/StepRow';
import Toast from '../components/Toast';
import type { Recipe } from '../lib/db';

export default function RecipeDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { toggleFav, removeRecipe } = useRecipeStore();
  const { addFromRecipe } = useShoppingStore();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    getRecipeById(id).then(setRecipe);
  }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  function handleDelete() {
    Alert.alert(
      isHe ? 'מחיקת מתכון' : 'Delete recipe',
      isHe ? 'האם למחוק את המתכון?' : 'Delete this recipe?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive', onPress: async () => {
            await removeRecipe(id);
            navigation.goBack();
          }
        },
      ]
    );
  }

  if (!recipe) return <View style={s.container} />;

  const title = isHe ? recipe.title_he : (recipe.title_en ?? recipe.title_he);
  const isFav = recipe.is_favorite === 1;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: Colors.accent }]}>
          <Text style={{ fontSize: 56 }}>🍝</Text>
          <TouchableOpacity
            style={s.favBtn}
            onPress={() => {
              toggleFav(id, recipe.is_favorite ?? 0);
              showToast(isFav
                ? (isHe ? 'הוסר ממועדפים' : 'Removed from favorites')
                : (isHe ? 'נוסף למועדפים ❤️' : 'Added to favorites ❤️'));
            }}
          >
            <Text style={{ fontSize: 18 }}>{isFav ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.editBtn]}
            onPress={() => navigation.navigate('EditRecipe', { id })}
          >
            <Text style={{ fontSize: 16 }}>✏️</Text>
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          <Text style={[s.title, { textAlign: isHe ? 'right' : 'left' }]}>{title}</Text>

          {/* Meta pills */}
          <View style={[s.pillsRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
            {recipe.cook_time_min != null && (
              <View style={s.pill}><Text style={s.pillText}>⏱ {recipe.cook_time_min} {t('minutes')}</Text></View>
            )}
            {recipe.servings != null && (
              <View style={s.pill}><Text style={s.pillText}>🍽 {recipe.servings} {t('servings')}</Text></View>
            )}
            {recipe.difficulty && (
              <View style={[s.pill, s.pillRed]}><Text style={[s.pillText, { color: '#993C1D' }]}>{t(recipe.difficulty as any)}</Text></View>
            )}
          </View>

          {/* Source badge */}
          {recipe.source_url && (
            <View style={[s.sourceBadge, { alignSelf: isHe ? 'flex-end' : 'flex-start' }]}>
              <Text style={s.sourceText}>🔗 {recipe.source_name ?? recipe.source_url}</Text>
            </View>
          )}

          {/* Ingredients */}
          <Text style={[s.sectionTitle, { textAlign: isHe ? 'right' : 'left' }]}>{t('ingredients')}</Text>
          {['ספגטי 400 גרם', 'בשר טחון 300 גרם', 'רסק עגבניות 2 כוסות', 'בצל גדול', 'שום 3 שיניים'].map((ing, i) => (
            <IngredientRow key={i} text={ing} isHe={isHe} />
          ))}

          {/* Steps */}
          <Text style={[s.sectionTitle, { textAlign: isHe ? 'right' : 'left' }]}>{t('steps')}</Text>
          {['בשל פסטה במים מומלחים.', 'טגן בצל ושום, הוסף בשר.', 'הוסף רסק, בשל 20 דקות.'].map((step, i) => (
            <StepRow key={i} index={i} text={step} isHe={isHe} />
          ))}

          {/* Notes */}
          {recipe.notes_he && (
            <>
              <Text style={[s.sectionTitle, { textAlign: isHe ? 'right' : 'left' }]}>{t('notes')}</Text>
              <Text style={[s.notes, { textAlign: isHe ? 'right' : 'left' }]}>
                {isHe ? recipe.notes_he : recipe.notes_en}
              </Text>
            </>
          )}

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => {
                addFromRecipe(recipe);
                showToast(isHe ? 'נוסף לרשימת קניות 🛒' : 'Added to shopping list 🛒');
              }}
            >
              <Text style={s.btnPrimaryText}>{t('addToShop')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnSecondary} onPress={() => shareRecipe(recipe)}>
              <Text style={s.btnSecondaryText}>{t('share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnDanger} onPress={handleDelete}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <Toast message={toast} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  hero:             { height: 180, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  favBtn:           { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  editBtn:          { position: 'absolute', top: 12, left: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  body:             { padding: 16 },
  title:            { fontSize: 20, fontWeight: '500', color: Colors.text.primary, marginBottom: 10 },
  pillsRow:         { gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  pill:             { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.surface, borderWidth: 0.5, borderColor: Colors.border },
  pillRed:          { backgroundColor: '#FF6B6B22', borderColor: '#FF6B6B55' },
  pillText:         { fontSize: 11, color: Colors.text.secondary },
  sourceBadge:      { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 0.5, borderColor: Colors.border, marginBottom: 14 },
  sourceText:       { fontSize: 11, color: Colors.text.secondary },
  sectionTitle:     { fontSize: 11, fontWeight: '500', color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  notes:            { fontSize: 13, color: Colors.text.secondary, lineHeight: 20 },
  actions:          { flexDirection: 'row', gap: 8, marginTop: 20 },
  btnPrimary:       { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, padding: 13, alignItems: 'center' },
  btnPrimaryText:   { color: '#fff', fontWeight: '500', fontSize: 13 },
  btnSecondary:     { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 13, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  btnSecondaryText: { fontSize: 13, color: Colors.text.primary, fontWeight: '500' },
  btnDanger:        { width: 46, backgroundColor: Colors.surface, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: Colors.border },
});
