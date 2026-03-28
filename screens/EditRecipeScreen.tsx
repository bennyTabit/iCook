import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';
import { isHebrew } from '../lib/i18n';
import { getRecipeById, insertRecipe, updateRecipe } from '../lib/db';
import { useRecipeStore } from '../store/recipeStore';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const TAGS = ['tagVegan', 'tagVegetarian', 'tagGlutenFree', 'tagDairyFree', 'tagDairy', 'tagMeat', 'tagParve', 'tagQuick'];

export default function EditRecipeScreen({ route, navigation }: any) {
  const { id } = route.params; // null = new recipe
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { loadRecipes } = useRecipeStore();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [prepTime,    setPrepTime]    = useState('');
  const [cookTime,    setCookTime]    = useState('');
  const [servings,    setServings]    = useState('');
  const [difficulty,  setDifficulty]  = useState<string | null>(null);
  const [ingredients, setIngredients] = useState('');
  const [steps,       setSteps]       = useState('');
  const [notes,       setNotes]       = useState('');
  const [selTags,     setSelTags]     = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      getRecipeById(id).then(r => {
        if (!r) return;
        setTitle(isHe ? r.title_he : (r.title_en ?? r.title_he));
        setDescription(isHe ? r.description_he ?? '' : r.description_en ?? '');
        setPrepTime(String(r.prep_time_min ?? ''));
        setCookTime(String(r.cook_time_min ?? ''));
        setServings(String(r.servings ?? ''));
        setDifficulty(r.difficulty ?? null);
        setNotes(isHe ? r.notes_he ?? '' : r.notes_en ?? '');
      });
    }
  }, [id]);

  function toggleTag(tag: string) {
    setSelTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  async function handleSave() {
    if (!title.trim()) { Alert.alert(t('error'), t('titleRequired')); return; }
    const data = {
      title_he:       isHe ? title : '',
      title_en:       !isHe ? title : '',
      description_he: isHe ? description : '',
      description_en: !isHe ? description : '',
      prep_time_min:  prepTime ? parseInt(prepTime) : undefined,
      cook_time_min:  cookTime ? parseInt(cookTime) : undefined,
      servings:       servings ? parseInt(servings) : undefined,
      difficulty:     difficulty as any,
      notes_he:       isHe ? notes : '',
      notes_en:       !isHe ? notes : '',
      source_type:    'manual' as const,
    };
    if (id) {
      await updateRecipe(id, data);
    } else {
      await insertRecipe(data);
    }
    await loadRecipes();
    navigation.goBack();
  }

  const align = isHe ? 'right' : 'left';
  const inp = [s.input, { textAlign: align }] as any;

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <Field label={isHe ? 'כותרת *' : 'Title *'} isHe={isHe}>
          <TextInput style={inp} value={title} onChangeText={setTitle}
            placeholder={isHe ? 'שם המתכון...' : 'Recipe name...'} placeholderTextColor={Colors.text.tertiary} />
        </Field>

        <Field label={isHe ? 'תיאור קצר' : 'Short description'} isHe={isHe}>
          <TextInput style={[inp, s.multiline]} multiline value={description} onChangeText={setDescription}
            textAlignVertical="top" placeholder={isHe ? 'תיאור...' : 'Description...'} placeholderTextColor={Colors.text.tertiary} />
        </Field>

        <View style={s.row}>
          <Field label={isHe ? 'הכנה (דקות)' : 'Prep (min)'} isHe={isHe} style={{ flex: 1 }}>
            <TextInput style={inp} value={prepTime} onChangeText={setPrepTime} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.text.tertiary} />
          </Field>
          <Field label={isHe ? 'בישול (דקות)' : 'Cook (min)'} isHe={isHe} style={{ flex: 1 }}>
            <TextInput style={inp} value={cookTime} onChangeText={setCookTime} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.text.tertiary} />
          </Field>
          <Field label={isHe ? 'מנות' : 'Servings'} isHe={isHe} style={{ flex: 1 }}>
            <TextInput style={inp} value={servings} onChangeText={setServings} keyboardType="number-pad" placeholder="4" placeholderTextColor={Colors.text.tertiary} />
          </Field>
        </View>

        <Field label={isHe ? 'רמת קושי' : 'Difficulty'} isHe={isHe}>
          <View style={s.chipRow}>
            {DIFFICULTIES.map(d => (
              <TouchableOpacity key={d} style={[s.chip, difficulty === d && s.chipActive]} onPress={() => setDifficulty(difficulty === d ? null : d)}>
                <Text style={[s.chipText, difficulty === d && s.chipTextActive]}>{t(d as any)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label={isHe ? 'מרכיבים (שורה לכל מרכיב)' : 'Ingredients (one per line)'} isHe={isHe}>
          <TextInput style={[inp, s.multiline, { minHeight: 110 }]} multiline value={ingredients} onChangeText={setIngredients}
            textAlignVertical="top"
            placeholder={isHe ? '- ספגטי 400 גרם\n- בשר טחון 300 גרם' : '- Spaghetti 400g\n- Ground beef 300g'}
            placeholderTextColor={Colors.text.tertiary} />
        </Field>

        <Field label={isHe ? 'שלבי הכנה (שורה לכל שלב)' : 'Steps (one per line)'} isHe={isHe}>
          <TextInput style={[inp, s.multiline, { minHeight: 110 }]} multiline value={steps} onChangeText={setSteps}
            textAlignVertical="top"
            placeholder={isHe ? 'בשל פסטה במים מומלחים.' : 'Boil pasta in salted water.'}
            placeholderTextColor={Colors.text.tertiary} />
        </Field>

        <Field label={isHe ? 'תגיות תזונה' : 'Dietary tags'} isHe={isHe}>
          <View style={s.chipRow}>
            {TAGS.map(tag => (
              <TouchableOpacity key={tag}
                style={[s.chip, s.chipTeal, selTags.includes(tag) && s.chipTealActive]}
                onPress={() => toggleTag(tag)}>
                <Text style={[s.chipText, selTags.includes(tag) && { color: '#fff' }]}>{t(tag as any)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label={isHe ? 'הערות' : 'Notes'} isHe={isHe}>
          <TextInput style={[inp, s.multiline]} multiline value={notes} onChangeText={setNotes}
            textAlignVertical="top"
            placeholder={isHe ? 'טיפים, וריאציות...' : 'Tips, variations...'}
            placeholderTextColor={Colors.text.tertiary} />
        </Field>

        <View style={s.actionRow}>
          <TouchableOpacity style={s.btnPrimary} onPress={handleSave}>
            <Text style={s.btnPrimaryText}>{t('save')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSecondary} onPress={() => navigation.goBack()}>
            <Text style={s.btnSecText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, isHe, children, style }: any) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={[s.fieldLabel, { textAlign: isHe ? 'right' : 'left' }]}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.background },
  scroll:         { padding: 16, paddingBottom: 40 },
  row:            { flexDirection: 'row', gap: 10 },
  fieldLabel:     { fontSize: 11, color: Colors.text.secondary, fontWeight: '500', marginBottom: 5 },
  input:          { backgroundColor: Colors.surface, borderWidth: 0.5, borderColor: Colors.border, borderRadius: 10, padding: 10, fontSize: 13, color: Colors.text.primary },
  multiline:      { minHeight: 80 },
  chipRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 0.5, borderColor: Colors.border },
  chipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTeal:       { backgroundColor: Colors.surface, borderColor: Colors.border },
  chipTealActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipText:       { fontSize: 12, color: Colors.text.secondary, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  actionRow:      { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary:     { flex: 1, backgroundColor: Colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '500', fontSize: 14 },
  btnSecondary:   { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  btnSecText:     { fontSize: 14, color: Colors.text.primary, fontWeight: '500' },
});
