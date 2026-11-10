import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { TextButton, topicLabel } from '../components/bits';
import { createJar, deleteJar, FIRST_JAR, removeFromJar, useJars, type Jar } from '../lib/jars';
import { goBack } from '../lib/nav';
import { fonts, labelSpacing, usePalette } from '../lib/theme';

function JarCard({ jar }: { jar: Jar }) {
  const p = usePalette();
  const [confirm, setConfirm] = useState(false);
  return (
    <View style={[styles.jar, { borderColor: p.rule, backgroundColor: p.surface }]}>
      <View style={styles.label}>
        <Text style={[styles.jarName, { color: p.ink }]}>{jar.name.toUpperCase()}</Text>
        <Text style={[styles.jarCount, { color: p.muted }]}>
          {jar.items.length} idea{jar.items.length === 1 ? '' : 's'}
        </Text>
      </View>

      {jar.items.length === 0 ? (
        <Text style={[styles.empty, { color: p.muted }]}>
          {jar.name === FIRST_JAR
            ? 'Alice took down a jar labelled ORANGE MARMALADE as she fell, and found it empty. Yours needn’t stay that way: tap “Put in a jar” on any story.'
            : 'Empty. Tap “Put in a jar” on any story.'}
        </Text>
      ) : (
        jar.items.map((item) => (
          <View key={item.id} style={[styles.item, { borderColor: p.rule }]}>
            <Pressable
              onPress={() => router.push(`/issue/${item.id}`)}
              style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.itemMeta, { color: p.muted }]}>
                No. {item.id} · {topicLabel(item.topic)}
              </Text>
              <Text style={[styles.itemTitle, { color: p.ink }]}>{item.title}</Text>
              <Text style={[styles.itemIdea, { color: p.ink }]}>{item.idea}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Take ${item.title} out of ${jar.name}`}
              hitSlop={10}
              onPress={() => removeFromJar(jar.key, item.id)}
            >
              <Text style={[styles.remove, { color: p.muted }]}>×</Text>
            </Pressable>
          </View>
        ))
      )}

      <TextButton
        title={confirm ? 'Tap again to throw this jar away' : 'Throw away this jar'}
        colour={confirm ? p.accent : p.muted}
        onPress={() => (confirm ? deleteJar(jar.key) : setConfirm(true))}
      />
    </View>
  );
}

export default function Jars() {
  const p = usePalette();
  const jars = useJars();
  const [name, setName] = useState('');
  const add = () => {
    if (createJar(name)) setName('');
  };

  return (
    <Screen>
      <TextButton title="← Back" colour={p.muted} onPress={goBack} />
      <Text style={[styles.title, { color: p.ink }]}>Jars</Text>
      <Text style={[styles.subtitle, { color: p.muted }]}>
        Ideas you’ve saved, kept on this phone
      </Text>

      {jars.length === 0 ? (
        <Text style={[styles.empty, { color: p.muted, marginBottom: 20 }]}>
          No jars yet. Tap “Put in a jar” on any story and the first one, Orange Marmalade, will
          appear. Or start one here.
        </Text>
      ) : (
        jars.map((j) => <JarCard key={j.key} jar={j} />)
      )}

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
        <TextButton title="Add jar" onPress={add} disabled={!name.trim()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 30, marginTop: 8 },
  subtitle: { fontFamily: fonts.displayItalic, fontSize: 14, marginTop: 2, marginBottom: 20 },
  jar: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 18, gap: 4 },
  label: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  jarName: { fontFamily: fonts.label, fontSize: 15, letterSpacing: labelSpacing, flexShrink: 1 },
  jarCount: { fontFamily: fonts.body, fontSize: 12.5 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemMeta: { fontFamily: fonts.body, fontSize: 12 },
  itemTitle: { fontFamily: fonts.display, fontSize: 17, marginTop: 2 },
  itemIdea: { fontFamily: fonts.bodyItalic, fontSize: 14, lineHeight: 21, marginTop: 4 },
  remove: { fontSize: 22, lineHeight: 24, paddingHorizontal: 4 },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
