import React, { useRef, useState } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { isHebrew } from "../lib/i18n";
import { useShoppingStore } from "../store/shoppingStore";
import ShoppingItem from "../components/ShoppingItem";
import AddItemSheet from "../components/AddItemSheet";

export default function ShoppingScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { items, grouped, checkItem, removeItem, clearChecked, clearAll, addItem } =
    useShoppingStore();

  const [sheetOpen, setSheetOpen] = useState(false);

  function openSheet() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetOpen(true);
  }

  const totalCount = items.length;
  const checkedCount = items.filter((i) => i.checked).length;
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;

  // Build SectionList sections from the grouped store object.
  // Keys look like "🧀 מוצרי חלב" — emoji prefix + space + name.
  const sections = Object.entries(grouped).map(([cat, catItems]) => ({
    title: cat,
    data: catItems as any[],
  }));

  function handleClearAll() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      isHe ? "נקה רשימה" : "Clear list",
      isHe ? "האם לנקות את כל הפריטים?" : "Delete all items?",
      [
        { text: isHe ? "ביטול" : "Cancel", style: "cancel" },
        {
          text: isHe ? "נקה הכל" : "Clear all",
          style: "destructive",
          onPress: clearAll,
        },
      ],
    );
  }

  function handleClearChecked() {
    void Haptics.selectionAsync();
    clearChecked();
  }

  // ── Section header ──────────────────────────────────────────────────────────
  function renderSectionHeader({ section }: { section: { title: string; data: any[] } }) {
    const unchecked = section.data.filter((i: any) => !i.checked).length;
    return (
      <View
        style={[
          s.sectionHeader,
          { flexDirection: isHe ? "row-reverse" : "row" },
        ]}
      >
        <View style={s.sectionAccent} />
        <Text style={[s.sectionTitle, { textAlign: isHe ? "right" : "left" }]}>
          {section.title}
        </Text>
        {unchecked > 0 && (
          <View style={s.sectionBadge}>
            <Text style={s.sectionBadgeText}>{unchecked}</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Item renderer ───────────────────────────────────────────────────────────
  function renderItem({ item, index, section }: { item: any; index: number; section: any }) {
    const isLast = index === section.data.length - 1;
    return (
      <ShoppingItem
        item={item}
        onCheck={() => {
          void Haptics.selectionAsync();
          checkItem(item.id);
        }}
        onDelete={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          removeItem(item.id);
        }}
        isHe={isHe}
        isLast={isLast}
      />
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <ScreenHeader
          isHe={isHe}
          checkedCount={0}
          onClearChecked={handleClearChecked}
          onBrowse={() => navigation.navigate("Search")}
        />
        <View style={s.emptyOuter}>
          <View style={s.emptyCard}>
            <View style={s.emptyIconWrap}>
              <Text style={s.emptyEmoji}>🛒</Text>
            </View>
            <Text style={s.emptyTitle}>
              {isHe ? "הרשימה ריקה" : "Your list is empty"}
            </Text>
            <Text style={s.emptySub}>
              {isHe
                ? "הוסף פריטים ידנית או ייבא ממתכון"
                : "Add items manually or import from a recipe"}
            </Text>
            <View style={[s.emptyBtns, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <TouchableOpacity style={s.emptyBtnPrimary} onPress={openSheet} activeOpacity={0.85}>
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={s.emptyBtnText}>{isHe ? "הוסף פריט" : "Add item"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.emptyBtnSecondary} onPress={() => navigation.navigate("Search")} activeOpacity={0.85}>
                <Ionicons name="book-outline" size={16} color={Colors.primary} />
                <Text style={s.emptyBtnSecondaryText}>{isHe ? "בחר מתכון" : "Browse"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <AddItemSheet
          visible={sheetOpen}
          isHe={isHe}
          onAdd={(params) => addItem(params)}
          onClose={() => setSheetOpen(false)}
        />
      </View>
    );
  }

  // ── Main list ───────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
        <ScreenHeader
          isHe={isHe}
          checkedCount={checkedCount}
          onClearChecked={handleClearChecked}
          onBrowse={() => navigation.navigate("Search")}
        />

        {/* ── Progress strip ── */}
        <View style={s.progressWrap}>
          <View style={[s.progressInfo, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <Text style={s.progressLabel}>
              {isHe
                ? `${checkedCount} מתוך ${totalCount} פריטים`
                : `${checkedCount} of ${totalCount} items`}
            </Text>
            <View style={[s.progressActions, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              {checkedCount > 0 && (
                <TouchableOpacity onPress={handleClearChecked} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.progressClearBtn}>
                    {isHe ? `נקה מסומנים (${checkedCount})` : `Clear checked (${checkedCount})`}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleClearAll}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={s.clearAllIconBtn}
              >
                <Ionicons name="trash-outline" size={16} color="#E53935" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
        </View>

        {/* ── Sections ── */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          renderSectionFooter={() => <View style={s.sectionFooter} />}
        />

        {/* ── FAB: Add item ── */}
        <TouchableOpacity
          style={[s.fab, { bottom: Math.max(insets.bottom, 16) + 60 }]}
          onPress={openSheet}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>

        <AddItemSheet
          visible={sheetOpen}
          isHe={isHe}
          onAdd={(params) => addItem(params)}
          onClose={() => setSheetOpen(false)}
        />
    </View>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function ScreenHeader({
  isHe,
  checkedCount,
  onClearChecked,
  onBrowse,
}: {
  isHe: boolean;
  checkedCount: number;
  onClearChecked: () => void;
  onBrowse: () => void;
}) {
  return (
    <LinearGradient
      colors={["#FF6B6B", "#FF8E53"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.hero}
    >
      <View style={[s.heroRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.heroTitle, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "רשימת קניות" : "Shopping List"}
          </Text>
          <Text style={[s.heroSub, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "גרור שמאלה למחיקת פריט" : "Swipe to delete items"}
          </Text>
        </View>

        <TouchableOpacity
          style={s.browseBtn}
          onPress={onBrowse}
          activeOpacity={0.85}
        >
          <Ionicons name="search-outline" size={15} color={Colors.primary} />
          <Text style={s.browseBtnText}>
            {isHe ? "בחר מתכון" : "Browse recipes"}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}


// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F0EB" },

  // Hero header
  hero: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },
  heroRow: {
    alignItems: "center",
    gap: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  browseBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Progress
  progressWrap: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBEB",
    gap: 8,
  },
  progressInfo: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
  },
  progressClearBtn: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
    textDecorationLine: "underline",
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#EBEBEB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },

  // Section header
  sectionHeader: {
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 6,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sectionBadge: {
    backgroundColor: Colors.primary + "22",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.primary + "44",
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  sectionFooter: {
    height: 4,
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },

  // Progress actions row
  progressActions: {
    alignItems: "center",
    gap: 12,
  },
  clearAllIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FFF0F0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },

  // Clear all (footer - kept for reference but no longer rendered)
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  clearAllText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },

  // FAB
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },

  // Empty state
  emptyOuter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyCard: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFE8D6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A2E",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 15,
    color: "#8A8A9A",
    textAlign: "center",
    lineHeight: 21,
  },
  emptyBtns: {
    gap: 10,
    marginTop: 8,
    alignItems: "center",
  },
  emptyBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  emptyBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },
});
