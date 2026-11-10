import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { fonts, labelSpacing, usePalette, useTopicColour } from '../lib/theme';
import type { Topic } from '../lib/types';

/** Topics are stored with a straight apostrophe; display them with a curly one. */
export const topicLabel = (topic: string) => topic.replace("'", '’');

export function TopicChip({ topic }: { topic: Topic }) {
  const colour = useTopicColour(topic);
  return (
    <View style={[styles.chip, { borderColor: colour }]}>
      <Text style={[styles.chipText, { color: colour }]}>{topicLabel(topic).toUpperCase()}</Text>
    </View>
  );
}

export function Label({ children, colour }: { children: string; colour?: string }) {
  const p = usePalette();
  return <Text style={[styles.label, { color: colour ?? p.muted }]}>{children.toUpperCase()}</Text>;
}

export function TextButton({
  title,
  colour,
  ...rest
}: PressableProps & { title: string; colour?: string }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={10}
      style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}
      {...rest}
    >
      <Text style={[styles.textButtonText, { color: colour ?? p.accent }]}>{title}</Text>
    </Pressable>
  );
}

export function Rule() {
  const p = usePalette();
  return <View style={[styles.rule, { backgroundColor: p.rule }]} />;
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: fonts.label,
    fontSize: 11.5,
    letterSpacing: Math.min(1.2, labelSpacing),
  },
  label: {
    fontFamily: fonts.label,
    fontSize: 13,
    letterSpacing: labelSpacing,
  },
  textButton: {
    paddingVertical: 6,
  },
  textButtonText: {
    fontFamily: fonts.label,
    fontSize: 15,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 24,
  },
});
