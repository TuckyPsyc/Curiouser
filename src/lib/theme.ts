import { useColorScheme } from 'react-native';
import type { Topic } from './types';

const light = {
  bg: '#F5EFE3',
  surface: '#FBF7EF',
  ink: '#2A211C',
  muted: '#6B5E55',
  rule: '#DDD2C0',
  accent: '#8A3B2E',
  accentSoft: '#EFDDD3',
  onAccent: '#FBF7EF',
};

const dark: typeof light = {
  bg: '#191512',
  surface: '#231D19',
  ink: '#EDE4D6',
  muted: '#A89B8E',
  rule: '#3A312A',
  accent: '#D9846B',
  accentSoft: '#3A2620',
  onAccent: '#191512',
};

/** The rabbit hole keeps its own palette whatever the system theme. */
export const hole = {
  bg: '#14112A',
  ink: '#E9E3F5',
  muted: '#A79FC2',
  gold: '#D4B06A',
  thread: '#5A4F86',
  levels: ['#221E3D', '#1D1936', '#18152E', '#131026', '#0F0D20'],
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

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
  const scheme = useColorScheme();
  const c = topicColours[topic] ?? topicColours.History;
  return scheme === 'dark' ? c.dark : c.light;
}

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_500Medium_Italic',
  label: 'Fraunces_500Medium',
  body: 'Literata_400Regular',
  bodyItalic: 'Literata_400Regular_Italic',
  bodyBold: 'Literata_600SemiBold',
};

export const DOWNLOAD_URL =
  'https://github.com/TuckyPsyc/curiouser/releases/latest/download/curiouser.apk';
