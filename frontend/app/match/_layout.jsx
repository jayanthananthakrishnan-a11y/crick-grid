import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function Icon({ emoji }) {
  return <Text style={{ fontSize: 18 }}>{emoji}</Text>;
}

export default function MatchLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0a3d1f' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        tabBarStyle: { backgroundColor: '#0a3d1f', borderTopColor: '#1a5c35' },
        tabBarActiveTintColor: '#f0c040',
        tabBarInactiveTintColor: '#8fbc8f',
        tabBarLabelStyle: { fontSize: 9 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'My Matches', tabBarLabel: 'Matches', tabBarIcon: () => <Icon emoji="🏆" /> }}
      />
      <Tabs.Screen
        name="centre"
        options={{
          title: 'Match Centre',
          tabBarLabel: 'Live',
          tabBarIcon: () => <Icon emoji="🔴" />,
          tabBarButton: () => null, // accessed via match card tap
        }}
      />
    </Tabs>
  );
}