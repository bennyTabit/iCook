import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';
import { isHebrew } from '../lib/i18n';

type Option = {
  icon: string;
  titleKey: string;
  subKey: string;
  screen: string;
  color: string;
};

const OPTIONS: Option[] = [
  { icon: '✏️', titleKey: 'manual',     subKey: 'manualSub',  screen: 'EditRecipe',  color: Colors.accent },
  { icon: '📷', titleKey: 'scan',       subKey: 'scanSub',    screen: 'OcrReview',   color: Colors.secondary },
  { icon: '🔗', titleKey: 'importLink', subKey: 'importSub',  screen: 'ImportLink',  color: Colors.primary },
];

const QUICK_TAGS = ['tagVegan', 'tagGlutenFree', 'tagQuick', 'tagMeat', 'tagDairy', 'tagParve'];

export default function AddRecipeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isHe = isHebrew();

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={[s.header, { backgroundColor: Colors.primary }]}>
          <Text style={s.headerTitle}>{t('addRecipe')}</Text>
          <Text style={s.headerSub}>{t('choosePath')}</Text>
        </View>

        <View style={s.options}>
          {OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.titleKey}
              style={[s.optCard, { borderColor: opt.color + '55', backgroundColor: opt.color + '11' }]}
              onPress={() => navigation.navigate(opt.screen, opt.screen === 'EditRecipe' ? { id: null } : undefined)}
              activeOpacity={0.8}
            >
              <View style={[s.optIcon, { backgroundColor: opt.color + '33' }]}>
                <Text style={{ fontSize: 22 }}>{opt.icon}</Text>
              </View>
              <View style={s.optText}>
                <Text style={[s.optTitle, { textAlign: isHe ? 'right' : 'left' }]}>{t(opt.titleKey as any)}</Text>
                <Text style={[s.optSub, { textAlign: isHe ? 'right' : 'left' }]}>{t(opt.subKey as any)}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Coming in v2 */}
          <View style={s.optCardDisabled}>
            <View style={[s.optIcon, { backgroundColor: Colors.surface }]}>
              <Text style={{ fontSize: 22 }}>📱</Text>
            </View>
            <View style={s.optText}>
              <Text style={[s.optTitle, { color: Colors.text.tertiary, textAlign: isHe ? 'right' : 'left' }]}>{t('comingV2')}</Text>
              <Text style={[s.optSub, { textAlign: isHe ? 'right' : 'left' }]}>{t('instaSub')}</Text>
            </View>
          </View>
        </View>

        <Text style={[s.tagsLabel, { textAlign: isHe ? 'right' : 'left' }]}>
          {isHe ? 'פילטרים מהירים לאחר ההוספה:' : 'Quick filters after adding:'}
        </Text>
        <View style={s.tagsRow}>
          {QUICK_TAGS.map(k => (
            <View key={k} style={s.tagChip}>
              <Text style={s.tagText}>{t(k as any)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.background },
  scroll:          { paddingBottom: 32 },
  header:          { padding: 16, paddingBottom: 20 },
  headerTitle:     { fontSize: 18, fontWeight: '500', color: '#fff' },
  headerSub:       { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  options:         { padding: 16, gap: 12 },
  optCard:         { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 0.5, padding: 14 },
  optCardDisabled: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, borderWidth: 0.5, borderColor: Colors.border, borderStyle: 'dashed', padding: 14, backgroundColor: Colors.surface },
  optIcon:         { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optText:         { flex: 1 },
  optTitle:        { fontSize: 13, fontWeight: '500', color: Colors.text.primary, marginBottom: 2 },
  optSub:          { fontSize: 11, color: Colors.text.secondary, lineHeight: 15 },
  tagsLabel:       { fontSize: 11, color: Colors.text.secondary, paddingHorizontal: 16, marginBottom: 8 },
  tagsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  tagChip:         { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: Colors.surface, borderWidth: 0.5, borderColor: Colors.border },
  tagText:         { fontSize: 12, color: Colors.text.secondary, fontWeight: '500' },
});
