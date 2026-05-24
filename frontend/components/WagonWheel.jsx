import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle, Line, Ellipse, G, Text as SvgText, Rect, Defs, LinearGradient, Stop
} from 'react-native-svg';

const RUN_COLORS = {
  0: '#bdbdbd', 1: '#64b5f6', 2: '#81c784',
  3: '#ffb74d', 4: '#e53935', 6: '#9c27b0'
};

function contactToAngle(x, y) {
  const dx = x - 50;
  const dy = 85 - y;
  const angle = Math.atan2(dx, dy) * (180 / Math.PI);
  const dist = Math.sqrt(dx * dx + dy * dy) * 1.2;
  return { angle, dist: Math.min(dist, 100) };
}

function shotToCoords(cx, cy, angle, dist, maxDist) {
  const rad = (angle * Math.PI) / 180;
  const r = (dist / 100) * maxDist;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

export default function WagonWheel({ width = 300, shots = [], showLegend = true, handedness = 'right' }) {
  const cx = width / 2;
  const cy = width / 2;
  const outerR = width * 0.45;

  const validShots = shots.filter(s => s.contact_x != null && s.contact_y != null);

  // For LHB, mirror the x coordinate
  const adjustX = (x) => handedness === 'left' ? 100 - x : x;

  return (
    <View>
      <Svg width={width} height={width}>
        {/* Outfield */}
        <Ellipse cx={cx} cy={cy} rx={outerR} ry={outerR * 0.93} fill="#3a7d2c" stroke="#2d6a22" strokeWidth={1.5} />
        {/* 30-yard circle */}
        <Ellipse cx={cx} cy={cy} rx={outerR * 0.63} ry={outerR * 0.6} fill="none" stroke="#6dbf5e" strokeWidth={0.7} strokeDasharray="5,4" />

        {/* Direction labels — flip for LHB */}
        <SvgText x={cx} y={14} fontSize={9} fill="#c8e6c9" textAnchor="middle">Straight</SvgText>
        <SvgText x={width - 4} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="end">
          {handedness === 'left' ? 'Leg side' : 'Off side'}
        </SvgText>
        <SvgText x={4} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="start">
          {handedness === 'left' ? 'Off side' : 'Leg side'}
        </SvgText>
        <SvgText x={cx} y={width - 4} fontSize={9} fill="#c8e6c9" textAnchor="middle">Fine leg / 3rd man</SvgText>

        {/* Pitch */}
        <Rect x={cx - 8} y={cy - 25} width={16} height={50} fill="#d4b483" stroke="#8a6d3b" strokeWidth={1} rx={2} />

        {/* Batter silhouette */}
        <BatterGraphic cx={cx} cy={cy + 14} handedness={handedness} size={18} />

        {/* Shot lines */}
        {validShots.map((s, i) => {
          const adjX = adjustX(parseFloat(s.contact_x));
          const { angle, dist } = contactToAngle(adjX, parseFloat(s.contact_y));
          const end = shotToCoords(cx, cy + 14, angle, dist, outerR);
          const runs = typeof s.runs === 'number' ? s.runs : 1;
          const color = RUN_COLORS[Math.min(runs, 6)] || '#64b5f6';
          return (
            <G key={i}>
              <Line
                x1={cx} y1={cy + 14}
                x2={end.x} y2={end.y}
                stroke={color}
                strokeWidth={runs >= 4 ? 2.5 : 1.5}
                opacity={0.85}
              />
              {runs >= 4 && (
                <Circle cx={end.x} cy={end.y} r={4} fill={color} opacity={0.9} />
              )}
            </G>
          );
        })}

        {/* Centre dot */}
        <Circle cx={cx} cy={cy + 14} r={3} fill="#f0c040" />
      </Svg>

      {showLegend && (
        <View style={styles.legend}>
          {Object.entries(RUN_COLORS).map(([runs, color]) => (
            <View key={runs} style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{runs === '0' ? 'Dot' : `${runs}s`}</Text>
            </View>
          ))}
        </View>
      )}

      {validShots.length === 0 && (
        <Text style={styles.empty}>No shot direction data yet</Text>
      )}
    </View>
  );
}

// Simple batter silhouette — bat on correct side for handedness
function BatterGraphic({ cx, cy, handedness, size }) {
  const batSide = handedness === 'right' ? 1 : -1; // +1 = right side, -1 = left side
  const s = size;
  return (
    <G>
      {/* Body */}
      <Line x1={cx} y1={cy - s * 0.6} x2={cx} y2={cy + s * 0.5} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      {/* Head */}
      <Circle cx={cx} cy={cy - s * 0.85} r={s * 0.28} fill="none" stroke="#fff" strokeWidth={1.5} />
      {/* Arms */}
      <Line x1={cx} y1={cy - s * 0.3} x2={cx + batSide * s * 0.5} y2={cy - s * 0.1} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      {/* Bat */}
      <Line
        x1={cx + batSide * s * 0.5}
        y1={cy - s * 0.1}
        x2={cx + batSide * s * 0.55}
        y2={cy + s * 0.55}
        stroke="#f0c040"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Legs */}
      <Line x1={cx} y1={cy + s * 0.5} x2={cx - batSide * s * 0.25} y2={cy + s} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx} y1={cy + s * 0.5} x2={cx + batSide * s * 0.1} y2={cy + s} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
    </G>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendLine: { width: 16, height: 3, borderRadius: 2 },
  legendText: { fontSize: 11, color: '#555' },
  empty: { textAlign: 'center', color: '#aaa', fontSize: 13, marginTop: 8 },
});