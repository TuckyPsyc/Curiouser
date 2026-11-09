import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, usePalette } from '../lib/theme';
import type { RecallPrompt } from '../lib/types';
import { Label, TextButton } from './bits';
import { Plate } from './Plate';

/**
 * The Red Queen's race: a question about an earlier story, asked before today's.
 * "It takes all the running you can do, to keep in the same place."
 * Trying to recall something strengthens memory more than rereading it.
 */
export function RecallCard({ recall }: { recall: RecallPrompt }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.rule }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Label>The Red Queen’s race</Label>
          <Text style={[styles.sub, { color: p.muted }]}>Before you begin</Text>
        </View>
        <Plate name="red-queen-race" width={92} />
      </View>
      <Text style={[styles.question, { color: p.ink }]}>{recall.question}</Text>
      {open ? (
        <>
          <Text style={[styles.answer, { color: p.ink }]}>{recall.answer}</Text>
          {recall.fromIssue != null ? (
            <TextButton
              title="Re-read that story →"
              onPress={() => router.push(`/issue/${recall.fromIssue}`)}
            />
          ) : null}
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.reveal,
            { borderColor: p.accent, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.revealText, { color: p.accent }]}>
            Have a think, then tap to check
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginBottom: 28,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sub: { fontFamily: fonts.displayItalic, fontSize: 14, marginTop: -2 },
  question: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 25,
  },
  answer: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 25,
  },
  reveal: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  revealText: {
    fontFamily: fonts.label,
    fontSize: 14,
  },
});
