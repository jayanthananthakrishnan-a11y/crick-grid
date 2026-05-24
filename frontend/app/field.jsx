import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSession } from '../context/SessionContext';
import { saveField } from '../services/api';
import FieldMap from '../components/FieldMap';
import SessionPicker from '../components/SessionPicker';

export default function FieldScreen() {
  const { activeSession, fieldPositions, fieldDiameter: ctxDiameter, refreshField } = useSession();
  const [localFielders, setLocalFielders] = useState(null);
  const [diameter, setDiameter] = useState('65');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync local state from context whenever field data changes
  useEffect(() => {
    setLocalFielders(fieldPositions || null);
    setDiameter(String(ctxDiameter || 65));
    setSaved(false);
  }, [fieldPositions, ctxDiameter, activeSession?.id]);

  // Re-fetch field every time tab comes into focus
  useFocusEffect(useCallback(() => {
    if (activeSession?.id) refreshField(activeSession.id);
  }, [activeSession?.id, refreshField]));

  const handleSave = async () => {
    if (!activeSession) { Alert.alert('No session', 'Select a session first'); return; }
    setSaving(true);
    try {
      await saveField({
        session_id: activeSession.id,
        positions: localFielders,
        field_diameter: parseFloat(diameter) || 65,
      });
      // Push new field back into context so Log tab sees it immediately
      await refreshField(activeSession.id);
      setSaved(true);
      Alert.alert('✅ Saved', 'Field saved — Log tab is now updated');
    } catch {
      Alert.alert('Error', 'Could not save field');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f0' }}>
      <SessionPicker />

      {!activeSession ? (
        <View style={styles.noSession}>
          <Text style={styles.noSessionIcon}>🏟️</Text>
          <Text style={styles.noSessionText}>Select a session above to set the field</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <Text style={styles.pageTitle}>🏟️ Set the Field</Text>
          <Text style={styles.pageSub}>
            {activeSession.session_name}
            {' · '}
            🏏 {activeSession.bowler_name || '?'} vs 🏏 {activeSession.batsman_name || '?'}
          </Text>

          {saved && (
            <View style={styles.savedBanner}>
              <Text style={styles.savedBannerText}>✅ Field saved — Log tab updated automatically</Text>
            </View>
          )}

          <View style={styles.diamRow}>
            <Text style={styles.label}>Field diameter (metres)</Text>
            <TextInput
              style={styles.diamInput}
              value={diameter}
              onChangeText={v => { setDiameter(v); setSaved(false); }}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>

          <View style={styles.fieldCard}>
            <FieldMap
              width={320}
              fielders={localFielders || undefined}
              onFieldersChange={f => { setLocalFielders(f); setSaved(false); }}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saved && styles.saveBtnDone]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>{saved ? '✅ Field Saved' : 'Save Field'}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noSession: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  noSessionIcon: { fontSize: 48, marginBottom: 12 },
  noSessionText: { fontSize: 16, color: '#888', textAlign: 'center' },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a472a', marginBottom: 4 },
  pageSub: { fontSize: 13, color: '#666', marginBottom: 16 },
  savedBanner: { backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#1a472a' },
  savedBannerText: { color: '#1a472a', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: '#444' },
  diamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  diamInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, width: 70, textAlign: 'center', fontSize: 16, backgroundColor: '#fff' },
  fieldCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 16 },
  saveBtn: { backgroundColor: '#1a472a', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnDone: { backgroundColor: '#2e7d32' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});