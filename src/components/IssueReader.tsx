import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { formatDate } from '../lib/feed';
import { DOWNLOAD_URL, fonts, usePalette, useTopicColour } from '../lib/theme';
import type { Issue } from '../lib/types';
import { Label, Rule, TextButton, TopicChip } from './bits';
import { RabbitHoleButton } from './RabbitHoleButton';
import { RecallCard } from './RecallCard';
import { SizeShifter, type Size } from './SizeShifter';

async function shareIssue(issue: Issue): Promise<string | null> {
  const message = `${issue.title}\n\n${issue.takeaway}\n\nGet curiouser before breakfast: ${DOWNLOAD_URL}`;
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ title: issue.title, text: message });
        return null;
      }
      await nav?.clipboard?.writeText(message);
      return 'Copied to clipboard';
    }
    await Share.share({ message, title: issue.title });
    return null;
  } catch {
    return null;
  }
}

export function IssueReader({ issue, kicker }: { issue: Issue; kicker: string }) {
  const p = usePalette();
  const topicColour = useTopicColour(issue.topic);
  const [size, setSize] = useState<Size>('story');
  const [showSources, setShowSources] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const share = async () => setShareNote(await shareIssue(issue));
  const goDeeper = () => router.push(`/rabbit-hole/${issue.id}`);

  return (
    <View>
      <View style={styles.metaRow}>
        <TopicChip topic={issue.topic} />
        <Text style={[styles.meta, { color: p.muted }]}>No. {issue.id}</Text>
      </View>

      <Text style={[styles.kicker, { color: p.muted }]}>
        {kicker} · {formatDate(issue.date)}
      </Text>
      <Text style={[styles.title, { color: p.ink }]}>{issue.title}</Text>
      <Text style={[styles.concept, { color: topicColour }]}>{issue.concept}</Text>

      <View style={{ height: 22 }} />
      <SizeShifter
        size={size}
        minutes={issue.readingMinutes}
        onDrink={() => setSize('idea')}
        onEat={() => (size === 'idea' ? setSize('story') : goDeeper())}
      />

      {size === 'idea' ? (
        <View style={[styles.idea, { borderColor: topicColour, backgroundColor: p.surface }]}>
          <Label colour={topicColour}>The idea, in a sip</Label>
          <Text style={[styles.ideaText, { color: p.ink }]}>{issue.takeaway}</Text>
          <Text style={[styles.ideaNote, { color: p.muted }]}>
            Shrunk to fit. Eat Me to grow back to the full story.
          </Text>
          <TextButton title="Share this idea" onPress={share} />
          {shareNote ? <Text style={[styles.note, { color: p.muted }]}>{shareNote}</Text> : null}
        </View>
      ) : (
        <>
          {issue.recall ? <RecallCard recall={issue.recall} /> : null}

          {issue.story.map((para, i) => (
            <Text key={i} style={[styles.para, { color: p.ink }]}>
              {para}
            </Text>
          ))}

          <View
            style={[styles.takeaway, { borderLeftColor: topicColour, backgroundColor: p.surface }]}
          >
            <Label colour={topicColour}>The idea</Label>
            <Text style={[styles.takeawayText, { color: p.ink }]}>{issue.takeaway}</Text>
          </View>

          <RabbitHoleButton issue={issue} />

          <View style={styles.actions}>
            <TextButton title="Share this story" onPress={share} />
            <TextButton
              title={showSources ? 'Hide sources' : `Sources (${issue.sources.length})`}
              colour={p.muted}
              onPress={() => setShowSources((s) => !s)}
            />
          </View>
          {shareNote ? <Text style={[styles.note, { color: p.muted }]}>{shareNote}</Text> : null}

          {showSources ? (
            <View style={styles.sources}>
              {issue.sources.map((s, i) => (
                <Pressable
                  key={i}
                  disabled={!s.url}
                  onPress={() => s.url && Linking.openURL(s.url)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.source, { color: s.url ? p.accent : p.muted }]}>
                    {s.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}

      <Rule />
      <TextButton title="All past stories →" onPress={() => router.push('/archive')} />
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  meta: { fontFamily: fonts.body, fontSize: 13 },
  kicker: { fontFamily: fonts.label, fontSize: 13, marginBottom: 6 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  concept: { fontFamily: fonts.displayItalic, fontSize: 18, marginTop: 6 },
  para: { fontFamily: fonts.body, fontSize: 17, lineHeight: 28, marginBottom: 16 },
  takeaway: {
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
  },
  takeawayText: { fontFamily: fonts.bodyItalic, fontSize: 17, lineHeight: 27 },
  idea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 22,
    gap: 12,
  },
  ideaText: { fontFamily: fonts.displayItalic, fontSize: 22, lineHeight: 31 },
  ideaNote: { fontFamily: fonts.body, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  note: { fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  sources: { gap: 10, marginTop: 12 },
  source: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
