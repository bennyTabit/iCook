import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type Props = { text: string; quantity?: string; unit?: string; isHe: boolean };

export default function IngredientRow({ text, quantity, unit, isHe }: Props) {
  return (
    <View style={[s.row, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
      <View style={s.dot} />
      <Text style={[s.text, { flex: 1, textAlign: isHe ? 'right' : 'left' }]}>{text}</Text>
      {quantity && <Text style={s.qty}>{quantity} {unit ?? ''}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row:  { alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderColor: Colors.border, gap: 10 },
  dot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary, flexShrink: 0 },
  text: { fontSize: 13, color: Colors.text.primary, lineHeight: 18 },
  qty:  { fontSize: 12, color: Colors.text.secondary, flexShrink: 0 },
});
