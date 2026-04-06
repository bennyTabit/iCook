import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  getNotificationPrefs,
  saveNotificationPrefs,
  scheduleMealPlanReminders,
  cancelMealPlanReminders,
} from '../lib/notifications';

describe('notification preferences', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('returns defaults when no prefs saved', async () => {
    const prefs = await getNotificationPrefs();
    expect(prefs.enabled).toBe(false);
    expect(prefs.reminderHour).toBe(17);
    expect(prefs.reminderMinute).toBe(0);
  });

  it('persists and restores preferences', async () => {
    await saveNotificationPrefs({ enabled: true, reminderHour: 8, reminderMinute: 30 });
    const loaded = await getNotificationPrefs();
    expect(loaded.enabled).toBe(true);
    expect(loaded.reminderHour).toBe(8);
    expect(loaded.reminderMinute).toBe(30);
  });

  it('does not schedule when disabled', async () => {
    await scheduleMealPlanReminders({ enabled: false, reminderHour: 17, reminderMinute: 0 });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules notification when enabled and permission granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    await scheduleMealPlanReminders({ enabled: true, reminderHour: 17, reminderMinute: 0 });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: '🍳 iCook' }),
        trigger: expect.objectContaining({ hour: 17, minute: 0 }),
      }),
    );
  });

  it('cancels scheduled notifications', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
      { identifier: 'icook.meal.daily' },
      { identifier: 'other-app.notif' },
    ]);
    await cancelMealPlanReminders();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('icook.meal.daily');
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other-app.notif');
  });
});
