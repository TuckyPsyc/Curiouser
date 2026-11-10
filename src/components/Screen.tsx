import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../lib/theme';

type ScrollListeners = Set<() => void>;
const ScrollContext = createContext<ScrollListeners | null>(null);

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
  const listeners = useMemo<ScrollListeners>(() => new Set(), []);
  return (
    <ScrollContext.Provider value={listeners}>
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 },
        ]}
        scrollEventThrottle={200}
        onScroll={() => listeners.forEach((l) => l())}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={p.muted} />
          ) : undefined
        }
      >
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </ScrollContext.Provider>
  );
}

/**
 * Calls `onSeen` once, the first time this point scrolls into view. Used to
 * count a story as read when the reader reaches its end.
 */
export function SeenMarker({ onSeen }: { onSeen: () => void }) {
  const listeners = useContext(ScrollContext);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const done = useRef(false);
  const { height } = useWindowDimensions();
  const latest = useRef(onSeen);
  latest.current = onSeen;

  useEffect(() => {
    const check = () => {
      if (done.current) return;
      ref.current?.measureInWindow((_x: number, y: number) => {
        // Above the bottom of the screen means reached (or scrolled past).
        // A zero means not laid out yet.
        if (!done.current && y !== 0 && y < height) {
          done.current = true;
          latest.current();
        }
      });
    };
    listeners?.add(check);
    const timer = setTimeout(check, 600);
    return () => {
      listeners?.delete(check);
      clearTimeout(timer);
    };
  }, [listeners, height]);

  return <View ref={ref} collapsable={false} style={{ height: 1 }} />;
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
