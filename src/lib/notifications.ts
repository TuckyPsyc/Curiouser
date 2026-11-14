import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const REMINDER_HOUR = 7;
export const REMINDER_MINUTE = 0;
const PREF_KEY = 'reminder-enabled';
const CHANNEL_ID = 'before-breakfast';

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function getReminderPref(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PREF_KEY);
    return v !== 'off';
  } catch {
    return true;
  }
}

async function schedule(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    // Worded to be true on any morning. The reminder is scheduled on the phone and
    // can't know whether today's story was released; on a morning it was held or
    // left unchecked, readers see the previous one (D-012).
    content: {
      title: 'Time for Before Breakfast',
      body: "Oh dear! Oh dear! Don't be late. Come and see what's on the page this morning, with a rabbit hole if you're hungry for more.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      channelId: CHANNEL_ID,
    },
  });
}

/** Turns the 7am reminder on or off. Returns whether it ended up on. */
export async function setReminder(on: boolean): Promise<boolean> {
  if (!supported) return false;
  try {
    await AsyncStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {}
  if (!on) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return false;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Before Breakfast',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return false;
  await schedule();
  return true;
}

/** Called on launch: keeps the reminder scheduled unless the reader switched it off. */
export async function ensureReminder(): Promise<void> {
  if (!supported) return;
  try {
    if (await getReminderPref()) await setReminder(true);
  } catch {
    // A missing reminder should never stop the app opening.
  }
}
