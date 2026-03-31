import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import type { RecipeSummary } from "../lib/search";
import * as Haptics from "expo-haptics";

const CATEGORY_EMOJI: Record<string, string> = {
  pasta: "🍝",
  salads: "🥗",
  desserts: "🍰",
  soups: "🍜",
  meat: "🥩",
  fish: "🐟",
  breakfast: "🍳",
  veggie: "🥦",
};

const CATEGORY_BG: Record<string, string> = {
  pasta: "#FFF3D6",
  salads: "#E6F7EF",
  desserts: "#FDE8F0",
  soups: "#FFF0E0",
  meat: "#FCE8E8",
  fish: "#E5F2FB",
  breakfast: "#FFF8E1",
  veggie: "#E8F5E9",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#2ECC71",
  medium: "#F39C12",
  hard: "#E74C3C",
};

const DIFFICULTY_LABEL: Record<string, { he: string; en: string }> = {
  easy: { he: "קל", en: "Easy" },
  medium: { he: "בינוני", en: "Medium" },
  hard: { he: "קשה", en: "Hard" },
};

const SOURCE_ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  manual: "create-outline",
  ocr: "camera-outline",
  url: "link-outline",
  instagram: "logo-instagram",
  ai: "sparkles-outline",
};

type Props = {
  recipe: RecipeSummary;
  query?: string;
  onPress: () => void;
  onFav: () => void;
  onDelete: () => void;
  isHe: boolean;
};

export default function RecipeCard({ recipe, onPress, onFav, onDelete, isHe }: Props) {
  const swipeableRef = useRef<Swipeable>(null);

  const title = isHe ? recipe.title_he : (recipe.title_en || recipe.title_he);
  const catKey = recipe.category_name_en?.toLowerCase() ?? "";
  const emoji = CATEGORY_EMOJI[catKey] ?? "🍽️";
  const thumbBg = CATEGORY_BG[catKey] ?? "#F5F3EE";
  const isFav = recipe.is_favorite === 1;
  const diff = recipe.difficulty ?? null;
  const diffColor = diff ? (DIFFICULTY_COLOR[diff] ?? Colors.text.tertiary) : null;
  const diffLabel = diff ? (isHe ? DIFFICULTY_LABEL[diff]?.he : DIFFICULTY_LABEL[diff]?.en) : null;
  const sourceIcon = SOURCE_ICON[recipe.source_type] ?? "document-outline";

  function renderDeleteAction(progress: Animated.AnimatedInterpolation<number>) {
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
    const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.8, 1] });
    return (
      <TouchableOpacity
        style={s.deleteAction}
        activeOpacity={0.8}
        onPress={() => {
          onDelete();
        }}
      >
        <Animated.View style={[s.deleteInner, { transform: [{ scale }], opacity }]}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
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
        style={s.card}
        onPress={() => {
          void Haptics.selectionAsync();
          onPress();
        }}
        activeOpacity={0.88}
      >
        {/* Difficulty accent bar */}
        <View style={[s.accentBar, { backgroundColor: diffColor ?? Colors.border }]} />

        {/* Thumbnail */}
        <View style={[s.thumb, { backgroundColor: thumbBg }]}>
          <Text style={s.thumbEmoji}>{emoji}</Text>
        </View>

        {/* Body */}
        <View style={s.body}>
          <Text
            style={[s.title, { textAlign: isHe ? "right" : "left" }]}
            numberOfLines={2}
          >
            {title}
          </Text>

          <View style={[s.chips, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            {recipe.cook_time_min != null && recipe.cook_time_min > 0 && (
              <View style={s.chip}>
                <Ionicons name="timer-outline" size={11} color={Colors.text.secondary} />
                <Text style={s.chipText}>
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
            <View style={[s.chip, s.sourceChip]}>
              <Ionicons name={sourceIcon} size={11} color={Colors.text.tertiary} />
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
        >
          <Ionicons
            name={isFav ? "heart" : "heart-outline"}
            size={20}
            color={isFav ? "#FF4757" : Colors.text.tertiary}
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
    // Shadow lives here so it's visible outside overflow:hidden on the card
    shadowColor: "#1A1A1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  card: {
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: "#1A1A1A",
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  diffDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourceChip: {
    paddingHorizontal: 6,
    backgroundColor: Colors.surface,
  },
  favBtn: {
    paddingHorizontal: 14,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },

  // Delete action
  deleteAction: {
    width: 80,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FF4757",
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
    color: "#fff",
  },
});
