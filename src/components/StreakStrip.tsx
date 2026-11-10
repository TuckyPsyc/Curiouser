import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayInitial, dayName } from '../lib/dates';
import { stopTheClock, useStreakData, useToday } from '../lib/progress';
import {
  dayState,
  hourAvailable,
  lastSeven,
  rescuableDay,
  streakLength,
  type DayState,
} from '../lib/streak';
import { fonts, labelSpacing, usePalette } from '../lib/theme';
import { Plate } from './Plate';

const DOT = 18;

/** A stopped watch: both hands in one straight line, at six o'clock. */
function Dot({ state, isToday }: { state: DayState; isToday: boolean }) {
  const p = usePalette();
  if (state === 'read') return <View style={[styles.dot, { backgroundColor: p.ink, borderColor: p.ink }]} />;
  if (state === 'frozen')
    return (
      <View style={[styles.dot, styles.clock, { borderColor: p.accent }]}>
        <View style={[styles.hands, { backgroundColor: p.accent }]} />
      </View>
    );
  return (
    <View
      style={[
        styles.dot,
        { borderColor: isToday ? p.muted : p.rule, borderStyle: isToday ? 'dashed' : 'solid' },
      ]}
    />
  );
}

/**
 * The Hatter's watch: a forgiving streak. Shows the last seven days, the
 * current run, and offers the week's Hatter's Hour when it would rescue a
 * missed day. Tap to see how it works.
 */
export function StreakStrip() {
  const p = usePalette();
  const data = useStreakData();
  const today = useToday();
  const [open, setOpen] = useState(false);

  const week = lastSeven(data, today);
  const count = week.filter((d) => d.state !== 'missed').length;
  const run = streakLength(data, today);
  const todayDone = dayState(data, today) !== 'missed';
  const rescue = rescuableDay(data, today);
  const hour = hourAvailable(data, today);

  const status = todayDone
    ? `Today counted${run > 1 ? ` · ${run}-day streak` : ''}`
    : run > 0
      ? `${run}-day streak · read today to keep it going`
      : count > 0
        ? 'Read today’s story to start a new run'
        : 'Finish a story, or Drink Me, to start it';

  return (
    <View style={[styles.wrap, { borderColor: p.rule }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reading streak: ${count} of the last 7 days. ${status}. Tap for how it works.`}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: p.muted }]}>THE HATTER’S WATCH</Text>
          <Text style={[styles.count, { color: p.ink }]}>
            {count === 0 ? 'Not started yet' : `${count} of the last 7 days`}
          </Text>
          <Text style={[styles.status, { color: p.muted }]}>{status}</Text>
        </View>
        <View style={styles.week}>
          {week.map(({ day, state }) => (
            <View key={day} style={styles.day}>
              <Dot state={state} isToday={day === today} />
              <Text style={[styles.initial, { color: day === today ? p.ink : p.muted }]}>
                {dayInitial(day)}
              </Text>
            </View>
          ))}
        </View>
      </Pressable>

      {rescue ? (
        <View style={[styles.rescue, { backgroundColor: p.surface, borderColor: p.accent }]}>
          <Text style={[styles.rescueText, { color: p.ink }]}>
            You missed {dayName(rescue)}. Use this week’s Hatter’s Hour to stop the clock, and
            your streak carries on.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => stopTheClock(rescue)}
            style={({ pressed }) => [
              styles.rescueButton,
              { backgroundColor: p.accent, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.rescueButtonText, { color: p.onAccent }]}>
              Stop the clock on {dayName(rescue)}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {open ? (
        <View style={styles.explain}>
          <Plate name="mad-tea-party" width={220} caption="The Mad Tea-Party, where it’s always six o’clock" />
          <Text style={[styles.explainText, { color: p.ink }]}>
            A day counts when you read a story to the end, or take the quick Drink Me version.
            Any story counts, old or new.
          </Text>
          <Text style={[styles.explainText, { color: p.ink }]}>
            Miss a day and all is not lost. Once a week you get a Hatter’s Hour, which stops the
            clock on one missed day, after the Hatter’s watch: “It’s always six o’clock now.” A
            stopped day shows as a little clock.
          </Text>
          <Text style={[styles.explainNote, { color: p.muted }]}>
            {hour
              ? 'This week’s Hatter’s Hour is still yours. A new one arrives every Monday.'
              : 'You’ve used this week’s Hatter’s Hour. A new one arrives on Monday.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    marginBottom: 24,
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { fontFamily: fonts.label, fontSize: 11, letterSpacing: labelSpacing },
  count: { fontFamily: fonts.display, fontSize: 18, marginTop: 1 },
  status: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 1 },
  week: { flexDirection: 'row', gap: 5 },
  day: { alignItems: 'center', gap: 3 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 1.5 },
  clock: { alignItems: 'center', justifyContent: 'center' },
  hands: { width: 1.5, height: DOT - 6, borderRadius: 1 },
  initial: { fontFamily: fonts.label, fontSize: 10 },
  rescue: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  rescueText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  rescueButton: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  rescueButtonText: { fontFamily: fonts.label, fontSize: 14 },
  explain: { gap: 10, paddingTop: 4 },
  explainText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  explainNote: { fontFamily: fonts.bodyItalic, fontSize: 13, lineHeight: 19 },
});
