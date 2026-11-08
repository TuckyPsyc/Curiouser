import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../lib/theme';

export function Screen({
  children,
  background,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  background?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const bg = background ?? p.bg;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 },
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={p.muted} />
        ) : undefined
      }
    >
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: 640,
  },
});
