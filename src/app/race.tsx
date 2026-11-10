import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plate } from '../components/Plate';
import { Screen } from '../components/Screen';
import { Label, TextButton } from '../components/bits';
import { formatDate, loadIssue, useFeed } from '../lib/feed';
import { goBack } from '../lib/nav';
import { useToday } from '../lib/progress';
import {
  currentRace,
  pickQuestions,
  recordFinish,
  useRaceResults,
  type RaceQuestion,
} from '../lib/race';
import { fonts, labelSpacing, usePalette } from '../lib/theme';
import type { Issue } from '../lib/types';

const DODO = '“Everybody has won, and all must have prizes.”';

function Comfits({ count }: { count: number }) {
  const p = usePalette();
  return (
    <View style={styles.comfits} accessibilityLabel={`${count} comfits`}>
      {Array.from({ length: Math.min(count, 24) }).map((_, i) => (
        <View
          key={i}
          style={[styles.comfit, { backgroundColor: i % 3 === 0 ? p.accent : i % 3 === 1 ? p.ink : p.muted }]}
        />
      ))}
    </View>
  );
}

function Question({
  q,
  n,
  total,
  onNext,
}: {
  q: RaceQuestion;
  n: number;
  total: number;
  onNext: (right: boolean) => void;
}) {
  const p = usePalette();
  const [chosen, setChosen] = useState<number | null>(null);
  const answered = chosen !== null;

  return (
    <View>
      <View style={styles.progress}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[styles.pip, { backgroundColor: i < n ? p.ink : i === n ? p.accent : p.rule }]}
          />
        ))}
      </View>
      <Text style={[styles.from, { color: p.muted }]}>
        Question {n + 1} of {total} · from No. {q.issueId}, {q.issueTitle}
      </Text>
      <Text style={[styles.question, { color: p.ink }]}>{q.question}</Text>

      <View style={styles.options}>
        {q.shown.map((opt, i) => {
          const isRight = i === q.correct;
          const isChosen = i === chosen;
          const border = !answered ? p.rule : isRight ? p.ink : isChosen ? p.accent : p.rule;
          return (
            <Pressable
              key={i}
              disabled={answered}
              accessibilityRole="button"
              accessibilityState={{ selected: isChosen }}
              onPress={() => setChosen(i)}
              style={({ pressed }) => [
                styles.option,
                {
                  borderColor: border,
                  borderWidth: answered && (isRight || isChosen) ? 2 : 1,
                  backgroundColor: p.surface,
                  opacity: answered && !isRight && !isChosen ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: p.ink }]}>{opt}</Text>
              {answered && isRight ? (
                <Text style={[styles.mark, { color: p.ink }]}>The answer</Text>
              ) : answered && isChosen ? (
                <Text style={[styles.mark, { color: p.accent }]}>Your answer</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <View style={styles.after}>
          <Text style={[styles.verdict, { color: chosen === q.correct ? p.ink : p.accent }]}>
            {chosen === q.correct ? 'Quite right.' : 'Not this time.'}
          </Text>
          <Text style={[styles.explain, { color: p.ink }]}>{q.explain}</Text>
          <View style={styles.afterRow}>
            <TextButton
              title="Re-read the story"
              colour={p.muted}
              onPress={() => router.push(`/issue/${q.issueId}`)}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => onNext(chosen === q.correct)}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: p.accent, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.primaryText, { color: p.onAccent }]}>
                {n + 1 === total ? 'Finish' : 'Next →'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function CaucusRace() {
  const p = usePalette();
  const today = useToday();
  const { issues } = useFeed();
  const results = useRaceResults();
  const race = useMemo(() => currentRace(today, issues), [today, issues]);
  const raceKey = race ? `${race.date}:${race.ids.join(',')}` : '';

  const [loaded, setLoaded] = useState<Issue[] | null>(null);
  const [step, setStep] = useState<'intro' | number | 'done'>('intro');
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!race) return;
    let alive = true;
    Promise.all(race.ids.map(loadIssue)).then((list) => {
      if (alive) setLoaded(list.filter((i): i is Issue => !!i));
    });
    return () => {
      alive = false;
    };
    // raceKey captures everything about the race that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceKey]);

  const questions = useMemo(
    () => (race && loaded ? pickQuestions(race, loaded) : []),
    [race, loaded],
  );
  const result = race ? results[race.date] : undefined;
  const comfits = Object.keys(results).length;

  const header = (
    <>
      <TextButton title="← Back" colour={p.muted} onPress={goBack} />
      <Label>The Caucus-race</Label>
      <Text style={[styles.sub, { color: p.muted }]}>Sunday’s quiz on the week’s stories</Text>
    </>
  );

  if (!race) {
    return (
      <Screen>
        {header}
        <Plate name="dodo-thimble" width={220} style={styles.hero} />
        <Text style={[styles.body, { color: p.ink }]}>
          No race this week: there weren’t enough stories to run one. The next Caucus-race starts
          on Sunday.
        </Text>
      </Screen>
    );
  }

  if (step === 'intro') {
    const ready = questions.length >= 3;
    return (
      <Screen>
        {header}
        <Plate name="dodo-thimble" width={240} style={styles.hero} />
        <Text style={[styles.quote, { color: p.ink }]}>{DODO}</Text>
        <Text style={[styles.attribution, { color: p.muted }]}>
          The Dodo, Alice’s Adventures in Wonderland
        </Text>
        <Text style={[styles.body, { color: p.ink }]}>
          {loaded ? (COUNT[questions.length] ?? questions.length) : 'Five'} questions on the stories from{' '}
          {formatDate(race.from)} to {formatDate(race.date)}. Trying to remember is what makes
          an idea stick, so have a go even at the ones you missed. Everyone who finishes gets a
          comfit.
        </Text>
        {result ? (
          <Text style={[styles.body, { color: p.muted }]}>
            You ran this race and got {result.score} of {result.total}. You can run it again, but
            the prize is the same.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={!ready}
          onPress={() => {
            setScore(0);
            setStep(0);
          }}
          style={({ pressed }) => [
            styles.primary,
            styles.start,
            { backgroundColor: p.accent, opacity: !ready ? 0.4 : pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.primaryText, { color: p.onAccent }]}>
            {!loaded ? 'Gathering the questions…' : result ? 'Run it again' : 'Start the race'}
          </Text>
        </Pressable>
        {loaded && !ready ? (
          <Text style={[styles.note, { color: p.muted }]}>
            The questions couldn’t be loaded. Check your signal and try again.
          </Text>
        ) : null}
      </Screen>
    );
  }

  if (step === 'done') {
    const total = questions.length;
    return (
      <Screen>
        {header}
        <Plate
          name="dodo-thimble"
          width={240}
          style={styles.hero}
          caption="The Dodo solemnly presents the thimble"
        />
        <Text style={[styles.quote, { color: p.ink }]}>{DODO}</Text>
        <Text style={[styles.score, { color: p.ink }]}>
          You got {score} of {total}.
        </Text>
        <Text style={[styles.body, { color: p.ink }]}>
          {score === total
            ? 'Every one. The Dodo is impressed, though he’d never say so.'
            : score >= total - 2
              ? 'A good race. The ones you missed are the ones you’ll now remember best.'
              : 'Getting them wrong and then reading why is one of the best ways to learn. They’ll stick now.'}
        </Text>
        <View style={[styles.prize, { borderColor: p.rule, backgroundColor: p.surface }]}>
          <Text style={[styles.prizeKicker, { color: p.accent }]}>YOUR PRIZE</Text>
          <Text style={[styles.body, { color: p.ink, marginBottom: 8 }]}>
            A comfit, handed round like Alice’s, one apiece. Your box now holds {comfits}.
          </Text>
          <Comfits count={comfits} />
        </View>
        <TextButton title="← Back to today’s story" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const q = questions[step];
  return (
    <Screen>
      {header}
      <View style={{ height: 18 }} />
      <Question
        key={step}
        q={q}
        n={step}
        total={questions.length}
        onNext={(right) => {
          const next = score + (right ? 1 : 0);
          setScore(next);
          if (step + 1 >= questions.length) {
            recordFinish(race.date, next, questions.length);
            setStep('done');
          } else setStep(step + 1);
        }}
      />
    </Screen>
  );
}

const COUNT: Record<number, string> = { 3: 'Three', 4: 'Four', 5: 'Five' };

const styles = StyleSheet.create({
  sub: { fontFamily: fonts.displayItalic, fontSize: 14, marginTop: 2 },
  hero: { marginVertical: 22 },
  quote: { fontFamily: fonts.displayItalic, fontSize: 20, lineHeight: 27, textAlign: 'center' },
  attribution: { fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 25, marginBottom: 14 },
  note: { fontFamily: fonts.body, fontSize: 13, marginTop: 10 },
  score: { fontFamily: fonts.display, fontSize: 28, textAlign: 'center', marginVertical: 14 },
  start: { alignSelf: 'stretch', alignItems: 'center', marginTop: 6 },
  primary: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  primaryText: { fontFamily: fonts.label, fontSize: 16 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  pip: { flex: 1, height: 4, borderRadius: 2 },
  from: { fontFamily: fonts.body, fontSize: 12.5, marginBottom: 8 },
  question: { fontFamily: fonts.display, fontSize: 24, lineHeight: 31, marginBottom: 18 },
  options: { gap: 10 },
  option: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  optionText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  mark: { fontFamily: fonts.label, fontSize: 12, letterSpacing: labelSpacing },
  after: { marginTop: 18, gap: 8 },
  verdict: { fontFamily: fonts.display, fontSize: 20 },
  explain: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 24 },
  afterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  prize: { borderWidth: 1, borderRadius: 14, padding: 16, marginVertical: 14 },
  prizeKicker: { fontFamily: fonts.label, fontSize: 11, letterSpacing: labelSpacing, marginBottom: 6 },
  comfits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  comfit: { width: 12, height: 12, borderRadius: 6 },
});
