import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, StyleSheet,
} from 'react-native';
import { isHebrew } from '../lib/i18n';
import { importFromUrl } from '../lib/importer';
import { insertRecipe } from '../lib/db';
import type { ImportedRecipe } from '../lib/importer';

export default function ImportLinkScreen({ navigation }: any) {
  const [url,     setUrl]     = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<ImportedRecipe | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const isHe = isHebrew();

  async function handleFetch() {
    setLoading(true); setError(null); setResult(null);
    try {
      const imported = await importFromUrl(url.trim());
      setResult(imported);
    } catch (e: any) {
      setError(e.message ?? 'שגיאה לא ידועה / Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    const id = await insertRecipe({
      title_he:      isHe ? result.title : '',
      title_en:      !isHe ? result.title : '',
      source_type:   'url',
      source_url:    result.sourceUrl,
      source_name:   result.sourceName,
      image_uri:     result.imageUrl,
      prep_time_min: result.prepTime,
      cook_time_min: result.cookTime,
      servings:      result.servings,
    });
    navigation.replace('RecipeDetail', { id });
  }

  const methodBadge = result
    ? result.parseMethod === 'json-ld'
      ? { label: 'JSON-LD ✓', color: '#4ECDC4' }
      : result.parseMethod === 'scrape'
      ? { label: 'Scraping', color: '#FFE66D' }
      : { label: isHe ? 'חלקי' : 'Partial', color: '#FF6B6B' }
    : null;

  return (
    <ScrollView style={s.container}>
      <Text style={s.label}>
        {isHe ? 'הדבק כתובת של אתר מתכונים' : 'Paste a recipe website URL'}
      </Text>
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://..."
          autoCapitalize="none"
          keyboardType="url"
        />
        <TouchableOpacity onPress={handleFetch} style={s.fetchBtn}>
          <Text style={s.fetchBtnText}>{isHe ? 'שלוף' : 'Fetch'}</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color="#FF6B6B" style={{ marginTop: 20 }} />}
      {error && <Text style={s.errorText}>{error}</Text>}

      {result && (
        <View style={s.preview}>
          <View style={s.badgeRow}>
            <View style={[s.methodBadge, { backgroundColor: methodBadge!.color + '22', borderColor: methodBadge!.color }]}>
              <Text style={[s.methodBadgeText, { color: methodBadge!.color }]}>{methodBadge!.label}</Text>
            </View>
            <Text style={s.sourceName}>{result.sourceName}</Text>
          </View>

          <Text style={s.recipeTitle}>{result.title}</Text>
          <Text style={s.sectionLabel}>
            {isHe ? 'מרכיבים' : 'Ingredients'} ({result.ingredients.length})
          </Text>
          {result.ingredients.slice(0, 4).map((ing, i) => (
            <Text key={i} style={s.ingItem}>• {ing}</Text>
          ))}
          {result.ingredients.length > 4 && (
            <Text style={s.moreText}>+{result.ingredients.length - 4} {isHe ? 'עוד' : 'more'}</Text>
          )}

          <View style={s.actionRow}>
            <TouchableOpacity style={s.btnPrimary} onPress={handleSave}>
              <Text style={s.btnPrimaryText}>{isHe ? 'שמור' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnSecondary}
              onPress={() => navigation.navigate('OcrReview', {
                ocr: { title: result.title, ingredients: result.ingredients, steps: result.steps, rawText: '', confidence: 'medium' }
              })}
            >
              <Text style={s.btnSecondaryText}>{isHe ? 'ערוך לפני שמירה' : 'Edit before saving'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, padding: 16, backgroundColor: '#FFFDF7' },
  label:           { fontSize: 12, color: '#888', marginBottom: 6 },
  inputRow:        { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input:           { flex: 1, borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 12 },
  fetchBtn:        { backgroundColor: '#FF6B6B', borderRadius: 10, padding: 10, justifyContent: 'center' },
  fetchBtnText:    { color: '#fff', fontWeight: '500', fontSize: 12 },
  errorText:       { color: '#FF6B6B', fontSize: 12 },
  preview:         { marginTop: 8 },
  badgeRow:        { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  methodBadge:     { borderRadius: 6, borderWidth: 0.5, padding: 4 },
  methodBadgeText: { fontSize: 10 },
  sourceName:      { fontSize: 11, color: '#888' },
  recipeTitle:     { fontSize: 16, fontWeight: '500', marginBottom: 8 },
  sectionLabel:    { fontSize: 11, color: '#888', marginBottom: 4 },
  ingItem:         { fontSize: 12, color: '#333', marginBottom: 3 },
  moreText:        { fontSize: 11, color: '#888' },
  actionRow:       { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnPrimary:      { flex: 1, backgroundColor: '#FF6B6B', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnPrimaryText:  { color: '#fff', fontWeight: '500' },
  btnSecondary:    { flex: 1, borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnSecondaryText:{ fontWeight: '500', fontSize: 12 },
});
