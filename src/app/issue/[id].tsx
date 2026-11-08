import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { IssueReader } from '../../components/IssueReader';
import { Screen } from '../../components/Screen';
import { TextButton } from '../../components/bits';
import { useIssue } from '../../lib/feed';
import { goBack } from '../../lib/nav';
import { fonts, usePalette } from '../../lib/theme';

export default function IssueScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { issue, failed } = useIssue(Number(id));

  return (
    <Screen>
      <TextButton title="← Back" colour={p.muted} onPress={goBack} />
      <Text style={{ height: 12 }} />
      {issue ? (
        <IssueReader issue={issue} kicker={`No. ${issue.id}`} />
      ) : (
        <Text style={[styles.note, { color: p.muted }]}>
          {failed ? 'Couldn’t load this story. Check your connection.' : 'Loading…'}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.body, fontSize: 15 },
});
