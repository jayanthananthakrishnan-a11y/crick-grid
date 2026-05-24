import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { SessionProvider } from '../context/SessionContext';

function TabIcon({ emoji }) {
  return <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}

function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1a472a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarStyle: { backgroundColor: '#1a472a', borderTopColor: '#2d6a3f' },
        tabBarActiveTintColor: '#f0c040',
        tabBarInactiveTintColor: '#8fbc8f',
        tabBarLabelStyle: { fontSize: 9 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Sessions', tabBarLabel: 'Sessions', tabBarIcon: () => <TabIcon emoji="🏏" /> }} />
      <Tabs.Screen name="field" options={{ title: 'Set Field', tabBarLabel: 'Field', tabBarIcon: () => <TabIcon emoji="🏟️" /> }} />
      <Tabs.Screen name="log" options={{ title: 'Log Ball', tabBarLabel: 'Log', tabBarIcon: () => <TabIcon emoji="📋" /> }} />
      <Tabs.Screen name="review" options={{ title: 'Video Review', tabBarLabel: 'Review', tabBarIcon: () => <TabIcon emoji="🎬" /> }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarLabel: 'Analytics', tabBarIcon: () => <TabIcon emoji="📊" /> }} />
      <Tabs.Screen
        name="balltracker"
        options={{
          title: 'Ball Tracker',
          tabBarLabel: 'Tracker',
          tabBarIcon: () => <TabIcon emoji="🎯" />,
          // Hide from tab bar — accessed via button in Analytics
          tabBarButton: () => null,
        }}
      />
    </Tabs>
  );
}

export default function Layout() {
  return (
    <SessionProvider>
      <TabsLayout />
    </SessionProvider>
  );
}