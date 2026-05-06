import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { Spacing } from '../constants/spacing';
import { Typography } from '../constants/typography';
import { CATEGORY_EMOJI, FALLBACK_EMOJI } from '../constants/recipes';
import type { Category } from '../lib/db';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const COOK_TIMES = [15, 30, 60];
const CALORIES_PP = [200, 400, 600, 800];
const CALORIES_TOTAL = [500, 1000, 2000, 3000];
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

const DIFFICULTY_LABELS: Record<string, { he: string; en: string }> = {
  easy:   { he: 'קל',      en: 'Easy' },
  medium: { he: 'בינוני',  en: 'Medium' },
  hard:   { he: 'קשה',     en: 'Hard' },
};
const DIFFICULTY_COLOR: Record<string, string> = {
  easy:   Colors.difficulty.easy,
  medium: Colors.difficulty.medium,
  hard:   Colors.difficulty.hard,
};

export default function FilterSheet({ filters, onUpdate, onClose, onReset, isHe, allCategories = [] }: any) {
  const F = (he: string, en: string) => isHe ? he : en;
  const toggleAnim = useRef(new Animated.Value(filters.favoritesOnly ? 1 : 0)).current;
  const [calInput, setCalInput] = useState(filters.maxCalories ? String(filters.maxCalories) : '');

  function handleToggleFavorites() {
    const next = !filters.favoritesOnly;
    Animated.spring(toggleAnim, {
      toValue: next ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 120,
    }).start();
    void Haptics.selectionAsync();
    onUpdate('favoritesOnly', next);
  }

  function handleChipPress(cb: () => void) {
    void Haptics.selectionAsync();
    cb();
  }

  function toggleTag(id: number) {
    const tags = filters.tagIds.includes(id)
      ? filters.tagIds.filter((t: number) => t !== id)
      : [...filters.tagIds, id];
    onUpdate('tagIds', tags);
  }

  const thumbTranslate = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 20],
  });

  const toggleBg = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.disabled, Colors.primary],
  });

  function Chip({ active, label, onPress, color = Colors.primary }: {
    active: boolean; label: string; onPress: () => void; color?: string;
  }) {
    return (
      <TouchableOpacity
        onPress={() => handleChipPress(onPress)}
        style={[
          fs.chip,
          active && { backgroundColor: color + '22', borderColor: color + '99' },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[fs.chipTxt, active && { color, fontWeight: '700' }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={fs.overlay}>
      <TouchableOpacity style={fs.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={fs.sheet}>
        <View style={fs.handle} />
        <View style={fs.header}>
          <TouchableOpacity
            onPress={() => { void Haptics.selectionAsync(); onReset(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={fs.resetBtn}>{F('איפוס', 'Reset')}</Text>
          </TouchableOpacity>
          <Text style={fs.headerTitle}>{F('סינון', 'Filter')}</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={fs.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={fs.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Favorites toggle */}
          <TouchableOpacity
            onPress={handleToggleFavorites}
            style={[fs.toggleRow, filters.favoritesOnly && fs.toggleRowActive]}
            accessibilityRole="switch"
            accessibilityState={{ checked: filters.favoritesOnly }}
            accessibilityLabel={F('מועדפים בלבד', 'Favorites only')}
          >
            <Text style={fs.toggleLabel}>❤️ {F('מועדפים בלבד', 'Favorites only')}</Text>
            <Animated.View style={[fs.toggle, { backgroundColor: toggleBg }]}>
              <Animated.View style={[fs.toggleThumb, { transform: [{ translateX: thumbTranslate }] }]} />
            </Animated.View>
          </TouchableOpacity>

          {/* Category */}
          {allCategories.length > 0 && (
            <View style={fs.section}>
              <Text style={fs.sectionTitle}>{F('קטגוריה', 'Category')}</Text>
              <View style={fs.chipRow}>
                {allCategories.map((cat: Category) => {
                  const key = cat.name_en.toLowerCase();
                  const emoji = CATEGORY_EMOJI[key] ?? FALLBACK_EMOJI;
                  return (
                    <Chip
                      key={cat.id}
                      active={filters.categoryId === cat.id}
                      label={`${emoji} ${isHe ? cat.name_he : cat.name_en}`}
                      onPress={() => onUpdate('categoryId', filters.categoryId === cat.id ? null : cat.id)}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* Difficulty */}
          <View style={fs.section}>
            <Text style={fs.sectionTitle}>{F('רמת קושי', 'Difficulty')}</Text>
            <View style={fs.chipRow}>
              {DIFFICULTIES.map(d => (
                <Chip
                  key={d}
                  active={filters.difficulty === d}
                  label={F(DIFFICULTY_LABELS[d].he, DIFFICULTY_LABELS[d].en)}
                  onPress={() => onUpdate('difficulty', filters.difficulty === d ? null : d)}
                  color={DIFFICULTY_COLOR[d]}
                />
              ))}
            </View>
          </View>

          {/* Cook time */}
          <View style={fs.section}>
            <Text style={fs.sectionTitle}>{F('זמן בישול', 'Cook time')}</Text>
            <View style={fs.chipRow}>
              {COOK_TIMES.map(t => (
                <Chip
                  key={t}
                  active={filters.maxCookTime === t}
                  label={`≤${t} ${F('דקות', 'min')}`}
                  onPress={() => onUpdate('maxCookTime', filters.maxCookTime === t ? null : t)}
                  color={Colors.secondary}
                />
              ))}
            </View>
          </View>

          {/* Dietary tags */}
          <View style={fs.section}>
            <Text style={fs.sectionTitle}>{F('תגיות תזונה', 'Dietary tags')}</Text>
            <View style={fs.chipRow}>
              {DIETARY_TAGS.map(tag => (
                <Chip
                  key={tag.id}
                  active={filters.tagIds.includes(tag.id)}
                  label={F(tag.he, tag.en)}
                  onPress={() => toggleTag(tag.id)}
                  color={Colors.secondary}
                />
              ))}
            </View>
          </View>

          {/* Calories */}
          <View style={fs.section}>
            <Text style={fs.sectionTitle}>{F('קלוריות', 'Calories')}</Text>

            {/* Per person / Total toggle */}
            <View style={[fs.segRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
              {(['per_serving', 'total'] as const).map(mode => {
                const active = filters.caloriesMode === mode;
                const label = mode === 'per_serving'
                  ? F('למנה אחת', 'Per person')
                  : F('כל המתכון', 'Full recipe');
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[fs.segBtn, active && fs.segBtnActive]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      onUpdate('caloriesMode', mode);
                      onUpdate('maxCalories', null);
                      setCalInput('');
                    }}
                  >
                    <Text style={[fs.segText, active && fs.segTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Preset chips */}
            <View style={fs.chipRow}>
              {(filters.caloriesMode === 'per_serving' ? CALORIES_PP : CALORIES_TOTAL).map(v => (
                <Chip
                  key={v}
                  active={filters.maxCalories === v}
                  label={`≤${v} ${F('קל׳', 'kcal')}`}
                  onPress={() => {
                    const next = filters.maxCalories === v ? null : v;
                    onUpdate('maxCalories', next);
                    setCalInput(next ? String(next) : '');
                  }}
                  color={Colors.secondary}
                />
              ))}
            </View>

            {/* Free input */}
            <View style={[fs.calInputRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
              <TextInput
                style={[fs.calInput, { textAlign: isHe ? 'right' : 'left', color: Colors.text.primary }]}
                placeholder={F('מקסימום קלוריות...', 'Max calories...')}
                placeholderTextColor={Colors.text.tertiary}
                keyboardType="numeric"
                value={calInput}
                onChangeText={text => {
                  setCalInput(text);
                  const n = parseInt(text, 10);
                  onUpdate('maxCalories', Number.isNaN(n) || n <= 0 ? null : n);
                }}
                returnKeyType="done"
              />
              {calInput.length > 0 && (
                <TouchableOpacity
                  onPress={() => { setCalInput(''); onUpdate('maxCalories', null); void Haptics.selectionAsync(); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ color: Colors.text.tertiary, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={fs.calNote}>
              {F('מציג מתכונים עם ערכים תזונתיים בלבד', 'Only shows recipes with nutrition data')}
            </Text>
          </View>

          {/* Source */}
          <View style={fs.section}>
            <Text style={fs.sectionTitle}>{F('מקור', 'Source')}</Text>
            <View style={fs.chipRow}>
              {SOURCES.map(src => (
                <Chip
                  key={src.key}
                  active={filters.sourceType === src.key}
                  label={F(src.he, src.en)}
                  onPress={() => onUpdate('sourceType', filters.sourceType === src.key ? null : src.key)}
                  color={Colors.text.secondary}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={fs.applyBtn}
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }}
          accessibilityRole="button"
        >
          <Text style={fs.applyBtnText}>{F('הצג תוצאות', 'Show results')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const fs = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    flexDirection: 'column',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    ...Typography.label,
    fontSize: 15,
  },
  resetBtn: {
    ...Typography.label,
    color: Colors.primary,
    fontSize: 13,
  },
  closeBtn: {
    fontSize: 16,
    color: Colors.text.tertiary,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipTxt: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleRowActive: {
    backgroundColor: Colors.primary + '0F',
    borderColor: Colors.primary + '55',
  },
  toggleLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  segRow: {
    gap: 8,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segBtnActive: {
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary + '88',
  },
  segText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  segTextActive: {
    color: Colors.primary,
  },
  calInputRow: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  calInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
  },
  calNote: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  applyBtn: {
    margin: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyBtnText: {
    color: Colors.text.inverse,
    fontWeight: '600',
    fontSize: 15,
  },
});
