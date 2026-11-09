import { StyleSheet, Text, View } from 'react-native';
import { fonts, usePalette } from '../lib/theme';
import type { GuideNote } from '../lib/types';

/**
 * A note in the margin, used only in the Start here story to explain each
 * feature as the reader meets it. Styled like the paper label tied round the
 * neck of the Drink Me bottle.
 */
export function MarginNote({ note }: { note?: GuideNote }) {
  const p = usePalette();
  if (!note) return null;
  return (
    <View style={styles.row} accessibilityRole="summary">
      <View style={[styles.string, { backgroundColor: p.muted }]} />
      <View style={[styles.label, { backgroundColor: p.surface, borderColor: p.accent }]}>
        <Text style={[styles.kicker, { color: p.accent }]}>HOW CURIOUSER WORKS</Text>
        <Text style={[styles.title, { color: p.ink }]}>{note.title}</Text>
        <Text style={[styles.text, { color: p.ink }]}>{note.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  string: { width: 14, height: 1.5, marginRight: -1, opacity: 0.6 },
  label: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    transform: [{ rotate: '-0.6deg' }],
  },
  kicker: { fontFamily: fonts.label, fontSize: 10, letterSpacing: 1.3, marginBottom: 3 },
  title: { fontFamily: fonts.display, fontSize: 15, marginBottom: 3 },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
});
