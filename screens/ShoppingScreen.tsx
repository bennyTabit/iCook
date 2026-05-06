import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Animated,
  Share,
  Linking,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import { Colors } from "../constants/colors";
import { useThemeColors } from "../hooks/useThemeColors";
import { isHebrew } from "../lib/i18n";
import { useShoppingStore } from "../store/shoppingStore";
import type { ShopItem } from "../store/shoppingStore";
import ScreenHeader from "../components/ScreenHeader";
import ShoppingItem from "../components/ShoppingItem";
import AddItemSheet from "../components/AddItemSheet";
import {
  getRecurringItems,
  addRecurringItem,
  removeRecurringItem,
} from "../lib/recurringItems";

export default function ShoppingScreen({ navigation }: any) {
  const C = useThemeColors();
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { items, grouped, checkItem, removeItem, clearChecked, clearAll, addItem, setItemPrice, totalCost } =
    useShoppingStore();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [recurring, setRecurring] = useState<string[]>([]);

  // Load recurring items whenever the screen is focused
  useFocusEffect(
    useCallback(() => {
      void getRecurringItems().then(setRecurring);
    }, [])
  );

  function openSheet() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetOpen(true);
  }

  const totalCount = items.length;
  const checkedCount = items.filter((i) => i.checked).length;
  const progress = totalCount > 0 ? checkedCount / totalCount : 0;

  // Compute cost values
  const uncheckedCost = totalCost();
  const allCost = items.reduce((sum, i) => sum + (i.price ?? 0), 0);
  const hasPrices = items.some((i) => i.price != null);

  // Build SectionList sections from the grouped store object.
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

  // ── Share ───────────────────────────────────────────────────────────────────
  async function handleShare() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (items.length === 0) return;

    const lines: string[] = [isHe ? '🛒 רשימת קניות - iCook' : '🛒 Shopping List - iCook', ''];
    for (const [cat, catItems] of Object.entries(grouped)) {
      lines.push(cat);
      for (const item of catItems as ShopItem[]) {
        const check = item.checked ? '✅' : '⬜';
        const qty = item.quantity ? `${item.quantity}${item.unit ? ' ' + item.unit : ''} ` : '';
        lines.push(`  ${check} ${qty}${item.text}`);
      }
      lines.push('');
    }
    const text = lines.join('\n');

    const waUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    const canOpenWA = await Linking.canOpenURL(waUrl);
    if (canOpenWA) {
      await Linking.openURL(waUrl);
    } else {
      await Share.share({ message: text });
    }
  }

  // ── Recurring items helpers ─────────────────────────────────────────────────
  function handleAddRecurringChip(name: string) {
    void Haptics.selectionAsync();
    addItem(name);
  }

  function handleLongPressRecurringChip(name: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      isHe ? 'הסר מתמיד' : 'Remove recurring',
      isHe ? `האם להסיר "${name}" מהפריטים התמידיים?` : `Remove "${name}" from recurring items?`,
      [
        { text: isHe ? 'ביטול' : 'Cancel', style: 'cancel' },
        {
          text: isHe ? 'הסר' : 'Remove',
          style: 'destructive',
          onPress: () => {
            void removeRecurringItem(name).then(() =>
              getRecurringItems().then(setRecurring)
            );
          },
        },
      ],
    );
  }

  function handleAddNewRecurring() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      Alert.prompt(
        isHe ? 'פריט תמידי' : 'Recurring item',
        isHe ? 'שם הפריט שיופיע תמיד ברשימה' : 'Item name to always show in the list',
        [
          { text: isHe ? 'ביטול' : 'Cancel', style: 'cancel' },
          {
            text: isHe ? 'הוסף' : 'Add',
            onPress: (val: string | undefined) => {
              const trimmed = val?.trim();
              if (!trimmed) return;
              void addRecurringItem(trimmed).then(() =>
                getRecurringItems().then(setRecurring)
              );
            },
          },
        ],
        'plain-text',
        '',
      );
    } else {
      // Android fallback: use a regular Alert with instructions
      Alert.alert(
        isHe ? 'פריט תמידי' : 'Recurring item',
        isHe ? 'הוסף פריטים תמידיים מהרשימה הנוכחית על ידי לחיצה ארוכה על פריט' : 'Add recurring items by long-pressing an existing item in another section',
      );
    }
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
        onSetPrice={(price) => setItemPrice(item.id, price)}
        isHe={isHe}
        isLast={isLast}
      />
    );
  }

  // ── Recurring items strip ───────────────────────────────────────────────────
  function RecurringStrip() {
    if (recurring.length === 0) return null;
    return (
      <View style={[s.recurringWrap, { backgroundColor: C.surfaceElevated, borderBottomColor: C.border }]}>
        <View style={[s.recurringRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          <Text style={[s.recurringLabel, { color: C.text.secondary }]}>
            {isHe ? '🔁 תמידיים:' : '🔁 Recurring:'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[s.chipsContainer, { flexDirection: isHe ? "row-reverse" : "row" }]}
          >
            {recurring.map((name) => {
              const alreadyAdded = items.some((i) => i.text.toLowerCase() === name.toLowerCase());
              return (
                <TouchableOpacity
                  key={name}
                  style={[s.chip, alreadyAdded && s.chipAdded]}
                  onPress={() => !alreadyAdded && handleAddRecurringChip(name)}
                  onLongPress={() => handleLongPressRecurringChip(name)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipText, alreadyAdded && s.chipTextAdded]}>
                    {name}
                  </Text>
                  {alreadyAdded && (
                    <Ionicons name="checkmark" size={11} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={s.recurringAddBtn}
            onPress={handleAddNewRecurring}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <View style={[s.container, { backgroundColor: C.background }]}>
        <ScreenHeader
          title={isHe ? "רשימת קניות" : "Shopping List"}
          subtitle={isHe ? "גרור שמאלה למחיקת פריט" : "Swipe left to delete items"}
          rightAction={
            <TouchableOpacity
              style={[s.browseBtn, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
              onPress={() => navigation.navigate("Search")}
              activeOpacity={0.85}
            >
              <Ionicons name="search-outline" size={15} color={Colors.primary} />
              <Text style={s.browseBtnText}>{isHe ? "בחר מתכון" : "Browse"}</Text>
            </TouchableOpacity>
          }
        />
        {recurring.length > 0 && <RecurringStrip />}
        <View style={s.emptyOuter}>
          <View style={[s.emptyCard, { backgroundColor: C.surfaceElevated }]}>
            <View style={[s.emptyIconWrap, { backgroundColor: C.primary + "25" }]}>
              <Text style={s.emptyEmoji}>🛒</Text>
            </View>
            <Text style={[s.emptyTitle, { color: C.text.primary }]}>
              {isHe ? "הרשימה ריקה" : "Your list is empty"}
            </Text>
            <Text style={[s.emptySub, { color: C.text.secondary }]}>
              {isHe
                ? "הוסף פריטים ידנית או ייבא ממתכון"
                : "Add items manually or import from a recipe"}
            </Text>
            <View style={[s.emptyBtns, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <TouchableOpacity style={s.emptyBtnPrimary} onPress={openSheet} activeOpacity={0.85}>
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={s.emptyBtnText}>{isHe ? "הוסף פריט" : "Add item"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.emptyBtnSecondary, { backgroundColor: C.surface, borderColor: C.primary }]} onPress={() => navigation.navigate("Search")} activeOpacity={0.85}>
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
    <View style={[s.container, { backgroundColor: C.background }]}>
        <ScreenHeader
          title={isHe ? "רשימת קניות" : "Shopping List"}
          subtitle={isHe ? "גרור שמאלה למחיקת פריט" : "Swipe left to delete items"}
          rightAction={
            <View style={[s.headerBtns, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <TouchableOpacity
                style={[s.shareIconBtn, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
                onPress={() => void handleShare()}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="share-social-outline" size={18} color={C.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.browseBtn, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
                onPress={() => navigation.navigate("Search")}
                activeOpacity={0.85}
              >
                <Ionicons name="search-outline" size={15} color={Colors.primary} />
                <Text style={s.browseBtnText}>{isHe ? "בחר מתכון" : "Browse"}</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* ── Progress strip ── */}
        <View style={[s.progressWrap, { backgroundColor: C.surfaceElevated, borderBottomColor: C.border }]}>
          <View style={[s.progressInfo, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <Text style={[s.progressLabel, { color: C.text.secondary }]}>
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
                style={[s.clearAllIconBtn, { backgroundColor: C.errorSurface, borderColor: C.errorBorder }]}
              >
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>

          {/* ── Total cost row ── */}
          {hasPrices && (
            <View style={[s.costRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <Text style={[s.costText, { color: C.text.secondary }]}>
                {isHe
                  ? `💰 סה״כ לא מסומן: ₪${uncheckedCost.toFixed(2)}  |  סה״כ: ₪${allCost.toFixed(2)}`
                  : `💰 Remaining: ₪${uncheckedCost.toFixed(2)}  |  Total: ₪${allCost.toFixed(2)}`}
              </Text>
            </View>
          )}
        </View>

        {/* ── Recurring strip ── */}
        <RecurringStrip />

        {/* ── Sections ── */}
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          renderSectionFooter={() => <View style={[s.sectionFooter, { backgroundColor: C.surface }]} />}
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  // Header right-action buttons
  headerBtns: {
    alignItems: "center",
    gap: 8,
  },
  shareIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  browseBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Progress
  progressWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  progressInfo: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressClearBtn: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
    textDecorationLine: "underline",
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  costRow: {
    paddingTop: 2,
  },
  costText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Recurring strip
  recurringWrap: {
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  recurringRow: {
    alignItems: "center",
    gap: 8,
  },
  recurringLabel: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 0,
  },
  chipsContainer: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary + "15",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
  },
  chipAdded: {
    backgroundColor: Colors.primary + "30",
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  chipTextAdded: {
    color: Colors.primary,
  },
  recurringAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.primary + "40",
    flexShrink: 0,
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 15,
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
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderWidth: 1.5,
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
