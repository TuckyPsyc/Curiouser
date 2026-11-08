import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, usePalette } from '../lib/theme';
import type { RecallPrompt } from '../lib/types';
import { Label, TextButton } from './bits';

/**
 * A question about an earlier story, asked before today's one.
 * Trying to recall something strengthens memory more than rereading it.
 */
export function RecallCard({ recall }: { recall: RecallPrompt }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.rule }]}>
      <Label>Before you begin</Label>
      <Text style={[styles.question, { color: p.ink }]}>{recall.question}</Text>
      {open ? (
        <>
          <Text style={[styles.answer, { color: p.ink }]}>{recall.answer}</Text>
          <TextButton
            title="Re-read that story →"
            onPress={() => router.push(`/issue/${recall.fromIssue}`)}
          />
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
