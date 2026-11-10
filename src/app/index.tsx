import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IssueReader } from '../components/IssueReader';
import { ChessRule } from '../components/ChessRule';
import { Plate } from '../components/Plate';
import { Screen } from '../components/Screen';
import { TextButton } from '../components/bits';
import { hasSeenStart, todayISO, useFeed, useIssue } from '../lib/feed';
import { DIRECTION, fonts, usePalette } from '../lib/theme';

export default function Today() {
  const p = usePalette();
  const { issues, status, refresh } = useFeed();
  const latest = issues[0];
  const { issue } = useIssue(latest?.id ?? null);

  // First launch: send new readers to Start here, which explains everything.
  useEffect(() => {
    hasSeenStart().then((seen) => {
      if (!seen) router.push('/start');
    });
  }, []);

  return (
    <Screen refreshing={status === 'loading'} onRefresh={refresh}>
      <View style={styles.masthead}>
        <View>
          <Text style={[styles.brand, { color: p.ink }]}>Curiouser</Text>
          <Text style={[styles.tagline, { color: p.muted }]}>Get curiouser before breakfast</Text>
        </View>
        <View style={styles.shelves}>
          <TextButton title="The Shelves" colour={p.ink} onPress={() => router.push('/archive')} />
          <Text style={[styles.shelvesSub, { color: p.muted }]}>past stories</Text>
        </View>
      </View>
      <ChessRule />

      <View style={styles.epigraphRow}>
        <Plate name="white-queen" width={62} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.epigraph, { color: p.muted }]}>
            “Why, sometimes I’ve believed as many as six impossible things before breakfast.”
          </Text>
          <Text style={[styles.attribution, { color: p.muted }]}>
            The White Queen, Through the Looking-Glass
          </Text>
        </View>
      </View>

      {status === 'offline' ? (
        <Text style={[styles.note, { color: p.muted }]}>
          You’ve wandered out of signal. Showing the stories saved on this phone.
        </Text>
      ) : null}

      {issue ? (
        <IssueReader
          issue={issue}
          kicker={issue.date === todayISO() ? 'Before Breakfast' : 'Previously'}
        />
      ) : (
        <View style={styles.empty}>
          <Plate name="cheshire-cat" width={130} />
          <Text style={[styles.note, { color: p.muted, textAlign: 'center' }]}>
            {status === 'loading'
              ? 'Down, down, down… fetching today’s story.'
              : 'Nothing here yet but a grin. Pull down to try again.'}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  brand: { fontFamily: fonts.display, fontSize: DIRECTION === 'current' ? 32 : 40, letterSpacing: 0.3 },
  tagline: { fontFamily: fonts.displayItalic, fontSize: DIRECTION === 'current' ? 13 : 15, marginTop: -2 },
  shelves: { alignItems: 'flex-end' },
  shelvesSub: { fontFamily: fonts.body, fontSize: 11, marginTop: -6 },
  rule: { height: 2, marginTop: 10, marginBottom: 16 },
  epigraphRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 26 },
  epigraph: { fontFamily: fonts.displayItalic, fontSize: 14, lineHeight: 20 },
  attribution: { fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  note: { fontFamily: fonts.body, fontSize: 14, marginBottom: 16 },
  empty: { alignItems: 'center', gap: 14, marginTop: 24 },
});
