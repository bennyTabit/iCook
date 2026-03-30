import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { isHebrew } from "../lib/i18n";
import { useAuthStore } from "../store/authStore";
import i18n from "../lib/i18n";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { user, signOut } = useAuthStore();

  function toggleLanguage() {
    const next = isHe ? "en" : "he";
    i18n.changeLanguage(next);
    I18nManager.forceRTL(next === "he");
  }

  const ROWS = [
    {
      icon: "🌐",
      label: t("language"),
      value: isHe ? "עברית" : "English",
      onPress: toggleLanguage,
    },
    {
      icon: "☀️",
      label: t("theme"),
      value: isHe ? "בהיר" : "Light",
      onPress: () => {},
    },
    {
      icon: "☁️",
      label: t("backup"),
      value: isHe ? "לא מסונכרן" : "Not synced",
      onPress: () => {},
    },
    {
      icon: "📷",
      label: t("permissions"),
      value: isHe ? "מצלמה, גלריה" : "Camera, Gallery",
      onPress: () => {},
    },
    {
      icon: "🥗",
      label: t("dietary"),
      value: isHe ? "ללא הגבלה" : "No restriction",
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={s.container} edges={["left", "right"]}>
      {/* User card */}
      <View style={s.userCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {user
              ? (user.displayName?.[0]?.toUpperCase() ?? "?")
              : isHe
                ? "א"
                : "A"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.userName, { textAlign: isHe ? "right" : "left" }]}>
            {user?.displayName ?? (isHe ? "אורח" : "Guest")}
          </Text>
          <Text style={[s.userEmail, { textAlign: isHe ? "right" : "left" }]}>
            {user?.email ?? (isHe ? "לא מחובר" : "Not signed in")}
          </Text>
        </View>
      </View>

      {/* Settings rows */}
      <View style={s.section}>
        {ROWS.map((row, i) => (
          <TouchableOpacity
            key={row.label}
            style={[
              s.row,
              i < ROWS.length - 1 && s.rowBorder,
              { flexDirection: isHe ? "row-reverse" : "row" },
            ]}
            onPress={row.onPress}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 18, width: 28 }}>{row.icon}</Text>
            <Text
              style={[
                s.rowLabel,
                { flex: 1, textAlign: isHe ? "right" : "left" },
              ]}
            >
              {row.label}
            </Text>
            <Text style={s.rowValue}>{row.value} ›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Auth */}
      <View style={s.section}>
        {user ? (
          <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
            <Text style={s.signOutText}>{t("signOut")}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.signInCard}>
            <Text
              style={[s.signInTitle, { textAlign: isHe ? "right" : "left" }]}
            >
              {t("signIn")}
            </Text>
            <Text style={[s.signInSub, { textAlign: isHe ? "right" : "left" }]}>
              {t("signInSub")}
            </Text>
            {[
              { key: "google", label: t("withGoogle") },
              { key: "apple", label: t("withApple") },
              { key: "phone", label: t("withPhone") },
            ].map((opt) => (
              <TouchableOpacity key={opt.key} style={s.authBtn}>
                <Text style={s.authBtnText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    margin: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, color: "#fff", fontWeight: "500" },
  userName: { fontSize: 16, fontWeight: "500", color: Colors.text.primary },
  userEmail: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  row: { alignItems: "center", padding: 14, gap: 10 },
  rowBorder: { borderBottomWidth: 0.5, borderColor: Colors.border },
  rowLabel: { fontSize: 13, color: Colors.text.primary },
  rowValue: { fontSize: 12, color: Colors.text.secondary },
  signOutBtn: { padding: 14, alignItems: "center" },
  signOutText: { fontSize: 14, color: Colors.primary, fontWeight: "500" },
  signInCard: { padding: 16, gap: 10 },
  signInTitle: { fontSize: 15, fontWeight: "500", color: Colors.text.primary },
  signInSub: { fontSize: 12, color: Colors.text.secondary, marginBottom: 4 },
  authBtn: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  authBtnText: { fontSize: 13, fontWeight: "500", color: Colors.text.primary },
});
