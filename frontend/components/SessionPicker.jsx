import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useSession } from '../context/SessionContext';

export default function SessionPicker({ onSessionChange }) {
  const { sessions, activeSession, setActiveSession, loadingSessions, error } = useSession();

  const handleSelect = (session) => {
    setActiveSession(session);
    onSessionChange?.(session);
  };

  if (loadingSessions) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorRow}>
        <Text style={styles.errorText}>⚠️ {error}</Text>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View style={styles.emptyRow}>
        <Text style={styles.emptyText}>No sessions yet — create one in the Sessions tab</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {sessions.map(s => {
          const isActive = activeSession?.id === s.id;
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => handleSelect(s)}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {s.session_name}
              </Text>
              {isActive && (
                <Text style={styles.chipBalls}>{s.total_balls} balls</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#1a472a',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  row: { paddingHorizontal: 10, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: '#4a8f3a', backgroundColor: '#2d6a3f',
  },
  chipActive: {
    backgroundColor: '#f0c040', borderColor: '#f0c040',
  },
  chipText: { color: '#c8e6c9', fontSize: 13 },
  chipTextActive: { color: '#1a472a', fontWeight: 'bold', fontSize: 13 },
  chipBalls: { color: '#1a472a', fontSize: 10, textAlign: 'center', marginTop: 1 },
  loadingRow: {
    backgroundColor: '#1a472a', flexDirection: 'row',
    alignItems: 'center', padding: 12, gap: 8,
  },
  loadingText: { color: '#c8e6c9', fontSize: 13 },
  errorRow: { backgroundColor: '#c62828', padding: 12 },
  errorText: { color: '#fff', fontSize: 12 },
  emptyRow: { backgroundColor: '#1a472a', padding: 12 },
  emptyText: { color: '#8fbc8f', fontSize: 12, textAlign: 'center' },
});