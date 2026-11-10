import {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import {
  Literata_400Regular,
  Literata_400Regular_Italic,
  Literata_600SemiBold,
} from '@expo-google-fonts/literata';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ensureReminder } from '../lib/notifications';
import { DIRECTION, usePalette } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const p = usePalette();
  const [loaded, error] = useFonts({
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
    Literata_400Regular,
    Literata_400Regular_Italic,
    Literata_600SemiBold,
    IMFellEnglish_400Regular: require('../fonts/IMFellEnglish_400Regular.ttf'),
    IMFellEnglish_400Regular_Italic: require('../fonts/IMFellEnglish_400Regular_Italic.ttf'),
    IMFellEnglishSC_400Regular: require('../fonts/IMFellEnglishSC_400Regular.ttf'),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  useEffect(() => {
    ensureReminder();
  }, []);

  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style={DIRECTION === 'night' ? 'light' : 'auto'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: p.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="rabbit-hole/[id]" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}
