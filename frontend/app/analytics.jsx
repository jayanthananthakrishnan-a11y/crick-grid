import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, Alert, Dimensions, RefreshControl, TouchableOpacity
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router'; // Added per instructions
import { useSession } from '../context/SessionContext';
import { getAnalytics, getSessionScoring } from '../services/api';
import WagonWheel from '../components/WagonWheel';
import PitchMap from '../components/PitchMap';
import SessionPicker from '../components/SessionPicker';

const W = Dimensions.get('window').width - 32;

function StatBar({ label, value, total, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color || '#1a472a' }]} />
      </View>
      <Text style={styles.statValue}>{value} ({pct.toFixed(0)}%)</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter(); // Added per instructions
  const { activeSession } = useSession();
  const [analytics, setAnalytics] = useState(null);
  const [scoring, setScoring] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async (sessionId, silent = false) => {
    if (!sessionId) return;
    if (!silent) setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        getAnalytics(sessionId),
        getSessionScoring(sessionId),
      ]);
      setAnalytics(aRes.data.data);
      setScoring(sRes.data.data);
    } catch {
      if (!silent) Alert.alert('Error', 'Could not load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Auto-refresh every time this tab comes into focus
  useFocusEffect(useCallback(() => {
    if (activeSession?.id) loadAnalytics(activeSession.id, true);
  }, [activeSession?.id, loadAnalytics]));

  // Also reload when session changes
  useEffect(() => {
    if (!activeSession) { setAnalytics(null); setScoring(null); return; }
    loadAnalytics(activeSession.id);
  }, [activeSession?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics(activeSession?.id, true);
  };

  const b = analytics?.bowler;
  const bat = analytics?.batsman;
  const batterHandedness = analytics?.session?.batter_handedness || 'right';
  const bowlerHandedness = analytics?.session?.bowler_handedness || 'right';

  const wagonShots = scoring?.ball_scores?.map((bs, i) => ({
    ...bs,
    contact_x: analytics?.batsman?.contact_map?.[i]?.x,
    contact_y: analytics?.batsman?.contact_map?.[i]?.y,
  })) || [];

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f0' }}>
      <SessionPicker />

      {!activeSession ? (
        <View style={styles.noSession}>
          <Text style={styles.noSessionIcon}>📊</Text>
          <Text style={styles.noSessionText}>Select a session above to view analytics</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator size="large" color="#1a472a" style={{ marginTop: 60 }} />
      ) : analytics ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1a472a" />}
        >
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{analytics.session.session_name}</Text>
            <Text style={styles.summaryText}>
              🏏 {analytics.session.bowler_name}
              {bowlerHandedness === 'left' ? ' (LH)' : ' (RH)'}
              {'  →  '}
              🏏 {analytics.session.batsman_name}
              {batterHandedness === 'left' ? ' (LH)' : ' (RH)'}
            </Text>
            <View style={styles.summaryStats}>
              <View style={styles.summaryStatBox}>
                <Text style={styles.summaryBig}>{analytics.total_balls}</Text>
                <Text style={styles.summaryStatLabel}>Balls</Text>
              </View>
              {scoring && (
                <>
                  <View style={styles.summaryStatBox}>
                    <Text style={[styles.summaryBig, { color: '#f0c040' }]}>{scoring.total_runs}</Text>
                    <Text style={styles.summaryStatLabel}>Runs</Text>
                  </View>
                  <View style={styles.summaryStatBox}>
                    <Text style={[styles.summaryBig, { color: '#81c784' }]}>{scoring.run_rate}</Text>
                    <Text style={styles.summaryStatLabel}>Run Rate</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Scoring */}
          {scoring && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📊 Scoring Summary</Text>
              <View style={styles.scoringRow}>
                {[
                  { label: '4s', value: scoring.boundaries, color: '#c62828' },
                  { label: '6s', value: scoring.sixes, color: '#6a1b9a' },
                  { label: 'Dots', value: scoring.dot_balls, color: '#9e9e9e' },
                ].map(s => (
                  <View key={s.label} style={styles.scoringBox}>
                    <Text style={[styles.scoringNum, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.scoringLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Wagon wheel */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎡 Wagon Wheel</Text>
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <WagonWheel
                width={W * 0.8}
                shots={wagonShots}
                handedness={batterHandedness}
              />
            </View>
          </View>

          {/* Length */}
          {b && Object.keys(b.length_distribution).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏏 Length Distribution</Text>
              {Object.entries(b.length_distribution).map(([k, v]) => (
                <StatBar key={k} label={k.replace(/_/g, ' ')} value={v} total={analytics.total_balls} color="#1a472a" />
              ))}
            </View>
          )}

          {/* Line */}
          {b && Object.keys(b.line_distribution).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏏 Line Distribution</Text>
              {Object.entries(b.line_distribution).map(([k, v]) => (
                <StatBar key={k} label={k.replace(/_/g, ' ')} value={v} total={analytics.total_balls} color="#2e7d32" />
              ))}
            </View>
          )}

          {/* Movement */}
          {b && (b.avg_swing_degree || b.avg_turn_degree) && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏏 Movement Averages</Text>
              {b.avg_swing_degree && <Text style={styles.statLine}>Avg swing: {b.avg_swing_degree}°</Text>}
              {b.avg_turn_degree && <Text style={styles.statLine}>Avg turn: {b.avg_turn_degree}°</Text>}
              {b.avg_turn_into_batter && <Text style={styles.statLine}>Into batter: {b.avg_turn_into_batter}°</Text>}
              {b.avg_turn_away_from_batter && <Text style={styles.statLine}>Away from batter: {b.avg_turn_away_from_batter}°</Text>}
            </View>
          )}

          {/* Pitch map */}
          {b && b.pitch_map.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🗺️ Pitch Map</Text>
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <PitchMap
                  width={W * 0.5}
                  points={b.pitch_map.map((p, i) => ({ ...p, ball_number: i + 1 }))}
                  batterHandedness={batterHandedness}
                  bowlerHandedness={bowlerHandedness}
                />
              </View>
            </View>
          )}

          {/* Contact quality */}
          {bat && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏏 Contact Quality</Text>
              <View style={styles.triStat}>
                <View style={styles.triBox}>
                  <Text style={styles.triNum}>{bat.middle_percentage}%</Text>
                  <Text style={styles.triLabel}>Middled</Text>
                </View>
                <View style={styles.triBox}>
                  <Text style={[styles.triNum, { color: '#c0392b' }]}>{bat.edge_percentage}%</Text>
                  <Text style={styles.triLabel}>Edges</Text>
                </View>
                <View style={styles.triBox}>
                  <Text style={[styles.triNum, { color: '#e67e22' }]}>{bat.miss_percentage}%</Text>
                  <Text style={styles.triLabel}>Misses</Text>
                </View>
              </View>
              {Object.entries(bat.contact_distribution).map(([k, v]) => (
                <StatBar key={k} label={k.replace(/_/g, ' ')} value={v} total={analytics.total_balls} color="#1565c0" />
              ))}
            </View>
          )}

          {/* Shot selection */}
          {bat && Object.keys(bat.shot_distribution).length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏏 Shot Selection</Text>
              {Object.entries(bat.shot_distribution).map(([k, v]) => (
                <StatBar key={k} label={k} value={v} total={analytics.total_balls} color="#6a1b9a" />
              ))}
            </View>
          )}

          {/* Extras */}
          {bat && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚠️ Extras</Text>
              <Text style={styles.statLine}>Wides: {bat.wides}</Text>
              <Text style={styles.statLine}>No Balls: {bat.no_balls}</Text>
            </View>
          )}

          {/* Ball-by-ball tracker link - Added per instructions */}
          <TouchableOpacity 
            style={styles.trackerBtn} 
            onPress={() => router.push('/balltracker')}
          >
            <Text style={styles.trackerBtnText}>📋 View Full Ball-by-Ball Tracker →</Text>
          </TouchableOpacity>

        </ScrollView>
      ) : (
        <View style={styles.noData}>
          <Text style={styles.noDataText}>No balls logged yet for this session</Text>
          <Text style={styles.noDataSub}>Pull down to refresh</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  noSession: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  noSessionIcon: { fontSize: 48, marginBottom: 12 },
  noSessionText: { fontSize: 16, color: '#888', textAlign: 'center' },
  noData: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  noDataText: { color: '#aaa', fontSize: 15 },
  noDataSub: { color: '#bbb', fontSize: 12, marginTop: 4 },
  summaryCard: { backgroundColor: '#1a472a', borderRadius: 12, padding: 16, marginBottom: 14, alignItems: 'center' },
  summaryTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  summaryText: { color: '#a5d6a7', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  summaryStats: { flexDirection: 'row', gap: 20 },
  summaryStatBox: { alignItems: 'center' },
  summaryBig: { color: '#fff', fontSize: 30, fontWeight: 'bold' },
  summaryStatLabel: { color: '#a5d6a7', fontSize: 11, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1a472a', marginBottom: 10 },
  scoringRow: { flexDirection: 'row', justifyContent: 'space-around' },
  scoringBox: { alignItems: 'center', padding: 12, backgroundColor: '#f8f9fa', borderRadius: 10, minWidth: 70 },
  scoringNum: { fontSize: 28, fontWeight: 'bold' },
  scoringLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statLabel: { width: 110, fontSize: 12, color: '#555', textTransform: 'capitalize' },
  barTrack: { flex: 1, height: 10, backgroundColor: '#e8f5e9', borderRadius: 5, overflow: 'hidden', marginHorizontal: 6 },
  barFill: { height: '100%', borderRadius: 5 },
  statValue: { fontSize: 11, color: '#666', width: 68, textAlign: 'right' },
  statLine: { fontSize: 14, color: '#333', marginBottom: 4 },
  triStat: { flexDirection: 'row', marginBottom: 12 },
  triBox: { flex: 1, alignItems: 'center', padding: 8, backgroundColor: '#f8fff8', borderRadius: 8, marginHorizontal: 3 },
  triNum: { fontSize: 22, fontWeight: 'bold', color: '#1a472a' },
  triLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  trackerBtn: { backgroundColor: '#1a472a', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 8 }, // Added per instructions
  trackerBtnText: { color: '#f0c040', fontWeight: 'bold', fontSize: 15 }, // Added per instructions
});