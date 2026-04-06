import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { useThemeColors } from "../hooks/useThemeColors";
import { isHebrew } from "../lib/i18n";
import { useAuthStore } from "../store/authStore";
import i18n from "../lib/i18n";
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  requestNotificationPermission,
  scheduleMealPlanReminders,
  cancelMealPlanReminders,
  type NotificationPrefs,
} from "../lib/notifications";

WebBrowser.maybeCompleteAuthSession();

type SettingRow = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value?: string;
  onPress: () => void;
  tint?: string;
  danger?: boolean;
};

export default function ProfileScreen() {
  const C = useThemeColors();
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { user, signInWithGoogle, signInWithApple, signOut, loading } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    enabled: false,
    reminderHour: 17,
    reminderMinute: 0,
  });

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const isGoogleConfigured = Boolean(googleClientId);

  if (!isGoogleConfigured) {
    console.warn(
      "[ProfileScreen] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. " +
      "Google Sign In will not work. Copy .env.example to .env and fill in the value."
    );
  }

  const [, response, promptAsync] = Google.useAuthRequest({
    clientId: googleClientId,
    redirectUri: makeRedirectUri(),
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    void getNotificationPrefs().then(setNotifPrefs);
  }, []);

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.authentication?.idToken;
    const accessToken = response.authentication?.accessToken;
    if (!idToken || !accessToken) return;
    setAuthLoading(true);
    signInWithGoogle(idToken, accessToken)
      .catch(console.error)
      .finally(() => setAuthLoading(false));
  }, [response]);

  async function handleGoogleSignIn() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await promptAsync();
  }

  async function handleAppleSignIn() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      setAuthLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const name =
        [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean)
          .join(" ") || null;

      await signInWithApple(credential.identityToken!, name, credential.email ?? null);
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") console.error(e);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    void Haptics.selectionAsync();
    await signOut();
  }

  async function handleToggleNotifications(value: boolean) {
    void Haptics.selectionAsync();
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          isHe ? "הרשאת התראות נדרשת" : "Notification permission required",
          isHe
            ? "כדי לקבל תזכורות, אפשר התראות בהגדרות המכשיר."
            : "To receive reminders, enable notifications in your device settings.",
          [{ text: isHe ? "אישור" : "OK" }],
        );
        return;
      }
    }
    const updated = { ...notifPrefs, enabled: value };
    setNotifPrefs(updated);
    await saveNotificationPrefs(updated);
    if (value) {
      await scheduleMealPlanReminders(updated);
    } else {
      await cancelMealPlanReminders();
    }
  }

  function handleChangeReminderTime() {
    // Cycle through common times: 07:00 → 12:00 → 17:00 → 19:00 → 07:00
    const times = [
      { h: 7, m: 0 },
      { h: 12, m: 0 },
      { h: 17, m: 0 },
      { h: 19, m: 0 },
    ];
    const cur = times.findIndex(
      (t) => t.h === notifPrefs.reminderHour && t.m === notifPrefs.reminderMinute,
    );
    const next = times[(cur + 1) % times.length];
    const updated = { ...notifPrefs, reminderHour: next.h, reminderMinute: next.m };
    setNotifPrefs(updated);
    void saveNotificationPrefs(updated);
    if (updated.enabled) void scheduleMealPlanReminders(updated);
  }

  function toggleLanguage() {
    void Haptics.selectionAsync();
    const next = isHe ? "en" : "he";
    void i18n.changeLanguage(next);
    void AsyncStorage.setItem("icook.lang", next);
    const needsRTLSwitch = (next === "he") !== I18nManager.isRTL;
    if (needsRTLSwitch) {
      I18nManager.forceRTL(next === "he");
      Alert.alert(
        next === "he" ? "נדרשת הפעלה מחדש" : "Restart required",
        next === "he"
          ? "כדי להפעיל את הפריסה מימין לשמאל, יש לסגור ולפתוח מחדש את האפליקציה."
          : "To apply the left-to-right layout, please close and reopen the app.",
        [{ text: next === "he" ? "אישור" : "OK" }],
      );
    }
  }

  // Apple only sends name/email on the first ever authorization.
  // Derive the best available label so we never show "Guest" to a signed-in user.
  const resolvedName: string | null = user
    ? user.displayName ??
      (user.email ? user.email.split("@")[0] : null) ??
      (user.provider === "apple"
        ? isHe ? "משתמש Apple" : "Apple User"
        : isHe ? "משתמש Google" : "Google User")
    : null;

  const avatarLetter =
    resolvedName?.[0]?.toUpperCase() ?? (isHe ? "א" : "A");

  const GENERAL_ROWS: SettingRow[] = [
    {
      icon: "language-outline",
      label: isHe ? "שפה" : "Language",
      value: isHe ? "עברית" : "English",
      onPress: toggleLanguage,
    },
    {
      icon: "sunny-outline",
      label: isHe ? "ערכת נושא" : "Theme",
      value: isHe ? "בהיר" : "Light",
      onPress: () => {},
    },
    {
      icon: "nutrition-outline",
      label: isHe ? "העדפות תזונה" : "Dietary",
      value: isHe ? "ללא הגבלה" : "No restriction",
      onPress: () => {},
    },
  ];

  const DATA_ROWS: SettingRow[] = [
    {
      icon: "cloud-upload-outline",
      label: isHe ? "גיבוי ענן" : "Cloud Backup",
      value: user ? (isHe ? "מסונכרן" : "Synced") : (isHe ? "לא מחובר" : "Not connected"),
      tint: user ? Colors.secondary : undefined,
      onPress: () => {},
    },
    {
      icon: "download-outline",
      label: isHe ? "ייצוא מתכונים" : "Export Recipes",
      onPress: () => {},
    },
  ];

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        {/* ── Hero banner ── */}
        <LinearGradient
          colors={C.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: insets.top + 20 }]}
        >
          {/* Avatar */}
          <View style={s.avatarRing}>
            <View
              style={[
                s.avatar,
                {
                  backgroundColor: user
                    ? user.provider === "google"
                      ? "#4285F4"
                      : "#1A1A1A"
                    : "rgba(255,255,255,0.3)",
                },
              ]}
            >
              <Text style={s.avatarText}>{avatarLetter}</Text>
            </View>
          </View>

          {/* Name + email */}
          <Text style={s.heroName} numberOfLines={1}>
            {resolvedName ?? (isHe ? "אורח" : "Guest")}
          </Text>
          <Text style={s.heroEmail} numberOfLines={1}>
            {user?.email ?? (user ? (isHe ? "מחובר" : "Signed in") : (isHe ? "לא מחובר" : "Not signed in"))}
          </Text>

          {/* Provider badge */}
          {user ? (
            <View style={s.providerBadge}>
              <Ionicons
                name={user.provider === "google" ? "logo-google" : "logo-apple"}
                size={12}
                color="rgba(255,255,255,0.9)"
              />
              <Text style={s.providerText}>
                {user.provider === "google" ? "Google" : "Apple"}
              </Text>
            </View>
          ) : null}

          {/* Wave bottom */}
          <View style={s.heroWave} />
        </LinearGradient>

        <View style={s.body}>
          {/* ── Sign-in card (guest only) ── */}
          {!user && (
            <View style={[s.signInCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View style={s.signInIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={28} color={Colors.primary} />
              </View>
              <Text style={[s.signInTitle, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "גבה את המתכונים שלך" : "Back up your recipes"}
              </Text>
              <Text style={[s.signInSub, { textAlign: isHe ? "right" : "left" }]}>
                {isHe
                  ? "התחבר כדי לשמור את המתכונים בענן ולגשת אליהם מכל מכשיר"
                  : "Sign in to save your recipes to the cloud and access them on any device"}
              </Text>

              {authLoading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: 8 }} />
              ) : (
                <View style={s.authBtns}>
                  {!isGoogleConfigured && (
                    <View style={s.configWarning}>
                      <Ionicons name="warning-outline" size={14} color={Colors.primary} />
                      <Text style={s.configWarningText}>
                        {isHe
                          ? "Google Sign In לא מוגדר — הוסף EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ל-.env"
                          : "Google Sign In not configured — add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to .env"}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[s.authBtn, { flexDirection: isHe ? "row-reverse" : "row" }, !isGoogleConfigured && s.authBtnDisabled]}
                    onPress={isGoogleConfigured ? handleGoogleSignIn : undefined}
                    activeOpacity={isGoogleConfigured ? 0.85 : 1}
                  >
                    <View style={s.authBtnIcon}>
                      <Ionicons name="logo-google" size={18} color="#4285F4" />
                    </View>
                    <Text style={s.authBtnText}>
                      {isHe ? "המשך עם Google" : "Continue with Google"}
                    </Text>
                    <Ionicons
                      name={isHe ? "chevron-back" : "chevron-forward"}
                      size={16}
                      color={Colors.text.tertiary}
                      style={{ marginStart: "auto" }}
                    />
                  </TouchableOpacity>

                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      style={[s.authBtn, s.authBtnApple, { flexDirection: isHe ? "row-reverse" : "row" }]}
                      onPress={handleAppleSignIn}
                      activeOpacity={0.85}
                    >
                      <View style={[s.authBtnIcon, s.authBtnIconDark]}>
                        <Ionicons name="logo-apple" size={18} color="#fff" />
                      </View>
                      <Text style={[s.authBtnText, { color: Colors.text.inverse }]}>
                        {isHe ? "המשך עם Apple" : "Continue with Apple"}
                      </Text>
                      <Ionicons
                        name={isHe ? "chevron-back" : "chevron-forward"}
                        size={16}
                        color="rgba(255,255,255,0.5)"
                        style={{ marginStart: "auto" }}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── General settings ── */}
          <View style={s.sectionGroup}>
            <Text style={[s.groupLabel, { textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "כללי" : "General"}
            </Text>
            <View style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              {GENERAL_ROWS.map((row, i) => (
                <TouchableOpacity
                  key={row.label}
                  style={[
                    s.row,
                    { flexDirection: isHe ? "row-reverse" : "row" },
                    i < GENERAL_ROWS.length - 1 && s.rowBorder,
                  ]}
                  onPress={row.onPress}
                  activeOpacity={0.65}
                >
                  <View style={[s.rowIconWrap, { backgroundColor: C.surface }]}>
                    <Ionicons name={row.icon} size={16} color={Colors.text.secondary} />
                  </View>
                  <Text style={[s.rowLabel, { flex: 1, textAlign: isHe ? "right" : "left" }]}>
                    {row.label}
                  </Text>
                  {row.value ? <Text style={s.rowValue}>{row.value}</Text> : null}
                  <Ionicons
                    name={isHe ? "chevron-back" : "chevron-forward"}
                    size={14}
                    color={Colors.text.tertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Notifications settings ── */}
          <View style={s.sectionGroup}>
            <Text style={[s.groupLabel, { textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "התראות" : "Notifications"}
            </Text>
            <View style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              {/* Toggle row */}
              <View style={[s.row, { flexDirection: isHe ? "row-reverse" : "row" }, s.rowBorder]}>
                <View style={[s.rowIconWrap, { backgroundColor: "#FFF0E8" }]}>
                  <Ionicons name="notifications-outline" size={16} color={Colors.primary} />
                </View>
                <Text style={[s.rowLabel, { flex: 1, textAlign: isHe ? "right" : "left" }]}>
                  {isHe ? "תזכורות יומיות" : "Daily reminders"}
                </Text>
                <Switch
                  value={notifPrefs.enabled}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
                  thumbColor={notifPrefs.enabled ? Colors.primary : Colors.text.tertiary}
                />
              </View>

              {/* Reminder time row — only shown when enabled */}
              {notifPrefs.enabled && (
                <TouchableOpacity
                  style={[s.row, { flexDirection: isHe ? "row-reverse" : "row" }]}
                  onPress={handleChangeReminderTime}
                  activeOpacity={0.65}
                >
                  <View style={[s.rowIconWrap, { backgroundColor: C.surface }]}>
                    <Ionicons name="time-outline" size={16} color={Colors.text.secondary} />
                  </View>
                  <Text style={[s.rowLabel, { flex: 1, textAlign: isHe ? "right" : "left" }]}>
                    {isHe ? "שעת תזכורת" : "Reminder time"}
                  </Text>
                  <Text style={s.rowValue}>
                    {String(notifPrefs.reminderHour).padStart(2, "0")}:
                    {String(notifPrefs.reminderMinute).padStart(2, "0")}
                  </Text>
                  <Ionicons
                    name={isHe ? "chevron-back" : "chevron-forward"}
                    size={14}
                    color={Colors.text.tertiary}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Data & Sync settings ── */}
          <View style={s.sectionGroup}>
            <Text style={[s.groupLabel, { textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "נתונים וסנכרון" : "Data & Sync"}
            </Text>
            <View style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              {DATA_ROWS.map((row, i) => (
                <TouchableOpacity
                  key={row.label}
                  style={[
                    s.row,
                    { flexDirection: isHe ? "row-reverse" : "row" },
                    i < DATA_ROWS.length - 1 && s.rowBorder,
                  ]}
                  onPress={row.onPress}
                  activeOpacity={0.65}
                >
                  <View
                    style={[
                      s.rowIconWrap,
                      { backgroundColor: row.tint ? row.tint + "20" : C.surface },
                    ]}
                  >
                    <Ionicons
                      name={row.icon}
                      size={16}
                      color={row.tint ?? Colors.text.secondary}
                    />
                  </View>
                  <Text style={[s.rowLabel, { flex: 1, textAlign: isHe ? "right" : "left" }]}>
                    {row.label}
                  </Text>
                  {row.value ? (
                    <Text style={[s.rowValue, row.tint ? { color: row.tint } : null]}>
                      {row.value}
                    </Text>
                  ) : null}
                  <Ionicons
                    name={isHe ? "chevron-back" : "chevron-forward"}
                    size={14}
                    color={Colors.text.tertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Sign out ── */}
          {user ? (
            <View style={s.sectionGroup}>
              <View style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                <TouchableOpacity
                  style={[s.row, { flexDirection: isHe ? "row-reverse" : "row" }]}
                  onPress={handleSignOut}
                  activeOpacity={0.65}
                >
                  <View style={[s.rowIconWrap, { backgroundColor: C.errorSurface }]}>
                    <Ionicons name="log-out-outline" size={16} color={Colors.error} />
                  </View>
                  <Text
                    style={[
                      s.rowLabel,
                      { flex: 1, color: Colors.error, textAlign: isHe ? "right" : "left" },
                    ]}
                  >
                    {isHe ? "התנתקות" : "Sign out"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* ── App version ── */}
          <Text style={s.version}>iCook v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Hero
  hero: {
    alignItems: "center",
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 32, color: Colors.text.inverse, fontWeight: "700" },
  heroName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text.inverse,
    letterSpacing: -0.3,
  },
  heroEmail: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 3,
  },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
  },
  providerText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.95)",
    fontWeight: "600",
  },
  heroWave: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 6 },

  // Sign-in card
  signInCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 10,
    marginBottom: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  signInIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.errorSurface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  signInTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  signInSub: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 19,
  },
  authBtns: { gap: 8, marginTop: 4 },
  authBtnDisabled: { opacity: 0.4 },
  configWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.errorSurface,
    borderRadius: 10,
    padding: 10,
    marginBottom: 4,
  },
  configWarningText: {
    fontSize: 11,
    color: Colors.primary,
    flex: 1,
  },
  authBtn: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  authBtnApple: {
    backgroundColor: "#1A1A1A",
    borderColor: "#1A1A1A",
  },
  authBtnIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  authBtnIconDark: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  authBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.primary,
  },

  // Section groups
  sectionGroup: { gap: 6 },
  groupLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    marginTop: 10,
  },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  row: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    backgroundColor: Colors.surfaceElevated,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 15, color: Colors.text.primary, fontWeight: "500" },
  rowValue: { fontSize: 13, color: Colors.text.tertiary, fontWeight: "500" },

  // Version
  version: {
    textAlign: "center",
    fontSize: 12,
    color: Colors.text.disabled,
    marginTop: 16,
    fontWeight: "500",
  },
});
