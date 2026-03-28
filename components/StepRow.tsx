import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type Props = { index: number; text: string; timerSeconds?: number; isHe: boolean };

export default function StepRow({ index, text, timerSeconds, isHe }: Props) {
  const [done, setDone] = useState(false);
  return (
    <TouchableOpacity
      style={[s.row, { flexDirection: isHe ? 'row-reverse' : 'row' }, done && s.rowDone]}
      onPress={() => setDone(d => !d)}
      activeOpacity={0.7}
    >
      <View style={[s.num, done && s.numDone]}>
        <Text style={s.numText}>{done ? '✓' : index + 1}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.text, { textAlign: isHe ? 'right' : 'left' }, done && s.textDone]}>{text}</Text>
        {timerSeconds != null && !done && (
          <Text style={[s.timer, { textAlign: isHe ? 'right' : 'left' }]}>
            ⏱ {Math.round(timerSeconds / 60)} {isHe ? 'דקות' : 'min'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row:      { alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  rowDone:  { opacity: 0.5 },
  num:      { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  numDone:  { backgroundColor: Colors.secondary },
  numText:  { fontSize: 11, color: '#fff', fontWeight: '500' },
  text:     { fontSize: 13, color: Colors.text.primary, lineHeight: 20 },
  textDone: { textDecorationLine: 'line-through' },
  timer:    { fontSize: 11, color: Colors.secondary, marginTop: 3 },
});
