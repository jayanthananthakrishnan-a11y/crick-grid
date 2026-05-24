import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSession } from '../context/SessionContext';
import { logBall, getBallsForSession, calculateScore } from '../services/api';
import PitchMap from '../components/PitchMap';
import SessionPicker from '../components/SessionPicker';
import ShotDirection from '../components/ShotDirection';

const SW = Dimensions.get('window').width;

const OPTIONS = {
  length: ['yorker', 'full_toss', 'good_length', 'slot', 'short'],
  line: ['wide_outside_off', 'outside_off', 'straight', 'outside_leg', 'wide_outside_leg'],
  delivery: ['inswing', 'outswing', 'off_spin', 'leg_spin', 'straight', 'googly', 'bouncer'],
  contact: ['middle', 'edge', 'leading_edge', 'miss', 'pad'],
  shot: ['drive', 'backfoot_drive', 'pull', 'backfoot_punch', 'cut', 'glance', 'sweep', 'defend', 'leave', 'lofted_drive', 'slog'],
};

const LABELS = {
  yorker: 'Yorker', full_toss: 'Full Toss', good_length: 'Good Length', slot: 'The Slot', short: 'Short',
  wide_outside_off: 'Wide Off', outside_off: 'Outside Off', straight: 'Straight',
  outside_leg: 'Outside Leg', wide_outside_leg: 'Wide Leg',
  inswing: 'Inswing', outswing: 'Outswing', off_spin: 'Off Spin',
  leg_spin: 'Leg Spin', googly: 'Googly', bouncer: 'Bouncer',
  middle: 'Middled', edge: 'Edge', leading_edge: 'Leading Edge', miss: 'Missed', pad: 'Pad',
  drive: 'Drive', backfoot_drive: 'BF Drive', pull: 'Pull', backfoot_punch: 'BF Punch',
  cut: 'Cut', glance: 'Glance', sweep: 'Sweep', defend: 'Defend',
  leave: 'Leave', lofted_drive: 'Lofted Drive', slog: 'Slog',
};

function OptionGroup({ label, options, selected, onSelect }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.optBtn, selected === opt && styles.optBtnActive]}
            onPress={() => onSelect(selected === opt ? null : opt)}
          >
            <Text style={[styles.optText, selected === opt && styles.optTextActive]}>
              {LABELS[opt] || opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ToggleBtn({ label, value, onToggle, activeColor = '#c62828' }) {
  return (
    <TouchableOpacity
      style={[styles.toggleBtn, value && { backgroundColor: activeColor, borderColor: activeColor }]}
      onPress={onToggle}
    >
      <Text style={[styles.toggleBtnText, value && styles.toggleBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ScorePopup({ score, onClose }) {
  if (!score) return null;
  const isWicket = !!score.wicket_type;
  const colors = { 0: '#9e9e9e', 1: '#1976d2', 2: '#388e3c', 3: '#f57c00', 4: '#c62828', 6: '#6a1b9a' };
  const c = isWicket ? '#b71c1c' : (colors[Math.min(score.runs, 6)] || '#1a472a');
  return (
    <View style={[styles.scorePopup, { borderColor: c }]}>
      {isWicket ? (
        <>
          <Text style={styles.scorePopupWicket}>⚡ WICKET</Text>
          <Text style={[styles.scorePopupWicketType, { color: c }]}>{score.wicket_type}</Text>
          {score.fielder_caught && (
            <Text style={styles.scorePopupFielder}>Caught by {score.fielder_caught}</Text>
          )}
        </>
      ) : (
        <>
          <Text style={[styles.scorePopupRuns, { color: c }]}>{score.runs}</Text>
          <Text style={styles.scorePopupLabel}>RUNS</Text>
        </>
      )}
      <Text style={styles.scorePopupReason}>{score.reason}</Text>
      <TouchableOpacity style={[styles.scorePopupBtn, { backgroundColor: c }]} onPress={onClose}>
        <Text style={styles.scorePopupBtnText}>OK</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function LogBallScreen() {
  const { activeSession, fieldPositions, refreshSessions } = useSession();
  const [ballCount, setBallCount] = useState(0);
  const [logging, setLogging] = useState(false);
  const [pitchTap, setPitchTap] = useState(null);
  const [contactTap, setContactTap] = useState(null);
  const [shotArrow, setShotArrow] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const [previousBalls, setPreviousBalls] = useState([]);
  const [loadingSession, setLoadingSession] = useState(false);

  const [sel, setSel] = useState({
    length_type: null, line_type: null, delivery_type: null,
    contact_type: null, shot_type: null,
    is_wide: false, is_no_ball: false,
    is_lofted: false, batter_stepped_out: false, is_stumped: false,
  });

  useFocusEffect(useCallback(() => {
    if (activeSession) loadBalls(activeSession.id);
  }, [activeSession?.id]));

  useEffect(() => {
    if (!activeSession) { setBallCount(0); setPreviousBalls([]); return; }
    loadBalls(activeSession.id);
  }, [activeSession?.id]);

  const loadBalls = async (sessionId) => {
    setLoadingSession(true);
    try {
      const res = await getBallsForSession(sessionId);
      setBallCount(res.data.data.length);
      setPreviousBalls(res.data.data);
    } catch {
      setBallCount(activeSession?.total_balls || 0);
    } finally {
      setLoadingSession(false);
    }
  };

  const set = (key, val) => setSel(p => ({ ...p, [key]: val }));
  const toggle = (key) => setSel(p => ({ ...p, [key]: !p[key] }));

  // Stumped auto-sets when batter stepped out + missed
  const handleSteppedOut = () => {
    setSel(p => ({
      ...p,
      batter_stepped_out: !p.batter_stepped_out,
      is_stumped: !p.batter_stepped_out && p.contact_type === 'miss',
    }));
  };

  const handleContact = (val) => {
    setSel(p => ({
      ...p,
      contact_type: p.contact_type === val ? null : val,
      is_stumped: p.batter_stepped_out && val === 'miss',
    }));
  };

  const handleShotDirection = (contact, arrow) => {
    setContactTap(contact);
    setShotArrow(arrow);
  };

  const handleLog = async () => {
    if (!activeSession) { Alert.alert('No Session', 'Select a session first'); return; }
    setLogging(true);
    try {
      const ballData = {
        session_id: activeSession.id,
        ball_number: ballCount + 1,
        length_type: sel.length_type,
        line_type: sel.line_type,
        delivery_type: sel.delivery_type,
        contact_type: sel.contact_type,
        shot_type: sel.shot_type,
        is_wide: sel.is_wide,
        is_no_ball: sel.is_no_ball,
        is_lofted: sel.is_lofted,
        batter_stepped_out: sel.batter_stepped_out,
        is_stumped: sel.is_stumped,
        pitch_x: pitchTap?.x ?? null,
        pitch_y: pitchTap?.y ?? null,
        contact_x: contactTap?.x ?? null,
        contact_y: contactTap?.y ?? null,
      };

      const logRes = await logBall(ballData);
      const newBallId = logRes.data.data.id;

      let scored = null;
      if (contactTap || sel.is_stumped) {
        const scoreRes = await calculateScore({
          session_id: activeSession.id,
          ball_id: newBallId,
          shotX: contactTap?.x ?? null,
          shotY: contactTap?.y ?? null,
          contactType: sel.contact_type,
          isLofted: sel.is_lofted,
          batterSteppedOut: sel.batter_stepped_out,
          isStumped: sel.is_stumped,
        });
        scored = scoreRes.data.data;
        setScoreResult(scored);
      }

      setBallCount(c => c + 1);
      setPreviousBalls(prev => [...prev, { ...ballData, id: newBallId }]);
      refreshSessions();

      // Reset per-ball (keep delivery settings)
      setSel(p => ({
        ...p,
        contact_type: null, shot_type: null,
        is_wide: false, is_no_ball: false,
        is_lofted: false, batter_stepped_out: false, is_stumped: false,
      }));
      setPitchTap(null);
      setContactTap(null);
      setShotArrow(null);

      if (!scored) Alert.alert('✅', `Ball ${ballCount + 1} logged!`);
    } catch {
      Alert.alert('Error', 'Failed to log ball');
    } finally {
      setLogging(false);
    }
  };

  const pitchW = SW - 48;
  const shotW = SW - 48;
  const batterHandedness = activeSession?.batter_handedness || 'right';
  const bowlerHandedness = activeSession?.bowler_handedness || 'right';

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f0' }}>
      <SessionPicker />

      {!activeSession ? (
        <View style={styles.noSession}>
          <Text style={styles.noSessionIcon}>📋</Text>
          <Text style={styles.noSessionText}>Select a session above to start logging balls</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          {loadingSession ? (
            <ActivityIndicator size="large" color="#1a472a" style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Session banner - Updated with Over/Around Wicket indicator */}
              <View style={styles.sessionBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionBannerText}>
                    🏏 {activeSession.bowler_name || '?'}
                    {bowlerHandedness === 'left' ? ' (Left arm)' : ' (Right arm)'}
                    {'  →  '}
                    🏏 {activeSession.batsman_name || '?'}
                    {batterHandedness === 'left' ? ' (LH)' : ' (RH)'}
                  </Text>
                  <Text style={styles.sessionBannerSub}>
                    {activeSession.bowling_side === 'around' ? '↓ Around the wicket' : '↑ Over the wicket'}
                  </Text>
                </View>
                <View style={styles.ballBadge}>
                  <Text style={styles.ballBadgeText}>Ball {ballCount + 1}</Text>
                </View>
              </View>

              {/* ── PITCH MAP (full width) ── */}
              <View style={styles.fullCard}>
                <Text style={styles.cardTitle}>🏏 Pitch Map</Text>
                <Text style={styles.cardHint}>Tap where the ball lands on the pitch</Text>
                <View style={{ alignItems: 'center' }}>
                  <PitchMap
                    width={pitchW * 0.55}
                    points={previousBalls.filter(b => b.pitch_x != null).map(b => ({
                      x: parseFloat(b.pitch_x), y: parseFloat(b.pitch_y),
                      length_type: b.length_type, ball_number: b.ball_number,
                    }))}
                    selectedPoint={pitchTap}
                    onTap={setPitchTap}
                    batterHandedness={batterHandedness}
                    bowlerHandedness={bowlerHandedness}
                  />
                </View>
                {pitchTap && (
                  <View style={styles.tapConfirmRow}>
                    <Text style={styles.tapConfirm}>📍 Landing marked</Text>
                    <TouchableOpacity onPress={() => setPitchTap(null)}>
                      <Text style={styles.tapClear}>✕ Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* ── SHOT DIRECTION (full width, below pitch map) ── */}
              <View style={styles.fullCard}>
                <Text style={styles.cardTitle}>🏏 Shot Direction</Text>
                <Text style={styles.cardHint}>Drag from the batter to show where the ball went</Text>
                <View style={{ alignItems: 'center' }}>
                  <ShotDirection
                    value={shotArrow}
                    onChange={handleShotDirection}
                    handedness={batterHandedness}
                  />
                </View>
                {contactTap && (
                  <View style={styles.tapConfirmRow}>
                    <Text style={styles.tapConfirm}>📍 Direction set</Text>
                    <TouchableOpacity onPress={() => { setContactTap(null); setShotArrow(null); }}>
                      <Text style={styles.tapClear}>✕ Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* ── DELIVERY ── */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>🏏 Delivery</Text>
                <OptionGroup label="Length" options={OPTIONS.length} selected={sel.length_type} onSelect={v => set('length_type', v)} />
                <OptionGroup label="Line" options={OPTIONS.line} selected={sel.line_type} onSelect={v => set('line_type', v)} />
                <OptionGroup label="Delivery type" options={OPTIONS.delivery} selected={sel.delivery_type} onSelect={v => set('delivery_type', v)} />
              </View>

              {/* ── BATSMAN ── */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>🏏 Batsman</Text>
                <OptionGroup label="Contact" options={OPTIONS.contact} selected={sel.contact_type} onSelect={handleContact} />
                <OptionGroup label="Shot played" options={OPTIONS.shot} selected={sel.shot_type} onSelect={v => set('shot_type', v)} />

                {/* Independent toggles */}
                <Text style={styles.groupLabel}>Modifiers</Text>
                <View style={styles.toggleRow}>
                  <ToggleBtn
                    label={sel.is_lofted ? '🟡 Lofted' : 'Lofted'}
                    value={sel.is_lofted}
                    onToggle={() => toggle('is_lofted')}
                    activeColor="#f57f17"
                  />
                  <ToggleBtn
                    label={sel.batter_stepped_out ? '👣 Stepped Out' : 'Stepped Out'}
                    value={sel.batter_stepped_out}
                    onToggle={handleSteppedOut}
                    activeColor="#6a1b9a"
                  />
                  <ToggleBtn
                    label={sel.is_stumped ? '🔴 Stumped' : 'Stumped'}
                    value={sel.is_stumped}
                    onToggle={() => toggle('is_stumped')}
                    activeColor='#b71c1c'
                  />
                </View>
              </View>

              {/* ── EXTRAS ── */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Extras</Text>
                <View style={styles.toggleRow}>
                  <ToggleBtn
                    label={sel.is_wide ? '⚠️ Wide' : 'Wide'}
                    value={sel.is_wide}
                    onToggle={() => toggle('is_wide')}
                    activeColor='#0277bd'
                  />
                  <ToggleBtn
                    label={sel.is_no_ball ? '🔴 No Ball' : 'No Ball'}
                    value={sel.is_no_ball}
                    onToggle={() => toggle('is_no_ball')}
                    activeColor='#c62828'
                  />
                </View>
              </View>

              {/* ── LOG BUTTON ── */}
              <TouchableOpacity style={styles.logBtn} onPress={handleLog} disabled={logging}>
                {logging
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.logBtnText}>Log Ball {ballCount + 1}</Text>
                }
              </TouchableOpacity>

              {scoreResult && (
                <ScorePopup score={scoreResult} onClose={() => setScoreResult(null)} />
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noSession: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  noSessionIcon: { fontSize: 48, marginBottom: 12 },
  noSessionText: { fontSize: 16, color: '#888', textAlign: 'center' },
  sessionBanner: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sessionBannerText: { color: '#1a472a', fontSize: 12, flex: 1 },
  sessionBannerSub: { color: '#555', fontSize: 11, marginTop: 2 }, // Added style for the new text
  ballBadge: { backgroundColor: '#1a472a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginLeft: 8 },
  ballBadgeText: { color: '#f0c040', fontWeight: 'bold', fontSize: 14 },
  fullCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a472a', marginBottom: 4 },
  cardHint: { fontSize: 11, color: '#888', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a472a', marginBottom: 10 },
  tapConfirmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 },
  tapConfirm: { fontSize: 12, color: '#1a472a', fontWeight: '600' },
  tapClear: { fontSize: 12, color: '#c62828', fontWeight: '600' },
  group: { marginBottom: 12 },
  groupLabel: { fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '600' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  optBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fafafa' },
  optBtnActive: { backgroundColor: '#1a472a', borderColor: '#1a472a' },
  optText: { fontSize: 13, color: '#444' },
  optTextActive: { color: '#fff', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: '#ccc', backgroundColor: '#fafafa' },
  toggleBtnText: { fontSize: 13, color: '#555', fontWeight: '500' },
  toggleBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  logBtn: { backgroundColor: '#1a472a', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  logBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  scorePopup: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 16, borderWidth: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  scorePopupRuns: { fontSize: 64, fontWeight: 'bold', lineHeight: 72 },
  scorePopupLabel: { fontSize: 16, color: '#666', fontWeight: '600', letterSpacing: 3, marginBottom: 6 },
  scorePopupReason: { fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 12 },
  scorePopupBtn: { paddingHorizontal: 32, paddingVertical: 10, borderRadius: 10 },
  scorePopupBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  scorePopupWicket: { fontSize: 28, fontWeight: 'bold', color: '#b71c1c', marginBottom: 4 },
  scorePopupWicketType: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  scorePopupFielder: { fontSize: 14, color: '#555', marginBottom: 8 },
});