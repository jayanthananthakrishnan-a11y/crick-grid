import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Dimensions
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSession } from '../../context/SessionContext';
import { getSessionScoring } from '../../services/api';

const W = Dimensions.get('window').width;

const RESULT_COLORS = {
  '6': { bg: '#6a1b9a', text: '#fff' },
  '4': { bg: '#c62828', text: '#fff' },
  '3': { bg: '#e65100', text: '#fff' },
  '2': { bg: '#1565c0', text: '#fff' },
  '1': { bg: '#2e7d32', text: '#fff' },
  'Dot': { bg: '#e0e0e0', text: '#555' },
  'Wicket': { bg: '#b71c1c', text: '#fff' },
  'Wide': { bg: '#0277bd', text: '#fff' },
  'No Ball': { bg: '#f57f17', text: '#fff' },
};

function ResultBadge({ ball }) {
  let label = String(ball.runs);
  let style = RESULT_COLORS[label] || RESULT_COLORS['Dot'];

  if (ball.wicket_type) {
    label = 'W';
    style = RESULT_COLORS['Wicket'];
  } else if (ball.is_wide) {
    label = 'Wd';
    style = RESULT_COLORS['Wide'];
  } else if (ball.is_no_ball) {
    label = 'NB';
    style = RESULT_COLORS['No Ball'];
  } else if (ball.runs === 0) {
    label = '•';
    style = RESULT_COLORS['Dot'];
  }

  return (
    <View style={[styles.resultBadge, { backgroundColor: style.bg }]}>
      <Text style={[styles.resultBadgeText, { color: style.text }]}>{label}</Text>
    </View>
  );
}

function formatDelivery(ball) {
  const parts = [];
  if (ball.delivery_type) parts.push(ball.delivery_type.replace(/_/g, ' '));
  if (ball.length_type) parts.push(ball.length_type.replace(/_/g, ' '));
  if (ball.line_type) parts.push(ball.line_type.replace(/_/g, ' '));
  return parts.join(' · ') || '—';
}

function formatShot(ball) {
  let shot = ball.shot_type || '—';
  if (ball.is_lofted) shot += ' (lofted)';
  if (ball.batter_stepped_out) shot += ' [stepped out]';
  return shot;
}

function formatResult(ball) {
  if (ball.wicket_type) {
    if (ball.fielder_caught) return `Wicket — ${ball.wicket_type} by ${ball.fielder_caught}`;
    return `Wicket — ${ball.wicket_type}`;
  }
  if (ball.is_wide) return `${ball.runs} wide${ball.runs !== 1 ? 's' : ''}`;
  if (ball.is_no_ball) return `No ball (${ball.runs} runs)`;
  if (ball.runs === 0) return 'Dot ball';
  return `${ball.runs} run${ball.runs !== 1 ? 's' : ''} — ${ball.reason || ''}`;
}

function ScorecardStrip({ balls }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
      {balls.map((b, i) => (
        <View key={i} style={styles.stripBall}>
          <ResultBadge ball={b} />
          <Text style={styles.stripNum}>{b.ball_number}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export default function BallTrackerScreen() {
  const { activeSession } = useSession();
  const [scoring, setScoring] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedBall, setExpandedBall] = useState(null);

  useFocusEffect(useCallback(() => {
    if (activeSession?.id) load();
  }, [activeSession?.id]));

  useEffect(() => {
    if (!activeSession) return;
    load();
  }, [activeSession?.id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getSessionScoring(activeSession.id);
      setScoring(res.data.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (!activeSession) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>No session selected</Text>
      </View>
    );
  }

  if (loading) {
    return <ActivityIndicator size="large" color="#1a472a" style={{ marginTop: 60 }} />;
  }

  const balls = scoring?.ball_scores || [];
  const wickets = balls.filter(b => b.wicket_type);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ball-by-Ball Tracker</Text>
        <Text style={styles.headerSub}>{activeSession.session_name}</Text>
      </View>

      <View style={styles.summaryRow}>
        {[
          { label: 'Runs', value: scoring?.total_runs ?? 0, color: '#f0c040' },
          { label: 'Balls', value: scoring?.total_balls ?? 0, color: '#fff' },
          { label: 'Wickets', value: scoring?.wickets ?? 0, color: '#ef9a9a' },
          { label: '4s', value: scoring?.boundaries ?? 0, color: '#ff8a65' },
          { label: '6s', value: scoring?.sixes ?? 0, color: '#ce93d8' },
          { label: 'Dots', value: scoring?.dot_balls ?? 0, color: '#aaa' },
        ].map(s => (
          <View key={s.label} style={styles.summaryBox}>
            <Text style={[styles.summaryNum, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ScorecardStrip balls={balls} />

      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: 36 }]}>Ball</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Delivery</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Shot</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Result</Text>
        <Text style={[styles.tableHeaderCell, { width: 40 }]}>Runs</Text>
      </View>

      {balls.map((ball, i) => {
        const isExpanded = expandedBall === i;
        const isWicket = !!ball.wicket_type;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.ballRow, isWicket && styles.ballRowWicket, i % 2 === 0 && styles.ballRowAlt]}
            onPress={() => setExpandedBall(isExpanded ? null : i)}
            activeOpacity={0.75}
          >
            <View style={styles.ballRowMain}>
              <View style={[styles.ballNumCell, { width: 36 }]}>
                <Text style={styles.ballNum}>{ball.ball_number}</Text>
                {(ball.is_wide || ball.is_no_ball) && (
                  <Text style={styles.extraTag}>{ball.is_wide ? 'Wd' : 'NB'}</Text>
                )}
              </View>

              <View style={{ flex: 1.4 }}>
                <Text style={styles.deliveryText} numberOfLines={2}>
                  {formatDelivery(ball)}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.shotText} numberOfLines={2}>
                  {formatShot(ball)}
                </Text>
              </View>

              <View style={{ flex: 1.6 }}>
                <Text style={[styles.resultText, isWicket && styles.resultTextWicket]} numberOfLines={2}>
                  {formatResult(ball)}
                </Text>
              </View>

              <View style={{ width: 40, alignItems: 'center' }}>
                <ResultBadge ball={ball} />
              </View>
            </View>

            {isExpanded && (
              <View style={styles.expandedRow}>
                {ball.contact_type && (
                  <Text style={styles.expandedItem}>Contact: <Text style={styles.expandedValue}>{ball.contact_type}</Text></Text>
                )}
                {ball.is_lofted && (
                  <Text style={styles.expandedItem}>Shot type: <Text style={styles.expandedValue}>Lofted</Text></Text>
                )}
                {ball.batter_stepped_out && (
                  <Text style={styles.expandedItem}>Batter stepped out</Text>
                )}
                {ball.wicket_type && (
                  <Text style={[styles.expandedItem, { color: '#c62828' }]}>
                    Dismissal: <Text style={styles.expandedValue}>{ball.wicket_type}{ball.fielder_caught ? ` — ${ball.fielder_caught}` : ''}</Text>
                  </Text>
                )}
                <Text style={styles.expandedItem}>Engine: <Text style={styles.expandedValue}>{ball.reason}</Text></Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {balls.length === 0 && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No balls logged yet for this session</Text>
        </View>
      )}

      {wickets.length > 0 && (
        <View style={styles.wicketsSummary}>
          <Text style={styles.wicketsSummaryTitle}>⚡ Wickets</Text>
          {wickets.map((w, i) => (
            <View key={i} style={styles.wicketRow}>
              <Text style={styles.wicketBall}>Ball {w.ball_number}</Text>
              <Text style={styles.wicketDesc}>
                {w.wicket_type}{w.fielder_caught ? ` — caught by ${w.fielder_caught}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: '#aaa', fontSize: 15, textAlign: 'center' },
  header: { backgroundColor: '#1a472a', padding: 16, paddingTop: 20 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#a5d6a7', fontSize: 13, marginTop: 2 },
  summaryRow: { flexDirection: 'row', backgroundColor: '#1a472a', paddingBottom: 16, paddingHorizontal: 8, justifyContent: 'space-around' },
  summaryBox: { alignItems: 'center', minWidth: 44 },
  summaryNum: { fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { color: '#a5d6a7', fontSize: 10, marginTop: 2 },
  strip: { backgroundColor: '#2d6a3f', maxHeight: 60 },
  stripContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, alignItems: 'center' },
  stripBall: { alignItems: 'center', gap: 2 },
  stripNum: { color: '#a5d6a7', fontSize: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#c8e6c9' },
  tableHeaderCell: { fontSize: 11, fontWeight: 'bold', color: '#1a472a', textTransform: 'uppercase' },
  ballRow: { flexDirection: 'column', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  ballRowAlt: { backgroundColor: '#fafafa' },
  ballRowWicket: { backgroundColor: '#fff8f8', borderLeftWidth: 3, borderLeftColor: '#c62828' },
  ballRowMain: { flexDirection: 'row', alignItems: 'flex-start' },
  ballNumCell: { alignItems: 'center' },
  ballNum: { fontSize: 14, fontWeight: 'bold', color: '#1a472a' },
  extraTag: { fontSize: 8, color: '#1565c0', fontWeight: 'bold' },
  deliveryText: { fontSize: 11, color: '#444', textTransform: 'capitalize', paddingRight: 4 },
  shotText: { fontSize: 11, color: '#555', textTransform: 'capitalize', paddingRight: 4 },
  resultText: { fontSize: 11, color: '#333', paddingRight: 4 },
  resultTextWicket: { color: '#c62828', fontWeight: '600' },
  resultBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resultBadgeText: { fontSize: 12, fontWeight: 'bold' },
  expandedRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingLeft: 36 },
  expandedItem: { fontSize: 12, color: '#666', marginBottom: 3 },
  expandedValue: { fontWeight: '600', color: '#333' },
  wicketsSummary: { margin: 16, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: '#c62828' },
  wicketsSummaryTitle: { fontSize: 16, fontWeight: 'bold', color: '#c62828', marginBottom: 10 },
  wicketRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  wicketBall: { fontSize: 13, fontWeight: 'bold', color: '#1a472a', width: 60 },
  wicketDesc: { fontSize: 13, color: '#333', flex: 1 },
});