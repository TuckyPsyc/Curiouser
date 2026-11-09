import { Image, StyleSheet, Text, View, useColorScheme, type ViewStyle } from 'react-native';
import { ART, type ArtName } from '../art';
import { fonts } from '../lib/theme';

const PAPER = '#EFE6D6';
const INK = '#2A211C';

/**
 * A Tenniel engraving. On paper (light mode) the ink sits straight on the page,
 * as in the books. On a dark background it's printed on a small paper plate, so
 * the engraving is never shown as a negative.
 */
export function Plate({
  name,
  width,
  caption,
  onDark,
  style,
}: {
  name: ArtName;
  width: number;
  caption?: string;
  /** Force the paper plate, e.g. on the rabbit hole's dark background. */
  onDark?: boolean;
  style?: ViewStyle;
}) {
  const dark = useColorScheme() === 'dark' || onDark;
  const art = ART[name];
  const image = (
    <Image
      source={art.source}
      accessibilityIgnoresInvertColors
      style={{ width, height: width / art.ratio, tintColor: INK }}
      resizeMode="contain"
    />
  );
  return (
    <View style={[styles.wrap, style]} accessible={!!caption} accessibilityLabel={caption}>
      {dark ? <View style={styles.plate}>{image}</View> : image}
      {caption ? (
        <Text style={[styles.caption, { color: dark && !onDark ? '#A89B8E' : onDark ? '#A79FC2' : '#6B5E55' }]}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  plate: {
    backgroundColor: PAPER,
    borderRadius: 6,
    padding: 10,
  },
  caption: {
    fontFamily: fonts.bodyItalic,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
});
