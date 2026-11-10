import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { weekday } from '../lib/dates';
import type { Race } from '../lib/race';
import { fonts, labelSpacing, usePalette } from '../lib/theme';
import { Plate } from './Plate';

/** Today's invitation to the Caucus-race, shown until the reader has run this week's. */
export function RaceCard({ race, today }: { race: Race; today: string }) {
  const p = usePalette();
  const sunday = weekday(today) === 0;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/race')}
      style={({ pressed }) => [
        styles.card,
        { borderColor: p.accent, backgroundColor: p.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Plate name="dodo-thimble" width={64} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.kicker, { color: p.accent }]}>THE CAUCUS-RACE</Text>
        <Text style={[styles.title, { color: p.ink }]}>Five questions on the week’s stories</Text>
        <Text style={[styles.note, { color: p.muted }]}>
          {sunday ? 'It’s Sunday. ' : ''}Everybody has won, and all must have prizes.
        </Text>
      </View>
      <Text style={[styles.arrow, { color: p.accent }]}>→</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  kicker: { fontFamily: fonts.label, fontSize: 10.5, letterSpacing: labelSpacing },
  title: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, marginVertical: 2 },
  note: { fontFamily: fonts.bodyItalic, fontSize: 12.5 },
  arrow: { fontFamily: fonts.display, fontSize: 22 },
});
