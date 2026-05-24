import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch
} from 'react-native';
import Svg, {
  Rect, Circle, Line, Path, Text as SvgText, G, Defs,
  LinearGradient, Stop, Ellipse
} from 'react-native-svg';

// Stump positions as % of width
const STUMP = { leg: 40, middle: 50, off: 60, legLine: 35, offLine: 65 };

const VERDICT_COLORS = {
  OUT: '#c62828',
  NOT_OUT: '#2e7d32',
  UMPIRES_CALL: '#f57f17',
  PITCHING_OUTSIDE_LEG: '#1565c0',
};

function PitchOverlay({ width, pitchTap, impactTap, onTapPitch, onTapImpact, mode, projectedPath }) {
  const height = width * 1.6;
  const pLeft = width * 0.2;
  const pWidth = width * 0.6;

  const stumpsY = height * 0.82;
  const bowlerY = height * 0.1;

  const stumpXs = [
    pLeft + (STUMP.leg / 100) * pWidth,
    pLeft + (STUMP.middle / 100) * pWidth,
    pLeft + (STUMP.off / 100) * pWidth,
  ];

  const handleTouch = (evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    const px = Math.max(0, Math.min(100, ((locationX - pLeft) / pWidth) * 100));
    const py = Math.max(0, Math.min(100, (locationY / height) * 100));
    const point = { x: parseFloat(px.toFixed(1)), y: parseFloat(py.toFixed(1)) };
    if (mode === 'pitch') onTapPitch(point);
    else if (mode === 'impact') onTapImpact(point);
  };

  // Build projected path SVG string
  let pathD = '';
  if (projectedPath && projectedPath.length > 1) {
    const pts = projectedPath.map(p => ({
      svgX: pLeft + (p.x / 100) * pWidth,
      svgY: (p.y / 100) * height,
    }));
    pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.svgX} ${p.svgY}`).join(' ');
  }

  return (
    <Svg
      width={width}
      height={height}
      onStartShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
    >
      <Defs>
        <LinearGradient id="pitchBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#c8a96e" />
          <Stop offset="100%" stopColor="#a07848" />
        </LinearGradient>
      </Defs>

      {/* Pitch */}
      <Rect x={pLeft} y={0} width={pWidth} height={height} fill="url(#pitchBg)" stroke="#7a5c30" strokeWidth={1.5} rx={3} />

      {/* Stump lines (off & leg) */}
      <Line x1={pLeft + (STUMP.legLine / 100) * pWidth} y1={0}
        x2={pLeft + (STUMP.legLine / 100) * pWidth} y2={height}
        stroke="#fff" strokeWidth={0.7} strokeDasharray="4,3" opacity={0.6} />
      <Line x1={pLeft + (STUMP.offLine / 100) * pWidth} y1={0}
        x2={pLeft + (STUMP.offLine / 100) * pWidth} y2={height}
        stroke="#fff" strokeWidth={0.7} strokeDasharray="4,3" opacity={0.6} />

      {/* Crease lines */}
      <Line x1={pLeft} y1={stumpsY} x2={pLeft + pWidth} y2={stumpsY} stroke="#fff" strokeWidth={2} />
      <Line x1={pLeft} y1={bowlerY} x2={pLeft + pWidth} y2={bowlerY} stroke="#fff" strokeWidth={1} strokeDasharray="6,4" />

      {/* Stumps at batter end */}
      {stumpXs.map((sx, i) => (
        <G key={i}>
          <Line x1={sx} y1={stumpsY} x2={sx} y2={stumpsY + 16} stroke="#f5e642" strokeWidth={2.5} />
        </G>
      ))}
      {/* Bails */}
      <Line x1={stumpXs[0]} y1={stumpsY} x2={stumpXs[2]} y2={stumpsY} stroke="#f5e642" strokeWidth={1.5} />

      {/* Stumps at bowler end */}
      {stumpXs.map((sx, i) => (
        <Line key={`bs${i}`} x1={sx} y1={bowlerY - 12} x2={sx} y2={bowlerY} stroke="#f5e642" strokeWidth={2} />
      ))}

      {/* Projected path */}
      {pathD && (
        <Path d={pathD} fill="none" stroke="#ff6f00" strokeWidth={2.5}
          strokeDasharray="6,3" opacity={0.85} />
      )}

      {/* Pitch tap point */}
      {pitchTap && (
        <G>
          <Circle
            cx={pLeft + (pitchTap.x / 100) * pWidth}
            cy={(pitchTap.y / 100) * height}
            r={8} fill="#2196f3" opacity={0.9} stroke="#fff" strokeWidth={2}
          />
          <SvgText
            x={pLeft + (pitchTap.x / 100) * pWidth}
            y={(pitchTap.y / 100) * height + 4}
            fontSize={8} fill="#fff" textAnchor="middle" fontWeight="bold"
          >P</SvgText>
        </G>
      )}

      {/* Impact tap point */}
      {impactTap && (
        <G>
          <Circle
            cx={pLeft + (impactTap.x / 100) * pWidth}
            cy={(impactTap.y / 100) * height}
            r={8} fill="#f44336" opacity={0.9} stroke="#fff" strokeWidth={2}
          />
          <SvgText
            x={pLeft + (impactTap.x / 100) * pWidth}
            y={(impactTap.y / 100) * height + 4}
            fontSize={8} fill="#fff" textAnchor="middle" fontWeight="bold"
          >I</SvgText>
        </G>
      )}

      {/* Labels */}
      <SvgText x={pLeft - 4} y={(bowlerY) + 4} fontSize={8} fill="#999" textAnchor="end">Bowler</SvgText>
      <SvgText x={pLeft - 4} y={stumpsY + 4} fontSize={8} fill="#999" textAnchor="end">Batter</SvgText>
      <SvgText x={pLeft + (STUMP.legLine / 100) * pWidth} y={height - 4} fontSize={7} fill="#ccc" textAnchor="middle">Leg</SvgText>
      <SvgText x={pLeft + (STUMP.offLine / 100) * pWidth} y={height - 4} fontSize={7} fill="#ccc" textAnchor="middle">Off</SvgText>

      {/* Mode hint */}
      {mode && (
        <Rect x={pLeft} y={height * 0.43} width={pWidth} height={20} fill="rgba(0,0,0,0.45)" rx={4} />
      )}
      {mode === 'pitch' && (
        <SvgText x={pLeft + pWidth / 2} y={height * 0.43 + 13} fontSize={9} fill="#64b5f6" textAnchor="middle">
          Tap where ball pitched
        </SvgText>
      )}
      {mode === 'impact' && (
        <SvgText x={pLeft + pWidth / 2} y={height * 0.43 + 13} fontSize={9} fill="#ef9a9a" textAnchor="middle">
          Tap where ball hit batter
        </SvgText>
      )}
    </Svg>
  );
}

function StumpView({ width, verdict, projectedX, hittingZone }) {
  const h = width * 0.8;
  const groundY = h * 0.85;
  const stumpH = h * 0.55;
  const stumpTop = groundY - stumpH;
  const bailTop = stumpTop - 4;
  const stumpSpacing = width * 0.18;
  const cx = width / 2;

  // Stump positions
  const stumpXs = [cx - stumpSpacing, cx, cx + stumpSpacing];

  // Project X position in stump view space
  const stumpViewLeft = stumpXs[0] - 12;
  const stumpViewRight = stumpXs[2] + 12;
  const projX = projectedX != null
    ? stumpViewLeft + ((projectedX - STUMP.legLine) / (STUMP.offLine - STUMP.legLine)) * (stumpViewRight - stumpViewLeft)
    : null;

  const ballColor = hittingZone === 'full' ? '#c62828'
    : hittingZone === 'umpires_call' ? '#f57f17'
    : '#4caf50';

  return (
    <Svg width={width} height={h}>
      {/* Ground */}
      <Rect x={0} y={groundY} width={width} height={h - groundY} fill="#c8a96e" />

      {/* Stumps */}
      {stumpXs.map((sx, i) => (
        <G key={i}>
          <Rect x={sx - 3} y={stumpTop} width={6} height={stumpH} fill="#f5e642" rx={2} />
        </G>
      ))}

      {/* Bails */}
      <Rect x={stumpXs[0] - 2} y={bailTop} width={stumpXs[2] - stumpXs[0] + 4} height={5} fill="#f5e642" rx={2} />

      {/* Umpire's call zone shading */}
      <Rect
        x={stumpXs[0] - 10}
        y={stumpTop}
        width={stumpXs[2] - stumpXs[0] + 20}
        height={stumpH}
        fill="#ff980020"
        stroke="#ff9800"
        strokeWidth={0.5}
        strokeDasharray="3,2"
      />

      {/* Projected ball */}
      {projX != null && (
        <G>
          <Circle cx={projX} cy={groundY - stumpH * 0.4} r={10}
            fill={ballColor} opacity={0.85} stroke="#fff" strokeWidth={1.5} />
          <SvgText x={projX} y={groundY - stumpH * 0.4 + 4}
            fontSize={8} fill="#fff" textAnchor="middle" fontWeight="bold">
            {hittingZone === 'full' ? 'OUT' : hittingZone === 'umpires_call' ? 'UC' : 'MISS'}
          </SvgText>
        </G>
      )}

      <SvgText x={cx} y={h - 4} fontSize={9} fill="#555" textAnchor="middle">End-on view</SvgText>
    </Svg>
  );
}

export default function LBWReview({ sessionId, ballId, ballNumber, onSubmit }) {
  const [mode, setMode] = useState('pitch'); // pitch → impact → height → result
  const [pitchTap, setPitchTap] = useState(null);
  const [impactTap, setImpactTap] = useState(null);
  const [impactHeight, setImpactHeight] = useState(80); // % of stump height
  const [batterHandedness, setBatterHandedness] = useState('right');
  const [isWideReview, setIsWideReview] = useState(false);
  const [batterMovedX, setBatterMovedX] = useState(50);
  const [isFullToss, setIsFullToss] = useState(false);
  const [frontFoot, setFrontFoot] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canReview = pitchTap && impactTap;

  const handleTapPitch = (pt) => { setPitchTap(pt); setMode('impact'); };
  const handleTapImpact = (pt) => { setImpactTap(pt); setMode('height'); };

  const handleCalculate = async () => {
    if (!canReview) return;
    setSubmitting(true);
    try {
      const payload = {
        ball_id: ballId || null,
        session_id: sessionId,
        pitchX: pitchTap.x, pitchY: pitchTap.y,
        impactX: impactTap.x, impactY: impactTap.y,
        impactHeightPct: impactHeight,
        batterHandedness,
        isWideReview,
        batterMovedX,
        isFullToss,
        frontFootNoBall: frontFoot,
      };

      const { submitLBWReview } = require('../services/api');
      const res = await submitLBWReview(payload);
      setResult(res.data.data);
      setMode('result');
      onSubmit?.(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setPitchTap(null); setImpactTap(null);
    setImpactHeight(80); setResult(null);
    setMode('pitch'); setIsWideReview(false);
    setIsFullToss(false); setFrontFoot(false);
  };

  const projectedPath = result?.lbw?.projected_path || null;
  const verdictColor = result ? VERDICT_COLORS[result.lbw?.verdict] || '#333' : '#333';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 DRS Review</Text>
        {ballNumber && <Text style={styles.ballNum}>Ball #{ballNumber}</Text>}
      </View>

      {/* Step tabs */}
      <View style={styles.stepTabs}>
        {[
          { key: 'pitch', label: '1. Pitch' },
          { key: 'impact', label: '2. Impact' },
          { key: 'height', label: '3. Height' },
          { key: 'result', label: '4. Verdict' },
        ].map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.stepTab, mode === s.key && styles.stepTabActive]}
            onPress={() => result || s.key !== 'result' ? setMode(s.key) : null}
          >
            <Text style={[styles.stepTabText, mode === s.key && styles.stepTabTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Batter handedness */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Batter:</Text>
        {['right', 'left'].map(h => (
          <TouchableOpacity
            key={h}
            style={[styles.handBtn, batterHandedness === h && styles.handBtnActive]}
            onPress={() => setBatterHandedness(h)}
          >
            <Text style={[styles.handBtnText, batterHandedness === h && styles.handBtnTextActive]}>
              {h === 'right' ? '🏏 RHB' : '🏏 LHB'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pitch overlay */}
      {(mode === 'pitch' || mode === 'impact') && (
        <View style={styles.pitchCard}>
          <PitchOverlay
            width={220}
            pitchTap={pitchTap}
            impactTap={impactTap}
            onTapPitch={handleTapPitch}
            onTapImpact={handleTapImpact}
            mode={mode === 'height' ? null : mode}
            projectedPath={projectedPath}
          />
        </View>
      )}

      {/* Height selector */}
      {mode === 'height' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Impact height</Text>
          <Text style={styles.heightHint}>
            Where did the ball hit the batter's body?
          </Text>
          <View style={styles.heightOptions}>
            {[
              { label: 'Below knee', value: 30 },
              { label: 'Knee roll', value: 55 },
              { label: 'Mid-thigh', value: 75 },
              { label: 'Top of stumps', value: 100 },
              { label: 'Hip height', value: 140 },
              { label: 'Above hip', value: 170 },
            ].map(h => (
              <TouchableOpacity
                key={h.value}
                style={[styles.heightBtn, impactHeight === h.value && styles.heightBtnActive]}
                onPress={() => setImpactHeight(h.value)}
              >
                <Text style={[styles.heightBtnText, impactHeight === h.value && styles.heightBtnTextActive]}>
                  {h.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Wide / no-ball toggles */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Wide review?</Text>
            <Switch value={isWideReview} onValueChange={setIsWideReview} trackColor={{ true: '#1a472a' }} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Full toss height no-ball?</Text>
            <Switch value={isFullToss} onValueChange={setIsFullToss} trackColor={{ true: '#c62828' }} />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Front-foot no-ball?</Text>
            <Switch value={frontFoot} onValueChange={setFrontFoot} trackColor={{ true: '#c62828' }} />
          </View>

          <TouchableOpacity
            style={[styles.reviewBtn, !canReview && styles.reviewBtnDisabled]}
            onPress={handleCalculate}
            disabled={!canReview || submitting}
          >
            <Text style={styles.reviewBtnText}>
              {submitting ? 'Calculating...' : '▶ Get Verdict'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Result */}
      {mode === 'result' && result && (
        <View style={styles.card}>
          {/* Main verdict */}
          <View style={[styles.verdictBox, { borderColor: verdictColor }]}>
            <Text style={[styles.verdictText, { color: verdictColor }]}>
              {result.lbw?.verdict}
            </Text>
            <Text style={styles.verdictReason}>{result.lbw?.verdict_reason}</Text>
          </View>

          {/* Checklist */}
          <View style={styles.checklist}>
            <CheckItem
              label="Pitched in line"
              passed={result.lbw?.pitched_in_line}
              failed={result.lbw?.pitched_outside_leg}
              failText="Pitched outside leg"
            />
            <CheckItem
              label="Impact in line"
              passed={result.lbw?.impact_in_line}
            />
            <CheckItem
              label="Hitting stumps"
              passed={result.lbw?.hitting_stumps}
              zone={result.lbw?.hitting_zone}
            />
          </View>

          {/* Stump end-on view */}
          <Text style={styles.cardTitle}>Stump projection</Text>
          <View style={{ alignItems: 'center' }}>
            <StumpView
              width={200}
              verdict={result.lbw?.verdict}
              projectedX={result.lbw?.projected_stump_x}
              hittingZone={result.lbw?.hitting_zone}
            />
          </View>

          {/* Wide verdict */}
          {result.wide && (
            <View style={[styles.extraVerdict, { borderColor: result.wide.verdict === 'WIDE' ? '#1565c0' : '#4caf50' }]}>
              <Text style={styles.extraVerdictTitle}>Wide check</Text>
              <Text style={[styles.extraVerdictResult, { color: result.wide.verdict === 'WIDE' ? '#1565c0' : '#2e7d32' }]}>
                {result.wide.verdict}
              </Text>
              <Text style={styles.extraVerdictReason}>{result.wide.reason}</Text>
            </View>
          )}

          {/* Height no-ball verdict */}
          {result.height_no_ball && (
            <View style={[styles.extraVerdict, { borderColor: result.height_no_ball.verdict === 'NO_BALL' ? '#c62828' : '#4caf50' }]}>
              <Text style={styles.extraVerdictTitle}>Height no-ball check</Text>
              <Text style={[styles.extraVerdictResult, { color: result.height_no_ball.verdict === 'NO_BALL' ? '#c62828' : '#2e7d32' }]}>
                {result.height_no_ball.verdict}
              </Text>
              <Text style={styles.extraVerdictReason}>{result.height_no_ball.reason}</Text>
            </View>
          )}

          {/* Front foot */}
          {result.front_foot_no_ball && (
            <View style={[styles.extraVerdict, { borderColor: '#c62828' }]}>
              <Text style={styles.extraVerdictTitle}>Front-foot no-ball</Text>
              <Text style={[styles.extraVerdictResult, { color: '#c62828' }]}>NO BALL</Text>
              <Text style={styles.extraVerdictReason}>Bowler's foot behind crease — no ball</Text>
            </View>
          )}

          <TouchableOpacity style={styles.resetBtn} onPress={reset}>
            <Text style={styles.resetBtnText}>↺ Review another ball</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pitch card shown in result mode too */}
      {mode === 'result' && (
        <View style={styles.pitchCard}>
          <Text style={styles.cardTitle}>Ball path</Text>
          <PitchOverlay
            width={220}
            pitchTap={pitchTap}
            impactTap={impactTap}
            onTapPitch={() => {}}
            onTapImpact={() => {}}
            mode={null}
            projectedPath={projectedPath}
          />
        </View>
      )}
    </ScrollView>
  );
}

function CheckItem({ label, passed, failed, failText, zone }) {
  const color = failed ? '#c62828' : passed ? '#2e7d32' : '#c62828';
  const icon = failed ? '✗' : passed ? '✓' : '✗';
  const displayText = failed && failText ? failText : label;
  const zoneTag = zone === 'umpires_call' ? " (Umpire's call)" : zone === 'full' ? ' (Full)' : '';
  return (
    <View style={styles.checkItem}>
      <Text style={[styles.checkIcon, { color }]}>{icon}</Text>
      <Text style={[styles.checkLabel, { color }]}>{displayText}{zoneTag}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a472a' },
  ballNum: { fontSize: 14, color: '#666', fontWeight: '600' },
  stepTabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 12 },
  stepTab: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  stepTabActive: { backgroundColor: '#1a472a', borderColor: '#1a472a' },
  stepTabText: { fontSize: 11, color: '#666', fontWeight: '500' },
  stepTabTextActive: { color: '#fff', fontWeight: 'bold' },
  pitchCard: { alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  card: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#1a472a', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  rowLabel: { fontSize: 14, color: '#444', fontWeight: '600', marginRight: 4 },
  handBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fff' },
  handBtnActive: { backgroundColor: '#1a472a', borderColor: '#1a472a' },
  handBtnText: { fontSize: 13, color: '#444' },
  handBtnTextActive: { color: '#fff', fontWeight: '600' },
  heightHint: { fontSize: 12, color: '#888', marginBottom: 10 },
  heightOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  heightBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#fafafa' },
  heightBtnActive: { backgroundColor: '#1a472a', borderColor: '#1a472a' },
  heightBtnText: { fontSize: 13, color: '#444' },
  heightBtnTextActive: { color: '#fff', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  toggleLabel: { fontSize: 14, color: '#444' },
  reviewBtn: { backgroundColor: '#1a472a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  reviewBtnDisabled: { backgroundColor: '#aaa' },
  reviewBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  verdictBox: { borderWidth: 3, borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 16 },
  verdictText: { fontSize: 36, fontWeight: 'bold', letterSpacing: 2 },
  verdictReason: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 6 },
  checklist: { marginBottom: 16 },
  checkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  checkIcon: { fontSize: 18, fontWeight: 'bold', width: 28 },
  checkLabel: { fontSize: 14, fontWeight: '500' },
  extraVerdict: { borderWidth: 2, borderRadius: 10, padding: 12, marginBottom: 10 },
  extraVerdictTitle: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 4 },
  extraVerdictResult: { fontSize: 20, fontWeight: 'bold' },
  extraVerdictReason: { fontSize: 12, color: '#555', marginTop: 2 },
  resetBtn: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#1a472a' },
  resetBtnText: { color: '#1a472a', fontWeight: '600' },
});