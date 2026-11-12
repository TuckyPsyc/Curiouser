import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Plate } from '../components/Plate';
import { Screen } from '../components/Screen';
import { Rule, TextButton, TopicChip, topicLabel } from '../components/bits';
import { formatDate, useFeed } from '../lib/feed';
import { useJars } from '../lib/jars';
import { useToday } from '../lib/progress';
import { currentRace, useRaceResults } from '../lib/race';
import { goBack } from '../lib/nav';
import {
  getRaceReminderPref,
  getReminderPref,
  RACE_REMINDER_HOUR,
  REMINDER_HOUR,
  setRaceReminder,
  setReminder,
} from '../lib/notifications';
import { labelSpacing, fonts, useConceptColour, usePalette } from '../lib/theme';
import { TOPICS, type IssueSummary, type Topic } from '../lib/types';

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.filter,
        { borderColor: active ? p.ink : p.rule, backgroundColor: active ? p.ink : 'transparent' },
      ]}
    >
      <Text style={[styles.filterText, { color: active ? p.bg : p.muted }]}>{label}</Text>
    </Pressable>
  );
}

function Row({ item }: { item: IssueSummary }) {
  const p = usePalette();
  const colour = useConceptColour(item.topic);
  return (
    <Pressable
      onPress={() => router.push(`/issue/${item.id}`)}
      style={({ pressed }) => [styles.row, { borderColor: p.rule, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.rowTop}>
        <TopicChip topic={item.topic} />
        <Text style={[styles.rowDate, { color: p.muted }]}>
          No. {item.id} · {formatDate(item.date)}
        </Text>
      </View>
      <Text style={[styles.rowTitle, { color: p.ink }]}>{item.title}</Text>
      <Text style={[styles.rowConcept, { color: colour }]}>{item.concept}</Text>
      <Text style={[styles.rowTeaser, { color: p.muted }]}>{item.teaser}</Text>
    </Pressable>
  );
}

export default function Archive() {
  const p = usePalette();
  const { issues, status, refresh } = useFeed();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [reminder, setReminderState] = useState(true);
  const [raceReminder, setRaceReminderState] = useState(true);

  useEffect(() => {
    getReminderPref().then(setReminderState);
    getRaceReminderPref().then(setRaceReminderState);
  }, []);

  const shown = topic ? issues.filter((i) => i.topic === topic) : issues;
  const jars = useJars();
  const saved = jars.reduce((n, j) => n + j.items.length, 0);
  const today = useToday();
  const race = currentRace(today, issues);
  const results = useRaceResults();
  const comfits = Object.keys(results).length;
  const ran = race ? results[race.date] : undefined;

  return (
    <Screen refreshing={status === 'loading'} onRefresh={refresh}>
      <TextButton title="← Today" colour={p.muted} onPress={goBack} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: p.ink }]}>The Shelves</Text>
          <Text style={[styles.subtitle, { color: p.muted }]}>Every past story, sorted by topic</Text>
        </View>
        <Plate name="herald-rabbit" width={74} />
      </View>

      <Pressable
        onPress={() => router.push('/start')}
        style={({ pressed }) => [
          styles.start,
          { borderColor: p.accent, backgroundColor: p.surface, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Plate name="little-door" width={56} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.startKicker, { color: p.accent }]}>START HERE</Text>
          <Text style={[styles.startTitle, { color: p.ink }]}>The Story Told on a Boat</Text>
          <Text style={[styles.rowTeaser, { color: p.muted }]}>
            How Alice was written, and how Curiouser works.
          </Text>
        </View>
      </Pressable>

      <View style={styles.pair}>
        <Pressable
          onPress={() => router.push('/jars')}
          style={({ pressed }) => [
            styles.tile,
            { borderColor: p.rule, backgroundColor: p.surface, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.startKicker, { color: p.accent }]}>JARS</Text>
          <Text style={[styles.tileTitle, { color: p.ink }]}>Ideas you’ve saved</Text>
          <Text style={[styles.rowTeaser, { color: p.muted }]}>
            {saved === 0 ? 'Nothing saved yet' : `${saved} idea${saved === 1 ? '' : 's'} in ${jars.length} jar${jars.length === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/race')}
          style={({ pressed }) => [
            styles.tile,
            { borderColor: p.rule, backgroundColor: p.surface, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.startKicker, { color: p.accent }]}>THE CAUCUS-RACE</Text>
          <Text style={[styles.tileTitle, { color: p.ink }]}>Sunday’s quiz</Text>
          <Text style={[styles.rowTeaser, { color: p.muted }]}>
            {ran
              ? `This week: ${ran.score} of ${ran.total} · ${comfits} comfit${comfits === 1 ? '' : 's'}`
              : race
                ? 'This week’s race is open'
                : 'Next race on Sunday'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filters}
      >
        <FilterChip label="All" active={topic === null} onPress={() => setTopic(null)} />
        {TOPICS.filter((t) => issues.some((i) => i.topic === t)).map((t) => (
          <FilterChip key={t} label={topicLabel(t)} active={topic === t} onPress={() => setTopic(t)} />
        ))}
      </ScrollView>

      {shown.length === 0 ? (
        <View style={styles.emptyBox}>
          <Plate name="cheshire-cat" width={110} />
          <Text style={[styles.empty, { color: p.muted }]}>Nothing on this shelf yet but a grin.</Text>
        </View>
      ) : (
        shown.map((item) => <Row key={item.id} item={item} />)
      )}

      <Rule />
      {Platform.OS !== 'web' ? (
        <View style={styles.setting}>
          <Plate name="white-rabbit-watch" width={40} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: p.ink }]}>The White Rabbit</Text>
            <Text style={[styles.settingNote, { color: p.muted }]}>
              “Oh dear! Oh dear! I shall be late!” A nudge at {REMINDER_HOUR}:00 when Before
              Breakfast is ready.
            </Text>
          </View>
          <Switch
            value={reminder}
            onValueChange={async (v) => setReminderState(await setReminder(v))}
            trackColor={{ true: p.accent, false: p.rule }}
          />
        </View>
      ) : null}
      {Platform.OS !== 'web' ? (
        <View style={styles.setting}>
          <Plate name="dodo-thimble" width={40} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: p.ink }]}>The Dodo</Text>
            <Text style={[styles.settingNote, { color: p.muted }]}>
              “Everybody has won, and all must have prizes.” A nudge at {RACE_REMINDER_HOUR}:00 on
              Sundays when the Caucus-race opens.
            </Text>
          </View>
          <Switch
            value={raceReminder}
            onValueChange={async (v) => setRaceReminderState(await setRaceReminder(v))}
            trackColor={{ true: p.accent, false: p.rule }}
          />
        </View>
      ) : null}
      <Text style={[styles.about, { color: p.muted }]}>
        Get curiouser before breakfast. One idea a day, told as a true story, ranging across
        fifteen subjects from science and philosophy to art, money and medicine. Every story lists
        its sources, and the Looking-Glass gives the other side.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8, marginBottom: 18 },
  title: { fontFamily: fonts.display, fontSize: 30 },
  subtitle: { fontFamily: fonts.displayItalic, fontSize: 14, marginTop: 2 },
  start: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  startKicker: { fontFamily: fonts.label, fontSize: 10.5, letterSpacing: labelSpacing },
  startTitle: { fontFamily: fonts.display, fontSize: 18, marginVertical: 2 },
  pair: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, gap: 2 },
  tileTitle: { fontFamily: fonts.display, fontSize: 16, marginBottom: 2 },
  emptyBox: { alignItems: 'center', gap: 12, marginTop: 16 },
  filterScroll: { marginHorizontal: -20, marginBottom: 16, flexGrow: 0 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  filterText: { fontFamily: fonts.label, fontSize: 13 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 18, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowDate: { fontFamily: fonts.body, fontSize: 12 },
  rowTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, marginTop: 4 },
  rowConcept: { fontFamily: fonts.displayItalic, fontSize: 15 },
  rowTeaser: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  empty: { fontFamily: fonts.body, fontSize: 15, textAlign: 'center' },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  settingTitle: { fontFamily: fonts.label, fontSize: 16 },
  settingNote: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  about: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
});
