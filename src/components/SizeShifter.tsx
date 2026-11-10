import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, labelSpacing, usePalette } from '../lib/theme';

export type Size = 'idea' | 'story';

/**
 * Alice's bottle and cake. Drink Me shrinks the story to its one-line idea;
 * Eat Me grows it back, and from full size drops you down the rabbit hole.
 */
export function SizeShifter({
  size,
  minutes,
  onDrink,
  onEat,
}: {
  size: Size;
  minutes: number;
  onDrink: () => void;
  onEat: () => void;
}) {
  const p = usePalette();
  const canDrink = size !== 'idea';
  return (
    <View style={styles.row}>
      <Tag
        text="Drink Me"
        tilt="-3deg"
        disabled={!canDrink}
        label="Drink Me: shrink to the one-line idea"
        onPress={onDrink}
      />
      <View style={styles.middle}>
        <Text style={[styles.size, { color: p.ink }]}>
          {size === 'idea' ? 'The idea' : 'The story'}
        </Text>
        <Text style={[styles.time, { color: p.muted }]}>
          {size === 'idea' ? '10 seconds' : `${minutes} min`}
        </Text>
      </View>
      <Tag
        text="Eat Me"
        tilt="3deg"
        label={size === 'idea' ? 'Eat Me: grow back to the full story' : 'Eat Me: go down the rabbit hole'}
        onPress={onEat}
      />
    </View>
  );
}

function Tag({
  text,
  tilt,
  disabled,
  label,
  onPress,
}: {
  text: string;
  tilt: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.tag,
        {
          backgroundColor: p.surface,
          borderColor: p.ink,
          transform: [{ rotate: tilt }],
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.tagText, { color: p.ink }]}>{text.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  middle: { alignItems: 'center' },
  size: { fontFamily: fonts.displayItalic, fontSize: 15 },
  time: { fontFamily: fonts.body, fontSize: 12 },
  tag: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: { fontFamily: fonts.label, fontSize: 12, letterSpacing: Math.min(1.4, labelSpacing) },
});
