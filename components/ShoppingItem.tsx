import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import type { ShopItem } from "../store/shoppingStore";

type Props = {
  item: ShopItem;
  onCheck: () => void;
  onDelete: () => void;
  isHe: boolean;
  isLast: boolean;
};

export default function ShoppingItem({ item, onCheck, onDelete, isHe, isLast }: Props) {
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

  const checkBg = checkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#ffffff", Colors.primary],
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
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={s.deleteLabel}>מחק</Text>
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
            <Ionicons name="checkmark" size={14} color="#fff" />
          )}
        </Animated.View>

        {/* Text content */}
        <View style={[s.textWrap, { alignItems: isHe ? "flex-end" : "flex-start" }]}>
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
    backgroundColor: "#fff",
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0EC",
  },
  rowChecked: {
    backgroundColor: "#FAFAFA",
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
  itemText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1A1A2E",
    lineHeight: 22,
  },
  itemTextDone: {
    textDecorationLine: "line-through",
    color: "#B0B0BB",
    fontWeight: "400",
  },
  itemQty: {
    fontSize: 13,
    color: "#888",
    fontWeight: "400",
  },
  swipeHint: {
    opacity: 0.3,
    flexShrink: 0,
  },
  deleteAction: {
    width: 72,
    backgroundColor: "#FF4757",
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  deleteLabel: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
  },
});
