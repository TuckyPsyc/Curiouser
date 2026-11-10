import { useColorScheme } from 'react-native';
import type { Topic } from './types';

/**
 * Design direction. 'current' is the original cream-and-Fraunces look;
 * 'page' and 'night' are the mock-up directions (chosen at build time).
 */
export type Direction = 'current' | 'page' | 'night';
export const DIRECTION: Direction =
  (process.env.EXPO_PUBLIC_DIRECTION as Direction | undefined) ?? 'current';

const palettes = {
  current: {
    light: {
      bg: '#F5EFE3', surface: '#FBF7EF', ink: '#2A211C', muted: '#6B5E55', rule: '#DDD2C0',
      accent: '#8A3B2E', accentSoft: '#EFDDD3', onAccent: '#FBF7EF',
    },
    dark: {
      bg: '#191512', surface: '#231D19', ink: '#EDE4D6', muted: '#A89B8E', rule: '#3A312A',
      accent: '#D9846B', accentSoft: '#3A2620', onAccent: '#191512',
    },
  },
  // The printed page: black ink and Queen-of-Hearts red on white paper.
  page: {
    light: {
      bg: '#FBFAF7', surface: '#FFFFFF', ink: '#141210', muted: '#5C5852', rule: '#D9D5CC',
      accent: '#B3122E', accentSoft: '#F6DDE1', onAccent: '#FFFFFF',
    },
    dark: {
      bg: '#111113', surface: '#1B1B1E', ink: '#F2EFE8', muted: '#A19C93', rule: '#34343A',
      accent: '#EC5A6F', accentSoft: '#3A1D23', onAccent: '#111113',
    },
  },
  // Wonderland at night: deep indigo and gold, whatever the phone's setting.
  night: {
    light: {
      bg: '#14112A', surface: '#1E1A3A', ink: '#ECE6F7', muted: '#A79FC2', rule: '#363062',
      accent: '#D4B06A', accentSoft: '#2C2650', onAccent: '#14112A',
    },
    dark: {
      bg: '#14112A', surface: '#1E1A3A', ink: '#ECE6F7', muted: '#A79FC2', rule: '#363062',
      accent: '#D4B06A', accentSoft: '#2C2650', onAccent: '#14112A',
    },
  },
};

export type Palette = (typeof palettes)['current']['light'];

/** True when the background is dark, so engravings go on paper plates. */
export function useIsDark(): boolean {
  const scheme = useColorScheme();
  return DIRECTION === 'night' || scheme === 'dark';
}

export function usePalette(): Palette {
  return useIsDark() ? palettes[DIRECTION].dark : palettes[DIRECTION].light;
}

/** The rabbit hole keeps its own palette whatever the system theme. */
export const hole = {
  bg: DIRECTION === 'night' ? '#0C0A1C' : '#14112A',
  ink: '#E9E3F5',
  muted: '#A79FC2',
  gold: '#D4B06A',
  thread: '#5A4F86',
  levels: ['#221E3D', '#1D1936', '#18152E', '#131026', '#0F0D20'],
};

const topicColours: Record<Topic, { light: string; dark: string }> = {
  History: { light: '#8C6A2F', dark: '#D1AE6E' },
  Psychology: { light: '#4F5D8C', dark: '#9AA7D6' },
  Science: { light: '#2F6E8C', dark: '#7FBEDB' },
  Literature: { light: '#8A3B2E', dark: '#D9846B' },
  Philosophy: { light: '#6B4C7A', dark: '#B79CC7' },
  Nature: { light: '#4F6B2F', dark: '#A6C47E' },
  Economics: { light: '#7A6A1F', dark: '#CDBB62' },
  'Self-Improvement': { light: '#3F6B4F', dark: '#8FC2A0' },
  'Art & Music': { light: '#9A3F6A', dark: '#DD8AB3' },
  Mathematics: { light: '#3D5A6B', dark: '#93B3C6' },
  "Gentleman's Pursuits": { light: '#5B4636', dark: '#C4A58C' },
  Society: { light: '#6E5A4E', dark: '#BFA99A' },
  Technology: { light: '#44627A', dark: '#8FB1CC' },
  Language: { light: '#8A5A2E', dark: '#D9A36B' },
  'Health & Medicine': { light: '#2F7A6A', dark: '#7FCDBB' },
};

export function useTopicColour(topic: Topic): string {
  const dark = useIsDark();
  const c = topicColours[topic] ?? topicColours.History;
  return dark ? c.dark : c.light;
}

/**
 * The italic line under each headline. The original design tinted it by topic,
 * which put gold italics on History days (too close to Honeyletter). The new
 * directions keep topic colour to the chip and use the house colour here.
 */
export function useConceptColour(topic: Topic): string {
  const p = usePalette();
  const t = useTopicColour(topic);
  if (DIRECTION === 'current') return t;
  return DIRECTION === 'page' ? p.accent : '#C3B6E8';
}

const fontSets = {
  current: {
    display: 'Fraunces_600SemiBold',
    displayItalic: 'Fraunces_500Medium_Italic',
    label: 'Fraunces_500Medium',
  },
  // IM Fell: 17th-century types collected by Bishop John Fell for the Oxford
  // press, revived by Igino Marini. Antique and irregular, unlike the usual app serif.
  page: {
    display: 'IMFellEnglish_400Regular',
    displayItalic: 'IMFellEnglish_400Regular_Italic',
    label: 'IMFellEnglishSC_400Regular',
  },
  night: {
    display: 'IMFellEnglish_400Regular',
    displayItalic: 'IMFellEnglish_400Regular_Italic',
    label: 'IMFellEnglishSC_400Regular',
  },
};

export const fonts = {
  ...fontSets[DIRECTION],
  body: 'Literata_400Regular',
  bodyItalic: 'Literata_400Regular_Italic',
  bodyBold: 'Literata_600SemiBold',
};

/** Small capitals are built into IM Fell SC, so it needs far less spacing. */
export const labelSpacing = DIRECTION === 'current' ? 1.6 : 0.4;

export const DOWNLOAD_URL =
  'https://github.com/TuckyPsyc/curiouser/releases/latest/download/curiouser.apk';
