import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type ShopItem = { id: string; text: string; quantity?: string; unit?: string; checked: boolean };
type Props = { item: ShopItem; onCheck: () => void; isHe: boolean };

export default function ShoppingItem({ item, onCheck, isHe }: Props) {
  return (
    <TouchableOpacity
      style={[s.row, { flexDirection: isHe ? 'row-reverse' : 'row' }]}
      onPress={onCheck}
      activeOpacity={0.7}
    >
      <View style={[s.check, item.checked && s.checkDone]}>
        {item.checked && <Text style={s.checkMark}>✓</Text>}
      </View>
      <Text style={[s.text, { flex: 1, textAlign: isHe ? 'right' : 'left' }, item.checked && s.textDone]}>
        {item.text}
      </Text>
      {item.quantity && <Text style={s.qty}>{item.quantity} {item.unit ?? ''}</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row:       { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderColor: Colors.border, gap: 12 },
  check:     { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkDone: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  checkMark: { fontSize: 12, color: '#fff', fontWeight: '500' },
  text:      { fontSize: 13, color: Colors.text.primary },
  textDone:  { textDecorationLine: 'line-through', color: Colors.text.tertiary },
  qty:       { fontSize: 12, color: Colors.text.secondary, flexShrink: 0 },
});
