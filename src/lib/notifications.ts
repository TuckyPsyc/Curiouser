import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const REMINDER_HOUR = 7;
export const REMINDER_MINUTE = 0;
const PREF_KEY = 'reminder-enabled';
const CHANNEL_ID = 'before-breakfast';

/**
 * The Caucus-race reminder: Sunday mornings, when the week's race opens.
 * Nine o'clock, so it never arrives on top of the 7:00 reminder.
 */
export const RACE_REMINDER_HOUR = 9;
export const RACE_REMINDER_MINUTE = 0;
const RACE_PREF_KEY = 'race-reminder-enabled';
const RACE_CHANNEL_ID = 'caucus-race';
/** expo-notifications counts weekdays from 1, and 1 is Sunday. */
const SUNDAY = 1;

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

async function readPref(key: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v !== 'off';
  } catch {
    return true;
  }
}

export const getReminderPref = () => readPref(PREF_KEY);

/**
 * The Sunday reminder starts on for everyone who still has the 7:00 one on.
 * A reader who switched the 7:00 reminder off didn't want nudges, so for them
 * it starts off too, until they choose otherwise.
 */
export async function getRaceReminderPref(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(RACE_PREF_KEY);
    if (v === null) return getReminderPref();
    return v !== 'off';
  } catch {
    return true;
  }
}

/**
 * Clears every scheduled reminder and schedules again the ones the reader has
 * on. Starting from nothing each time means a switch can never leave a stray
 * reminder behind, including ones scheduled by older versions of the app.
 */
async function reschedule(daily: boolean, race: boolean): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (daily) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Before Breakfast is ready',
        body: "Oh dear! Oh dear! Don't be late. Today's story is waiting, with a rabbit hole if you're hungry for more.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: REMINDER_HOUR,
        minute: REMINDER_MINUTE,
        channelId: CHANNEL_ID,
      },
    });
  }
  if (race) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'The Caucus-race is on',
        body: 'Five questions on the week’s stories. Everybody has won, and all must have prizes.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: SUNDAY,
        hour: RACE_REMINDER_HOUR,
        minute: RACE_REMINDER_MINUTE,
        channelId: RACE_CHANNEL_ID,
      },
    });
  }
}

/** Sets up the Android channels and asks for permission. Returns whether we may notify. */
async function permitted(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Before Breakfast',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(RACE_CHANNEL_ID, {
      name: 'The Caucus-race',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  return granted;
}

/**
 * Saves one switch, then reschedules both reminders. Returns whether the
 * switched reminder ended up on.
 */
async function setPref(key: string, on: boolean): Promise<boolean> {
  if (!supported) return false;
  try {
    // Fix the Sunday switch where it stands first, so turning the 7:00
    // reminder off later doesn't quietly turn the Sunday one off with it.
    await AsyncStorage.setItem(RACE_PREF_KEY, (await getRaceReminderPref()) ? 'on' : 'off');
    await AsyncStorage.setItem(key, on ? 'on' : 'off');
  } catch {}
  const daily = await getReminderPref();
  const race = await getRaceReminderPref();
  if (!daily && !race) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return false;
  }
  if (!(await permitted())) return false;
  await reschedule(daily, race);
  return on;
}

/** Turns the 7am reminder on or off. Returns whether it ended up on. */
export const setReminder = (on: boolean) => setPref(PREF_KEY, on);

/** Turns the Sunday Caucus-race reminder on or off. Returns whether it ended up on. */
export const setRaceReminder = (on: boolean) => setPref(RACE_PREF_KEY, on);

/** Called on launch: keeps the reminders scheduled unless the reader switched them off. */
export async function ensureReminder(): Promise<void> {
  if (!supported) return;
  try {
    const daily = await getReminderPref();
    const race = await getRaceReminderPref();
    if (!daily && !race) return;
    if (await permitted()) await reschedule(daily, race);
  } catch {
    // A missing reminder should never stop the app opening.
  }
}
