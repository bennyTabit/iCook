import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';
import { isHebrew } from '../lib/i18n';
import { useShoppingStore } from '../store/shoppingStore';
import ShoppingItem from '../components/ShoppingItem';

export default function ShoppingScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { items, grouped, checkItem, clearChecked, clearAll } = useShoppingStore();
  const checkedCount = items.filter(i => i.checked).length;

  return (
    <SafeAreaView style={s.container}>
      <View style={[s.header, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
        <Text style={s.headerTitle}>{t('shoppingList')}</Text>
        <View style={[s.headerBtns, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
          {checkedCount > 0 && (
            <TouchableOpacity onPress={clearChecked}>
              <Text style={s.clearBtn}>{isHe ? `נקה (${checkedCount})` : `Clear (${checkedCount})`}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.navigate('AddRecipe')}>
            <View style={s.addBtn}><Text style={s.addBtnText}>{t('generateList')}</Text></View>
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 40 }}>🛒</Text>
          <Text style={s.emptyTitle}>{t('noItems')}</Text>
          <Text style={s.emptySub}>{isHe ? 'הוסף מתכונים כדי לייצר רשימה' : 'Add recipes to generate a list'}</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => navigation.navigate('AddRecipe')}>
            <Text style={s.emptyBtnText}>{t('addFromRecipe')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {Object.entries(grouped).map(([cat, catItems]) => (
            <View key={cat}>
              <Text style={[s.catHeader, { textAlign: isHe ? 'right' : 'left' }]}>{cat}</Text>
              {(catItems as any[]).map((item: any) => (
                <ShoppingItem key={item.id} item={item} onCheck={() => checkItem(item.id)} isHe={isHe} />
              ))}
            </View>
          ))}
          {checkedCount > 0 && (
            <TouchableOpacity style={s.clearAllBtn} onPress={clearAll}>
              <Text style={s.clearAllText}>{isHe ? 'נקה רשימה' : 'Clear list'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.background },
  header:       { alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderColor: Colors.border },
  headerTitle:  { fontSize: 18, fontWeight: '500', color: Colors.text.primary },
  headerBtns:   { gap: 10, alignItems: 'center' },
  clearBtn:     { fontSize: 12, color: Colors.primary },
  addBtn:       { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText:   { color: '#fff', fontSize: 12, fontWeight: '500' },
  catHeader:    { fontSize: 10, fontWeight: '500', color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyTitle:   { fontSize: 16, fontWeight: '500', color: Colors.text.secondary },
  emptySub:     { fontSize: 13, color: Colors.text.tertiary, textAlign: 'center' },
  emptyBtn:     { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 6 },
  emptyBtnText: { color: '#fff', fontWeight: '500' },
  clearAllBtn:  { margin: 16, padding: 14, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border },
  clearAllText: { color: Colors.primary, fontWeight: '500', fontSize: 13 },
});
