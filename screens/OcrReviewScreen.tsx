import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { insertRecipe } from '../lib/db';
import { isHebrew } from '../lib/i18n';
import type { OcrResult } from '../lib/ocr';

type Props = {
  route: { params: { ocr: OcrResult } };
  navigation: any;
};

export default function OcrReviewScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { ocr } = route.params;

  const [title,       setTitle]       = useState(ocr.title);
  const [ingredients, setIngredients] = useState(ocr.ingredients.join('\n'));
  const [steps,       setSteps]       = useState(ocr.steps.join('\n'));

  const confidenceColor =
    ocr.confidence === 'high'   ? '#4ECDC4' :
    ocr.confidence === 'medium' ? '#FFE66D' : '#FF6B6B';

  async function handleSave() {
    if (!title.trim()) { Alert.alert(t('error'), t('titleRequired')); return; }
    const id = await insertRecipe({
      title_he: isHe ? title : '',
      title_en: !isHe ? title : '',
      source_type: 'ocr',
    });
    navigation.replace('RecipeDetail', { id });
  }

  return (
    <ScrollView style={s.container}>
      <View style={[s.badge, { backgroundColor: confidenceColor + '22', borderColor: confidenceColor }]}>
        <Text style={[s.badgeText, { color: confidenceColor }]}>
          {ocr.confidence === 'high'
            ? (isHe ? 'זיהוי טוב' : 'Good recognition')
            : ocr.confidence === 'medium'
            ? (isHe ? 'זיהוי בינוני' : 'Partial recognition')
            : (isHe ? 'זיהוי חלש — נא לתקן' : 'Weak recognition — please correct')}
        </Text>
      </View>

      <Text style={s.label}>{isHe ? 'כותרת' : 'Title'}</Text>
      <TextInput
        style={s.input}
        value={title}
        onChangeText={setTitle}
        textAlign={isHe ? 'right' : 'left'}
      />

      <Text style={s.label}>{isHe ? 'מרכיבים (שורה לכל מרכיב)' : 'Ingredients (one per line)'}</Text>
      <TextInput
        style={[s.input, s.multiline]}
        multiline
        value={ingredients}
        onChangeText={setIngredients}
        textAlign={isHe ? 'right' : 'left'}
        textAlignVertical="top"
        writingDirection={isHe ? 'rtl' : 'ltr'}
      />

      <Text style={s.label}>{isHe ? 'שלבים (שורה לכל שלב)' : 'Steps (one per line)'}</Text>
      <TextInput
        style={[s.input, s.multiline]}
        multiline
        value={steps}
        onChangeText={setSteps}
        textAlign={isHe ? 'right' : 'left'}
        textAlignVertical="top"
        writingDirection={isHe ? 'rtl' : 'ltr'}
      />

      <View style={s.row}>
        <TouchableOpacity style={s.btnPrimary} onPress={handleSave}>
          <Text style={s.btnPrimaryText}>{isHe ? 'שמור מתכון' : 'Save recipe'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={() => navigation.goBack()}>
          <Text style={s.btnSecondaryText}>{isHe ? 'ביטול' : 'Cancel'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, padding: 16, backgroundColor: '#FFFDF7' },
  badge:          { borderRadius: 8, borderWidth: 0.5, padding: 8, marginBottom: 16, alignSelf: 'flex-start' },
  badgeText:      { fontSize: 12, fontWeight: '500' },
  label:          { fontSize: 12, color: '#888', marginBottom: 4, marginTop: 12 },
  input:          { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  multiline:      { minHeight: 100 },
  row:            { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 40 },
  btnPrimary:     { flex: 1, backgroundColor: '#FF6B6B', borderRadius: 10, padding: 13, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '500', fontSize: 14 },
  btnSecondary:   { flex: 1, borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 13, alignItems: 'center' },
  btnSecondaryText: { fontSize: 14 },
});
