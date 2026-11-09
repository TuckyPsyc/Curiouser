import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IssueReader } from '../components/IssueReader';
import { Plate } from '../components/Plate';
import { Screen } from '../components/Screen';
import { TextButton } from '../components/bits';
import { START_ID, markStartSeen, useIssue } from '../lib/feed';
import { goBack } from '../lib/nav';
import { fonts, usePalette } from '../lib/theme';

/** No. 0: the story of how Alice was written, annotated to explain each feature. */
export default function StartHere() {
  const p = usePalette();
  const { issue, failed } = useIssue(START_ID);

  useEffect(() => {
    markStartSeen();
  }, []);

  const begin = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen>
      <TextButton title="← Back" colour={p.muted} onPress={goBack} />
      <View style={styles.hero}>
        <Plate name="little-door" width={190} caption="Alice finds the little door behind the curtain" />
        <Text style={[styles.welcome, { color: p.ink }]}>Welcome to Curiouser</Text>
        <Text style={[styles.intro, { color: p.muted }]}>
          One idea a day, told as a true story. Here’s the story behind the app, with notes in the
          margins explaining what everything does.
        </Text>
      </View>

      {issue ? (
        <IssueReader issue={issue} kicker="Start here" />
      ) : (
        <Text style={[styles.intro, { color: p.muted }]}>
          {failed ? 'Couldn’t load this story. Check your connection.' : 'Down, down, down…'}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={begin}
        style={({ pressed }) => [styles.begin, { backgroundColor: p.ink, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.beginText, { color: p.bg }]}>Begin: today’s Before Breakfast →</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 28 },
  welcome: { fontFamily: fonts.display, fontSize: 26, marginTop: 8 },
  intro: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  begin: { marginTop: 28, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  beginText: { fontFamily: fonts.label, fontSize: 16 },
});
