import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { fonts } from '../lib/theme';
import { CONFIDENCE, type LookingGlass } from '../lib/types';

const KIND_LABEL: Record<LookingGlass['kind'], string> = {
  counter: 'The other side',
  none: 'Nothing much in the mirror',
  myth: 'A myth, reflected',
};

function useGlass() {
  const dark = useColorScheme() === 'dark';
  return dark
    ? { bg: '#1D252B', edge: '#3E4B55', ink: '#E3E9EE', muted: '#93A2AD', on: '#B9C9D4', off: '#33404A' }
    : { bg: '#E9EEF1', edge: '#B4C0C8', ink: '#1F2A31', muted: '#5D6C76', on: '#4E6371', off: '#CBD5DB' };
}

/**
 * Through the Looking-Glass: the case against the day's idea, or an honest
 * "there isn't one". Opens with a mirror flip.
 */
export function LookingGlassPanel({ glass }: { glass: LookingGlass }) {
  const g = useGlass();
  const [open, setOpen] = useState(false);
  const flip = useRef(new Animated.Value(-1)).current;

  const openGlass = () => {
    setOpen(true);
    flip.setValue(-1);
    Animated.timing(flip, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Through the Looking-Glass: the other side of today's idea"
        onPress={openGlass}
        style={({ pressed }) => [
          styles.closed,
          { backgroundColor: g.bg, borderColor: g.edge, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: g.muted }]}>THROUGH THE LOOKING-GLASS</Text>
          <Text style={[styles.prompt, { color: g.ink }]}>The other side of today’s idea</Text>
        </View>
        <Text style={[styles.mirror, { color: g.muted }]}>⇄</Text>
      </Pressable>
    );
  }

  const level = CONFIDENCE.indexOf(glass.confidence);
  return (
    <Animated.View
      style={[
        styles.open,
        { backgroundColor: g.bg, borderColor: g.edge, transform: [{ scaleX: flip }] },
      ]}
    >
      <Text style={[styles.kicker, { color: g.muted }]}>THROUGH THE LOOKING-GLASS</Text>
      <Text style={[styles.kind, { color: g.muted }]}>{KIND_LABEL[glass.kind]}</Text>
      <Text style={[styles.heading, { color: g.ink }]}>{glass.heading}</Text>
      {glass.body.map((p, i) => (
        <Text key={i} style={[styles.body, { color: g.ink }]}>
          {p}
        </Text>
      ))}

      <View style={[styles.rule, { backgroundColor: g.edge }]} />
      <Text style={[styles.kicker, { color: g.muted }]}>HOW SURE ARE WE?</Text>
      <View
        style={styles.meter}
        accessible
        accessibilityLabel={`How sure are we: ${glass.confidence}`}
      >
        {CONFIDENCE.map((c, i) => (
          <View
            key={c}
            style={[styles.segment, { backgroundColor: i <= level ? g.on : g.off }]}
          />
        ))}
      </View>
      <Text style={[styles.confidence, { color: g.ink }]}>{glass.confidence}</Text>

      <Text style={[styles.kicker, { color: g.muted, marginTop: 14 }]}>WHERE THAT LEAVES YOU</Text>
      <Text style={[styles.verdict, { color: g.ink }]}>{glass.verdict}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(false)}
        hitSlop={8}
        style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.backText, { color: g.muted }]}>Step back through ⇄</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  closed: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  open: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  kicker: { fontFamily: fonts.label, fontSize: 10.5, letterSpacing: 1.2, marginBottom: 6 },
  prompt: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23 },
  kind: { fontFamily: fonts.displayItalic, fontSize: 14, marginTop: -2, marginBottom: 8 },
  mirror: { fontFamily: fonts.display, fontSize: 24, marginLeft: 12 },
  heading: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, marginBottom: 10 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 26, marginBottom: 12 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  meter: { flexDirection: 'row', gap: 6, marginTop: 2 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  confidence: { fontFamily: fonts.displayItalic, fontSize: 15, marginTop: 6 },
  verdict: { fontFamily: fonts.bodyItalic, fontSize: 16, lineHeight: 25 },
  back: { alignSelf: 'flex-end', marginTop: 12 },
  backText: { fontFamily: fonts.label, fontSize: 14 },
});
