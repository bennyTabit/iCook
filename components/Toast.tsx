import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type Props = { message: string };

export default function Toast({ message }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) { opacity.setValue(0); return; }
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [message]);

  if (!message) return null;
  return (
    <Animated.View style={[s.toast, { opacity }]}>
      <Text style={s.text}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: { position: 'absolute', bottom: 90, alignSelf: 'center', backgroundColor: Colors.text.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9, zIndex: 999 },
  text:  { color: '#fff', fontSize: 13, fontWeight: '500' },
});
