import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, TextInput
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { saveField, getField } from '../../services/api';
import FieldMap, { DEFAULT_FIELDERS } from '../../components/FieldMap';
import SessionPicker from '../../components/SessionPicker';

export default function FieldScreen() {
  const { activeSession, refreshField, refreshSessions } = useSession();

  const [localFielders, setLocalFielders]     = useState(null);
  const [diameter, setDiameter]               = useState('65');
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [loadedForSessionId, setLoadedForId]  = useState(null);

  // ── Load field whenever active session changes ───────────────────────────
  const loadFieldForSession = useCallback(async (session) => {
    if (!session) return;
    setLoading(true);
    setSaved(false);
    setLocalFielders(null);
    setDiameter('65');
    setLoadedForId(null);

    try {
      const res = await getField(session.id);
      const data = res.data.data;

      if (data && data.session_id === session.id) {
        // Parse positions — handle both object and string forms
        let positions = data.positions;
        if (typeof positions === 'string') {
          positions = JSON.parse(positions);
        }
        setLocalFielders(positions);
        setDiameter(String(data.field_diameter || 65));
      } else {
        // No field saved yet — use defaults
        setLocalFielders([...DEFAULT_FIELDERS]);
        setDiameter('65');
      }
      setLoadedForId(session.id);
    } catch {
      setLocalFielders([...DEFAULT_FIELDERS]);
      setDiameter('65');
      setLoadedForId(session.id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSession) loadFieldForSession(activeSession);
    else {
      setLocalFielders(null);
      setDiameter('65');
      setLoadedForId(null);
    }
  }, [activeSession?.id]);

  useFocusEffect(useCallback(() => {
    if (activeSession) loadFieldForSession(activeSession);
  }, [activeSession?.id]));

  // ── Save field ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!activeSession) {
      Alert.alert('No session', 'Select a session first');
      return;
    }
    if (loadedForSessionId !== activeSession.id) {
      Alert.alert('Not ready', 'Please wait for the field to finish loading');
      return;
    }

    const positionsToSave = localFielders || DEFAULT_FIELDERS;

    setSaving(true);
    try {
      const payload = {
        session_id: activeSession.id,
        positions: positionsToSave,
        field_diameter: parseFloat(diameter) || 65,
      };

      const res = await saveField(payload);

      if (!res.data.data || res.data.data.session_id !== activeSession.id) {
        Alert.alert('Error', 'Field saved to wrong session — please try again');
        return;
      }

      await refreshField(activeSession.id);
      await refreshSessions();
      setSaved(true);
      Alert.alert('✅ Saved', `Field saved for "${activeSession.session_name}"`);
    } catch (e) {
      Alert.alert('Error', `Could not save field: ${e.message}`);
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

          {/* Session identity badge */}
          <View style={styles.sessionBadge}>
            <Text style={styles.sessionBadgeText}>
              Session #{activeSession.id} · {activeSession.session_name}
            </Text>
          </View>

          {saved && (
            <View style={styles.savedBanner}>
              <Text style={styles.savedBannerText}>
                ✅ Field saved for "{activeSession.session_name}" only
              </Text>
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

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#1a472a" />
              <Text style={styles.loadingText}>
                Loading field for {activeSession.session_name}...
              </Text>
            </View>
          ) : (
            <View style={styles.fieldCard}>
              <FieldMap
                key={`field-${activeSession.id}`}
                width={320}
                fielders={localFielders || DEFAULT_FIELDERS}
                onFieldersChange={f => {
                  setLocalFielders(f);
                  setSaved(false);
                }}
              />
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.saveBtn,
              saved && styles.saveBtnDone,
              (saving || loading) && styles.saveBtnDisabled,
            ]}
            onPress={handleSave}
            disabled={saving || loading}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : (
                <Text style={styles.saveBtnText}>
                  {saved
                    ? '✅ Field Saved'
                    : `Save Field for "${activeSession.session_name}"`}
                </Text>
              )
            }
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noSession: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40
  },
  noSessionIcon: { fontSize: 48, marginBottom: 12 },
  noSessionText: { fontSize: 16, color: '#888', textAlign: 'center' },
  pageTitle: {
    fontSize: 22, fontWeight: 'bold', color: '#1a472a', marginBottom: 8
  },
  sessionBadge: {
    backgroundColor: '#e8f5e9', borderRadius: 8, padding: 8,
    marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#1a472a'
  },
  sessionBadgeText: { fontSize: 12, color: '#2e7d32', fontWeight: '500' },
  savedBanner: {
    backgroundColor: '#e8f5e9', borderRadius: 8, padding: 10,
    marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#1a472a'
  },
  savedBannerText: { color: '#1a472a', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: '#444' },
  diamRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16
  },
  diamInput: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 8, width: 70, textAlign: 'center',
    fontSize: 16, backgroundColor: '#fff'
  },
  loadingBox: { alignItems: 'center', padding: 40, gap: 12 },
  loadingText: { color: '#888', fontSize: 14 },
  fieldCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    alignItems: 'center', shadowColor: '#000',
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 16
  },
  saveBtn: {
    backgroundColor: '#1a472a', padding: 16,
    borderRadius: 12, alignItems: 'center'
  },
  saveBtnDone: { backgroundColor: '#2e7d32' },
  saveBtnDisabled: { backgroundColor: '#aaa' },
  saveBtnText: {
    color: '#fff', fontSize: 15, fontWeight: 'bold', textAlign: 'center'
  },
});