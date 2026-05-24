import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Rect, Circle, Line, Text as SvgText, G,
  Defs, LinearGradient, Stop, Path
} from 'react-native-svg';

const ZONES = [
  { label: 'Short', y: 0, h: 0.22, color: '#ffcdd2' },
  { label: 'Good Length', y: 0.22, h: 0.25, color: '#c8e6c9' },
  { label: 'The Slot', y: 0.47, h: 0.16, color: '#fff9c4' },
  { label: 'Full', y: 0.63, h: 0.15, color: '#ffe0b2' },
  { label: 'Yorker', y: 0.78, h: 0.22, color: '#e1bee7' },
];

const ZONE_COLORS = {
  short: '#ef9a9a', good_length: '#66bb6a',
  slot: '#ffd54f', full_toss: '#ffb74d', yorker: '#ba68c8',
};

// Bowler at TOP of pitch — bowling end
function BowlerGraphic({ cx, cy, size, handedness }) {
  const s = size;
  const armSide = handedness === 'left' ? -1 : 1;
  return (
    <G>
      <Circle cx={cx} cy={cy - s * 0.9} r={s * 0.28} fill="none" stroke="#1565c0" strokeWidth={1.5} />
      <Line x1={cx} y1={cy - s * 0.62} x2={cx} y2={cy + s * 0.2} stroke="#1565c0" strokeWidth={2} strokeLinecap="round" />
      <Line x1={cx} y1={cy - s * 0.4} x2={cx + armSide * s * 0.6} y2={cy - s * 0.8} stroke="#1565c0" strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={cx + armSide * s * 0.6} cy={cy - s * 0.8} r={s * 0.18} fill="#c62828" />
      <Line x1={cx} y1={cy - s * 0.4} x2={cx - armSide * s * 0.4} y2={cy - s * 0.1} stroke="#1565c0" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx} y1={cy + s * 0.2} x2={cx - s * 0.3} y2={cy + s * 0.8} stroke="#1565c0" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx} y1={cy + s * 0.2} x2={cx + s * 0.2} y2={cy + s * 0.8} stroke="#1565c0" strokeWidth={1.5} strokeLinecap="round" />
    </G>
  );
}

// Batter at BOTTOM of pitch — batting end
function BatterGraphic({ cx, cy, size, handedness }) {
  const s = size;
  const batSide = handedness === 'right' ? 1 : -1;
  return (
    <G>
      <Circle cx={cx} cy={cy - s * 0.9} r={s * 0.28} fill="none" stroke="#2e7d32" strokeWidth={1.5} />
      <Line x1={cx} y1={cy - s * 0.62} x2={cx} y2={cy + s * 0.2} stroke="#2e7d32" strokeWidth={2} strokeLinecap="round" />
      <Line x1={cx} y1={cy - s * 0.35} x2={cx + batSide * s * 0.45} y2={cy - s * 0.05} stroke="#2e7d32" strokeWidth={1.5} strokeLinecap="round" />
      <Line
        x1={cx + batSide * s * 0.45} y1={cy - s * 0.05}
        x2={cx + batSide * s * 0.5} y2={cy + s * 0.55}
        stroke="#f0c040" strokeWidth={3} strokeLinecap="round"
      />
      <Line x1={cx} y1={cy - s * 0.35} x2={cx - batSide * s * 0.3} y2={cy - s * 0.05} stroke="#2e7d32" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx} y1={cy + s * 0.2} x2={cx - batSide * s * 0.2} y2={cy + s * 0.8} stroke="#2e7d32" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx} y1={cy + s * 0.2} x2={cx + batSide * s * 0.15} y2={cy + s * 0.8} stroke="#2e7d32" strokeWidth={1.5} strokeLinecap="round" />
      <Path
        d={`M ${cx - s * 0.28} ${cy - s * 0.9} A ${s * 0.28} ${s * 0.28} 0 0 1 ${cx + s * 0.28} ${cy - s * 0.9}`}
        fill="#2e7d32" stroke="none"
      />
    </G>
  );
}

export default function PitchMap({
  width = 200,
  points = [],
  selectedPoint = null,
  onTap,
  highlightPoint = null,
  batterHandedness = 'right',
  bowlerHandedness = 'right',
}) {
  const height = width * 1.8;
  const pitchLeft = width * 0.2;
  const pitchW = width * 0.6;
  const graphicSize = width * 0.11;

  // Total SVG height: graphic above + pitch + graphic below
  const totalH = height + graphicSize * 2.2 + 20;
  const pitchOffsetY = graphicSize * 1.9; // pitch starts after bowler graphic

  const adjustedPoints = points.map(p => ({
    ...p,
    x: batterHandedness === 'left' ? 100 - p.x : p.x,
  }));

  const adjustedSelected = selectedPoint && batterHandedness === 'left'
    ? { ...selectedPoint, x: 100 - selectedPoint.x }
    : selectedPoint;

  const handleTouch = (evt) => {
    if (!onTap) return;
    const { locationX, locationY } = evt.nativeEvent;
    const adjustedY = locationY - pitchOffsetY;
    if (adjustedY < 0 || adjustedY > height) return; // outside pitch
    let px = Math.max(0, Math.min(100, ((locationX - pitchLeft) / pitchW) * 100));
    const py = Math.max(0, Math.min(100, (adjustedY / height) * 100));
    if (batterHandedness === 'left') px = 100 - px;
    onTap({ x: parseFloat(px.toFixed(1)), y: parseFloat(py.toFixed(1)) });
  };

  // Stump x positions based on handedness
  const offStumpPct = batterHandedness === 'right' ? 0.6 : 0.4;
  const legStumpPct = batterHandedness === 'right' ? 0.4 : 0.6;
  const midStumpPct = 0.5;

  // Crease y positions within pitch
  // Batter's crease: near BOTTOM of pitch (y = 88% down)
  // Bowler's crease: near TOP of pitch (y = 6% down) — this is where bowler releases
  const batterCreaseY = pitchOffsetY + height * 0.88;
  const bowlerCreaseY = pitchOffsetY + height * 0.06; // very top — bowler's end

  return (
    <View>
      <Svg
        width={width}
        height={totalH}
        onStartShouldSetResponder={() => !!onTap}
        onResponderGrant={handleTouch}
      >
        <Defs>
          <LinearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#d4e6b5" />
            <Stop offset="100%" stopColor="#a5c96a" />
          </LinearGradient>
        </Defs>

        {/* ── BOWLER GRAPHIC (above pitch) ── */}
        <BowlerGraphic
          cx={pitchLeft + pitchW / 2}
          cy={graphicSize * 0.95}
          size={graphicSize}
          handedness={bowlerHandedness}
        />

        {/* ── PITCH ── */}
        <Rect
          x={pitchLeft} y={pitchOffsetY}
          width={pitchW} height={height}
          fill="url(#pitchGrad)" stroke="#5d8a3c" strokeWidth={1.5} rx={4}
        />

        {/* Zone bands */}
        {ZONES.map((z, i) => (
          <G key={i}>
            <Rect
              x={pitchLeft} y={pitchOffsetY + z.y * height}
              width={pitchW} height={z.h * height}
              fill={z.color} opacity={0.32}
            />
            <Line
              x1={pitchLeft} y1={pitchOffsetY + z.y * height}
              x2={pitchLeft + pitchW} y2={pitchOffsetY + z.y * height}
              stroke="#8bc34a" strokeWidth={0.6} strokeDasharray="5,3"
            />
            <SvgText
              x={pitchLeft - 4}
              y={pitchOffsetY + z.y * height + z.h * height * 0.5 + 4}
              fontSize={8} fill="#555" textAnchor="end"
            >
              {z.label}
            </SvgText>
          </G>
        ))}

        {/* ── BATTER'S CREASE (bottom of pitch) ── */}
        <Line
          x1={pitchLeft} y1={batterCreaseY}
          x2={pitchLeft + pitchW} y2={batterCreaseY}
          stroke="#fff" strokeWidth={2}
        />

        {/* ── BOWLER'S CREASE (very top of pitch) ── */}
        <Line
          x1={pitchLeft} y1={bowlerCreaseY}
          x2={pitchLeft + pitchW} y2={bowlerCreaseY}
          stroke="#fff" strokeWidth={1.5} strokeDasharray="5,3"
        />

        {/* ── STUMPS AT BATTER'S END (bottom) ── */}
        {[legStumpPct, midStumpPct, offStumpPct].map((sx, i) => (
          <G key={`bat-stump-${i}`}>
            <Line
              x1={pitchLeft + pitchW * sx} y1={batterCreaseY}
              x2={pitchLeft + pitchW * sx} y2={batterCreaseY + 14}
              stroke="#f5e642" strokeWidth={2.5}
            />
          </G>
        ))}
        {/* Bails at batter end */}
        <Line
          x1={pitchLeft + pitchW * legStumpPct} y1={batterCreaseY}
          x2={pitchLeft + pitchW * offStumpPct} y2={batterCreaseY}
          stroke="#f5e642" strokeWidth={1.5}
        />
        {/* Stump labels */}
        <SvgText x={pitchLeft + pitchW * offStumpPct} y={batterCreaseY + 22} fontSize={8} fill="#f5e642" textAnchor="middle">Off</SvgText>
        <SvgText x={pitchLeft + pitchW * legStumpPct} y={batterCreaseY + 22} fontSize={8} fill="#f5e642" textAnchor="middle">Leg</SvgText>

        {/* ── NON-STRIKER STUMPS AT BOWLER'S END (very top of pitch) ── */}
        {[legStumpPct, midStumpPct, offStumpPct].map((sx, i) => (
          <G key={`bowl-stump-${i}`}>
            <Line
              x1={pitchLeft + pitchW * sx} y1={bowlerCreaseY - 12}
              x2={pitchLeft + pitchW * sx} y2={bowlerCreaseY}
              stroke="#f5e642" strokeWidth={1.8}
            />
          </G>
        ))}
        {/* Bails at bowler end */}
        <Line
          x1={pitchLeft + pitchW * legStumpPct} y1={bowlerCreaseY - 12}
          x2={pitchLeft + pitchW * offStumpPct} y2={bowlerCreaseY - 12}
          stroke="#f5e642" strokeWidth={1.2}
        />

        {/* ── BALL LANDING DOTS ── */}
        {adjustedPoints.map((p, i) => {
          const dotX = pitchLeft + (p.x / 100) * pitchW;
          const dotY = pitchOffsetY + (p.y / 100) * height;
          const color = ZONE_COLORS[p.length_type] || '#e53935';
          const isHighlight = highlightPoint && p.ball_number === highlightPoint;
          return (
            <G key={i}>
              <Circle
                cx={dotX} cy={dotY}
                r={isHighlight ? 9 : 6}
                fill={color} opacity={isHighlight ? 1 : 0.75}
                stroke={isHighlight ? '#fff' : 'none'} strokeWidth={2}
              />
              <SvgText x={dotX} y={dotY + 4} fontSize={7} fill="#fff" textAnchor="middle" fontWeight="bold">
                {p.ball_number || ''}
              </SvgText>
            </G>
          );
        })}

        {/* ── SELECTED TAP POINT ── */}
        {adjustedSelected && (
          <Circle
            cx={pitchLeft + (adjustedSelected.x / 100) * pitchW}
            cy={pitchOffsetY + (adjustedSelected.y / 100) * height}
            r={9} fill="#f44336" opacity={0.9} stroke="#fff" strokeWidth={2}
          />
        )}

        {/* Tap hint */}
        {onTap && !selectedPoint && (
          <SvgText
            x={pitchLeft + pitchW / 2}
            y={pitchOffsetY + height * 0.5}
            fontSize={10} fill="#777" textAnchor="middle"
          >
            Tap where ball lands
          </SvgText>
        )}

        {/* ── BATTER GRAPHIC (below pitch) ── */}
        <BatterGraphic
          cx={pitchLeft + pitchW / 2}
          cy={pitchOffsetY + height + graphicSize * 0.9}
          size={graphicSize}
          handedness={batterHandedness}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({});