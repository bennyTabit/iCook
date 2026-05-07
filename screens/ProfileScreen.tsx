import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenHeader from "../components/ScreenHeader";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { useThemeColors } from "../hooks/useThemeColors";
import { useThemeStore, type ThemePreference } from "../store/themeStore";
import { useSettingsStore } from "../store/settingsStore";
import { isHebrew } from "../lib/i18n";
import { useAuthStore } from "../store/authStore";
import { useRecipeStore } from "../store/recipeStore";
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

// ── Dietary chip definitions ──────────────────────────────────────────────────
type DietaryTag = "vegan" | "dairy-free" | "gluten-free" | "nut-free" | "meat";
const DIETARY_CHIPS: { tag: DietaryTag; emoji: string; labelHe: string; labelEn: string }[] = [
  { tag: "vegan",       emoji: "🌱", labelHe: "טבעוני",    labelEn: "Vegan" },
  { tag: "dairy-free",  emoji: "🥛", labelHe: "ללא חלב",   labelEn: "Dairy-free" },
  { tag: "gluten-free", emoji: "🌾", labelHe: "ללא גלוטן", labelEn: "Gluten-free" },
  { tag: "nut-free",    emoji: "🥜", labelHe: "ללא אגוזים",labelEn: "Nut-free" },
  { tag: "meat",        emoji: "🥩", labelHe: "בשרי",      labelEn: "Meat" },
];

// ── Theme preference cycle ────────────────────────────────────────────────────
const THEME_CYCLE: ThemePreference[] = ["system", "light", "dark"];
const THEME_ICON: Record<ThemePreference, React.ComponentProps<typeof Ionicons>["name"]> = {
  system: "phone-portrait-outline",
  light:  "sunny-outline",
  dark:   "moon-outline",
};
const THEME_LABEL_HE: Record<ThemePreference, string> = {
  system: "לפי מכשיר",
  light:  "בהיר",
  dark:   "כהה",
};
const THEME_LABEL_EN: Record<ThemePreference, string> = {
  system: "System",
  light:  "Light",
  dark:   "Dark",
};

// ── Row type ──────────────────────────────────────────────────────────────────
type SettingRow = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sub?: string;
  value?: string;
  onPress: () => void;
  tint?: string;          // icon & background accent colour
  noChevron?: boolean;    // hide the trailing chevron (e.g. version row)
  danger?: boolean;       // red label
};

export default function ProfileScreen() {
  const C = useThemeColors();
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { user, signInWithGoogle, signInWithApple, signOut, loading } = useAuthStore();
  const [authLoading, setAuthLoading] = useState(false);

  // Recipe stats from store
  const { recipes } = useRecipeStore();
  const totalRecipes   = recipes.length;
  const favoriteCount  = recipes.filter(r => r.is_favorite === 1).length;

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    enabled: false,
    reminderHour: 17,
    reminderMinute: 0,
  });

  // Theme preference
  const { preference: themePreference, setPreference: setThemePreference } = useThemeStore();

  // Dietary preferences
  const [dietaryTags, setDietaryTags] = useState<DietaryTag[]>([]);
  const [showDietary, setShowDietary] = useState(false);

  // Feature flags
  const { nutritionEnabled, setNutritionEnabled } = useSettingsStore();

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

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    void getNotificationPrefs().then(setNotifPrefs);
    AsyncStorage.getItem("icook.prefs.dietary").then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as DietaryTag[];
          setDietaryTags(parsed);
        } catch { /* ignore corrupt data */ }
      }
    });
  }, []);

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken     = response.authentication?.idToken;
    const accessToken = response.authentication?.accessToken;
    if (!idToken || !accessToken) return;
    setAuthLoading(true);
    signInWithGoogle(idToken, accessToken)
      .catch(console.error)
      .finally(() => setAuthLoading(false));
  }, [response]);

  // ── Auth handlers ──────────────────────────────────────────────────────────
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
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED") console.error(e);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    void Haptics.selectionAsync();
    await signOut();
  }

  // ── Notification handlers ──────────────────────────────────────────────────
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
    if (value) await scheduleMealPlanReminders(updated);
    else await cancelMealPlanReminders();
  }

  function handleChangeReminderTime() {
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

  // ── Theme handler ──────────────────────────────────────────────────────────
  function handleCycleTheme() {
    void Haptics.selectionAsync();
    const cur = THEME_CYCLE.indexOf(themePreference);
    const next = THEME_CYCLE[(cur + 1) % THEME_CYCLE.length];
    void setThemePreference(next);
  }

  // ── Language handler ───────────────────────────────────────────────────────
  async function toggleLanguage() {
    void Haptics.selectionAsync();
    const next = isHe ? "en" : "he";
    await i18n.changeLanguage(next);
    await AsyncStorage.setItem("icook.lang", next);
  }

  // ── Dietary handlers ───────────────────────────────────────────────────────
  async function toggleDietaryTag(tag: DietaryTag) {
    void Haptics.selectionAsync();
    const updated = dietaryTags.includes(tag)
      ? dietaryTags.filter((t) => t !== tag)
      : [...dietaryTags, tag];
    setDietaryTags(updated);
    await AsyncStorage.setItem("icook.prefs.dietary", JSON.stringify(updated));
  }

  function dietaryLabel() {
    if (dietaryTags.length === 0) return isHe ? "ללא הגבלה" : "No restriction";
    return dietaryTags
      .map((tag) => {
        const chip = DIETARY_CHIPS.find((c) => c.tag === tag);
        return chip ? (isHe ? chip.labelHe : chip.labelEn) : tag;
      })
      .join(", ");
  }

  // ── Share handler ──────────────────────────────────────────────────────────
  async function handleShare() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: isHe
        ? "אני משתמש ב-iCook לשמירת המתכונים שלי 🍳\nנסה גם אתה!"
        : "I use iCook to keep all my recipes in one place 🍳\nCheck it out!",
    });
  }

  // ── Name / avatar ──────────────────────────────────────────────────────────
  const resolvedName: string | null = user
    ? user.displayName ??
      (user.email ? user.email.split("@")[0] : null) ??
      (user.provider === "apple"
        ? isHe ? "משתמש Apple" : "Apple User"
        : isHe ? "משתמש Google" : "Google User")
    : null;

  const avatarLetter = resolvedName?.[0]?.toUpperCase() ?? (isHe ? "א" : "A");

  // ── Row definitions ────────────────────────────────────────────────────────
  const GENERAL_ROWS: SettingRow[] = [
    {
      icon: "language-outline",
      label: isHe ? "שפה" : "Language",
      value: isHe ? "עברית" : "English",
      onPress: toggleLanguage,
      tint: "#007AFF",
    },
    {
      icon: THEME_ICON[themePreference],
      label: isHe ? "ערכת נושא" : "Theme",
      value: isHe ? THEME_LABEL_HE[themePreference] : THEME_LABEL_EN[themePreference],
      onPress: handleCycleTheme,
      tint: "#8B5CF6",
    },
    {
      icon: "leaf-outline",
      label: isHe ? "העדפות תזונה" : "Dietary",
      value: dietaryLabel(),
      onPress: () => setShowDietary(true),
      tint: "#34C759",
    },
  ];

  const DATA_ROWS: SettingRow[] = [
    {
      icon: "cloud-upload-outline",
      label: isHe ? "גיבוי ענן" : "Cloud Backup",
      value: user ? (isHe ? "מסונכרן" : "Synced") : (isHe ? "לא מחובר" : "Not connected"),
      tint: user ? Colors.secondary : "#8E8E93",
      onPress: () => {},
    },
    {
      icon: "download-outline",
      label: isHe ? "ייצוא מתכונים" : "Export Recipes",
      onPress: () => {},
      tint: "#5856D6",
    },
  ];

  const ABOUT_ROWS: SettingRow[] = [
    {
      icon: "star-outline",
      label: isHe ? "דרג את iCook" : "Rate iCook",
      onPress: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert(
          isHe ? "תודה על התמיכה! ⭐" : "Thanks for your support! ⭐",
          isHe ? "הדירוג יהיה זמין בקרוב" : "Rating will be available soon",
          [{ text: isHe ? "אישור" : "OK" }],
        );
      },
      tint: "#FF9500",
    },
    {
      icon: "share-social-outline",
      label: isHe ? "שתף עם חברים" : "Share with Friends",
      onPress: handleShare,
      tint: "#34C759",
    },
    {
      icon: "lock-closed-outline",
      label: isHe ? "מדיניות פרטיות" : "Privacy Policy",
      onPress: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void WebBrowser.openBrowserAsync("https://icook.app/privacy");
      },
      tint: "#8E8E93",
    },
    {
      icon: "information-circle-outline",
      label: isHe ? "גרסה" : "Version",
      value: "1.0.0",
      onPress: () => {},
      tint: "#8E8E93",
      noChevron: true,
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
      {/* ── Header (non-scrollable) ── */}
      <ScreenHeader
        title={resolvedName ?? (isHe ? "אורח" : "Guest")}
        subtitle={user?.email ?? (user
          ? (isHe ? "מחובר" : "Signed in")
          : (isHe ? "לא מחובר — התחבר לגיבוי בענן" : "Not signed in — sign in to back up"))}
        rightAction={
          <View style={[s.avatarRing, { borderColor: C.border }]}>
            <View
              style={[
                s.avatar,
                {
                  backgroundColor: user
                    ? user.provider === "google" ? "#4285F4" : "#1A1A1A"
                    : C.surfaceElevated,
                },
              ]}
            >
              <Text style={[s.avatarText, { color: user ? Colors.text.inverse : C.text.tertiary }]}>
                {avatarLetter}
              </Text>
            </View>
          </View>
        }
      >
        {/* ── Stats strip ── */}
        {totalRecipes > 0 && (
          <View style={[s.statsStrip, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <View style={[s.statPill, { backgroundColor: Colors.primary + "14", borderColor: Colors.primary + "30" }]}>
              <Text style={[s.statNum, { color: Colors.primary }]}>{totalRecipes}</Text>
              <Text style={[s.statLabel, { color: Colors.primary + "CC" }]}>
                {isHe ? "מתכונים" : "Recipes"}
              </Text>
            </View>
            <View style={[s.statPill, { backgroundColor: "#FF6B6B14", borderColor: "#FF6B6B30" }]}>
              <Text style={[s.statNum, { color: "#E85555" }]}>{favoriteCount}</Text>
              <Text style={[s.statLabel, { color: "#E85555CC" }]}>
                {isHe ? "מועדפים" : "Favorites"}
              </Text>
            </View>
            {user && (
              <View style={[s.statPill, { backgroundColor: Colors.secondary + "14", borderColor: Colors.secondary + "30" }]}>
                <Ionicons name="cloud-done-outline" size={16} color={Colors.secondary} />
                <Text style={[s.statLabel, { color: Colors.secondary + "CC", marginTop: 1 }]}>
                  {isHe ? "מסונכרן" : "Synced"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Provider badge ── */}
        {user && (
          <View style={[s.providerBadge, { backgroundColor: C.surfaceElevated, borderWidth: 1, borderColor: C.border, alignSelf: isHe ? "flex-end" : "flex-start", marginTop: totalRecipes > 0 ? 6 : 0 }]}>
            <Ionicons
              name={user.provider === "google" ? "logo-google" : "logo-apple"}
              size={12}
              color={C.text.secondary}
            />
            <Text style={[s.providerText, { color: C.text.secondary }]}>
              {user.provider === "google" ? "Google" : "Apple"}
            </Text>
          </View>
        )}
      </ScreenHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        <View style={s.body}>
          {/* ── Sign-in card (guest only) ── */}
          {!user && (
            <View style={[s.signInCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View style={s.signInIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={28} color={Colors.primary} />
              </View>
              <Text style={[s.signInTitle, { color: C.text.primary, textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "גבה את המתכונים שלך" : "Back up your recipes"}
              </Text>
              <Text style={[s.signInSub, { color: C.text.secondary, textAlign: isHe ? "right" : "left" }]}>
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
                    style={[
                      s.authBtn,
                      { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: C.surface, borderColor: C.border },
                      !isGoogleConfigured && s.authBtnDisabled,
                    ]}
                    onPress={isGoogleConfigured ? handleGoogleSignIn : undefined}
                    activeOpacity={isGoogleConfigured ? 0.85 : 1}
                  >
                    <View style={[s.authBtnIcon, { backgroundColor: C.surfaceElevated }]}>
                      <Ionicons name="logo-google" size={18} color="#4285F4" />
                    </View>
                    <Text style={[s.authBtnText, { color: C.text.primary }]}>
                      {isHe ? "המשך עם Google" : "Continue with Google"}
                    </Text>
                    <Ionicons
                      name={isHe ? "chevron-back" : "chevron-forward"}
                      size={16}
                      color={C.text.tertiary}
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
          <SectionGroup label={isHe ? "כללי" : "General"} isHe={isHe} C={C}>
            <SettingCard rows={GENERAL_ROWS} isHe={isHe} C={C} />
          </SectionGroup>

          {/* ── Notifications ── */}
          <SectionGroup label={isHe ? "התראות" : "Notifications"} isHe={isHe} C={C}>
            <View style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              {/* Toggle row */}
              <View style={[
                s.row,
                { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: C.surfaceElevated },
                s.rowBorder,
                { borderBottomColor: C.border },
              ]}>
                <View style={[s.rowIconWrap, { backgroundColor: "#FF6B6B18" }]}>
                  <Ionicons name="notifications-outline" size={16} color={Colors.primary} />
                </View>
                <Text style={[s.rowLabel, { flex: 1, color: C.text.primary, textAlign: isHe ? "right" : "left" }]}>
                  {isHe ? "תזכורות יומיות" : "Daily reminders"}
                </Text>
                <Switch
                  value={notifPrefs.enabled}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: C.border, true: Colors.primary + "80" }}
                  thumbColor={notifPrefs.enabled ? Colors.primary : C.text.tertiary}
                />
              </View>
              {/* Time row — only visible when enabled */}
              {notifPrefs.enabled && (
                <TouchableOpacity
                  style={[s.row, { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: C.surfaceElevated }]}
                  onPress={handleChangeReminderTime}
                  activeOpacity={0.65}
                >
                  <View style={[s.rowIconWrap, { backgroundColor: "#FF950018" }]}>
                    <Ionicons name="time-outline" size={16} color="#FF9500" />
                  </View>
                  <Text style={[s.rowLabel, { flex: 1, color: C.text.primary, textAlign: isHe ? "right" : "left" }]}>
                    {isHe ? "שעת תזכורת" : "Reminder time"}
                  </Text>
                  <Text style={[s.rowValue, { color: C.text.tertiary }]}>
                    {String(notifPrefs.reminderHour).padStart(2, "0")}:
                    {String(notifPrefs.reminderMinute).padStart(2, "0")}
                  </Text>
                  <Ionicons
                    name={isHe ? "chevron-back" : "chevron-forward"}
                    size={14}
                    color={C.text.tertiary}
                  />
                </TouchableOpacity>
              )}
            </View>
          </SectionGroup>

          {/* ── Premium Features ── */}
          <View style={s.sectionGroup}>
            <View style={[{ flexDirection: isHe ? "row-reverse" : "row", alignItems: "center", gap: 6, marginBottom: 8 }]}>
              <Text style={[s.groupLabel, { color: C.text.tertiary, marginBottom: 0 }]}>
                {isHe ? "תכונות פרמיום" : "Premium Features"}
              </Text>
              <View style={s.premiumBadge}>
                <Text style={s.premiumBadgeText}>✨ {isHe ? "בקרוב" : "Soon"}</Text>
              </View>
            </View>
            <View style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View style={[s.row, { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: C.surfaceElevated }]}>
                <View style={[s.rowIconWrap, { backgroundColor: "#34C75918" }]}>
                  <Ionicons name="bar-chart-outline" size={16} color="#34C759" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[s.rowLabel, { color: C.text.primary, textAlign: isHe ? "right" : "left" }]}>
                    {isHe ? "ניתוח ערכי תזונה" : "Nutrition Analysis"}
                  </Text>
                  <Text style={[s.rowSub, { color: C.text.tertiary, textAlign: isHe ? "right" : "left" }]}>
                    {isHe ? "חישוב קלוריות ומאקרו עם AI" : "AI-powered calorie & macro breakdown"}
                  </Text>
                </View>
                <Switch
                  value={nutritionEnabled}
                  onValueChange={(val) => {
                    void Haptics.selectionAsync();
                    void setNutritionEnabled(val);
                  }}
                  trackColor={{ false: C.border, true: "#34C75980" }}
                  thumbColor={nutritionEnabled ? "#34C759" : C.text.tertiary}
                />
              </View>
            </View>
          </View>

          {/* ── Data & Sync ── */}
          <SectionGroup label={isHe ? "נתונים וסנכרון" : "Data & Sync"} isHe={isHe} C={C}>
            <SettingCard rows={DATA_ROWS} isHe={isHe} C={C} />
          </SectionGroup>

          {/* ── About & Support ── */}
          <SectionGroup label={isHe ? "עוד" : "About & Support"} isHe={isHe} C={C}>
            <SettingCard rows={ABOUT_ROWS} isHe={isHe} C={C} />
          </SectionGroup>

          {/* ── Sign out ── */}
          {user && (
            <View style={[s.sectionGroup, { marginTop: 4 }]}>
              <View style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
                <TouchableOpacity
                  style={[s.row, { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: C.surfaceElevated }]}
                  onPress={handleSignOut}
                  activeOpacity={0.65}
                >
                  <View style={[s.rowIconWrap, { backgroundColor: C.errorSurface }]}>
                    <Ionicons name="log-out-outline" size={16} color={Colors.error} />
                  </View>
                  <Text style={[s.rowLabel, { flex: 1, color: Colors.error, textAlign: isHe ? "right" : "left" }]}>
                    {isHe ? "התנתקות" : "Sign out"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Dietary preferences modal ── */}
      <Modal
        visible={showDietary}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDietary(false)}
      >
        <TouchableOpacity
          style={s.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowDietary(false)}
        />
        <View style={[s.dietarySheet, { backgroundColor: C.surfaceElevated }]}>
          <View style={[s.sheetHandle, { backgroundColor: C.border }]} />
          <Text style={[s.sheetTitle, { color: C.text.primary }]}>
            {isHe ? "העדפות תזונה" : "Dietary preferences"}
          </Text>
          <Text style={[s.sheetSub, { color: C.text.secondary }]}>
            {isHe ? "בחר את ההגבלות שלך (לא חובה)" : "Select your restrictions (optional)"}
          </Text>
          <View style={s.chipGrid}>
            {DIETARY_CHIPS.map((chip) => {
              const active = dietaryTags.includes(chip.tag);
              return (
                <TouchableOpacity
                  key={chip.tag}
                  style={[
                    s.dietChip,
                    { borderColor: active ? Colors.primary : C.border, backgroundColor: active ? Colors.primary + "18" : C.surface },
                  ]}
                  onPress={() => toggleDietaryTag(chip.tag)}
                  activeOpacity={0.7}
                >
                  <Text style={s.chipEmoji}>{chip.emoji}</Text>
                  <Text style={[s.chipLabel, { color: active ? Colors.primary : C.text.secondary }]}>
                    {isHe ? chip.labelHe : chip.labelEn}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark-circle" size={16} color={Colors.primary} style={{ marginStart: 4 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[s.sheetDone, { backgroundColor: Colors.primary }]}
            onPress={() => setShowDietary(false)}
          >
            <Text style={s.sheetDoneText}>{isHe ? "סיום" : "Done"}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────

type ThemeColors = ReturnType<typeof useThemeColors>;

function SectionGroup({
  label,
  isHe,
  C,
  children,
}: {
  label: string;
  isHe: boolean;
  C: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View style={s.sectionGroup}>
      <Text style={[s.groupLabel, { color: C.text.tertiary, textAlign: isHe ? "right" : "left" }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function SettingCard({
  rows,
  isHe,
  C,
}: {
  rows: SettingRow[];
  isHe: boolean;
  C: ThemeColors;
}) {
  return (
    <View style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
      {rows.map((row, i) => (
        <TouchableOpacity
          key={row.label}
          style={[
            s.row,
            { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: C.surfaceElevated },
            i < rows.length - 1 && [s.rowBorder, { borderBottomColor: C.border }],
          ]}
          onPress={row.onPress}
          activeOpacity={row.noChevron ? 1 : 0.65}
        >
          {/* Coloured icon box */}
          <View style={[
            s.rowIconWrap,
            { backgroundColor: row.tint ? row.tint + "18" : C.surface },
          ]}>
            <Ionicons name={row.icon} size={16} color={row.tint ?? C.text.secondary} />
          </View>

          {/* Label + optional sub */}
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={[
              s.rowLabel,
              { color: row.danger ? Colors.error : C.text.primary, textAlign: isHe ? "right" : "left" },
            ]}>
              {row.label}
            </Text>
            {row.sub ? (
              <Text style={[s.rowSub, { color: C.text.tertiary, textAlign: isHe ? "right" : "left" }]}>
                {row.sub}
              </Text>
            ) : null}
          </View>

          {/* Trailing value + chevron */}
          {row.value ? (
            <Text style={[s.rowValue, { color: C.text.tertiary }]}>{row.value}</Text>
          ) : null}
          {!row.noChevron && (
            <Ionicons
              name={isHe ? "chevron-back" : "chevron-forward"}
              size={14}
              color={C.text.tertiary}
            />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Avatar
  avatarRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700" },

  // Stats strip (in header)
  statsStrip: {
    gap: 8,
    marginTop: 4,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  statNum: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  statLabel: { fontSize: 12, fontWeight: "600" },

  // Provider badge
  providerBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  providerText: { fontSize: 12, fontWeight: "600" },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 6 },

  // Sign-in card
  signInCard: {
    borderRadius: 20, borderWidth: 1, padding: 20, gap: 10, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  signInIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#FFF0E8",
    alignItems: "center", justifyContent: "center", marginBottom: 2,
  },
  signInTitle: { fontSize: 17, fontWeight: "700" },
  signInSub: { fontSize: 13, lineHeight: 19 },
  authBtns: { gap: 8, marginTop: 4 },
  authBtnDisabled: { opacity: 0.4 },
  configWarning: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.errorSurface, borderRadius: 10, padding: 10, marginBottom: 4,
  },
  configWarningText: { fontSize: 11, color: Colors.primary, flex: 1 },
  authBtn: {
    alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1,
  },
  authBtnApple: { backgroundColor: "#1A1A1A", borderColor: "#1A1A1A" },
  authBtnIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  authBtnIconDark: { backgroundColor: "rgba(255,255,255,0.15)" },
  authBtnText: { fontSize: 15, fontWeight: "600" },

  // Section groups
  sectionGroup: { gap: 6 },
  groupLabel: {
    fontSize: 11, fontWeight: "600", letterSpacing: 0.6,
    textTransform: "uppercase", paddingHorizontal: 4, marginTop: 12, marginBottom: 2,
  },
  card: {
    borderRadius: 16, borderWidth: 1, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  row: { alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  rowIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontWeight: "500" },
  rowValue: { fontSize: 13, fontWeight: "500" },
  rowSub: { fontSize: 12, fontWeight: "400" },

  // Premium badge
  premiumBadge: {
    backgroundColor: "#FFF3E0",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  premiumBadgeText: { fontSize: 11, fontWeight: "700", color: "#E65100" },

  // Dietary modal
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  dietarySheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, gap: 12,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  sheetSub: { fontSize: 13, textAlign: "center", marginBottom: 4 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  dietChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, borderWidth: 1.5,
  },
  chipEmoji: { fontSize: 18 },
  chipLabel: { fontSize: 14, fontWeight: "600" },
  sheetDone: {
    marginTop: 6, borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
  },
  sheetDoneText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
