import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, hole } from '../lib/theme';
import type { Issue } from '../lib/types';

export function RabbitHoleButton({ issue }: { issue: Issue }) {
  const levels = issue.rabbitHole.levels.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Down the rabbit hole: ${issue.rabbitHole.title}`}
      onPress={() => router.push(`/rabbit-hole/${issue.id}`)}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Image source={require('../../assets/brand/rabbit.png')} style={styles.rabbit} />
      <View style={styles.text}>
        <Text style={styles.kicker}>EAT ME · DOWN THE RABBIT HOLE</Text>
        <Text style={styles.title}>{issue.rabbitHole.title}</Text>
        <Text style={styles.meta}>
          {levels} levels deeper · further reading at the bottom
        </Text>
      </View>
      <Text style={styles.arrow}>↓</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: hole.bg,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  rabbit: { width: 40, height: 40 },
  text: { flex: 1, gap: 4 },
  kicker: {
    fontFamily: fonts.label,
    fontSize: 10.5,
    letterSpacing: 1,
    color: hole.gold,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 23,
    color: hole.ink,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: hole.muted,
  },
  arrow: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: hole.gold,
  },
});
