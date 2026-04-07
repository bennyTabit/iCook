import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "../constants/colors";
import { Shadow } from "../constants/spacing";
import {
  CATEGORY_EMOJI,
  CATEGORY_BG,
  DIFFICULTY_COLOR,
  DIFFICULTY_LABEL,
  SOURCE_ICON,
  FALLBACK_EMOJI,
  FALLBACK_BG,
} from "../constants/recipes";
import { useThemeColors } from "../hooks/useThemeColors";
import type { RecipeSummary } from "../lib/search";

type Props = {
  recipe: RecipeSummary;
  query?: string;
  onPress: () => void;
  onFav: () => void;
  onDelete: () => void;
  isHe: boolean;
};

export default function RecipeCard({ recipe, onPress, onFav, onDelete, isHe }: Props) {
  const C = useThemeColors();
  const swipeableRef = useRef<Swipeable>(null);

  const title = isHe ? recipe.title_he : (recipe.title_en || recipe.title_he);
  const catKey = recipe.category_name_en?.toLowerCase() ?? "";
  const emoji = CATEGORY_EMOJI[catKey] ?? FALLBACK_EMOJI;
  const thumbBg = CATEGORY_BG[catKey] ?? FALLBACK_BG;
  const isFav = recipe.is_favorite === 1;
  const diff = recipe.difficulty ?? null;
  const diffColor = diff ? (DIFFICULTY_COLOR[diff] ?? C.text.tertiary) : null;
  const diffLabel = diff ? (isHe ? DIFFICULTY_LABEL[diff]?.he : DIFFICULTY_LABEL[diff]?.en) : null;
  const sourceIcon = (SOURCE_ICON[recipe.source_type] ?? "document-outline") as React.ComponentProps<typeof Ionicons>["name"];

  function renderDeleteAction(progress: Animated.AnimatedInterpolation<number>) {
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
    const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.8, 1] });
    return (
      <TouchableOpacity
        style={s.deleteAction}
        activeOpacity={0.8}
        onPress={onDelete}
        accessibilityLabel={isHe ? "מחק מתכון" : "Delete recipe"}
        accessibilityRole="button"
      >
        <Animated.View style={[s.deleteInner, { transform: [{ scale }], opacity }]}>
          <Ionicons name="trash-outline" size={22} color={Colors.text.inverse} />
          <Text style={s.deleteLabel}>{isHe ? "מחק" : "Delete"}</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      overshootFriction={8}
      rightThreshold={72}
      renderRightActions={isHe ? undefined : renderDeleteAction}
      renderLeftActions={isHe ? renderDeleteAction : undefined}
      onSwipeableWillOpen={() =>
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      }
      containerStyle={s.swipeContainer}
    >
      <TouchableOpacity
        style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {/* Difficulty accent bar */}
        <View style={[s.accentBar, { backgroundColor: diffColor ?? C.border }]} />

        {/* Thumbnail */}
        <View style={[s.thumb, { backgroundColor: thumbBg }]}>
          <Text style={s.thumbEmoji}>{emoji}</Text>
        </View>

        {/* Body */}
        <View style={s.body}>
          <Text
            style={[s.title, { color: C.text.primary, textAlign: isHe ? "right" : "left" }]}
            numberOfLines={2}
          >
            {title}
          </Text>

          <View style={[s.chips, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            {recipe.cook_time_min != null && recipe.cook_time_min > 0 && (
              <View style={[s.chip, { borderColor: C.border, backgroundColor: C.surface }]}>
                <Ionicons name="timer-outline" size={11} color={C.text.secondary} />
                <Text style={[s.chipText, { color: C.text.secondary }]}>
                  {recipe.cook_time_min} {isHe ? "דק׳" : "min"}
                </Text>
              </View>
            )}
            {diffLabel && diffColor && (
              <View style={[s.chip, { borderColor: diffColor + "55", backgroundColor: diffColor + "18" }]}>
                <View style={[s.diffDot, { backgroundColor: diffColor }]} />
                <Text style={[s.chipText, { color: diffColor }]}>{diffLabel}</Text>
              </View>
            )}
            <View style={[s.chip, s.sourceChip, { borderColor: C.border, backgroundColor: C.surface }]}>
              <Ionicons name={sourceIcon} size={11} color={C.text.tertiary} />
            </View>
          </View>
        </View>

        {/* Favorite button */}
        <TouchableOpacity
          style={s.favBtn}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onFav();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={isFav ? (isHe ? "הסר ממועדפים" : "Remove from favorites") : (isHe ? "הוסף למועדפים" : "Add to favorites")}
          accessibilityRole="button"
        >
          <Ionicons
            name={isFav ? "heart" : "heart-outline"}
            size={20}
            color={isFav ? Colors.error : C.text.tertiary}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Swipeable>
  );
}

const s = StyleSheet.create({
  swipeContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    ...Shadow.sm,
  },
  card: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
  },
  thumb: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  thumbEmoji: { fontSize: 28 },
  body: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    justifyContent: "center",
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  chips: {
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  diffDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourceChip: {
    paddingHorizontal: 6,
  },
  favBtn: {
    paddingHorizontal: 14,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAction: {
    width: 80,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteInner: {
    alignItems: "center",
    gap: 4,
  },
  deleteLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.text.inverse,
  },
});
