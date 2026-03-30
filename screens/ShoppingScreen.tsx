import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { isHebrew } from "../lib/i18n";
import { useShoppingStore } from "../store/shoppingStore";
import ShoppingItem from "../components/ShoppingItem";

export default function ShoppingScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { items, grouped, checkItem, removeItem, clearChecked, clearAll, addItem } =
    useShoppingStore();
  const checkedCount = items.filter((i) => i.checked).length;

  const [inputText, setInputText] = useState("");

  function handleAddItem() {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem(trimmed);
    setInputText("");
  }

  return (
    <SafeAreaView style={s.container} edges={["left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={88}
      >
        {/* Header */}
        <View style={[s.header, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          <Text style={s.headerTitle}>{t("shoppingList")}</Text>
          <View style={[s.headerBtns, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            {checkedCount > 0 && (
              <TouchableOpacity
                onPress={() => {
                  void Haptics.selectionAsync();
                  clearChecked();
                }}
              >
                <Text style={s.clearBtn}>
                  {isHe ? `נקה (${checkedCount})` : `Clear (${checkedCount})`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                void Haptics.selectionAsync();
                navigation.navigate("Search");
              }}
            >
              <View style={s.browseBtn}>
                <Ionicons name="search" size={13} color="#fff" />
                <Text style={s.browseBtnText}>
                  {isHe ? "בחר מתכון" : "Browse recipes"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* List */}
        {items.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 44 }}>🛒</Text>
            <Text style={s.emptyTitle}>{t("noItems")}</Text>
            <Text style={s.emptySub}>
              {isHe
                ? "הוסף פריטים ידנית או דרך מתכון"
                : "Add items below or from a recipe"}
            </Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => {
                void Haptics.selectionAsync();
                navigation.navigate("Search");
              }}
            >
              <Ionicons name="book-outline" size={15} color="#fff" style={{ marginRight: 6 }} />
              <Text style={s.emptyBtnText}>
                {isHe ? "בחר מתכון" : "Browse recipes"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {Object.entries(grouped).map(([cat, catItems]) => (
              <View key={cat}>
                <Text style={[s.catHeader, { textAlign: isHe ? "right" : "left" }]}>
                  {cat}
                </Text>
                {(catItems as any[]).map((item: any) => (
                  <ShoppingItem
                    key={item.id}
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
                  />
                ))}
              </View>
            ))}
            {items.length > 0 && (
              <TouchableOpacity
                style={s.clearAllBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  clearAll();
                }}
              >
                <Text style={s.clearAllText}>
                  {isHe ? "נקה רשימה" : "Clear list"}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* Manual add input */}
        <View style={[s.inputBar, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          <TextInput
            style={[s.input, { textAlign: isHe ? "right" : "left" }]}
            placeholder={isHe ? "הוסף פריט..." : "Add item..."}
            placeholderTextColor={Colors.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[s.addBtn, !inputText.trim() && s.addBtnDisabled]}
            onPress={handleAddItem}
            disabled={!inputText.trim()}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 0.5,
    borderColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "500", color: Colors.text.primary },
  headerBtns: { gap: 10, alignItems: "center" },
  clearBtn: { fontSize: 12, color: Colors.primary },
  browseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  browseBtnText: { color: "#fff", fontSize: 12, fontWeight: "500" },
  catHeader: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
  },
  emptyTitle: { fontSize: 16, fontWeight: "500", color: Colors.text.secondary },
  emptySub: { fontSize: 13, color: Colors.text.tertiary, textAlign: "center" },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 6,
  },
  emptyBtnText: { color: "#fff", fontWeight: "500" },
  clearAllBtn: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  clearAllText: { color: Colors.primary, fontWeight: "500", fontSize: 13 },
  inputBar: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.text.primary,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnDisabled: {
    backgroundColor: Colors.text.tertiary,
  },
});
