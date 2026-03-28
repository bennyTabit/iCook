import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const COOK_TIMES   = [15, 30, 60];
const DIETARY_TAGS = [
  { id: 1, he: 'טבעוני',    en: 'Vegan' },
  { id: 2, he: 'צמחוני',    en: 'Vegetarian' },
  { id: 3, he: 'ללא גלוטן', en: 'Gluten-free' },
  { id: 4, he: 'ללא לקטוז', en: 'Dairy-free' },
  { id: 5, he: 'חלבי',      en: 'Dairy' },
  { id: 6, he: 'בשרי',      en: 'Meat' },
  { id: 7, he: 'פרווה',     en: 'Parve' },
  { id: 8, he: 'מהיר',      en: 'Quick' },
];
const SOURCES = [
  { key: 'manual',    he: 'ידני',   en: 'Manual' },
  { key: 'ocr',       he: 'סרוק',   en: 'Scanned' },
  { key: 'url',       he: 'לינק',   en: 'Link' },
  { key: 'instagram', he: 'אינסטה', en: 'Instagram' },
];

export default function FilterSheet({ filters, onUpdate, onClose, onReset, isHe }: any) {
  const F = (he: string, en: string) => isHe ? he : en;

  function toggleTag(id: number) {
    const tags = filters.tagIds.includes(id)
      ? filters.tagIds.filter((t: number) => t !== id)
      : [...filters.tagIds, id];
    onUpdate('tagIds', tags);
  }

  function chip(active: boolean, label: string, onPress: () => void, color = '#FF6B6B') {
    return (
      <TouchableOpacity
        key={label}
        onPress={onPress}
        style={[fs.chip, active && { backgroundColor: color + '22', borderColor: color + '88' }]}
      >
        <Text style={[fs.chipTxt, active && { color }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={fs.overlay}>
      <View style={fs.sheet}>
        <View style={fs.handle} />
        <View style={fs.header}>
          <Text style={fs.headerTitle}>{F('סינון', 'Filter')}</Text>
          <TouchableOpacity onPress={onReset}><Text style={fs.resetBtn}>{F('איפוס', 'Reset')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={onClose}><Text style={fs.closeBtn}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>

          {/* Favorites toggle */}
          <TouchableOpacity
            onPress={() => onUpdate('favoritesOnly', !filters.favoritesOnly)}
            style={[fs.toggleRow, filters.favoritesOnly && fs.toggleRowActive]}
          >
            <Text style={fs.toggleLabel}>❤️ {F('מועדפים בלבד', 'Favorites only')}</Text>
            <View style={[fs.toggle, filters.favoritesOnly && fs.toggleOn]}>
              <View style={[fs.toggleThumb, filters.favoritesOnly && fs.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

          {/* Difficulty */}
          <View>
            <Text style={fs.sectionTitle}>{F('רמת קושי', 'Difficulty')}</Text>
            <View style={fs.chipRow}>
              {DIFFICULTIES.map(d => chip(
                filters.difficulty === d,
                F(d === 'easy' ? 'קל' : d === 'medium' ? 'בינוני' : 'קשה', d.charAt(0).toUpperCase() + d.slice(1)),
                () => onUpdate('difficulty', filters.difficulty === d ? null : d)
              ))}
            </View>
          </View>

          {/* Cook time */}
          <View>
            <Text style={fs.sectionTitle}>{F('זמן בישול', 'Cook time')}</Text>
            <View style={fs.chipRow}>
              {COOK_TIMES.map(t => chip(
                filters.maxCookTime === t,
                `≤${t} ${F('דקות', 'min')}`,
                () => onUpdate('maxCookTime', filters.maxCookTime === t ? null : t),
                '#4ECDC4'
              ))}
            </View>
          </View>

          {/* Dietary tags */}
          <View>
            <Text style={fs.sectionTitle}>{F('תגיות תזונה', 'Dietary tags')}</Text>
            <View style={fs.chipRow}>
              {DIETARY_TAGS.map(tag => chip(
                filters.tagIds.includes(tag.id),
                F(tag.he, tag.en),
                () => toggleTag(tag.id),
                '#4ECDC4'
              ))}
            </View>
          </View>

          {/* Source */}
          <View>
            <Text style={fs.sectionTitle}>{F('מקור', 'Source')}</Text>
            <View style={fs.chipRow}>
              {SOURCES.map(src => chip(
                filters.sourceType === src.key,
                F(src.he, src.en),
                () => onUpdate('sourceType', filters.sourceType === src.key ? null : src.key),
                '#888'
              ))}
            </View>
          </View>

        </ScrollView>
        <TouchableOpacity style={fs.applyBtn} onPress={onClose}>
          <Text style={fs.applyBtnText}>{F('הצג תוצאות', 'Show results')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const fs = StyleSheet.create({
  overlay:         { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: '#FFFDF7', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', flexDirection: 'column' },
  handle:          { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header:          { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderColor: '#eee' },
  headerTitle:     { flex: 1, fontSize: 15, fontWeight: '500' },
  resetBtn:        { fontSize: 13, color: '#FF6B6B', marginRight: 16 },
  closeBtn:        { fontSize: 16, color: '#999' },
  sectionTitle:    { fontSize: 12, color: '#888', fontWeight: '500', marginBottom: 8 },
  chipRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:            { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F0F0EB', borderWidth: 0.5, borderColor: '#E0E0DC' },
  chipTxt:         { fontSize: 12, color: '#666', fontWeight: '500' },
  toggleRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F0', borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: '#E0E0DC' },
  toggleRowActive: { backgroundColor: '#FF6B6B11', borderColor: '#FF6B6B55' },
  toggleLabel:     { flex: 1, fontSize: 13 },
  toggle:          { width: 40, height: 22, borderRadius: 11, backgroundColor: '#ddd', padding: 2 },
  toggleOn:        { backgroundColor: '#FF6B6B' },
  toggleThumb:     { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  toggleThumbOn:   { transform: [{ translateX: 18 }] },
  applyBtn:        { margin: 16, backgroundColor: '#FF6B6B', borderRadius: 14, padding: 14, alignItems: 'center' },
  applyBtnText:    { color: '#fff', fontWeight: '500', fontSize: 15 },
});
