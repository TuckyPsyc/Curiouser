import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Plate } from '../../components/Plate';
import { Screen } from '../../components/Screen';
import { TextButton } from '../../components/bits';
import { useIssue } from '../../lib/feed';
import { goBack } from '../../lib/nav';
import { labelSpacing, fonts, hole } from '../../lib/theme';

const DEPTHS = [
  'Deeper',
  'Curiouser and curiouser',
  'Deeper still',
  'Through the looking-glass',
  'The bottom of the hole',
];

function Thread() {
  return (
    <View style={styles.thread} accessibilityElementsHidden importantForAccessibility="no">
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.dot} />
      ))}
    </View>
  );
}

export default function RabbitHole() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { issue, failed } = useIssue(Number(id));
  const rh = issue?.rabbitHole;

  return (
    <Screen background={hole.bg}>
      <StatusBar style="light" />
      <TextButton title="↑ Drink Me: back to the story" colour={hole.muted} onPress={goBack} />

      {!rh ? (
        <Text style={styles.body}>{failed ? 'Couldn’t load this rabbit hole.' : 'Down, down, down…'}</Text>
      ) : (
        <>
          <Plate name="white-rabbit-watch" width={92} onDark style={styles.rabbit} />
          <Text style={styles.epigraph}>
            “Down, down, down. Would the fall never come to an end!”
          </Text>
          <Text style={styles.attribution}>Lewis Carroll, Alice’s Adventures in Wonderland</Text>

          <Text style={styles.kicker}>DOWN THE RABBIT HOLE · {issue.concept.toUpperCase()}</Text>
          <Text style={styles.title}>{rh.title}</Text>
          <Text style={styles.intro}>{rh.intro}</Text>

          {rh.levels.map((level, i) => (
            <View key={i}>
              <Thread />
              <View
                style={[
                  styles.level,
                  { backgroundColor: hole.levels[Math.min(i, hole.levels.length - 1)] },
                ]}
              >
                <Text style={styles.depth}>
                  LEVEL {i + 1} · {(DEPTHS[i] ?? 'Deeper').toUpperCase()}
                </Text>
                <Text style={styles.heading}>{level.heading}</Text>
                {level.body.map((para, j) => (
                  <Text key={j} style={styles.body}>
                    {para}
                  </Text>
                ))}
              </View>
            </View>
          ))}

          <Thread />
          <View style={styles.reading}>
            <Text style={styles.depth}>IF YOU WANT TO KEEP FALLING</Text>
            {rh.furtherReading.map((r, i) => (
              <Pressable
                key={i}
                disabled={!r.url}
                onPress={() => r.url && Linking.openURL(r.url)}
                style={({ pressed }) => [styles.readingItem, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.readingTitle, r.url ? { color: hole.gold } : null]}>
                  {r.title}
                </Text>
                {r.author ? <Text style={styles.readingAuthor}>{r.author}</Text> : null}
                {r.note ? <Text style={styles.readingNote}>{r.note}</Text> : null}
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={goBack}
            style={({ pressed }) => [styles.climb, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.climbText}>↑ Climb back out</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rabbit: { alignSelf: 'center', marginTop: 20 },
  epigraph: {
    fontFamily: fonts.displayItalic,
    fontSize: 17,
    lineHeight: 25,
    color: hole.muted,
    marginTop: 24,
  },
  attribution: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: hole.thread,
    marginTop: 6,
    marginBottom: 32,
  },
  kicker: {
    fontFamily: fonts.label,
    fontSize: 11,
    letterSpacing: labelSpacing,
    color: hole.gold,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: hole.ink,
  },
  intro: {
    fontFamily: fonts.bodyItalic,
    fontSize: 17,
    lineHeight: 27,
    color: hole.ink,
    marginTop: 14,
  },
  thread: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: hole.thread,
  },
  level: {
    borderRadius: 16,
    padding: 20,
  },
  depth: {
    fontFamily: fonts.label,
    fontSize: 11,
    letterSpacing: labelSpacing,
    color: hole.gold,
    marginBottom: 8,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 27,
    color: hole.ink,
    marginBottom: 12,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 26,
    color: hole.ink,
    marginBottom: 12,
  },
  reading: {
    borderWidth: 1,
    borderColor: hole.thread,
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  readingItem: { paddingVertical: 8 },
  readingTitle: { fontFamily: fonts.display, fontSize: 16, color: hole.ink },
  readingAuthor: { fontFamily: fonts.body, fontSize: 14, color: hole.muted },
  readingNote: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: hole.ink, marginTop: 2 },
  climb: {
    marginTop: 32,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: hole.gold,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  climbText: { fontFamily: fonts.label, fontSize: 15, color: hole.gold },
});
