import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Rule, TextButton, TopicChip, topicLabel } from '../components/bits';
import { formatDate, useFeed } from '../lib/feed';
import { goBack } from '../lib/nav';
import { getReminderPref, REMINDER_HOUR, setReminder } from '../lib/notifications';
import { fonts, usePalette, useTopicColour } from '../lib/theme';
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
  const colour = useTopicColour(item.topic);
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

  useEffect(() => {
    getReminderPref().then(setReminderState);
  }, []);

  const shown = topic ? issues.filter((i) => i.topic === topic) : issues;

  return (
    <Screen refreshing={status === 'loading'} onRefresh={refresh}>
      <TextButton title="← Today" colour={p.muted} onPress={goBack} />
      <Text style={[styles.title, { color: p.ink }]}>Past stories</Text>

      <View style={styles.filters}>
        <FilterChip label="All" active={topic === null} onPress={() => setTopic(null)} />
        {TOPICS.map((t) => (
          <FilterChip key={t} label={topicLabel(t)} active={topic === t} onPress={() => setTopic(t)} />
        ))}
      </View>

      {shown.length === 0 ? (
        <Text style={[styles.empty, { color: p.muted }]}>Nothing here yet.</Text>
      ) : (
        shown.map((item) => <Row key={item.id} item={item} />)
      )}

      <Rule />
      {Platform.OS !== 'web' ? (
        <View style={styles.setting}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: p.ink }]}>White Rabbit reminder</Text>
            <Text style={[styles.settingNote, { color: p.muted }]}>
              A nudge at {REMINDER_HOUR}:00 each day when Before Breakfast is ready.
            </Text>
          </View>
          <Switch
            value={reminder}
            onValueChange={async (v) => setReminderState(await setReminder(v))}
            trackColor={{ true: p.accent, false: p.rule }}
          />
        </View>
      ) : null}
      <Text style={[styles.about, { color: p.muted }]}>
        Get curiouser before breakfast. One idea a day, told as a story: psychology, literature,
        history, self-improvement and gentleman’s pursuits. Every story lists its sources.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, marginTop: 8, marginBottom: 16 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  filterText: { fontFamily: fonts.label, fontSize: 13 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 18, gap: 6 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowDate: { fontFamily: fonts.body, fontSize: 12 },
  rowTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, marginTop: 4 },
  rowConcept: { fontFamily: fonts.displayItalic, fontSize: 15 },
  rowTeaser: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  empty: { fontFamily: fonts.body, fontSize: 15, marginTop: 12 },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  settingTitle: { fontFamily: fonts.label, fontSize: 16 },
  settingNote: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  about: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
});
