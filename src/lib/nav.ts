import { router } from 'expo-router';

/** Back if there's somewhere to go back to (e.g. opened from a link), otherwise home. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
