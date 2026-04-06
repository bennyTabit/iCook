/**
 * lib/notifications.ts
 *
 * Notification helpers for iCook:
 *   - requestPermissions()         → ask iOS/Android for notification permission
 *   - scheduleMealPlanReminders()  → daily "what are you cooking tonight?" at user's chosen time
 *   - cancelMealPlanReminders()    → cancel all iCook notifications
 *   - getNotificationSettings()    → read stored preferences from AsyncStorage
 *   - saveNotificationSettings()   → persist preferences
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ── Constants ─────────────────────────────────────────────────────────────────

const PREF_KEY = 'icook.notifications';
const MEAL_REMINDER_ID_PREFIX = 'icook.meal.';

export interface NotificationPrefs {
  enabled: boolean;
  /** 0-23 */
  reminderHour: number;
  /** 0-59 */
  reminderMinute: number;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  reminderHour: 17,
  reminderMinute: 0,
};

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ── Permission ────────────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (existing.canAskAgain === false) return false;

  const { granted } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: false,
      allowBadge: false,
    },
  });
  return granted;
}

export async function checkNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

// ── Preferences ───────────────────────────────────────────────────────────────

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}

// ── Scheduling ────────────────────────────────────────────────────────────────

/**
 * Schedule a daily meal-plan reminder at the user's chosen time.
 * Cancels any previously scheduled iCook reminders first.
 */
export async function scheduleMealPlanReminders(prefs: NotificationPrefs): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelMealPlanReminders();
  if (!prefs.enabled) return;

  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${MEAL_REMINDER_ID_PREFIX}daily`,
    content: {
      title: '🍳 iCook',
      body: prefs.reminderHour < 12
        ? 'מה מתכננים לבשל היום? 🥗'
        : 'מה לבשל הערב? 🍲',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: prefs.reminderHour,
      minute: prefs.reminderMinute,
    },
  });
}

export async function cancelMealPlanReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter((n) =>
      n.identifier.startsWith(MEAL_REMINDER_ID_PREFIX),
    );
    await Promise.all(ours.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // silently ignore — app still works without notifications
  }
}

/**
 * Apply saved preferences at app boot (reschedule if enabled).
 */
export async function applyNotificationPrefsOnBoot(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const prefs = await getNotificationPrefs();
    if (prefs.enabled) {
      const hasPermission = await checkNotificationPermission();
      if (hasPermission) {
        await scheduleMealPlanReminders(prefs);
      } else {
        // Permission was revoked — disable silently
        await saveNotificationPrefs({ ...prefs, enabled: false });
      }
    }
  } catch {
    // non-fatal
  }
}
