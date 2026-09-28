import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { SessionProvider } from '../context/SessionContext';

LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'Method copyAsync imported from "expo-file-system" is deprecated',
  'Require cycle:',
]);

export default function RootLayout() {
  return (
    <SessionProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="(nets)" />
        <Stack.Screen name="match" />
      </Stack>
    </SessionProvider>
  );
}