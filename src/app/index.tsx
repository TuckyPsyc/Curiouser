import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { IssueReader } from '../components/IssueReader';
import { Screen } from '../components/Screen';
import { TextButton } from '../components/bits';
import { todayISO, useFeed, useIssue } from '../lib/feed';
import { fonts, usePalette } from '../lib/theme';

export default function Today() {
  const p = usePalette();
  const { issues, status, refresh } = useFeed();
  const latest = issues[0];
  const { issue } = useIssue(latest?.id ?? null);

  return (
    <Screen refreshing={status === 'loading'} onRefresh={refresh}>
      <View style={styles.masthead}>
        <Text style={[styles.brand, { color: p.ink }]}>Curiouser</Text>
        <TextButton title="Past stories" colour={p.muted} onPress={() => router.push('/archive')} />
      </View>
      <View style={[styles.rule, { backgroundColor: p.ink }]} />
      <Text style={[styles.epigraph, { color: p.muted }]}>
        “Why, sometimes I’ve believed as many as six impossible things before breakfast.”
      </Text>
      <Text style={[styles.attribution, { color: p.muted }]}>
        The White Queen, Through the Looking-Glass
      </Text>

      {status === 'offline' ? (
        <Text style={[styles.note, { color: p.muted }]}>
          Offline. Showing the stories saved on this phone.
        </Text>
      ) : null}

      {issue ? (
        <IssueReader
          issue={issue}
          kicker={issue.date === todayISO() ? 'Before Breakfast' : 'Previously'}
        />
      ) : (
        <Text style={[styles.note, { color: p.muted }]}>
          {status === 'loading' ? 'Fetching today’s story…' : 'No story yet. Pull down to try again.'}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  brand: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 0.3 },
  rule: { height: 2, marginTop: 8, marginBottom: 14 },
  epigraph: { fontFamily: fonts.displayItalic, fontSize: 14, lineHeight: 20 },
  attribution: { fontFamily: fonts.body, fontSize: 11, marginTop: 4, marginBottom: 26 },
  note: { fontFamily: fonts.body, fontSize: 14, marginBottom: 16 },
});
