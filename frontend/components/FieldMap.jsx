import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Svg, {
  Circle, Line, Rect, Text as SvgText, G, Ellipse, Path
} from 'react-native-svg';

const DEFAULT_FIELDERS = [
  { id: 1, name: 'Slip', x: 62, y: 42 },
  { id: 2, name: 'Gully', x: 70, y: 38 },
  { id: 3, name: 'Point', x: 78, y: 50 },
  { id: 4, name: 'Cover', x: 72, y: 60 },
  { id: 5, name: 'Mid-off', x: 58, y: 70 },
  { id: 6, name: 'Mid-on', x: 42, y: 70 },
  { id: 7, name: 'Mid-wicket', x: 28, y: 60 },
  { id: 8, name: 'Square leg', x: 22, y: 50 },
  { id: 9, name: 'Fine leg', x: 35, y: 35 },
  { id: 10, name: 'Keeper', x: 52, y: 42 },
];

export default function FieldMap({ width = 300, fielders: initialFielders, onFieldersChange, readonly = false }) {
  const [fielders, setFielders] = useState(initialFielders || DEFAULT_FIELDERS);
  const [selected, setSelected] = useState(null);
  const svgRef = useRef(null);

  const h = width;
  const cx = width / 2;
  const cy = width / 2;
  const outerR = width * 0.46;
  const innerR = width * 0.28;

  const toSvg = (pct, isX) => (isX ? (pct / 100) * width : (pct / 100) * h);
  const toPct = (sv, isX) => (isX ? (sv / width) * 100 : (sv / h) * 100);

  const handleFieldPress = (evt) => {
    if (readonly) return;
    const { locationX, locationY } = evt.nativeEvent;
    const px = toPct(locationX, true);
    const py = toPct(locationY, false);

    // Check if tapping near an existing fielder
    for (const f of fielders) {
      const fx = toSvg(f.x, true);
      const fy = toSvg(f.y, false);
      const dist = Math.sqrt((locationX - fx) ** 2 + (locationY - fy) ** 2);
      if (dist < 20) {
        setSelected(selected === f.id ? null : f.id);
        return;
      }
    }

    // Move selected fielder to tapped position
    if (selected !== null) {
      const updated = fielders.map(f =>
        f.id === selected ? { ...f, x: parseFloat(px.toFixed(1)), y: parseFloat(py.toFixed(1)) } : f
      );
      setFielders(updated);
      onFieldersChange?.(updated);
      setSelected(null);
    }
  };

  const resetField = () => {
    setFielders(DEFAULT_FIELDERS);
    onFieldersChange?.(DEFAULT_FIELDERS);
    setSelected(null);
  };

  // Draw shot direction dot (for wagon wheel overlay)
  return (
    <View>
      {!readonly && (
        <Text style={styles.hint}>
          {selected !== null
            ? `📍 Tap anywhere to move ${fielders.find(f => f.id === selected)?.name}`
            : 'Tap a fielder to select, then tap destination to move'}
        </Text>
      )}
      <Svg
        width={width}
        height={h}
        onStartShouldSetResponder={() => !readonly}
        onResponderGrant={handleFieldPress}
      >
        {/* Outfield */}
        <Ellipse cx={cx} cy={cy} rx={outerR} ry={outerR * 0.92} fill="#3a7d2c" stroke="#2d6a22" strokeWidth={1.5} />
        {/* 30-yard circle */}
        <Ellipse cx={cx} cy={cy} rx={innerR} ry={innerR * 0.92} fill="#4a8f3a" stroke="#6dbf5e" strokeWidth={1} strokeDasharray="6,4" />
        {/* Pitch rectangle */}
        <Rect x={cx - 9} y={cy - 28} width={18} height={56} fill="#d4b483" stroke="#8a6d3b" strokeWidth={1} rx={2} />
        {/* Stumps */}
        {[-4, 0, 4].map((ox, i) => (
          <G key={i}>
            <Line x1={cx + ox} y1={cy - 28} x2={cx + ox} y2={cy - 36} stroke="#5d4037" strokeWidth={1.5} />
            <Line x1={cx + ox} y1={cy + 28} x2={cx + ox} y2={cy + 36} stroke="#5d4037" strokeWidth={1.5} />
          </G>
        ))}
        {/* Fielder positions */}
        {fielders.map(f => {
          const fx = toSvg(f.x, true);
          const fy = toSvg(f.y, false);
          const isSelected = selected === f.id;
          const isKeeper = f.name === 'Keeper';
          return (
            <G key={f.id}>
              <Circle
                cx={fx} cy={fy}
                r={isKeeper ? 8 : 10}
                fill={isSelected ? '#f0c040' : isKeeper ? '#1565c0' : '#e53935'}
                stroke="#fff"
                strokeWidth={isSelected ? 2.5 : 1.5}
                opacity={0.92}
              />
              <SvgText
                x={fx} y={fy + 4}
                fontSize={isSelected ? 8 : 7}
                fill="#fff"
                textAnchor="middle"
                fontWeight="bold"
              >
                {f.name.split(' ').map(w => w[0]).join('').slice(0, 3)}
              </SvgText>
              {isSelected && (
                <SvgText x={fx} y={fy - 15} fontSize={9} fill="#f0c040" textAnchor="middle" fontWeight="bold">
                  {f.name}
                </SvgText>
              )}
            </G>
          );
        })}
        {/* Batter marker */}
        <Circle cx={cx} cy={cy + 16} r={5} fill="#fff" stroke="#1a472a" strokeWidth={1.5} />
        <SvgText x={cx} y={cy + 16 + 4} fontSize={7} fill="#1a472a" textAnchor="middle" fontWeight="bold">BAT</SvgText>

        {/* Compass labels */}
        <SvgText x={cx} y={12} fontSize={9} fill="#c8e6c9" textAnchor="middle">Straight</SvgText>
        <SvgText x={width - 6} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="end">Off</SvgText>
        <SvgText x={6} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="start">Leg</SvgText>
      </Svg>

      {!readonly && (
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.resetBtn} onPress={resetField}>
            <Text style={styles.resetBtnText}>↺ Reset Field</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fielder legend */}
      <View style={styles.legend}>
        {fielders.map(f => (
          <View key={f.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: f.name === 'Keeper' ? '#1565c0' : '#e53935' }]} />
            <Text style={styles.legendText}>{f.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: '#555', textAlign: 'center', marginBottom: 8, fontStyle: 'italic' },
  btnRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 10 },
  resetBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#1a472a' },
  resetBtnText: { color: '#1a472a', fontWeight: '600', fontSize: 13 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: '#555' },
});