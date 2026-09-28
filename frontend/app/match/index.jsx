import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, Modal, TextInput, ScrollView
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getMatches, saveMatch, deleteMatch, generateId } from '../../services/matchStorage';

const BALL_TYPES   = ['Leather', 'Tennis', 'Rubber'];
const OVER_OPTIONS = [4, 5, 6, 8, 10, 15, 20, 50];

const PRIMARY = '#0a3d1f';
const ACCENT  = '#f0c040';

export default function MatchListScreen() {
  const router = useRouter();
  const [matches,       setMatches]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [setupVisible,  setSetupVisible]  = useState(false);

  // ── Format: 'limited' | 'test' ───────────────────────────────────────────
  const [matchFormat, setMatchFormat] = useState('limited');

  const [form, setForm] = useState({
    team_a_name:      '',
    team_b_name:      '',
    venue:            '',
    total_overs:      10,
    custom_overs:     '',
    use_custom_overs: false,
    ball_type:        'Leather',
    scorer_name:      '',
    has_powerplay:    false,
    powerplay_end:    6,
    // Test match specific
    overs_per_day:    90,
    custom_overs_per_day: '',
    use_custom_opd:   false,
    follow_on_threshold: 200,
  });

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    setLoading(true);
    const data = await getMatches();
    setMatches(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.team_a_name.trim() || !form.team_b_name.trim()) {
      Alert.alert('Required', 'Please enter both team names');
      return;
    }
    if (form.team_a_name.trim().toLowerCase() === form.team_b_name.trim().toLowerCase()) {
      Alert.alert('Invalid', 'Team names must be different');
      return;
    }

    let totalOvers = form.total_overs;
    if (form.use_custom_overs) {
      const parsed = parseInt(form.custom_overs, 10);
      if (!parsed || parsed < 1) {
        Alert.alert('Invalid overs', 'Please enter a valid number of overs (minimum 1)');
        return;
      }
      totalOvers = parsed;
    }

    let oversPerDay = form.overs_per_day;
    if (matchFormat === 'test' && form.use_custom_opd) {
      const parsed = parseInt(form.custom_overs_per_day, 10);
      if (!parsed || parsed < 1) {
        Alert.alert('Invalid overs per day', 'Please enter a valid number');
        return;
      }
      oversPerDay = parsed;
    }

    const ppEnd = Math.min(form.powerplay_end, totalOvers - 1);

    const newMatch = {
      id:                 generateId(),
      team_a_name:        form.team_a_name.trim(),
      team_b_name:        form.team_b_name.trim(),
      venue:              form.venue.trim(),
      total_overs:        matchFormat === 'test' ? oversPerDay : totalOvers,
      ball_type:          form.ball_type,
      scorer_name:        form.scorer_name.trim(),
      has_powerplay:      matchFormat === 'test' ? false : form.has_powerplay,
      powerplay_end:      matchFormat === 'test' ? null : (form.has_powerplay ? ppEnd : null),
      status:             'toss',
      match_format:       matchFormat,         // 'limited' | 'test'
      // Test-only fields
      overs_per_day:      matchFormat === 'test' ? oversPerDay : null,
      follow_on_threshold: matchFormat === 'test' ? (form.follow_on_threshold || 200) : null,
      max_innings:        matchFormat === 'test' ? 4 : 2,
      current_day:        matchFormat === 'test' ? 1 : null,
      created_at:         new Date().toISOString(),
      match_date:         new Date().toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      }),
    };

    await saveMatch(newMatch);
    setSetupVisible(false);
    resetForm();
    router.push({ pathname: '/match/centre', params: { matchId: newMatch.id } });
  };

  const resetForm = () => {
    setMatchFormat('limited');
    setForm({
      team_a_name:      '',
      team_b_name:      '',
      venue:            '',
      total_overs:      10,
      custom_overs:     '',
      use_custom_overs: false,
      ball_type:        'Leather',
      scorer_name:      '',
      has_powerplay:    false,
      powerplay_end:    6,
      overs_per_day:    90,
      custom_overs_per_day: '',
      use_custom_opd:   false,
      follow_on_threshold: 200,
    });
  };

  const handleDelete = (match) => {
    Alert.alert(
      'Delete Match',
      `Delete "${match.team_a_name} vs ${match.team_b_name}"?\n\nThis will permanently remove all match data.`,
      [
        { text: 'Cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteMatch(match.id);
            load();
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    if (status === 'live' || status === 'innings2' || status === 'innings3' || status === 'innings4') return '#e53935';
    if (status === 'completed' || status === 'drawn' || status === 'forfeited') return '#757575';
    return PRIMARY;
  };

  const getStatusLabel = (status) => {
    if (['live', 'innings2', 'innings3', 'innings4'].includes(status)) return 'LIVE';
    if (status === 'completed') return 'COMPLETED';
    if (status === 'drawn')     return 'DRAWN';
    if (status === 'forfeited') return 'FORFEIT';
    if (status === 'toss')      return 'TOSS';
    return 'SETUP';
  };

  const OPD_OPTIONS = [10, 20, 30, 50, 90];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.startBtn} onPress={() => setSetupVisible(true)}>
        <Text style={styles.startBtnText}>▶ START MATCH</Text>
      </TouchableOpacity>

      <FlatList
        data={matches}
        keyExtractor={item => item.id.toString()}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🏏</Text>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptySub}>Tap "Start Match" to begin</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.matchCard}
            onPress={() => router.push({ pathname: '/match/centre', params: { matchId: item.id } })}
            onLongPress={() => handleDelete(item)}
            activeOpacity={0.8}
          >
            <View style={styles.matchCardHeader}>
              <Text style={styles.matchCardFormat}>
                {item.match_format === 'test'
                  ? `Test Match · ${item.overs_per_day} overs/day · ${item.ball_type} ball`
                  : `${item.ball_type} Ball · ${item.total_overs} Overs`}
                {item.has_powerplay ? ` · PP: 1-${item.powerplay_end}` : ''}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusBadgeText}>{getStatusLabel(item.status)}</Text>
              </View>
            </View>

            <View style={styles.matchCardTeams}>
              <View style={styles.teamRow}>
                <View style={styles.teamCircle}>
                  <Text style={styles.teamInitial}>
                    {(item.team_a_name || 'A')[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.teamName}>{item.team_a_name}</Text>
                {item.innings1_score != null && (
                  <Text style={styles.inningsScore}>
                    {item.innings1_score}/{item.innings1_wickets || 0}
                    {item.innings1_overs ? ` (${item.innings1_overs})` : ''}
                    {item.innings3_score != null
                      ? ` & ${item.innings3_score}/${item.innings3_wickets || 0}`
                      : ''}
                  </Text>
                )}
              </View>
              <View style={styles.teamRow}>
                <View style={[styles.teamCircle, { backgroundColor: '#1a5c35' }]}>
                  <Text style={styles.teamInitial}>
                    {(item.team_b_name || 'B')[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.teamName}>{item.team_b_name}</Text>
                {item.innings2_score != null && (
                  <Text style={styles.inningsScore}>
                    {item.innings2_score}/{item.innings2_wickets || 0}
                    {item.innings4_score != null
                      ? ` & ${item.innings4_score}/${item.innings4_wickets || 0}`
                      : ''}
                  </Text>
                )}
              </View>
            </View>

            {item.venue ? (
              <Text style={styles.matchCardVenue}>📍 {item.venue}</Text>
            ) : null}
            {item.result ? (
              <Text style={styles.matchResult}>{item.result}</Text>
            ) : null}
            <Text style={styles.matchCardDate}>{item.match_date}</Text>
            <Text style={styles.deleteHint}>Hold to delete</Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Setup Modal ── */}
      <Modal visible={setupVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Match</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* ── Format selector ── */}
              <Text style={styles.inputLabel}>Match Format</Text>
              <View style={styles.formatRow}>
                <TouchableOpacity
                  style={[styles.formatBtn, matchFormat === 'limited' && styles.formatBtnActive]}
                  onPress={() => setMatchFormat('limited')}
                >
                  <Text style={[styles.formatBtnText, matchFormat === 'limited' && styles.formatBtnTextActive]}>
                    🏏 Limited Overs
                  </Text>
                  <Text style={[styles.formatBtnSub, matchFormat === 'limited' && { color: '#a5d6a7' }]}>
                    T20, ODI, custom
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formatBtn, matchFormat === 'test' && styles.formatBtnActive]}
                  onPress={() => setMatchFormat('test')}
                >
                  <Text style={[styles.formatBtnText, matchFormat === 'test' && styles.formatBtnTextActive]}>
                    📋 Test Match
                  </Text>
                  <Text style={[styles.formatBtnSub, matchFormat === 'test' && { color: '#a5d6a7' }]}>
                    4 innings, multi-day
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Teams */}
              <View style={styles.teamSetupRow}>
                <View style={styles.teamSetupCol}>
                  <View style={styles.teamSetupCircle}>
                    <Text style={styles.teamSetupLetter}>
                      {form.team_a_name ? form.team_a_name[0].toUpperCase() : 'A'}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.teamNameInput}
                    placeholder="Team A"
                    placeholderTextColor="#aaa"
                    value={form.team_a_name}
                    onChangeText={v => setForm(p => ({ ...p, team_a_name: v }))}
                    textAlign="center"
                  />
                </View>
                <Text style={styles.vsText}>VS</Text>
                <View style={styles.teamSetupCol}>
                  <View style={[styles.teamSetupCircle, { backgroundColor: '#1a5c35' }]}>
                    <Text style={styles.teamSetupLetter}>
                      {form.team_b_name ? form.team_b_name[0].toUpperCase() : 'B'}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.teamNameInput}
                    placeholder="Team B"
                    placeholderTextColor="#aaa"
                    value={form.team_b_name}
                    onChangeText={v => setForm(p => ({ ...p, team_b_name: v }))}
                    textAlign="center"
                  />
                </View>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Venue (optional)"
                value={form.venue}
                onChangeText={v => setForm(p => ({ ...p, venue: v }))}
              />

              {/* ── LIMITED OVERS section ── */}
              {matchFormat === 'limited' && (
                <>
                  <Text style={styles.inputLabel}>Overs per side</Text>
                  <View style={styles.overBtns}>
                    {OVER_OPTIONS.map(o => (
                      <TouchableOpacity
                        key={o}
                        style={[
                          styles.overBtn,
                          !form.use_custom_overs && form.total_overs === o && styles.overBtnActive,
                        ]}
                        onPress={() => setForm(p => ({
                          ...p,
                          total_overs:      o,
                          use_custom_overs: false,
                          powerplay_end:    Math.min(p.powerplay_end, o - 1),
                        }))}
                      >
                        <Text style={[
                          styles.overBtnText,
                          !form.use_custom_overs && form.total_overs === o && styles.overBtnTextActive,
                        ]}>
                          {o}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {/* Other / custom overs */}
                    <TouchableOpacity
                      style={[styles.overBtn, form.use_custom_overs && styles.overBtnActive]}
                      onPress={() => setForm(p => ({ ...p, use_custom_overs: true }))}
                    >
                      <Text style={[styles.overBtnText, form.use_custom_overs && styles.overBtnTextActive]}>
                        Other
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {form.use_custom_overs && (
                    <TextInput
                      style={[styles.input, { marginBottom: 14 }]}
                      placeholder="Enter number of overs (e.g. 18)"
                      keyboardType="number-pad"
                      value={form.custom_overs}
                      onChangeText={v => setForm(p => ({ ...p, custom_overs: v }))}
                    />
                  )}

                  {/* Ball type */}
                  <Text style={styles.inputLabel}>Ball type</Text>
                  <View style={styles.ballTypeBtns}>
                    {BALL_TYPES.map(bt => (
                      <TouchableOpacity
                        key={bt}
                        style={[styles.ballTypeBtn, form.ball_type === bt && styles.ballTypeBtnActive]}
                        onPress={() => setForm(p => ({ ...p, ball_type: bt }))}
                      >
                        <Text style={[
                          styles.ballTypeBtnText,
                          form.ball_type === bt && styles.ballTypeBtnTextActive
                        ]}>
                          {bt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Powerplay toggle */}
                  <Text style={styles.inputLabel}>Powerplay overs?</Text>
                  <View style={styles.ppToggleRow}>
                    {[{ k: false, l: 'No' }, { k: true, l: 'Yes' }].map(opt => (
                      <TouchableOpacity
                        key={String(opt.k)}
                        style={[
                          styles.ppToggleBtn,
                          form.has_powerplay === opt.k && styles.ppToggleBtnActive,
                        ]}
                        onPress={() => setForm(p => ({ ...p, has_powerplay: opt.k }))}
                      >
                        <Text style={[
                          styles.ppToggleBtnText,
                          form.has_powerplay === opt.k && styles.ppToggleBtnTextActive,
                        ]}>
                          {opt.l}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {form.has_powerplay && (
                    <View style={styles.ppEndRow}>
                      <Text style={styles.inputLabel}>
                        Powerplay ends after over
                      </Text>
                      <View style={styles.overBtns}>
                        {Array.from(
                          { length: Math.min((form.use_custom_overs ? parseInt(form.custom_overs,10) : form.total_overs) - 1 || 9, 10) },
                          (_, i) => i + 1
                        ).map(o => (
                          <TouchableOpacity
                            key={o}
                            style={[
                              styles.overBtn,
                              form.powerplay_end === o && styles.overBtnActive,
                            ]}
                            onPress={() => setForm(p => ({ ...p, powerplay_end: o }))}
                          >
                            <Text style={[
                              styles.overBtnText,
                              form.powerplay_end === o && styles.overBtnTextActive,
                            ]}>
                              {o}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* ── TEST MATCH section ── */}
              {matchFormat === 'test' && (
                <>
                  <View style={styles.testInfoBox}>
                    <Text style={styles.testInfoText}>
                      📋 Test Match: 4 innings · Follow-on rule · Declarations · Multi-day play
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>Overs per day</Text>
                  <View style={styles.overBtns}>
                    {OPD_OPTIONS.map(o => (
                      <TouchableOpacity
                        key={o}
                        style={[
                          styles.overBtn,
                          !form.use_custom_opd && form.overs_per_day === o && styles.overBtnActive,
                        ]}
                        onPress={() => setForm(p => ({
                          ...p,
                          overs_per_day:  o,
                          use_custom_opd: false,
                        }))}
                      >
                        <Text style={[
                          styles.overBtnText,
                          !form.use_custom_opd && form.overs_per_day === o && styles.overBtnTextActive,
                        ]}>
                          {o}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.overBtn, form.use_custom_opd && styles.overBtnActive]}
                      onPress={() => setForm(p => ({ ...p, use_custom_opd: true }))}
                    >
                      <Text style={[styles.overBtnText, form.use_custom_opd && styles.overBtnTextActive]}>
                        Other
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {form.use_custom_opd && (
                    <TextInput
                      style={[styles.input, { marginBottom: 14 }]}
                      placeholder="Custom overs per day (e.g. 45)"
                      keyboardType="number-pad"
                      value={form.custom_overs_per_day}
                      onChangeText={v => setForm(p => ({ ...p, custom_overs_per_day: v }))}
                    />
                  )}

                  <Text style={styles.inputLabel}>Follow-on threshold (runs behind)</Text>
                  <View style={styles.overBtns}>
                    {[100, 150, 200].map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.overBtn, form.follow_on_threshold === t && styles.overBtnActive]}
                        onPress={() => setForm(p => ({ ...p, follow_on_threshold: t }))}
                      >
                        <Text style={[
                          styles.overBtnText,
                          form.follow_on_threshold === t && styles.overBtnTextActive,
                        ]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.ppHint}>
                    Standard: 5-day = 200, 3-4 day = 150, 1-2 day = 100
                  </Text>

                  {/* Ball type */}
                  <Text style={styles.inputLabel}>Ball type</Text>
                  <View style={styles.ballTypeBtns}>
                    {BALL_TYPES.map(bt => (
                      <TouchableOpacity
                        key={bt}
                        style={[styles.ballTypeBtn, form.ball_type === bt && styles.ballTypeBtnActive]}
                        onPress={() => setForm(p => ({ ...p, ball_type: bt }))}
                      >
                        <Text style={[
                          styles.ballTypeBtnText,
                          form.ball_type === bt && styles.ballTypeBtnTextActive
                        ]}>
                          {bt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TextInput
                style={styles.input}
                placeholder="Scorer name (optional)"
                value={form.scorer_name}
                onChangeText={v => setForm(p => ({ ...p, scorer_name: v }))}
              />

              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setSetupVisible(false); resetForm(); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                  <Text style={styles.createBtnText}>Start Match →</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:              { flex: 1, backgroundColor: '#f4f6f4', padding: 16 },
  center:                 { flex: 1, justifyContent: 'center', alignItems: 'center' },
  startBtn:               { backgroundColor: PRIMARY, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  startBtnText:           { color: ACCENT, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  empty:                  { alignItems: 'center', marginTop: 60 },
  emptyIcon:              { fontSize: 48, marginBottom: 8 },
  emptyTitle:             { fontSize: 18, fontWeight: 'bold', color: PRIMARY, marginBottom: 4 },
  emptySub:               { fontSize: 13, color: '#888' },
  matchCard:              { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  matchCardHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  matchCardFormat:        { fontSize: 11, color: '#888', flex: 1, marginRight: 8 },
  statusBadge:            { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusBadgeText:        { color: '#fff', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  matchCardTeams:         { gap: 8, marginBottom: 8 },
  teamRow:                { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamCircle:             { width: 34, height: 34, borderRadius: 17, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  teamInitial:            { color: ACCENT, fontWeight: 'bold', fontSize: 14 },
  teamName:               { fontSize: 16, fontWeight: '600', color: '#222', flex: 1 },
  inningsScore:           { fontSize: 14, fontWeight: 'bold', color: PRIMARY },
  matchCardVenue:         { fontSize: 11, color: '#888', marginBottom: 2 },
  matchResult:            { fontSize: 13, color: '#1565c0', fontWeight: '600', marginTop: 4 },
  matchCardDate:          { fontSize: 11, color: '#aaa', marginTop: 4 },
  deleteHint:             { fontSize: 10, color: '#ddd', marginTop: 4, textAlign: 'right' },
  modalOverlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 16 },
  modalBox:               { backgroundColor: '#fff', borderRadius: 18, padding: 20, maxHeight: '94%' },
  modalTitle:             { fontSize: 22, fontWeight: 'bold', color: PRIMARY, textAlign: 'center', marginBottom: 16 },
  formatRow:              { flexDirection: 'row', gap: 8, marginBottom: 16 },
  formatBtn:              { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fafafa', alignItems: 'center' },
  formatBtnActive:        { backgroundColor: PRIMARY, borderColor: PRIMARY },
  formatBtnText:          { fontSize: 14, fontWeight: 'bold', color: '#555', textAlign: 'center' },
  formatBtnTextActive:    { color: '#fff' },
  formatBtnSub:           { fontSize: 10, color: '#aaa', marginTop: 3, textAlign: 'center' },
  testInfoBox:            { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 14 },
  testInfoText:           { fontSize: 12, color: PRIMARY, lineHeight: 18 },
  teamSetupRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  teamSetupCol:           { flex: 1, alignItems: 'center', gap: 8 },
  teamSetupCircle:        { width: 64, height: 64, borderRadius: 32, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  teamSetupLetter:        { color: ACCENT, fontSize: 28, fontWeight: 'bold' },
  teamNameInput:          { borderBottomWidth: 1.5, borderBottomColor: PRIMARY, width: '100%', padding: 8, fontSize: 15, color: '#222' },
  vsText:                 { fontSize: 18, fontWeight: 'bold', color: '#aaa', paddingHorizontal: 8 },
  input:                  { borderBottomWidth: 1, borderBottomColor: '#ddd', padding: 10, fontSize: 15, marginBottom: 14, color: '#222' },
  inputLabel:             { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 6, marginTop: 4 },
  overBtns:               { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  overBtn:                { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fafafa' },
  overBtnActive:          { backgroundColor: PRIMARY, borderColor: PRIMARY },
  overBtnText:            { fontSize: 13, color: '#555' },
  overBtnTextActive:      { color: '#fff', fontWeight: 'bold' },
  ballTypeBtns:           { flexDirection: 'row', gap: 8, marginBottom: 14 },
  ballTypeBtn:            { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', backgroundColor: '#fafafa' },
  ballTypeBtnActive:      { backgroundColor: PRIMARY, borderColor: PRIMARY },
  ballTypeBtnText:        { fontSize: 13, color: '#555' },
  ballTypeBtnTextActive:  { color: '#fff', fontWeight: 'bold' },
  ppToggleRow:            { flexDirection: 'row', gap: 8, marginBottom: 10 },
  ppToggleBtn:            { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', alignItems: 'center', backgroundColor: '#fafafa' },
  ppToggleBtnActive:      { backgroundColor: PRIMARY, borderColor: PRIMARY },
  ppToggleBtnText:        { fontSize: 13, color: '#555' },
  ppToggleBtnTextActive:  { color: '#fff', fontWeight: 'bold' },
  ppEndRow:               { marginBottom: 14 },
  ppHint:                 { fontSize: 11, color: '#888', marginTop: 4, fontStyle: 'italic', marginBottom: 14 },
  modalBtns:              { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn:              { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  cancelBtnText:          { color: '#666', fontWeight: '600' },
  createBtn:              { flex: 1, padding: 13, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  createBtnText:          { color: ACCENT, fontWeight: 'bold', fontSize: 15 },
});