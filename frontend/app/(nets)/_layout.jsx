import { Tabs } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { SessionProvider } from '../../context/SessionContext';
import { useRouter } from 'expo-router';

function TabIcon({ emoji }) {
  return <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}

function HiddenTabButton() { return null; }

export default function NetsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1a472a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.push('/home')} style={{ marginLeft: 14 }}>
            <Text style={{ color: '#f0c040', fontSize: 18 }}>🏠</Text>
          </TouchableOpacity>
        ),
        tabBarStyle: {
          backgroundColor: '#1a472a',
          borderTopColor: '#2d6a3f',
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
          justifyContent: 'space-evenly',
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarActiveTintColor: '#f0c040',
        tabBarInactiveTintColor: '#a5d6a7',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Sessions', tabBarLabel: 'Sessions', tabBarIcon: () => <TabIcon emoji="🏏" /> }} />
      <Tabs.Screen name="field" options={{ title: 'Set Field', tabBarLabel: 'Field', tabBarIcon: () => <TabIcon emoji="🏟️" /> }} />
      <Tabs.Screen name="log" options={{ title: 'Log Ball', tabBarLabel: 'Log', tabBarIcon: () => <TabIcon emoji="📋" /> }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarLabel: 'Analytics', tabBarIcon: () => <TabIcon emoji="📊" /> }} />
      <Tabs.Screen name="balltracker" options={{ title: 'Ball Tracker', tabBarButton: HiddenTabButton }} />
    </Tabs>
  );
}