import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ActivityIndicator,
  RefreshControl, ScrollView
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { createSession, deleteSession, saveField } from '../../services/api';
import FieldMap, { DEFAULT_FIELDERS } from '../../components/FieldMap';

const STEPS = ['details', 'field'];

function HandednessSelector({ label, value, onChange, type = 'bat' }) {
  const options = type === 'bowl'
    ? [{ key: 'right', label: 'Right arm' }, { key: 'left', label: 'Left arm' }]
    : [{ key: 'right', label: 'Right hand' }, { key: 'left', label: 'Left hand' }];
  return (
    <View style={styles.selectorRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.btnGroup}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.groupBtn, value === opt.key && styles.groupBtnActive]}
            onPress={() => onChange(opt.key)}
          >
            <Text style={[styles.groupBtnText, value === opt.key && styles.groupBtnTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function SessionsScreen() {
  const {
    sessions, activeSession, setActiveSession,
    loadingSessions, refreshSessions
  } = useSession();

  const [refreshing, setRefreshing]       = useState(false);
  const [modalVisible, setModalVisible]   = useState(false);
  const [step, setStep]                   = useState('details');
  const [newSessionId, setNewSessionId]   = useState(null);
  // fielders starts as DEFAULT so Step 2 always has something to save
  const [fielders, setFielders]           = useState([...DEFAULT_FIELDERS]);
  const [fieldDiameter, setFieldDiameter] = useState('65');
  const [savingField, setSavingField]     = useState(false);
  const [form, setForm] = useState({
    session_name:      '',
    bowler_name:       '',
    batsman_name:      '',
    notes:             '',
    bowler_handedness: 'right',
    batter_handedness: 'right',
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
    if (!newSessionId) {
      closeModal();
      refreshSessions();
      return;
    }

    setSavingField(true);
    try {
      // Always save something — either the user's layout or the defaults
      const positionsToSave = fielders?.length ? fielders : DEFAULT_FIELDERS;
      await saveField({
        session_id:     newSessionId,
        positions:      positionsToSave,
        field_diameter: parseFloat(fieldDiameter) || 65,
      });
    } catch {
      if (!skip) {
        Alert.alert(
          'Warning',
          'Session created but field could not be saved. Set it later in the Field tab.'
        );
      }
    } finally {
      setSavingField(false);
    }

    closeModal();
    refreshSessions();
  };

  const closeModal = () => {
    setModalVisible(false);
    setStep('details');
    setNewSessionId(null);
    setFielders([...DEFAULT_FIELDERS]);
    setFieldDiameter('65');
    setForm({
      session_name:      '',
      bowler_name:       '',
      batsman_name:      '',
      notes:             '',
      bowler_handedness: 'right',
      batter_handedness: 'right',
    });
  };

  const handleDelete = (id, name, e) => {
    e?.stopPropagation?.();
    Alert.alert('Delete Session', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSession(id);
            if (activeSession?.id === id) setActiveSession(null);
            await refreshSessions();
          } catch {
            Alert.alert('Error', 'Could not delete session');
          }
        },
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
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setModalVisible(true)}
      >
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
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
                <TouchableOpacity style={{ padding: 6 }} onPress={(e) => handleDelete(item.id, item.session_name, e)}>
                  <Text style={styles.deleteBtn}>🗑️</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cardSub}>
                🏏 {item.bowler_name || '—'}
                {' ('}{item.bowler_handedness === 'left' ? 'Left arm' : 'Right arm'}{')'}
                {'  vs  '}
                🏏 {item.batsman_name || '—'}
                {' ('}{item.batter_handedness === 'left' ? 'LH' : 'RH'}{')'}
              </Text>
              <Text style={styles.cardSub}>
                📅 {new Date(item.date).toLocaleDateString()}
              </Text>
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

      {/* ── Create Session Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>

            {/* Step indicator */}
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
                  <Text style={[
                    styles.stepLabel,
                    step === s && styles.stepLabelActive
                  ]}>
                    {s === 'details' ? 'Details' : 'Field'}
                  </Text>
                </View>
              ))}
            </View>

            {/* Step 1 — Details */}
            {step === 'details' && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.modalTitle}>New Session</Text>

                <Text style={styles.inputLabel}>Session Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Morning Nets 12 Apr"
                  value={form.session_name}
                  onChangeText={v => setForm(p => ({ ...p, session_name: v }))}
                />

                {/* Bowler */}
                <View style={styles.playerSection}>
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
                </View>

                {/* Batter */}
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

                <View style={styles.preview}>
                  <Text style={styles.previewTitle}>Match-up</Text>
                  <Text style={styles.previewText}>
                    {form.bowler_handedness === 'left' ? 'Left-arm' : 'Right-arm'} bowler
                    {' vs '}
                    {form.batter_handedness === 'left' ? 'left-handed' : 'right-handed'} batter
                  </Text>
                  <Text style={styles.previewHint}>
                    Over/Around the wicket is set per-ball in the Log tab
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

            {/* Step 2 — Field */}
            {step === 'field' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Set the Field</Text>
                <Text style={styles.modalSub}>
                  Tap a fielder then tap the destination to move them.
                  If you skip, default positions will be saved automatically.
                </Text>

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
                  <FieldMap
                    key={`new-session-field-${newSessionId}`}
                    width={300}
                    fielders={fielders}
                    onFieldersChange={setFielders}
                    onMount={defaults => {
                      // Capture defaults so save always has something
                      if (!fielders?.length) setFielders(defaults);
                    }}
                  />
                </View>

                <View style={styles.fieldSetBadge}>
                  <Text style={styles.fieldSetText}>
                    ✓ {fielders?.length || 10} fielder positions ready
                  </Text>
                </View>

                <View style={styles.modalBtns}>
                  <TouchableOpacity
                    style={styles.skipBtn}
                    onPress={() => handleSaveField(true)}
                    disabled={savingField}
                  >
                    <Text style={styles.skipBtnText}>Skip (save defaults)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => handleSaveField(false)}
                    disabled={savingField}
                  >
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
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  addBtn: {
    backgroundColor: '#1a472a', padding: 14, borderRadius: 10,
    marginBottom: 12, alignItems: 'center'
  },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  activeBanner: {
    backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12,
    marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#1a472a'
  },
  activeBannerLabel: {
    fontSize: 10, color: '#555', fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase'
  },
  activeBannerName: {
    fontSize: 16, fontWeight: 'bold', color: '#1a472a', marginTop: 2
  },
  activeBannerSub: { fontSize: 12, color: '#666', marginTop: 2 },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1a472a' },
  emptySub:   { fontSize: 13, color: '#888', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1.5, borderColor: 'transparent'
  },
  cardActive: { borderColor: '#1a472a', backgroundColor: '#f0fff4' },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  activeDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a472a' },
  cardTitle:   { fontSize: 16, fontWeight: 'bold', color: '#333', flex: 1 },
  cardTitleActive: { color: '#1a472a' },
  deleteBtn:   { fontSize: 18 },
  cardSub:     { color: '#555', fontSize: 12, marginBottom: 2, lineHeight: 18 },
  cardFooter: {
    marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee',
    paddingTop: 8, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center'
  },
  ballCount:   { color: '#1a472a', fontWeight: '600', fontSize: 13 },
  activeTag: {
    backgroundColor: '#1a472a', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 10
  },
  activeTagText: { color: '#f0c040', fontSize: 11, fontWeight: 'bold' },
  tapToSelect:   { fontSize: 12, color: '#999', fontStyle: 'italic' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', padding: 16
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 20, maxHeight: '94%'
  },
  stepIndicator: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16, gap: 32
  },
  stepItem:  { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#e0e0e0',
    alignItems: 'center', justifyContent: 'center'
  },
  stepDotActive: { backgroundColor: '#1a472a' },
  stepDotDone:   { backgroundColor: '#4caf50' },
  stepDotText:   { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  stepLabel:      { fontSize: 11, color: '#aaa' },
  stepLabelActive: { color: '#1a472a', fontWeight: '600' },
  modalTitle: {
    fontSize: 20, fontWeight: 'bold', color: '#1a472a',
    marginBottom: 12, textAlign: 'center'
  },
  modalSub: {
    fontSize: 12, color: '#777', textAlign: 'center',
    marginBottom: 14, lineHeight: 18
  },
  playerSection: {
    backgroundColor: '#f8fff8', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#c8e6c9'
  },
  playerSectionTitle: {
    fontSize: 15, fontWeight: 'bold', color: '#1a472a', marginBottom: 10
  },
  inputLabel: { fontSize: 13, color: '#444', marginBottom: 4, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 15, backgroundColor: '#fff', marginBottom: 10
  },
  selectorRow: { marginBottom: 8 },
  btnGroup:    { flexDirection: 'row', gap: 8, marginTop: 4 },
  groupBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff',
    alignItems: 'center'
  },
  groupBtnActive: { backgroundColor: '#1a472a', borderColor: '#1a472a' },
  groupBtnText:   { fontSize: 13, color: '#555' },
  groupBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  preview: {
    backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 12
  },
  previewTitle: {
    fontSize: 11, color: '#555', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4
  },
  previewText: { fontSize: 14, fontWeight: '600', color: '#1a472a' },
  previewHint: { fontSize: 11, color: '#666', marginTop: 4, fontStyle: 'italic' },
  diamRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10
  },
  diamInput: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 8, width: 70, textAlign: 'center',
    fontSize: 16, backgroundColor: '#fff'
  },
  fieldSetBadge: {
    backgroundColor: '#e8f5e9', borderRadius: 8,
    padding: 8, alignItems: 'center', marginBottom: 8
  },
  fieldSetText: { color: '#1a472a', fontWeight: '600', fontSize: 13 },
  modalBtns:  { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#ddd', alignItems: 'center'
  },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  skipBtn: {
    flex: 1, padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#bbb',
    alignItems: 'center', backgroundColor: '#f5f5f5'
  },
  skipBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: {
    flex: 1, padding: 12, borderRadius: 8,
    backgroundColor: '#1a472a', alignItems: 'center'
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
});