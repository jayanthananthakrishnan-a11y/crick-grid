import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator,
  RefreshControl, ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSession } from '../context/SessionContext';
import { createSession, deleteSession, saveField } from '../services/api';
import FieldMap from '../components/FieldMap';

const STEPS = ['details', 'field'];

// Handedness selector — correct icons
function HandednessSelector({ label, value, onChange, type = 'bat' }) {
  const icons = type === 'bowl'
    ? { right: '🏏 Right arm', left: '🏏 Left arm' }
    : { right: '🏏 Right hand', left: '🏏 Left hand' };

  return (
    <View style={styles.handednessRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.handBtnGroup}>
        {['right', 'left'].map(h => (
          <TouchableOpacity
            key={h}
            style={[styles.handBtn, value === h && styles.handBtnActive]}
            onPress={() => onChange(h)}
          >
            <Text style={[styles.handBtnText, value === h && styles.handBtnTextActive]}>
              {icons[h]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Over/Around the wicket selector
function WicketSideSelector({ value, onChange }) {
  return (
    <View style={styles.handednessRow}>
      <Text style={styles.inputLabel}>Bowling angle</Text>
      <View style={styles.handBtnGroup}>
        {[
          { key: 'over', label: '↑ Over the wicket' },
          { key: 'around', label: '↓ Around the wicket' },
        ].map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.handBtn, value === opt.key && styles.handBtnActive]}
            onPress={() => onChange(opt.key)}
          >
            <Text style={[styles.handBtnText, value === opt.key && styles.handBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function SessionsScreen() {
  const { sessions, activeSession, setActiveSession, loadingSessions, refreshSessions } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState('details');
  const [newSessionId, setNewSessionId] = useState(null);
  const [fielders, setFielders] = useState(null);
  const [fieldDiameter, setFieldDiameter] = useState('65');
  const [savingField, setSavingField] = useState(false);
  const [form, setForm] = useState({
    session_name: '',
    bowler_name: '',
    batsman_name: '',
    notes: '',
    bowler_handedness: 'right',
    batter_handedness: 'right',
    bowling_side: 'over',
  });

  useFocusEffect(useCallback(() => { refreshSessions(); }, [refreshSessions]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSessions();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!form.session_name.trim()) {
      Alert.alert('Required', 'Please enter a session name');
      return;
    }
    try {
      const res = await createSession(form);
      const newSession = res.data.data;
      setNewSessionId(newSession.id);
      setActiveSession(newSession);
      await refreshSessions();
      setStep('field');
    } catch {
      Alert.alert('Error', 'Could not create session');
    }
  };

  const handleSaveField = async (skip = false) => {
    if (!skip && fielders) {
      setSavingField(true);
      try {
        await saveField({
          session_id: newSessionId,
          positions: fielders,
          field_diameter: parseFloat(fieldDiameter) || 65,
        });
      } catch {
        Alert.alert('Warning', 'Session created but field could not be saved. Set it later in the Field tab.');
      } finally {
        setSavingField(false);
      }
    }
    closeModal();
    refreshSessions();
  };

  const closeModal = () => {
    setModalVisible(false);
    setStep('details');
    setNewSessionId(null);
    setFielders(null);
    setFieldDiameter('65');
    setForm({
      session_name: '', bowler_name: '', batsman_name: '', notes: '',
      bowler_handedness: 'right', batter_handedness: 'right', bowling_side: 'over',
    });
  };

  const handleDelete = (id, name) => {
    Alert.alert('Delete Session', `Delete "${name}"?`, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteSession(id);
          if (activeSession?.id === id) setActiveSession(null);
          refreshSessions();
        }
      },
    ]);
  };

  if (loadingSessions && sessions.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a472a" />
        <Text style={{ color: '#666', marginTop: 8 }}>Connecting to server...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
        <Text style={styles.addBtnText}>+ New Session</Text>
      </TouchableOpacity>

      {activeSession && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerLabel}>ACTIVE SESSION</Text>
          <Text style={styles.activeBannerName}>{activeSession.session_name}</Text>
          <Text style={styles.activeBannerSub}>
            {activeSession.total_balls} balls · Used across all tabs
          </Text>
        </View>
      )}

      <FlatList
        data={sessions}
        keyExtractor={item => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏏</Text>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySub}>Tap "+ New Session" to get started</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = activeSession?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => setActiveSession(item)}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  {isActive && <View style={styles.activeDot} />}
                  <Text style={[styles.cardTitle, isActive && styles.cardTitleActive]}>
                    {item.session_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id, item.session_name)}>
                  <Text style={styles.deleteBtn}>🗑️</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.cardSub}>
                🏏 {item.bowler_name || '—'}
                {' ('}
                {item.bowler_handedness === 'left' ? 'Left arm' : 'Right arm'}
                {item.bowling_side === 'around' ? ', around wicket' : ', over wicket'}
                {') vs 🏏 '}
                {item.batsman_name || '—'}
                {' ('}
                {item.batter_handedness === 'left' ? 'LH' : 'RH'}
                {')'}
              </Text>
              <Text style={styles.cardSub}>📅 {new Date(item.date).toLocaleDateString()}</Text>

              <View style={styles.cardFooter}>
                <Text style={styles.ballCount}>{item.total_balls} balls logged</Text>
                {isActive
                  ? <View style={styles.activeTag}><Text style={styles.activeTagText}>✓ Active</Text></View>
                  : <Text style={styles.tapToSelect}>Tap to select →</Text>
                }
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>

            <View style={styles.stepIndicator}>
              {STEPS.map((s, i) => (
                <View key={s} style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    step === s && styles.stepDotActive,
                    STEPS.indexOf(step) > i && styles.stepDotDone,
                  ]}>
                    <Text style={styles.stepDotText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
                    {s === 'details' ? 'Details' : 'Field'}
                  </Text>
                </View>
              ))}
            </View>

            {step === 'details' && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>New Session</Text>

                <Text style={styles.inputLabel}>Session Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Morning Nets 12 Apr"
                  value={form.session_name}
                  onChangeText={v => setForm(p => ({ ...p, session_name: v }))}
                />

                {/* Bowler section */}
                <View style={styles.playerSection}>
                  {/* Cricket ball icon — correct */}
                  <Text style={styles.playerSectionTitle}>🏏 Bowler</Text>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Jasprit Bumrah"
                    value={form.bowler_name}
                    onChangeText={v => setForm(p => ({ ...p, bowler_name: v }))}
                  />
                  <HandednessSelector
                    label="Bowling arm"
                    value={form.bowler_handedness}
                    onChange={v => setForm(p => ({ ...p, bowler_handedness: v }))}
                    type="bowl"
                  />
                  <WicketSideSelector
                    value={form.bowling_side}
                    onChange={v => setForm(p => ({ ...p, bowling_side: v }))}
                  />
                </View>

                {/* Batter section */}
                <View style={styles.playerSection}>
                  <Text style={styles.playerSectionTitle}>🏏 Batsman</Text>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Virat Kohli"
                    value={form.batsman_name}
                    onChangeText={v => setForm(p => ({ ...p, batsman_name: v }))}
                  />
                  <HandednessSelector
                    label="Batting hand"
                    value={form.batter_handedness}
                    onChange={v => setForm(p => ({ ...p, batter_handedness: v }))}
                    type="bat"
                  />
                </View>

                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Optional..."
                  value={form.notes}
                  onChangeText={v => setForm(p => ({ ...p, notes: v }))}
                />

                {/* Match preview */}
                <View style={styles.handednessPreview}>
                  <Text style={styles.previewTitle}>Match-up preview</Text>
                  <Text style={styles.previewText}>
                    {form.bowler_handedness === 'left' ? 'Left-arm' : 'Right-arm'} bowler
                    {' ('}{form.bowling_side === 'around' ? 'around wicket' : 'over wicket'}{')'}
                    {' vs '}
                    {form.batter_handedness === 'left' ? 'left-handed' : 'right-handed'} batter
                  </Text>
                  <Text style={styles.previewHint}>
                    {form.bowler_handedness !== form.batter_handedness
                      ? '↔️ Cross-handed match-up'
                      : '⬆️ Same-hand match-up'}
                    {form.bowling_side === 'around'
                      ? ' · Around the wicket angle'
                      : ' · Over the wicket angle'}
                  </Text>
                </View>

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleCreate}>
                    <Text style={styles.saveBtnText}>Next: Set Field →</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {step === 'field' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Set the Field</Text>
                <Text style={styles.modalSub}>Arrange fielders or skip and set later.</Text>
                <View style={styles.diamRow}>
                  <Text style={styles.inputLabel}>Field diameter (m)</Text>
                  <TextInput
                    style={styles.diamInput}
                    value={fieldDiameter}
                    onChangeText={setFieldDiameter}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  <FieldMap width={300} fielders={fielders || undefined} onFieldersChange={setFielders} />
                </View>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.skipBtn} onPress={() => handleSaveField(true)}>
                    <Text style={styles.skipBtnText}>Skip for now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveField(false)} disabled={savingField}>
                    {savingField
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.saveBtnText}>Save & Start</Text>
                    }
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  addBtn: { backgroundColor: '#1a472a', padding: 14, borderRadius: 10, marginBottom: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  activeBanner: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#1a472a' },
  activeBannerLabel: { fontSize: 10, color: '#555', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  activeBannerName: { fontSize: 16, fontWeight: 'bold', color: '#1a472a', marginTop: 2 },
  activeBannerSub: { fontSize: 12, color: '#666', marginTop: 2 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a472a' },
  emptySub: { fontSize: 13, color: '#888', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, borderWidth: 1.5, borderColor: 'transparent' },
  cardActive: { borderColor: '#1a472a', backgroundColor: '#f0fff4' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a472a' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 },
  cardTitleActive: { color: '#1a472a' },
  deleteBtn: { fontSize: 18 },
  cardSub: { color: '#555', fontSize: 12, marginBottom: 2, lineHeight: 18 },
  cardFooter: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ballCount: { color: '#1a472a', fontWeight: '600', fontSize: 13 },
  activeTag: { backgroundColor: '#1a472a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activeTagText: { color: '#f0c040', fontSize: 11, fontWeight: 'bold' },
  tapToSelect: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '94%' },
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 32 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#1a472a' },
  stepDotDone: { backgroundColor: '#4caf50' },
  stepDotText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  stepLabel: { fontSize: 11, color: '#aaa' },
  stepLabelActive: { color: '#1a472a', fontWeight: '600' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a472a', marginBottom: 12, textAlign: 'center' },
  modalSub: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12 },
  playerSection: { backgroundColor: '#f8fff8', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#c8e6c9' },
  playerSectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a472a', marginBottom: 10 },
  inputLabel: { fontSize: 13, color: '#444', marginBottom: 4, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fff', marginBottom: 10 },
  handednessRow: { marginBottom: 10 },
  handBtnGroup: { flexDirection: 'row', gap: 8, marginTop: 4 },
  handBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff', alignItems: 'center' },
  handBtnActive: { backgroundColor: '#1a472a', borderColor: '#1a472a' },
  handBtnText: { fontSize: 12, color: '#555' },
  handBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  handednessPreview: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 12 },
  previewTitle: { fontSize: 11, color: '#555', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  previewText: { fontSize: 14, fontWeight: '600', color: '#1a472a' },
  previewHint: { fontSize: 12, color: '#555', marginTop: 3 },
  diamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  diamInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, width: 70, textAlign: 'center', fontSize: 16, backgroundColor: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  skipBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#bbb', alignItems: 'center', backgroundColor: '#f5f5f5' },
  skipBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#1a472a', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
});