import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { DOWNLOAD_URL, fonts, labelSpacing, usePalette } from '../lib/theme';
import type { Issue } from '../lib/types';
import { Plate } from './Plate';

/**
 * Opens the phone's share sheet (WhatsApp, Messages and the rest). Uses React
 * Native's own Share, so it needs no new library and ships over the air (D-008).
 * Nothing is sent by the app itself: the reader chooses where it goes (D-005).
 * Returns a note to show, or null.
 */
export async function shareText(title: string, message: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ title, text: message });
        return null;
      }
      await nav?.clipboard?.writeText(message);
      return 'Copied to clipboard';
    }
    await Share.share({ message, title });
    return null;
  } catch {
    return null;
  }
}

/** Quotes a heading as a sentence, keeping its own question mark if it has one. */
const quoted = (heading: string) => {
  const h = heading.trim().replace(/[.:;,]+$/, '');
  return `“${/[?!]$/.test(h) ? h : `${h}.`}”`;
};

/**
 * The question to put to friends. Stories have no talking-point field yet, so
 * it is made from the Looking-Glass, which is already the case for arguing.
 */
export function talkingPoint(issue: Issue): string {
  const glass = issue.lookingGlass;
  if (!glass) return 'What do you make of it?';
  switch (glass.kind) {
    case 'counter':
      return `The other side says: ${quoted(glass.heading)} Does that change your mind?`;
    case 'myth':
      return `It also debunks a myth: ${quoted(glass.heading)} Had you heard it?`;
    case 'none':
      return 'Even through the Looking-Glass there’s no serious case against it. Can you find one?';
  }
}

function teaPartyMessage(issue: Issue): string {
  return [
    `A question for the tea table, from Curiouser: “${issue.title}”.`,
    issue.takeaway,
    talkingPoint(issue),
    `Get curiouser before breakfast: ${DOWNLOAD_URL}`,
  ].join('\n\n');
}

/**
 * The Tea Party: a talking point to send to friends. The discussion happens
 * where friends already are (WhatsApp, Messages), so the app needs no accounts
 * or server (IDEAS.md, item 9).
 */
export function TeaParty({ issue }: { issue: Issue }) {
  const p = usePalette();
  const [note, setNote] = useState<string | null>(null);
  const share = async () => setNote(await shareText(issue.title, teaPartyMessage(issue)));

  return (
    <View style={[styles.card, { borderColor: p.rule, backgroundColor: p.surface }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: p.muted }]}>THE TEA PARTY</Text>
          <Text style={[styles.title, { color: p.ink }]}>Talk it over with friends</Text>
        </View>
        <Plate name="mad-tea-party" width={76} />
      </View>
      <Text style={[styles.point, { color: p.ink }]}>{talkingPoint(issue)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="The Tea Party: send today's talking point to friends"
        onPress={share}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: p.accent, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: p.onAccent }]}>Share the tea</Text>
      </Pressable>
      <Text style={[styles.hint, { color: p.muted }]}>
        {note ?? 'Opens WhatsApp, Messages or wherever your friends are.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
    marginBottom: 12,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { fontFamily: fonts.label, fontSize: 11.5, letterSpacing: labelSpacing, marginBottom: 4 },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23 },
  point: { fontFamily: fonts.bodyItalic, fontSize: 16, lineHeight: 25 },
  button: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  buttonText: { fontFamily: fonts.label, fontSize: 15 },
  hint: { fontFamily: fonts.body, fontSize: 13 },
});
