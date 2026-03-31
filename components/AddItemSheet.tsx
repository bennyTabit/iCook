import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "../constants/colors";
import type { AddItemParams } from "../store/shoppingStore";

// ─── Constants ────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { key: "🛒 אחר",           label_he: "אחר",          label_en: "Other",       emoji: "🛒" },
  { key: "🧀 מוצרי חלב",    label_he: "מוצרי חלב",    label_en: "Dairy",       emoji: "🧀" },
  { key: "🥩 בשר ודגים",    label_he: "בשר ודגים",    label_en: "Meat & Fish", emoji: "🥩" },
  { key: "🥦 ירקות ופירות", label_he: "ירקות ופירות", label_en: "Produce",     emoji: "🥦" },
  { key: "🏺 מזווה",         label_he: "מזווה",         label_en: "Pantry",      emoji: "🏺" },
  { key: "🥚 ביצים",         label_he: "ביצים",         label_en: "Eggs",        emoji: "🥚" },
  { key: "🍞 מאפים",         label_he: "מאפים",         label_en: "Bakery",      emoji: "🍞" },
  { key: "🧃 שתייה",         label_he: "שתייה",         label_en: "Drinks",      emoji: "🧃" },
  { key: "🧹 ניקיון",        label_he: "ניקיון",        label_en: "Cleaning",    emoji: "🧹" },
];

const UNITS_HE = ["יח׳", "גרם", "ק״ג", "מ״ל", "ליטר", "כוס", "כף", "כפית", "חבילה", "קופסה", "עלה"];
const UNITS_EN = ["pcs", "g", "kg", "ml", "liter", "cup", "tbsp", "tsp", "pack", "can"];

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  isHe: boolean;
  onAdd: (params: AddItemParams) => void;
  onClose: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddItemSheet({ visible, isHe, onAdd, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const nameRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [nameFocused, setNameFocused] = useState(false);
  const [showError, setShowError] = useState(false);

  const units = isHe ? UNITS_HE : UNITS_EN;
  const canAdd = name.trim().length > 0;

  // ── Sheet animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setShowError(false);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          friction: 22,
          tension: 200,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => nameRef.current?.focus(), 80);
      });
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  function reset() {
    setName("");
    setQty(1);
    setUnit("");
    setCategory(CATEGORIES[0].key);
    setShowError(false);
    setNameFocused(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleAdd() {
    if (!name.trim()) {
      setShowError(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      nameRef.current?.focus();
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdd({
      text: name.trim(),
      quantity: qty > 0 ? String(qty) : undefined,
      unit: unit || undefined,
      category,
    });
    reset();
    onClose();
  }

  function changeQty(delta: number) {
    void Haptics.selectionAsync();
    setQty((prev) => Math.max(1, prev + delta));
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet wrapper — KeyboardAvoidingView pushes sheet up when keyboard appears */}
      <KeyboardAvoidingView
        style={s.kvWrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            s.sheet,
            {
              paddingBottom: Math.max(insets.bottom + 8, 20),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* ── Drag handle ── */}
          <View style={s.handle} />

          {/* ── Header ── */}
          <View style={[s.headerRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <Text style={s.headerTitle}>{isHe ? "הוסף פריט" : "Add Item"}</Text>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* ── Category ── */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "קטגוריה" : "Category"}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                s.categoryScroll,
                { flexDirection: isHe ? "row-reverse" : "row" },
              ]}
            >
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[s.catPill, active && s.catPillActive]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setCategory(c.key);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={s.catEmoji}>{c.emoji}</Text>
                    <Text style={[s.catLabel, active && s.catLabelActive]}>
                      {isHe ? c.label_he : c.label_en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* ── Item name ── */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "שם הפריט" : "Item name"}
            </Text>
            <TextInput
              ref={nameRef}
              style={[
                s.nameInput,
                { textAlign: isHe ? "right" : "left", writingDirection: isHe ? "rtl" : "ltr" },
                nameFocused && s.nameInputFocused,
                showError && !name.trim() && s.nameInputError,
              ]}
              placeholder={isHe ? "לדוגמה: חלב, לחם, גבינה..." : "e.g. milk, bread, cheese..."}
              placeholderTextColor="#B8B8C0"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (t.trim()) setShowError(false);
              }}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              returnKeyType="done"
              autoCorrect={false}
            />
            {showError && !name.trim() && (
              <Text style={[s.errorText, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "שדה חובה" : "Required field"}
              </Text>
            )}
          </View>

          {/* ── Qty + Unit ── */}
          <View style={s.fieldGroup}>
            <Text style={[s.fieldLabel, { textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "כמות ויחידה" : "Quantity & Unit"}
            </Text>
            <View style={[s.qtyUnitRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>

              {/* +/− Stepper */}
              <View style={[s.stepper, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                <TouchableOpacity
                  style={s.stepperBtn}
                  onPress={() => changeQty(-1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={s.stepperValue}>{qty}</Text>
                <TouchableOpacity
                  style={s.stepperBtn}
                  onPress={() => changeQty(1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Unit pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[
                  s.unitScroll,
                  { flexDirection: isHe ? "row-reverse" : "row" },
                ]}
                style={s.unitScrollContainer}
              >
                {units.map((u, idx) => {
                  const active = unit === u;
                  return (
                    <TouchableOpacity
                      key={`${u}-${idx}`}
                      style={[s.unitPill, active && s.unitPillActive]}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setUnit(active ? "" : u);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.unitText, active && s.unitTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* ── Preview line ── */}
          {canAdd && (
            <View style={[s.preview, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <Ionicons name="cart-outline" size={13} color={Colors.text.tertiary} />
              <Text style={[s.previewText, { textAlign: isHe ? "right" : "left" }]}>
                {[qty > 0 ? String(qty) : "", unit, name.trim()].filter(Boolean).join(" ")}
              </Text>
            </View>
          )}

          {/* ── Submit button ── */}
          <TouchableOpacity
            style={[s.addBtn, !canAdd && s.addBtnDisabled]}
            onPress={handleAdd}
            activeOpacity={canAdd ? 0.85 : 1}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={s.addBtnText}>{isHe ? "הוסף לרשימה" : "Add to list"}</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  kvWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 20,
  },

  // Drag handle — visible and centered
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DEDEDE",
    alignSelf: "center",
    marginBottom: 2,
  },

  // Header
  headerRow: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1A1A2E",
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F2F2F5",
    alignItems: "center",
    justifyContent: "center",
  },

  // Field groups
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8A8A9A",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  // Category pills
  categoryScroll: { gap: 8, paddingBottom: 2 },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    backgroundColor: "#fff",
  },
  catPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 13, fontWeight: "600", color: "#444" },
  catLabelActive: { color: "#fff" },

  // Name input
  nameInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "500",
    color: "#1A1A2E",
    backgroundColor: "#FAFAFA",
  },
  nameInputFocused: {
    borderColor: Colors.primary,
    backgroundColor: "#fff",
  },
  nameInputError: {
    borderColor: "#FF4757",
    backgroundColor: "#FFF5F5",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF4757",
    marginTop: -4,
  },

  // Qty + Unit row
  qtyUnitRow: {
    alignItems: "center",
    gap: 10,
  },

  // Stepper
  stepper: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA",
    overflow: "hidden",
  },
  stepperBtn: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF5F3",
  },
  stepperValue: {
    minWidth: 36,
    height: 44,
    lineHeight: 44,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A2E",
  },

  // Unit pills
  unitScrollContainer: { flex: 1 },
  unitScroll: { gap: 7, paddingBottom: 2 },
  unitPill: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  unitPillActive: {
    backgroundColor: Colors.primary + "18",
    borderColor: Colors.primary,
  },
  unitText: { fontSize: 13, fontWeight: "600", color: "#555" },
  unitTextActive: { color: Colors.primary },

  // Preview
  preview: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#F5F3EE",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E8E3",
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: "500",
  },

  // Submit
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  addBtnDisabled: {
    backgroundColor: "#CCCCCC",
    shadowOpacity: 0,
    elevation: 0,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
