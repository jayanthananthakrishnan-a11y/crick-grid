import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle, Line, Ellipse, G, Text as SvgText, Rect
} from 'react-native-svg';

const RUN_COLORS = {
  0: '#bdbdbd', 1: '#64b5f6', 2: '#81c784',
  3: '#ffb74d', 4: '#e53935', 6: '#9c27b0',
};

// Convert contact_x/y (0-100 field %) to SVG coordinates
// Batter is at exact centre (cx, cy)
// contact_y < 50 = straight (forward), contact_y > 50 = behind (fine leg/3rd man)
function contactToSvg(contactX, contactY, cx, cy, outerR, handedness) {
  let fx = contactX;
  if (handedness === 'left') fx = 100 - fx;

  const normX = (fx - 50) / 50;  // -1 to 1 range
  const normY = (contactY - 50) / 50;  // -1 to 1 range

  return {
    x: cx + normX * outerR,
    y: cy + normY * outerR,
  };
}

// Batter silhouette — always at exact (cx, cy)
function BatterSilhouette({ cx, cy, size: s, handedness }) {
  const bat = handedness === 'right' ? 1 : -1;
  return (
    <G>
      {/* Head */}
      <Circle cx={cx} cy={cy - s * 0.9} r={s * 0.26} fill="none" stroke="#fff" strokeWidth={1.5} />
      {/* Body */}
      <Line x1={cx} y1={cy - s * 0.64} x2={cx} y2={cy + s * 0.2}
        stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      {/* Bat arm */}
      <Line x1={cx} y1={cy - s * 0.35} x2={cx + bat * s * 0.45} y2={cy}
        stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      {/* Bat */}
      <Line
        x1={cx + bat * s * 0.45} y1={cy}
        x2={cx + bat * s * 0.5}  y2={cy + s * 0.5}
        stroke="#f0c040" strokeWidth={3} strokeLinecap="round"
      />
      {/* Other arm */}
      <Line x1={cx} y1={cy - s * 0.35} x2={cx - bat * s * 0.3} y2={cy}
        stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      {/* Legs */}
      <Line x1={cx} y1={cy + s * 0.2} x2={cx - bat * s * 0.2} y2={cy + s * 0.75}
        stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx} y1={cy + s * 0.2} x2={cx + bat * s * 0.15} y2={cy + s * 0.75}
        stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
    </G>
  );
}

export default function WagonWheel({
  width = 300,
  shots = [],
  showLegend = true,
  handedness = 'right',
}) {
  const cx = width / 2;
  const cy = width / 2;   // exact centre — no offset
  const outerR = width * 0.44;
  const innerR = width * 0.27;

  const validShots = shots.filter(
    s => s.contact_x != null && s.contact_y != null
  );

  return (
    <View>
      <Svg width={width} height={width}>
        {/* Outfield */}
        <Ellipse cx={cx} cy={cy} rx={outerR} ry={outerR * 0.93}
          fill="#3a7d2c" stroke="#2d6a22" strokeWidth={1.5} />
        {/* 30-yard circle */}
        <Ellipse cx={cx} cy={cy} rx={innerR} ry={innerR * 0.93}
          fill="none" stroke="#6dbf5e" strokeWidth={0.8} strokeDasharray="5,4" />

        {/* Direction labels */}
        <SvgText x={cx} y={12} fontSize={9} fill="#c8e6c9" textAnchor="middle">Straight</SvgText>
        <SvgText x={width - 4} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="end">
          {handedness === 'right' ? 'Off side' : 'Leg side'}
        </SvgText>
        <SvgText x={4} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="start">
          {handedness === 'right' ? 'Leg side' : 'Off side'}
        </SvgText>
        <SvgText x={cx} y={width - 4} fontSize={9} fill="#c8e6c9" textAnchor="middle">
          Fine leg / 3rd man
        </SvgText>

        {/* Pitch strip — centred */}
        <Rect x={cx - 7} y={cy - 22} width={14} height={44}
          fill="#d4b483" stroke="#8a6d3b" strokeWidth={1} rx={2} />

        {/* Batter silhouette at exact centre */}
        <BatterSilhouette cx={cx} cy={cy} size={16} handedness={handedness} />

        {/* Shot lines */}
        {validShots.map((shot, i) => {
          const end = contactToSvg(
            parseFloat(shot.contact_x),
            parseFloat(shot.contact_y),
            cx, cy, outerR, handedness
          );
          const runs  = typeof shot.runs === 'number' ? shot.runs : 0;
          const color = RUN_COLORS[Math.min(runs, 6)] || '#64b5f6';
          const isBig = runs >= 4;

          return (
            <G key={i}>
              <Line
                x1={cx} y1={cy}
                x2={end.x} y2={end.y}
                stroke={color}
                strokeWidth={isBig ? 2.5 : 1.5}
                opacity={0.85}
              />
              {isBig && (
                <Circle cx={end.x} cy={end.y} r={4} fill={color} opacity={0.9} />
              )}
            </G>
          );
        })}

        {/* Centre dot */}
        <Circle cx={cx} cy={cy} r={3} fill="#f0c040" />
      </Svg>

      {showLegend && (
        <View style={styles.legend}>
          {Object.entries(RUN_COLORS).map(([runs, color]) => (
            <View key={runs} style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: color }]} />
              <Text style={styles.legendText}>
                {runs === '0' ? 'Dot' : `${runs}s`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {validShots.length === 0 && (
        <Text style={styles.empty}>
          No shot direction data yet.
          Use the arrow in the Log tab to set shot direction.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  legend:      { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8, justifyContent: 'center' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendLine:  { width: 16, height: 3, borderRadius: 2 },
  legendText:  { fontSize: 11, color: '#555' },
  empty:       { textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 8, lineHeight: 18 },
});