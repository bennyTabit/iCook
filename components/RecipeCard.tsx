import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "../constants/colors";
import type { RecipeSummary } from "../lib/search";
import { Typography } from "../constants/typography";
import * as Haptics from "expo-haptics";

const CARD_COLORS = [
  "#FFE66D",
  "#E1F5EE",
  "#FAECE7",
  "#E6F1FB",
  "#EAF3DE",
  "#FFF0E6",
];
const CARD_EMOJIS: Record<string, string> = {
  pasta: "🍝",
  salads: "🥗",
  desserts: "🍰",
  soups: "🍜",
  meat: "🥩",
  fish: "🐟",
  breakfast: "🍳",
  veggie: "🥦",
};

type Props = {
  recipe: RecipeSummary;
  query?: string;
  onPress: () => void;
  onFav: () => void;
  isHe: boolean;
};

export default function RecipeCard({ recipe, onPress, onFav, isHe }: Props) {
  const title = isHe ? recipe.title_he : recipe.title_en || recipe.title_he;
  const bg = CARD_COLORS[recipe.id % CARD_COLORS.length];
  const emoji =
    CARD_EMOJIS[recipe.category_name_en?.toLowerCase() ?? ""] ?? "🍽";
  const isFav = recipe.is_favorite === 1;

  function tap() {
    void Haptics.selectionAsync();
  }

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => {
        tap();
        onPress();
      }}
      activeOpacity={0.88}
    >
      <View style={[s.img, { backgroundColor: bg }]}>
        <Text style={{ fontSize: 26 }}>{emoji}</Text>
      </View>
      <View style={s.body}>
        <Text
          style={[s.title, { textAlign: isHe ? "right" : "left" }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <View style={[s.meta, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          {recipe.cook_time_min != null && (
            <Text style={s.metaText}>⏱ {recipe.cook_time_min}m</Text>
          )}
          {recipe.difficulty != null && (
            <Text style={s.metaText}>👨‍🍳 {recipe.difficulty}</Text>
          )}
          <View
            style={[
              s.srcBadge,
              {
                backgroundColor:
                  (Colors.source as any)[recipe.source_type] + "22",
              },
            ]}
          >
            <Text style={{ fontSize: 10 }}>
              {recipe.source_type === "manual"
                ? "✏️"
                : recipe.source_type === "ocr"
                  ? "📷"
                  : "🔗"}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        style={s.fav}
        onPress={() => {
          tap();
          onFav();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={{ fontSize: 18 }}>{isFav ? "❤️" : "🤍"}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,
  },
  img: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, padding: 11, justifyContent: "center" },
  title: {
    ...Typography.body,
    fontWeight: "600",
    color: Colors.text.primary,
    marginBottom: 4,
  },
  meta: { gap: 8, alignItems: "center" },
  metaText: { ...Typography.caption, color: Colors.text.secondary },
  srcBadge: { borderRadius: 6, padding: 4 },
  fav: { paddingHorizontal: 12, justifyContent: "center" },
});
