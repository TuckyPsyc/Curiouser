import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createJar, ensureFirstJar, FIRST_JAR, toggleInJar, useJars } from '../lib/jars';
import { fonts, usePalette } from '../lib/theme';
import type { Issue } from '../lib/types';
import { TextButton } from './bits';

/** "Put in a jar" for a story. Shows "In a jar" once saved. */
export function JarButton({ issue }: { issue: Issue }) {
  const p = usePalette();
  const jars = useJars();
  const [open, setOpen] = useState(false);
  const saved = jars.some((j) => j.items.some((i) => i.id === issue.id));
  return (
    <>
      <TextButton
        title={saved ? 'In a jar ✓' : 'Put in a jar'}
        colour={saved ? p.ink : p.accent}
        onPress={() => {
          ensureFirstJar();
          setOpen(true);
        }}
      />
      <JarSheet issue={issue} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** A sheet listing the reader's jars; tap one to put the idea in or take it out. */
export function JarSheet({
  issue,
  visible,
  onClose,
}: {
  issue: Issue;
  visible: boolean;
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const jars = useJars();
  const [name, setName] = useState('');

  const add = () => {
    const key = createJar(name);
    if (key) {
      setName('');
      toggleInJar(key, issue);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.bg, borderColor: p.rule, paddingBottom: insets.bottom + 18 },
          ]}
        >
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: p.ink }]}>Put it in a jar</Text>
            <TextButton title="Done" colour={p.ink} onPress={onClose} />
          </View>
          <Text style={[styles.sheetIdea, { color: p.muted }]} numberOfLines={2}>
            {issue.title}: {issue.takeaway}
          </Text>

          <ScrollView style={{ maxHeight: 280 }}>
            {jars.map((j) => {
              const has = j.items.some((i) => i.id === issue.id);
              return (
                <Pressable
                  key={j.key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: has }}
                  onPress={() => toggleInJar(j.key, issue)}
                  style={({ pressed }) => [
                    styles.jarRow,
                    { borderColor: p.rule, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.check,
                      { borderColor: has ? p.accent : p.muted, backgroundColor: has ? p.accent : 'transparent' },
                    ]}
                  >
                    {has ? <Text style={[styles.tick, { color: p.onAccent }]}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.jarName, { color: p.ink }]}>{j.name}</Text>
                    <Text style={[styles.jarCount, { color: p.muted }]}>
                      {j.items.length === 0
                        ? j.name === FIRST_JAR
                          ? 'Empty, like Alice’s. Yours needn’t be.'
                          : 'Empty'
                        : `${j.items.length} idea${j.items.length === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.newRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              onSubmitEditing={add}
              placeholder="New jar, e.g. Ideas for work"
              placeholderTextColor={p.muted}
              maxLength={40}
              returnKeyType="done"
              style={[styles.input, { color: p.ink, borderColor: p.rule, backgroundColor: p.surface }]}
            />
            <TextButton title="Add" onPress={add} disabled={!name.trim()} />
          </View>

          <TextButton
            title="See all your jars →"
            colour={p.muted}
            onPress={() => {
              onClose();
              router.push('/jars');
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22 },
  sheetIdea: { fontFamily: fonts.bodyItalic, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  jarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 14, lineHeight: 16 },
  jarName: { fontFamily: fonts.display, fontSize: 17 },
  jarCount: { fontFamily: fonts.body, fontSize: 12.5, marginTop: 1 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: fonts.body,
    fontSize: 15,
  },
});
