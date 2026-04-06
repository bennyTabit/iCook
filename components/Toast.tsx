import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Spacing } from '../constants/spacing';

type ToastType = 'default' | 'success' | 'error';

type Props = {
  message: string;
  /** Display duration in ms, default 1800 */
  duration?: number;
  type?: ToastType;
};

const TYPE_BG: Record<ToastType, string> = {
  default: Colors.text.primary,
  success: Colors.success,
  error:   Colors.error,
};

export default function Toast({ message, duration = 1800, type = 'default' }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) { opacity.setValue(0); return; }
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(duration),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [message, duration]);

  if (!message) return null;

  const bottomOffset = Math.max(insets.bottom, Spacing.lg) + 64; // above tab bar

  return (
    <Animated.View
      style={[s.toast, { opacity, bottom: bottomOffset, backgroundColor: TYPE_BG[type] }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Text style={s.text}>{message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 20,
    paddingHorizontal: Spacing.lg + 2,
    paddingVertical: Spacing.sm + 1,
    zIndex: 999,
    maxWidth: '80%',
  },
  text: {
    color: Colors.text.inverse,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
