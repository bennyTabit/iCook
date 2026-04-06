import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  Platform,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "../constants/colors";
import type { ShopItem } from "../store/shoppingStore";

type Props = {
  item: ShopItem;
  onCheck: () => void;
  onDelete: () => void;
  onSetPrice: (price: number | undefined) => void;
  isHe: boolean;
  isLast: boolean;
};

export default function ShoppingItem({ item, onCheck, onDelete, onSetPrice, isHe, isLast }: Props) {
  const swipeableRef = useRef<Swipeable>(null);
  const checkAnim = useRef(new Animated.Value(item.checked ? 1 : 0)).current;

  function handleCheck() {
    Animated.spring(checkAnim, {
      toValue: item.checked ? 0 : 1,
      useNativeDriver: false,
      friction: 6,
    }).start();
    onCheck();
  }

  function handleLongPress() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      Alert.prompt(
        isHe ? 'מחיר' : 'Price',
        isHe ? 'הכנס מחיר לפריט (₪)' : 'Enter price for this item (₪)',
        [
          { text: isHe ? 'ביטול' : 'Cancel', style: 'cancel' },
          {
            text: isHe ? 'שמור' : 'Save',
            onPress: (val: string | undefined) => {
              const n = parseFloat(val ?? '');
              onSetPrice(!isNaN(n) && n > 0 ? n : undefined);
            },
          },
        ],
        'plain-text',
        item.price != null ? String(item.price) : '',
        'numeric',
      );
    }
  }

  const checkBg = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.surfaceElevated, Colors.primary],
  });
  const checkBorder = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.primary, Colors.primary],
  });

  function renderDeleteAction(progress: Animated.AnimatedInterpolation<number>) {
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
    const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.7, 1] });
    return (
      <TouchableOpacity
        style={s.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        activeOpacity={0.8}
      >
        <Animated.View style={{ transform: [{ scale }], opacity }}>
          <Ionicons name="trash-outline" size={22} color={Colors.text.inverse} />
          <Text style={s.deleteLabel}>{isHe ? "מחק" : "Delete"}</Text>
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
        style={[
          s.row,
          { flexDirection: isHe ? "row-reverse" : "row" },
          !isLast && s.rowBorder,
          item.checked && s.rowChecked,
        ]}
        onPress={handleCheck}
        onLongPress={Platform.OS === 'ios' ? handleLongPress : undefined}
        activeOpacity={0.75}
      >
        {/* Animated checkbox */}
        <Animated.View
          style={[
            s.checkbox,
            { backgroundColor: checkBg, borderColor: checkBorder },
          ]}
        >
          {item.checked && (
            <Ionicons name="checkmark" size={14} color={Colors.text.inverse} />
          )}
        </Animated.View>

        {/* Text content */}
        <View style={[s.textWrap, { alignItems: isHe ? "flex-end" : "flex-start" }]}>
          <View style={[s.nameRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <Text
              style={[
                s.itemText,
                { textAlign: isHe ? "right" : "left" },
                item.checked && s.itemTextDone,
              ]}
              numberOfLines={1}
            >
              {item.text}
            </Text>
            {item.price != null && (
              <Text style={s.priceTag}>₪{item.price.toFixed(2)}</Text>
            )}
          </View>
          {(item.quantity || item.unit) ? (
            <Text style={[s.itemQty, { textAlign: isHe ? "right" : "left" }]}>
              {[item.quantity, item.unit].filter(Boolean).join(" ")}
            </Text>
          ) : null}
        </View>

        {/* Swipe hint chevron */}
        <Ionicons
          name={isHe ? "chevron-back-outline" : "chevron-forward-outline"}
          size={14}
          color={Colors.text.tertiary}
          style={s.swipeHint}
        />
      </TouchableOpacity>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  row: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: Colors.surfaceElevated,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowChecked: {
    backgroundColor: Colors.surface,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    alignItems: "center",
    gap: 6,
  },
  itemText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text.primary,
    lineHeight: 22,
    flexShrink: 1,
  },
  itemTextDone: {
    textDecorationLine: "line-through",
    color: Colors.text.disabled,
    fontWeight: "400",
  },
  priceTag: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontWeight: "500",
    flexShrink: 0,
  },
  itemQty: {
    fontSize: 13,
    color: Colors.text.tertiary,
    fontWeight: "400",
  },
  swipeHint: {
    opacity: 0.3,
    flexShrink: 0,
  },
  deleteAction: {
    width: 72,
    backgroundColor: Colors.error,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  deleteLabel: {
    fontSize: 10,
    color: Colors.text.inverse,
    fontWeight: "700",
  },
});
