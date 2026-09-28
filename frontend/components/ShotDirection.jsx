import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText, G, Rect } from 'react-native-svg';

const SIZE = Math.min(Dimensions.get('window').width - 64, 300);
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = SIZE * 0.44;
const INNER_R = SIZE * 0.27;

// Compass zones — label based on angle from centre
const ZONES = [
  { label: 'Straight', minA: -30, maxA: 30 },
  { label: 'Mid-on', minA: 30, maxA: 65 },
  { label: 'Mid-wicket', minA: 65, maxA: 110 },
  { label: 'Square leg', minA: 110, maxA: 145 },
  { label: 'Fine leg', minA: 145, maxA: 180 },
  { label: 'Fine leg', minA: -180, maxA: -145 },
  { label: '3rd man', minA: -145, maxA: -110 },
  { label: 'Point', minA: -110, maxA: -65 },
  { label: 'Cover', minA: -65, maxA: -30 },
];

function getZoneLabel(angle) {
  for (const z of ZONES) {
    if (angle >= z.minA && angle < z.maxA) return z.label;
  }
  return 'Straight';
}

function getAngle(x, y) {
  return Math.atan2(x - CX, CY - y) * (180 / Math.PI);
}

function arrowHead(x1, y1, x2, y2, size = 10) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI * 0.8;
  const a2 = angle - Math.PI * 0.8;
  return `${x2},${y2} ${x2 + size * Math.cos(a1)},${y2 + size * Math.sin(a1)} ${x2 + size * Math.cos(a2)},${y2 + size * Math.sin(a2)}`;
}

// ── FIXED COORDINATE ORIENTATION ENGINE ──
// Convert arrow endpoint to contact_x, contact_y (0-100 field %)
// Matches FieldMap coordinate system: batter at (50, 85), straight = y decreasing
function arrowToContact(endX, endY, distFromCenter, handedness) {
  const normX = (endX - CX) / OUTER_R;  // -1 to 1 range
  const normY = (endY - CY) / OUTER_R;  // -1 to 1 range

  let fieldX = 50 + normX * 50;
  let fieldY = 50 + normY * 50;

  if (handedness === 'left') fieldX = 100 - fieldX;

  const isBoundaryHit = distFromCenter >= 0.88 * OUTER_R;

  return {
    x: Math.max(0, Math.min(100, parseFloat(fieldX.toFixed(2)))),
    y: Math.max(0, Math.min(100, parseFloat(fieldY.toFixed(2)))),
    is_boundary_hit: isBoundaryHit,
  };
}

export default function ShotDirection({ value, onChange, handedness = 'right' }) {
  const [arrow, setArrow] = useState(value || null); 
  const [dragging, setDragging] = useState(false);

  const updateArrow = (locationX, locationY) => {
    const dx = locationX - CX;
    const dy = locationY - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = dist > OUTER_R ? OUTER_R / dist : 1;
    const endX = CX + dx * clamped;
    const endY = CY + dy * clamped;
    const newArrow = { endX, endY };
    
    setArrow(newArrow);
    const contact = arrowToContact(endX, endY, Math.min(dist, OUTER_R), handedness);
    onChange?.(contact, newArrow);
  };

  const handleStart = (evt) => {
    setDragging(true);
    updateArrow(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
  };

  const handleMove = (evt) => {
    if (!dragging) return;
    updateArrow(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
  };

  const handleEnd = () => setDragging(false);

  const handleClear = () => {
    setArrow(null);
    onChange?.(null, null);
  };

  const zoneLabel = arrow ? getZoneLabel(getAngle(arrow.endX, arrow.endY)) : null;
  const displayZone = arrow
    ? (handedness === 'left' && zoneLabel
        ? zoneLabel.replace('Leg', '__LEG__').replace('Off', '__OFF__')
          .replace('Mid-on', 'Mid-off').replace('Mid-wicket', 'Mid-on')
          .replace('Square leg', 'Square leg')
          .replace('Fine leg', 'Fine leg')
          .replace('Point', 'Mid-wicket')
          .replace('Cover', 'Point')
          .replace('3rd man', '3rd man')
          .replace('__LEG__', 'Off').replace('__OFF__', 'Leg')
        : zoneLabel)
    : null;

  const compassLabels = handedness === 'right'
    ? [
        { label: 'Straight', x: CX, y: 10, anchor: 'middle' },
        { lable: 'Leg', x: 10, y: CY + 4, anchor: 'start' },
        { label: 'Off', x: SIZE - 10, y: CY + 4, anchor: 'end' },
        { label: 'Fine leg/3rd man', x: CX, y: SIZE - 4, anchor: 'middle' },
      ]
    : [
        { label: 'Straight', x: CX, y: 10, anchor: 'middle' },
        { label: 'Off', x: 10, y: CY + 4, anchor: 'start' },
        { label: 'Leg', x: SIZE - 10, y: CY + 4, anchor: 'end' },
        { label: 'Fine leg/3rd man', x: CX, y: SIZE - 4, anchor: 'middle' },
      ];

  return (
    <View style={styles.container}>
      <View
        style={styles.svgWrap}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleStart}
        onResponderMove={handleMove}
        onResponderRelease={handleEnd}
      >
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={CX} cy={CY} r={OUTER_R} fill="#3a7d2c" stroke="#2d6a22" strokeWidth={1.5} />
          <Circle cx={CX} cy={CY} r={INNER_R} fill="#4a8f3a" stroke="#6dbf5e" strokeWidth={0.8} strokeDasharray="5,4" />

          {compassLabels.map((l, i) => (
            <SvgText key={i} x={l.x} y={l.y} fontSize={9} fill="#c8e6c9" textAnchor={l.anchor}>{l.label}</SvgText>
          ))}

          <Rect x={CX - 7} y={CY - 22} width={14} height={44} fill="#d4b483" stroke="#8a6d3b" strokeWidth={1} rx={2} />
          <BatterSilhouette cx={CX} cy={CY + 10} size={18} handedness={handedness} />

          {!arrow && (
            <G>
              <Circle cx={CX} cy={CY} r={INNER_R * 0.5} fill="none" stroke="#f0c04055" strokeWidth={1.5} strokeDasharray="4,3" />
              <SvgText x={CX} y={CY - INNER_R * 0.65} fontSize={9} fill="#f0c040aa" textAnchor="middle">
                Drag to aim
              </SvgText>
            </G>
          )}

          {arrow && (
            <G>
              <Line
                x1={CX} y1={CY + 10}
                x2={arrow.endX + 1} y2={arrow.endY + 1}
                stroke="rgba(0,0,0,0.3)" strokeWidth={4} strokeLinecap="round"
              />
              <Line
                x1={CX} y1={CY + 10}
                x2={arrow.endX} y2={arrow.endY}
                stroke="#f0c040" strokeWidth={3.5} strokeLinecap="round"
              />
              <Polygon
                points={arrowHead(CX, CY + 10, arrow.endX, arrow.endY, 10)}
                fill="#f0c040"
              />
              <Circle cx={arrow.endX} cy={arrow.endY} r={6} fill="#f0c040" opacity={0.9} stroke="#fff" strokeWidth={1.5} />
            </G>
          )}
        </Svg>
      </View>

      <View style={styles.footer}>
        {displayZone ? (
          <View style={styles.zonePill}>
            <Text style={styles.zoneText}>📍 {displayZone}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>Drag from centre to set shot direction</Text>
        )}
        {arrow && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Text style={styles.clearBtnText}>✕ Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function BatterSilhouette({ cx, cy, size: s, handedness }) {
  const bat = handedness === 'right' ? 1 : -1;
  return (
    <G>
      <Circle cx={cx} cy={cy - s * 0.9} r={s * 0.26} fill="none" stroke="#fff" strokeWidth={1.5} />
      <Line x1={cx} y1={cy - s * 0.64} x2={cx} y2={cy + s * 0.2} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      <Line x1={cx} y1={cy - s * 0.35} x2={cx + bat * s * 0.45} y2={cy} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx + bat * s * 0.45} y1={cy} x2={cx + bat * s * 0.5} y2={cy + s * 0.5} stroke="#f0c040" strokeWidth={3} strokeLinecap="round" />
      <Line x1={cx} y1={cy + s * 0.2} x2={cx - bat * s * 0.2} y2={cy + s * 0.75} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx} y1={cy + s * 0.2} x2={cx + bat * s * 0.15} y2={cy + s * 0.75} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
    </G>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  svgWrap: { borderRadius: SIZE / 2, overflow: 'hidden' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 8, minHeight: 32 },
  zonePill: { backgroundColor: '#1a472a', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16 },
  zoneText: { color: '#f0c040', fontWeight: 'bold', fontSize: 13 },
  hint: { fontSize: 11, color: '#888', fontStyle: 'italic' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#ef9a9a' },
  clearBtnText: { color: '#c62828', fontSize: 12, fontWeight: '600' },
});