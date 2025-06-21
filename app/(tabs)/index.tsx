import { Redirect } from 'expo-router';

// The tabs router looks for an `index` screen first. Redirecting here ensures
// the app opens on the Camera tab without needing fragile `initialRouteName`
// work-arounds.

export default function IndexRedirect() {
  return <Redirect href="/camera" />;
} 