import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import type { ShopItem } from '../store/shoppingStore';

type Props = { item: ShopItem; onCheck: () => void; onDelete: () => void; isHe: boolean };

export default function ShoppingItem({ item, onCheck, onDelete, isHe }: Props) {
  const swipeableRef = useRef<Swipeable>(null);

  function renderDeleteAction(progress: Animated.AnimatedInterpolation<number>) {
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
    return (
      <TouchableOpacity
        style={s.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        activeOpacity={0.8}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={isHe ? undefined : renderDeleteAction}
      renderLeftActions={isHe ? renderDeleteAction : undefined}
      overshootFriction={8}
      friction={2}
    >
      <TouchableOpacity
        style={[s.row, { flexDirection: isHe ? 'row-reverse' : 'row' }]}
        onPress={onCheck}
        activeOpacity={0.7}
      >
        <View style={[s.check, item.checked && s.checkDone]}>
          {item.checked && <Text style={s.checkMark}>✓</Text>}
        </View>
        <Text
          style={[
            s.text,
            { flex: 1, textAlign: isHe ? 'right' : 'left' },
            item.checked && s.textDone,
          ]}
        >
          {item.text}
        </Text>
        {item.quantity && (
          <Text style={s.qty}>{item.quantity} {item.unit ?? ''}</Text>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  row: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
    gap: 12,
    backgroundColor: Colors.background,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkDone: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  checkMark: { fontSize: 12, color: '#fff', fontWeight: '500' },
  text: { fontSize: 13, color: Colors.text.primary },
  textDone: { textDecorationLine: 'line-through', color: Colors.text.tertiary },
  qty: { fontSize: 12, color: Colors.text.secondary, flexShrink: 0 },
  deleteAction: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 64,
  },
});
