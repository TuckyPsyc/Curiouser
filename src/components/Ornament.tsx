import { StyleSheet, Text } from 'react-native';
import { usePalette } from '../lib/theme';

/** A row of card suits, for the Queen of Hearts' pack. Used as a section break. */
export function Ornament() {
  const p = usePalette();
  return (
    <Text
      style={[styles.ornament, { color: p.muted }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      ♠   ♥   ♦   ♣
    </Text>
  );
}

const styles = StyleSheet.create({
  ornament: { textAlign: 'center', fontSize: 14, letterSpacing: 2, marginVertical: 18 },
});
