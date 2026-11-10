import { StyleSheet, View } from 'react-native';
import { DIRECTION, usePalette } from '../lib/theme';

/**
 * A strip of chessboard, for the Looking-Glass world, which Carroll laid out
 * as a game of chess. Falls back to a plain rule in the original design.
 */
export function ChessRule({ squares = 32 }: { squares?: number }) {
  const p = usePalette();
  if (DIRECTION === 'current') {
    return <View style={[styles.plain, { backgroundColor: p.ink }]} />;
  }
  return (
    <View
      style={[styles.board, { borderColor: p.ink }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {[0, 1].map((row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: squares }).map((_, i) => (
            <View
              key={i}
              style={[styles.square, (i + row) % 2 === 0 && { backgroundColor: p.ink }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  plain: { height: 2, marginTop: 10, marginBottom: 16 },
  board: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: 12,
    marginBottom: 18,
  },
  row: { flexDirection: 'row', height: 5 },
  square: { flex: 1 },
});
