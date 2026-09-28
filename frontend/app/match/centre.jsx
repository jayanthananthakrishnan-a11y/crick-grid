import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, Dimensions, FlatList, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, {
  Circle, Line, Ellipse, G, Text as SvgText, Rect, Path,
} from 'react-native-svg';
import {
  getMatch, saveMatch, saveInnings, getInningsList,
  saveBall, getBalls, undoLastBall,
  saveBatsmen, getBatsmen,
  saveBowlers, getBowlers,
  saveRoster, getRoster,
  savePartnerships, getPartnerships,
  saveDaySnapshot,
  generateId,
} from '../../services/matchStorage';
import { generateMatchPDF } from '../../services/pdfReportGenerator';
import {
  calcCRR, calcRRR, formatOvers, shouldStrikeRotate,
  isLegalDelivery, isNoBallEvent, generateNarrative, buildDismissalString,
  computeInningsSummary, computeAllBatsmenFromBalls,
  computeAllBowlersFromBalls, getCurrentOverState,
  getBallsInCurrentOver, computeOverRuns,
  computeScoreProgression, computePhaseStats, projectScore,
} from '../../services/matchEngine';

const SW      = Dimensions.get('window').width;
const ACCENT  = '#f0c040';
const PRIMARY = '#0a3d1f';
const SCORING = '#e8650a';

const RUN_COLORS = {
  0: '#9e9e9e', 1: '#bdbdbd', 2: '#3f51b5',
  3: '#9c27b0', 4: '#1565c0', 6: '#e65100',
};

function OverBall({ ball }) {
  let bg = '#616161', label = '•';
  if (ball.is_wide)                { bg = '#1565c0'; label = 'Wd'; }
  else if (ball.is_no_ball)        { bg = '#e65100'; label = 'NB'; }
  else if (ball.is_wicket)         { bg = '#c62828'; label = 'W';  }
  else if (ball.runs_scored === 6) { bg = '#7b1fa2'; label = '6';  }
  else if (ball.runs_scored === 4) { bg = '#1565c0'; label = '4';  }
  else if (ball.runs_scored > 0)   { bg = '#388e3c'; label = String(ball.runs_scored); }
  return (
    <View style={[ob.ball, { backgroundColor: bg }]}>
      <Text style={ob.text}>{label}</Text>
    </View>
  );
}
const ob = StyleSheet.create({
  ball: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});

function WagonWheelModal({ visible, runs, title, onConfirm }) {
  const [arrow, setArrow] = useState(null);
  const SIZE = SW * 0.78;
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE * 0.43;
  useEffect(() => { if (visible) setArrow(null); }, [visible]);
  const handleTouch = (evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    const dx = locationX - cx, dy = locationY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const c = dist > r ? r / dist : 1;
    setArrow({ x: cx + dx * c, y: cy + dy * c });
  };
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={ww.overlay}>
        <View style={ww.box}>
          <View style={ww.header}>
            <Text style={ww.title}>{title || 'Shot Direction'}</Text>
            {runs != null && <Text style={ww.runs}>{runs} run{runs !== 1 ? 's' : ''}</Text>}
          </View>
          <Text style={ww.hint}>Tap or drag to show where the ball went</Text>
          <View onStartShouldSetResponder={() => true} onResponderGrant={handleTouch} onResponderMove={handleTouch}>
            <Svg width={SIZE} height={SIZE}>
              <Ellipse cx={cx} cy={cy} rx={r} ry={r * 0.93} fill="#3a7d2c" stroke="#2d6a22" strokeWidth={1.5} />
              <Ellipse cx={cx} cy={cy} rx={r * 0.6} ry={r * 0.56} fill="none" stroke="#6dbf5e" strokeWidth={0.8} strokeDasharray="4,3" />
              <Rect x={cx - 7} y={cy - 20} width={14} height={40} fill="#d4b483" rx={2} />
              <SvgText x={cx} y={12} fontSize={9} fill="#c8e6c9" textAnchor="middle">Straight</SvgText>
              <SvgText x={SIZE - 4} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="end">Off</SvgText>
              <SvgText x={4} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="start">Leg</SvgText>
              {!arrow && <SvgText x={cx} y={cy + 4} fontSize={11} fill="#f0c04088" textAnchor="middle">Tap to aim</SvgText>}
              {arrow && (
                <G>
                  <Line x1={cx} y1={cy} x2={arrow.x} y2={arrow.y} stroke={ACCENT} strokeWidth={3.5} strokeLinecap="round" />
                  <Circle cx={arrow.x} cy={arrow.y} r={6} fill={ACCENT} />
                  <Circle cx={cx} cy={cy} r={4} fill="#fff" />
                </G>
              )}
            </Svg>
          </View>
          <View style={ww.btns}>
            <TouchableOpacity style={ww.skip} onPress={() => onConfirm(null)}>
              <Text style={ww.skipText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[ww.confirm, !arrow && { opacity: 0.4 }]}
              onPress={() => arrow && onConfirm(arrow)}
              disabled={!arrow}
            >
              <Text style={ww.confirmText}>Confirm →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const ww = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  box:         { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', width: '92%' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 4 },
  title:       { fontSize: 17, fontWeight: 'bold', color: PRIMARY, flex: 1 },
  runs:        { fontSize: 28, fontWeight: 'bold', color: SCORING },
  hint:        { fontSize: 12, color: '#888', marginBottom: 12 },
  btns:        { flexDirection: 'row', gap: 12, marginTop: 16, width: '100%' },
  skip:        { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', alignItems: 'center' },
  skipText:    { color: '#666', fontWeight: '600' },
  confirm:     { flex: 1, padding: 12, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  confirmText: { color: ACCENT, fontWeight: 'bold' },
});

function WWLegend() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, justifyContent: 'center' }}>
      {[['0','Dot'],['1','1 run'],['2','2 runs'],['3','3 runs'],['4','4 (four)'],['6','6 (six)']].map(([k, label]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 20, height: 4, backgroundColor: RUN_COLORS[parseInt(k)], borderRadius: 2 }} />
          <Text style={{ fontSize: 11, color: '#555' }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function PlayerSelectModal({
  visible, title, accentColor = SCORING,
  players, alreadySelected, allowDone,
  onSelect, onAdd, onDeselect, onDelete, onDone, onClose,
}) {
  const [search,   setSearch]   = useState('');
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState('');
  const available = players.filter(p =>
    !alreadySelected?.includes(p) && p.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#f4f6f4' }}>
        <View style={[ps.header, { backgroundColor: accentColor }]}>
          <TouchableOpacity onPress={onClose} style={{ width: 36 }}>
            <Text style={ps.close}>✕</Text>
          </TouchableOpacity>
          <Text style={ps.title}>{title}</Text>
          {allowDone
            ? <TouchableOpacity onPress={onDone} style={ps.doneBtn}><Text style={ps.doneBtnText}>Done ✓</Text></TouchableOpacity>
            : <View style={{ width: 60 }} />
          }
        </View>
        {alreadySelected && alreadySelected.length > 0 && (
          <View style={ps.selectedBar}>
            <Text style={ps.selectedLabel}>Selected ({alreadySelected.length}):</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {alreadySelected.map(p => (
                <TouchableOpacity key={p} style={ps.selectedChip} onPress={() => onDeselect?.(p)}>
                  <Text style={ps.selectedChipText}>{p} ✕</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <TextInput style={ps.search} placeholder="Search by name..." value={search} onChangeText={setSearch} />
        <FlatList
          data={available}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={ps.row}
              onPress={() => onSelect(item)}
              onLongPress={() => Alert.alert('Remove Player', `Remove "${item}"?`, [
                { text: 'Cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => onDelete?.(item) },
              ])}
            >
              <View style={[ps.avatar, { backgroundColor: accentColor }]}>
                <Text style={ps.avatarText}>{item[0].toUpperCase()}</Text>
              </View>
              <Text style={ps.rowName}>{item}</Text>
              <Text style={ps.holdHint}>hold to remove</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={ps.empty}>
              {players.length === 0 ? 'No players yet. Create one below.' : 'No more players. Create one below.'}
            </Text>
          }
        />
        {creating ? (
          <View style={ps.createBox}>
            <Text style={ps.createTitle}>Create New Player</Text>
            <TextInput style={ps.createInput} placeholder="Full name" value={newName} onChangeText={setNewName} autoFocus />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={ps.createCancel} onPress={() => { setCreating(false); setNewName(''); }}>
                <Text style={{ color: '#666' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ps.createAdd, { backgroundColor: accentColor }, !newName.trim() && { opacity: 0.4 }]}
                onPress={() => { if (!newName.trim()) return; onAdd(newName.trim()); setNewName(''); setCreating(false); }}
                disabled={!newName.trim()}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add Player</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[ps.addBtn, { backgroundColor: accentColor }]} onPress={() => setCreating(true)}>
            <Text style={ps.addBtnText}>+ ADD / CREATE PLAYER</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}
const ps = StyleSheet.create({
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16 },
  close:            { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  title:            { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  doneBtn:          { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  doneBtnText:      { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  selectedBar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  selectedLabel:    { fontSize: 12, color: '#888', marginRight: 6 },
  selectedChip:     { backgroundColor: '#e8f5e9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginRight: 6, borderWidth: 1, borderColor: '#1a472a' },
  selectedChipText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  search:           { margin: 12, borderRadius: 10, backgroundColor: '#fff', padding: 12, fontSize: 15, elevation: 1 },
  row:              { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 1, padding: 14, borderRadius: 8 },
  avatar:           { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText:       { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  rowName:          { fontSize: 16, color: '#222', fontWeight: '500', flex: 1 },
  holdHint:         { fontSize: 10, color: '#ccc' },
  empty:            { textAlign: 'center', color: '#aaa', padding: 20, fontSize: 14 },
  createBox:        { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16 },
  createTitle:      { fontSize: 16, fontWeight: 'bold', color: PRIMARY, marginBottom: 10 },
  createInput:      { borderBottomWidth: 1.5, borderBottomColor: PRIMARY, padding: 8, fontSize: 15, marginBottom: 14 },
  createCancel:     { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  createAdd:        { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  addBtn:           { margin: 12, padding: 16, borderRadius: 12, alignItems: 'center' },
  addBtnText:       { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.5 },
});

function ManhattanChart({ overRuns, width }) {
  if (!overRuns.length) return <Text style={{ color: '#aaa', textAlign: 'center', padding: 16, fontSize: 13 }}>No completed overs yet</Text>;
  const maxRuns = Math.max(...overRuns.map(o => o.runs), 1);
  const chartH  = 130;
  const barW    = Math.min((width - 40) / overRuns.length - 4, 36);
  const barColor = (o) => {
    if (o.wickets > 0 && o.runs === 0) return '#757575';
    if (o.runs === 0) return '#9e9e9e';
    if (o.wickets > 0) return '#c62828';
    if (o.fours + o.sixes >= 3) return '#1565c0';
    return PRIMARY;
  };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ padding: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH + 32, gap: 4 }}>
          {overRuns.map((o, i) => {
            const h = Math.max((o.runs / maxRuns) * chartH, 4);
            return (
              <View key={i} style={{ alignItems: 'center', width: barW }}>
                <Text style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>{o.runs}</Text>
                <View style={{ width: barW - 2, height: h, backgroundColor: barColor(o), borderRadius: 3 }} />
                {o.wickets > 0 && <Text style={{ fontSize: 9, color: '#c62828', fontWeight: 'bold' }}>W</Text>}
                <Text style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{o.over}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function WormGraph({ progression1, progression2, team1, team2, totalOvers, width }) {
  const h = 160, padL = 32, padB = 24, padT = 12, padR = 12;
  const chartW = width - padL - padR;
  const chartH = h - padT - padB;
  const allRuns = [...progression1.map(p => p.runs), ...progression2.map(p => p.runs), 1];
  const maxRuns = Math.max(...allRuns);
  const maxBalls = totalOvers * 6;
  const toX = (ball) => padL + (ball / maxBalls) * chartW;
  const toY = (runs) => padT + chartH - (runs / maxRuns) * chartH;
  const buildPath = (pts) => pts.length < 2 ? '' : pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(p.ball).toFixed(1)} ${toY(p.runs).toFixed(1)}`
  ).join(' ');
  const yLabels = [0, Math.round(maxRuns * 0.5), maxRuns];
  return (
    <View>
      <Svg width={width} height={h}>
        {yLabels.map(v => (
          <G key={v}>
            <Line x1={padL} y1={toY(v)} x2={width - padR} y2={toY(v)} stroke="#e0e0e0" strokeWidth={0.8} />
            <SvgText x={padL - 4} y={toY(v) + 4} fontSize={8} fill="#999" textAnchor="end">{v}</SvgText>
          </G>
        ))}
        <Line x1={padL} y1={padT} x2={padL} y2={h - padB} stroke="#ccc" strokeWidth={1} />
        <Line x1={padL} y1={h - padB} x2={width - padR} y2={h - padB} stroke="#ccc" strokeWidth={1} />
        {Array.from({ length: totalOvers + 1 }, (_, i) => i).filter(i => i % 2 === 0).map(o => (
          <SvgText key={o} x={toX(o * 6)} y={h - padB + 12} fontSize={8} fill="#999" textAnchor="middle">{o}</SvgText>
        ))}
        {progression1.length > 1 && <Path d={buildPath(progression1)} fill="none" stroke="#1565c0" strokeWidth={2.5} strokeLinejoin="round" />}
        {progression2.length > 1 && <Path d={buildPath(progression2)} fill="none" stroke="#c62828" strokeWidth={2.5} strokeLinejoin="round" />}
        {progression1.filter(p => p.wicket).map((p, i) => (
          <Circle key={`w1${i}`} cx={toX(p.ball)} cy={toY(p.runs)} r={5} fill="#1565c0" stroke="#fff" strokeWidth={1.5} />
        ))}
        {progression2.filter(p => p.wicket).map((p, i) => (
          <Circle key={`w2${i}`} cx={toX(p.ball)} cy={toY(p.runs)} r={5} fill="#c62828" stroke="#fff" strokeWidth={1.5} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginTop: 6 }}>
        {team1 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 24, height: 3, backgroundColor: '#1565c0', borderRadius: 2 }} /><Text style={{ fontSize: 11, color: '#555' }}>{team1}</Text></View>}
        {team2 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 24, height: 3, backgroundColor: '#c62828', borderRadius: 2 }} /><Text style={{ fontSize: 11, color: '#555' }}>{team2}</Text></View>}
      </View>
    </View>
  );
}

function CompactPartnership({ batter1, batter2 }) {
  if (!batter1 || !batter2) return null;
  const totalRuns = (batter1.runs || 0) + (batter2.runs || 0);
  const totalBalls = (batter1.balls || 0) + (batter2.balls || 0);
  return (
    <View style={cp.row}>
      <View style={cp.side}>
        <Text style={cp.name} numberOfLines={1}>{batter1.name}</Text>
        <Text style={cp.score}>{batter1.runs}({batter1.balls})</Text>
        <Text style={cp.sr}>SR {batter1.balls > 0 ? ((batter1.runs / batter1.balls) * 100).toFixed(0) : '0'}</Text>
      </View>
      <View style={cp.circle}>
        <Text style={cp.circleRuns}>{totalRuns}</Text>
        <Text style={cp.circleBalls}>{totalBalls}b</Text>
      </View>
      <View style={[cp.side, { alignItems: 'flex-end' }]}>
        <Text style={cp.name} numberOfLines={1}>{batter2.name}</Text>
        <Text style={cp.score}>{batter2.runs}({batter2.balls})</Text>
        <Text style={cp.sr}>SR {batter2.balls > 0 ? ((batter2.runs / batter2.balls) * 100).toFixed(0) : '0'}</Text>
      </View>
    </View>
  );
}
const cp = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  side:        { flex: 1 },
  name:        { fontSize: 13, fontWeight: '600', color: '#222' },
  score:       { fontSize: 12, color: '#555', marginTop: 1 },
  sr:          { fontSize: 10, color: '#888' },
  circle:      { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: PRIMARY, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  circleRuns:  { fontSize: 16, fontWeight: 'bold', color: PRIMARY, lineHeight: 18 },
  circleBalls: { fontSize: 9, color: '#888' },
});

function PhaseStats({ phases }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {phases.map(p => (
        <View key={p.name} style={ph.card}>
          <Text style={ph.name}>{p.name}</Text>
          <Text style={ph.overs}>{p.overs}</Text>
          <Text style={ph.runs}>{p.runs}/{p.wickets}</Text>
          <Text style={ph.rr}>RR {p.rr}</Text>
        </View>
      ))}
    </View>
  );
}
const ph = StyleSheet.create({
  card:  { flex: 1, backgroundColor: '#f0fff4', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#c8e6c9', alignItems: 'center' },
  name:  { fontSize: 10, color: PRIMARY, fontWeight: '700', marginBottom: 2, textAlign: 'center' },
  overs: { fontSize: 9, color: '#888', marginBottom: 3 },
  runs:  { fontSize: 15, fontWeight: 'bold', color: '#222' },
  rr:    { fontSize: 10, color: '#666', marginTop: 2 },
});

function AllPartnerships({ partnerships }) {
  if (!partnerships.length) return null;
  return (
    <View>
      {partnerships.map((p, i) => (
        <View key={i} style={ap.row}>
          <Text style={ap.num}>#{i + 1}</Text>
          <Text style={ap.pair} numberOfLines={1}>{p.batter1} & {p.batter2}</Text>
          <Text style={ap.score}>{p.runs}({p.balls})</Text>
          {p.dismissed && <Text style={ap.dismissed}>† {p.dismissed}</Text>}
        </View>
      ))}
    </View>
  );
}
const ap = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  num:       { fontSize: 11, color: '#aaa', width: 24 },
  pair:      { flex: 1, fontSize: 13, color: '#333' },
  score:     { fontSize: 14, fontWeight: 'bold', color: PRIMARY, marginLeft: 8 },
  dismissed: { fontSize: 10, color: '#c62828', marginLeft: 6 },
});

function InningsToggle({ inningsList, currentView, onSelect }) {
  if (!inningsList || inningsList.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {inningsList.map((inn) => {
          const active = currentView === inn.innings_number;
          return (
            <TouchableOpacity
              key={inn.id}
              style={[it.btn, active && it.btnActive]}
              onPress={() => onSelect(inn.innings_number)}
            >
              <Text style={[it.label, active && it.labelActive]}>Inn {inn.innings_number}</Text>
              <Text style={[it.sub, active && it.subActive]} numberOfLines={1}>{inn.batting_team_name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
const it = StyleSheet.create({
  btn:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#ddd', backgroundColor: '#fff', minWidth: 90, alignItems: 'center' },
  btnActive:   { backgroundColor: PRIMARY, borderColor: PRIMARY },
  label:       { fontSize: 13, fontWeight: 'bold', color: '#555' },
  labelActive: { color: '#fff' },
  sub:         { fontSize: 10, color: '#aaa', marginTop: 2 },
  subActive:   { color: '#a5d6a7' },
});

// ─────────────────────────────────────────────────────────────────────────────
export default function MatchCentre() {
  const { matchId } = useLocalSearchParams();
  const router      = useRouter();

  const [match,              setMatch]              = useState(null);
  const [allInnings,         setAllInnings]         = useState([]);
  const [innings,            setInnings]            = useState(null);
  const [allBallsMap,        setAllBallsMap]        = useState({});
  const [allBatsmenMap,      setAllBatsmenMap]      = useState({});
  const [allBowlersMap,      setAllBowlersMap]      = useState({});
  const [allPartnershipsMap, setAllPartnershipsMap] = useState({});
  const [roster,             setRoster]             = useState({ a: [], b: [] });
  const [activeTab,          setActiveTab]          = useState('scoring');
  const [loading,            setLoading]            = useState(true);

  const balls        = innings ? (allBallsMap[innings.id]        || []) : [];
  const batsmen      = innings ? (allBatsmenMap[innings.id]      || []) : [];
  const bowlers      = innings ? (allBowlersMap[innings.id]      || []) : [];
  const partnerships = innings ? (allPartnershipsMap[innings.id] || []) : [];

  const setBalls             = (b) => setAllBallsMap(m      => ({ ...m, [innings.id]: b }));
  const setBatsmenS          = (b) => setAllBatsmenMap(m    => ({ ...m, [innings.id]: b }));
  const setBowlersS          = (b) => setAllBowlersMap(m    => ({ ...m, [innings.id]: b }));
  const setPartnershipsState = (p) => setAllPartnershipsMap(m => ({ ...m, [innings.id]: p }));

  const [statsView,      setStatsView]      = useState(1);
  const [scorecardView, setScorecardView] = useState(1);
  const [ballsView,      setBallsView]      = useState(1);

  const [showToss,            setShowToss]            = useState(false);
  const [tossWinner,          setTossWinner]          = useState(null);
  const [showWW,              setShowWW]              = useState(false);
  const [pendingRuns,         setPendingRuns]         = useState(null);
  const [showWicket,          setShowWicket]          = useState(false);
  const [showSelectBat,       setShowSelectBat]       = useState(false);
  const [showSelectBowl,      setShowSelectBowl]      = useState(false);
  const [inningsBatSelMode,   setInningsBatSelMode]   = useState(false);
  const [selectedBatters,     setSelectedBatters]     = useState([]);
  const [inningsBowlSelMode,  setInningsBowlSelMode]  = useState(false);
  const [bowlSquadDone,       setBowlSquadDone]       = useState(false);
  const [showExtrasPrompt,    setShowExtrasPrompt]    = useState(false);
  const [pendingExtraType,    setPendingExtraType]    = useState(null);
  const [extraRunInput,       setExtraRunInput]       = useState('1');

  const [pendingWicketType,      setPendingWicketType]      = useState(null);
  const [showWWForWicket,        setShowWWForWicket]        = useState(false);
  const [pendingWicketArrow,     setPendingWicketArrow]     = useState(null);
  const [showFielderNamePrompt,  setShowFielderNamePrompt]  = useState(false);
  const [fielderNameInput,       setFielderNameInput]       = useState('');
  const [showRunOutBatterSelect, setShowRunOutBatterSelect] = useState(false);
  const [runOutDismissedBatter,  setRunOutDismissedBatter]  = useState(null);
  const [showRunOutRunsPrompt,   setShowRunOutRunsPrompt]   = useState(false);
  const [runOutBatRuns,          setRunOutBatRuns]          = useState('0');
  const [showKeeperPrompt,       setShowKeeperPrompt]       = useState(false);
  const [keeperNameInput,        setKeeperNameInput]        = useState('');
  const [showNSROFielder,        setShowNSROFielder]        = useState(false);
  const [nsroFielderInput,       setNsroFielderInput]       = useState('');

  const [showNoBallRunsPrompt,   setShowNoBallRunsPrompt]   = useState(false);
  const [showWideExtraPrompt,    setShowWideExtraPrompt]    = useState(false);
  const [noBallBatRuns,          setNoBallBatRuns]          = useState('0');
  const [wideExtraRuns,          setWideExtraRuns]          = useState('0');
  const [showWWForNB,            setShowWWForNB]            = useState(false);

  const [showFollowOnPrompt,     setShowFollowOnPrompt]     = useState(false);
  const [showDaySnapshot,        setShowDaySnapshot]        = useState(false);
  const [currentDay,             setCurrentDay]             = useState(1);
  const [showSubBowlerModal,     setShowSubBowlerModal]     = useState(false);

  useEffect(() => { loadAll(); }, [matchId]);

  const loadAll = async () => {
    setLoading(true);
    const m = await getMatch(matchId);
    if (!m) { router.back(); return; }
    setMatch(m);
    if (m.status === 'toss') { setShowToss(true); setLoading(false); return; }

    const r = await getRoster(matchId);
    setRoster(r);

    const innList = await getInningsList(matchId);
    setAllInnings(innList);
    const activeInn = innList.find(i => i.status === 'active') || innList[innList.length - 1];
    if (activeInn) { setInnings(activeInn); setCurrentDay(m.current_day || 1); }

    const bMap = {}, btMap = {}, bwMap = {}, pMap = {};
    for (const inn of innList) {
      bMap[inn.id]  = await getBalls(inn.id);
      btMap[inn.id] = await getBatsmen(inn.id);
      bwMap[inn.id] = await getBowlers(inn.id);
      pMap[inn.id]  = await getPartnerships(inn.id);
    }
    setAllBallsMap(bMap);
    setAllBatsmenMap(btMap);
    setAllBowlersMap(bwMap);
    setAllPartnershipsMap(pMap);

    if (activeInn) {
      setStatsView(activeInn.innings_number);
      setScorecardView(activeInn.innings_number);
      setBallsView(activeInn.innings_number);
    }
    setLoading(false);
  };

  const getInnById       = (num) => allInnings.find(i => i.innings_number === num);
  const getBallsForInn   = (num) => { const inn = getInnById(num); return inn ? (allBallsMap[inn.id]        || []) : []; };
  const getBatsmenForInn = (num) => { const inn = getInnById(num); return inn ? (allBatsmenMap[inn.id]      || []) : []; };
  const getBowlersForInn = (num) => { const inn = getInnById(num); return inn ? (allBowlersMap[inn.id]      || []) : []; };
  const getPshipsForInn  = (num) => { const inn = getInnById(num); return inn ? (allPartnershipsMap[inn.id] || []) : []; };

  const summary    = innings ? computeInningsSummary(balls, match?.total_overs || 10) : null;
  const overBalls  = innings ? getBallsInCurrentOver(balls) : [];
  const projected  = summary ? projectScore(summary.runs, summary.legalBalls, match?.total_overs || 10) : 0;
  const striker    = batsmen.find(b => b.onStrike && b.isActive);
  const nonStriker = batsmen.find(b => !b.onStrike && b.isActive);
  const curBowler  = bowlers.find(b => b.isCurrent);
  const activeBat  = batsmen.filter(b => b.isActive);
  const isTestMatch = match?.match_format === 'test';
  const maxInnings  = match?.max_innings || 2;

  const isChasing    = !isTestMatch && innings?.target != null;
  const runsNeeded    = isChasing ? Math.max(0, innings.target - (summary?.runs || 0)) : null;
  const ballsRemLeft = isChasing ? Math.max(0, (match?.total_overs || 10) * 6 - (summary?.legalBalls || 0)) : null;
  const liveRRR      = isChasing && ballsRemLeft > 0 ? calcRRR(innings.target, summary?.runs || 0, ballsRemLeft) : null;

  const battingTeam   = innings?.batting_team_name;
  const battingIsA    = battingTeam === match?.team_a_name;
  const battingRoster = battingIsA ? roster.a : roster.b;
  const bowlingRoster = battingIsA ? roster.b : roster.a;

  const addToRoster = async (name, forBatting) => {
    const team = forBatting ? (battingIsA ? 'a' : 'b') : (battingIsA ? 'b' : 'a');
    const updated = { ...roster, [team]: [...roster[team], name] };
    setRoster(updated);
    await saveRoster(matchId, updated);
    return name;
  };

  const removeFromRoster = async (name, forBatting) => {
    const hasPlayed = balls.some(b => b.batsman_name === name || b.bowler_name === name);
    if (hasPlayed) { Alert.alert('Cannot Remove', `${name} has already participated`); return; }
    const team = forBatting ? (battingIsA ? 'a' : 'b') : (battingIsA ? 'b' : 'a');
    const updated = { ...roster, [team]: roster[team].filter(p => p !== name) };
    setRoster(updated);
    await saveRoster(matchId, updated);
  };

  const handleToss = async (winner, decision) => {
    const battingFirst = decision === 'bat' ? winner : (winner === match.team_a_name ? match.team_b_name : match.team_a_name);
    const bowlingFirst = battingFirst === match.team_a_name ? match.team_b_name : match.team_a_name;
    const updated = { ...match, toss_winner: winner, toss_decision: decision, batting_first: battingFirst, status: 'live' };
    await saveMatch(updated); setMatch(updated);
    const inn = { id: generateId(), match_id: matchId, innings_number: 1, batting_team_name: battingFirst, bowling_team_name: bowlingFirst, status: 'active', day_number: 1 };
    await saveInnings(matchId, inn);
    setAllInnings([inn]); setInnings(inn);
    setAllBallsMap({ [inn.id]: [] }); setAllBatsmenMap({ [inn.id]: [] });
    setAllBowlersMap({ [inn.id]: [] }); setAllPartnershipsMap({ [inn.id]: [] });
    setShowToss(false);
    setInningsBatSelMode(true); setSelectedBatters([]); setShowSelectBat(true);
  };

  const handleSelectBatter = async (name) => {
    if (inningsBatSelMode) {
      if (selectedBatters.includes(name)) setSelectedBatters(prev => prev.filter(n => n !== name));
      else setSelectedBatters(prev => [...prev, name]);
      return;
    }
    const newBatter = {
      name, runs: 0, balls: 0, fours: 0, sixes: 0,
      onStrike: !batsmen.find(b => b.onStrike && b.isActive),
      isActive: true, isOut: false, battingPosition: batsmen.length + 1,
    };
    const updated = [...batsmen, newBatter];
    setBatsmenS(updated); await saveBatsmen(innings.id, updated);
    setShowSelectBat(false);
    if (!curBowler) { setInningsBowlSelMode(true); setBowlSquadDone(false); setShowSelectBowl(true); }
  };

  const handleBattersConfirmed = async () => {
    if (selectedBatters.length < 2) {
      Alert.alert('Select 2 batters', 'Cricket requires exactly 2 opening batters at the crease.');
      return;
    }
    const openers = selectedBatters.slice(0, 2);
    const newBatsmen = openers.map((name, i) => ({
      name, runs: 0, balls: 0, fours: 0, sixes: 0,
      onStrike: i === 0, isActive: true, isOut: false,
      battingPosition: batsmen.length + i + 1,
    }));
    const updated = [...batsmen.filter(b => b.isOut), ...newBatsmen];
    setBatsmenS(updated); await saveBatsmen(innings.id, updated);
    setShowSelectBat(false); setInningsBatSelMode(false); setSelectedBatters([]);
    setInningsBowlSelMode(true); setBowlSquadDone(false); setShowSelectBowl(true);
  };

  const handleSelectBowler = async (name) => {
    if (inningsBowlSelMode && !bowlSquadDone) {
      setInningsBowlSelMode(false); setBowlSquadDone(false);
    }
    const existing = bowlers.find(b => b.name === name);
    let updated;
    if (existing) {
      updated = bowlers.map(b => ({ ...b, isCurrent: b.name === name }));
    } else {
      updated = [...bowlers.map(b => ({ ...b, isCurrent: false })),
        { name, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, maidens: 0, isCurrent: true }];
    }
    setBowlersS(updated); await saveBowlers(innings.id, updated);
    setShowSelectBowl(false);
  };

  const handleBowlingSquadDone = () => {
    if (bowlingRoster.length === 0) {
      Alert.alert('Add bowlers first', 'Please add at least one bowler to the squad.');
      return;
    }
    setBowlSquadDone(true); setInningsBowlSelMode(false);
    setTimeout(() => setShowSelectBowl(true), 200);
  };

  const updateCurrentPartnership = async (currentBalls, currentBatsmen) => {
    const activeBat2 = (currentBatsmen || batsmen).filter(b => b.isActive);
    if (activeBat2.length < 2) return;
    const p1 = activeBat2[0].name, p2 = activeBat2[1].name;
    const lastWicketIdx = currentBalls.reduce((idx, b, i) => b.is_wicket ? i : idx, -1);
    const partBalls = currentBalls.slice(lastWicketIdx + 1);
    const pRuns  = partBalls.reduce((s, b) => s + (b.runs_scored || 0) + (b.extras_runs || 0), 0);
    const pBallCount = partBalls.filter(b => !isNoBallEvent(b) && (isLegalDelivery(b) || b.is_no_ball)).length;
    const cur = partnerships || [];
    const existingIdx = cur.findIndex(p => p.active &&
      ((p.batter1 === p1 && p.batter2 === p2) || (p.batter1 === p2 && p.batter2 === p1))
    );
    let updated;
    if (existingIdx >= 0) updated = cur.map((p, i) => i === existingIdx ? { ...p, runs: pRuns, balls: pBallCount } : p);
    else updated = [...cur.filter(p => !p.active), { batter1: p1, batter2: p2, runs: pRuns, balls: pBallCount, active: true }];
    setPartnershipsState(updated); await savePartnerships(innings.id, updated);
  };

  const arrowToXY = (arrow) => arrow ? {
    x: parseFloat(((arrow.x / (SW * 0.78)) * 100).toFixed(1)),
    y: parseFloat(((arrow.y / (SW * 0.78)) * 100).toFixed(1)),
  } : { x: null, y: null };

  const handleRunBtn = (runs, extraType = null) => {
    if (!striker && runs > 0) { Alert.alert('Select batter', 'Tap a batsman name to set who is on strike'); return; }
    if (!curBowler) { setInningsBowlSelMode(false); setBowlSquadDone(true); setShowSelectBowl(true); return; }
    if (extraType === 'wide') { setShowWideExtraPrompt(true); setWideExtraRuns('0'); return; }
    if (extraType === 'noball') { setShowNoBallRunsPrompt(true); setNoBallBatRuns('0'); return; }
    if (runs === 0) { doLogBall({ runs_scored: 0 }); return; }
    setPendingRuns(runs); setShowWW(true);
  };

  const handleWWConfirm = (arrow) => {
    setShowWW(false);
    const { x, y } = arrowToXY(arrow);
    doLogBall({ runs_scored: pendingRuns, shot_x: x, shot_y: y });
    setPendingRuns(null);
  };

  const handleNoBallRunsChosen = () => {
    const batRuns = parseInt(noBallBatRuns, 10) || 0;
    setShowNoBallRunsPrompt(false);
    if (batRuns > 0) {
      setShowWWForNB(true);
    } else {
      doLogBall({ runs_scored: 0, extras_runs: 1, is_no_ball: true, shot_x: null, shot_y: null });
    }
  };

  const handleWWForNBConfirm = (arrow) => {
    setShowWWForNB(false);
    const batRuns = parseInt(noBallBatRuns, 10) || 0;
    const { x, y } = arrowToXY(arrow);
    doLogBall({ runs_scored: batRuns, extras_runs: 1, is_no_ball: true, shot_x: x, shot_y: y });
  };

  const handleWideConfirmed = () => {
    setShowWideExtraPrompt(false);
    const byeRuns = parseInt(wideExtraRuns, 10) || 0;
    doLogBall({ runs_scored: 0, extras_runs: 1 + byeRuns, is_wide: true, is_bye: byeRuns > 0 });
  };

  const doLogBall = async (ballData) => {
    const { currentOver, ballsInOver } = getCurrentOverState(balls);
    const ball = {
      id:                generateId(),
      innings_id:        innings.id,
      match_id:          matchId,
      over_number:       currentOver,
      ball_number:       ballsInOver + 1,
      ball_display:      `${currentOver}.${ballsInOver + 1}`,
      batsman_name:      striker?.name || '',
      bowler_name:       curBowler?.name || '',
      runs_scored:       ballData.runs_scored || 0,
      extras_runs:       ballData.extras_runs || 0,
      is_wide:           ballData.is_wide || false,
      is_no_ball:        ballData.is_no_ball || false,
      is_bye:            ballData.is_bye || false,
      is_leg_bye:        ballData.is_leg_bye || false,
      is_wicket:         ballData.is_wicket || false,
      wicket_type:       ballData.wicket_type || null,
      dismissed_batsman: ballData.dismissed_batsman || null,
      fielder_name:      ballData.fielder_name || null,
      keeper_name:       ballData.keeper_name || null,
      shot_direction_x:  ballData.shot_x || null,
      shot_direction_y:  ballData.shot_y || null,
      narrative:         generateNarrative({ ...ballData, bowler_name: curBowler?.name }),
    };
    const newBalls = [...balls, ball];
    await saveBall(innings.id, ball); setBalls(newBalls);

    const updatedBatsmen = computeAllBatsmenFromBalls(newBalls, batsmen);
    setBatsmenS(updatedBatsmen); await saveBatsmen(innings.id, updatedBatsmen);
    const updatedBowlers = computeAllBowlersFromBalls(newBalls, bowlers);
    setBowlersS(updatedBowlers); await saveBowlers(innings.id, updatedBowlers);
    await updateCurrentPartnership(newBalls, updatedBatsmen);

    const runsForRotation = (ball.is_bye || ball.is_leg_bye) ? (ball.extras_runs || 0) : ball.runs_scored;
    if (!ball.is_wide && shouldStrikeRotate(runsForRotation)) {
      const rotated = updatedBatsmen.map(b => ({ ...b, onStrike: b.isActive ? !b.onStrike : b.onStrike }));
      setBatsmenS(rotated); await saveBatsmen(innings.id, rotated);
    }

    const newState = getCurrentOverState(newBalls);
    if (newState.ballsInOver === 0 && newState.legalBalls > 0) {
      if (isTestMatch) {
        const dayOvers = match.overs_per_day || 90;
        if (newState.legalBalls % (dayOvers * 6) === 0) {
          setShowDaySnapshot(true);
        } else {
          const rotated = updatedBatsmen.map(b => ({ ...b, onStrike: b.isActive ? !b.onStrike : b.onStrike }));
          setBatsmenS(rotated); await saveBatsmen(innings.id, rotated);
          setTimeout(() => setShowSelectBowl(true), 400);
        }
      } else {
        if (newState.legalBalls < (match.total_overs || 10) * 6) {
          const rotated = updatedBatsmen.map(b => ({ ...b, onStrike: b.isActive ? !b.onStrike : b.onStrike }));
          setBatsmenS(rotated); await saveBatsmen(innings.id, rotated);
          setTimeout(() => setShowSelectBowl(true), 400);
        }
      }
    }
    await checkInningsEnd(newBalls);
  };

  const checkInningsEnd = async (newBalls) => {
    const s = computeInningsSummary(newBalls, match.total_overs);
    if (isTestMatch) {
      if (innings.target != null && s.runs >= innings.target) {
        await endInnings(newBalls, 'target_chased');
      }
      return;
    }
    if (innings.target != null && s.runs >= innings.target) {
      await endInnings(newBalls, 'target_chased'); return;
    }
    if (s.legalBalls >= (match.total_overs || 10) * 6) {
      await endInnings(newBalls);
    }
  };

  const handleWicketTypeSelected = (wicketType) => {
    setShowWicket(false);
    if (wicketType === 'non_striker_run_out') { setNsroFielderInput(''); setShowNSROFielder(true); return; }
    if (wicketType === 'retired_hurt') { commitNoBallEvent('retired_hurt', striker?.name, null); return; }
    if (wicketType === 'stumped') { setPendingWicketType('stumped'); setKeeperNameInput(''); setShowKeeperPrompt(true); return; }
    if (wicketType === 'caught') { setPendingWicketType('caught'); setShowWWForWicket(true); return; }
    if (wicketType === 'run_out') { setPendingWicketType('run_out'); setShowRunOutBatterSelect(true); return; }
    commitWicket(wicketType, striker?.name, null, null, null, null);
  };

  const commitNoBallEvent = async (wicketType, dismissedName, fielder) => {
    setShowNSROFielder(false);
    if (!innings) return;
    const ball = {
      id: generateId(), innings_id: innings.id, match_id: matchId,
      over_number: getCurrentOverState(balls).currentOver,
      ball_number: 0, ball_display: '–',
      batsman_name: dismissedName || '', bowler_name: curBowler?.name || '',
      runs_scored: 0, extras_runs: 0,
      is_wide: false, is_no_ball: false, is_bye: false, is_leg_bye: false,
      is_wicket: true, wicket_type: wicketType, dismissed_batsman: dismissedName,
      fielder_name: fielder || null, shot_direction_x: null, shot_direction_y: null,
      narrative: generateNarrative({ is_wicket: true, wicket_type: wicketType, fielder_name: fielder }),
    };
    const newBalls = [...balls, ball];
    await saveBall(innings.id, ball); setBalls(newBalls);
    const closedP = partnerships.map(p => p.active ? { ...p, active: false, dismissed: dismissedName } : p);
    setPartnershipsState(closedP); await savePartnerships(innings.id, closedP);
    const updatedBatsmen = batsmen.map(b => b.name === dismissedName
      ? { ...b, isOut: true, isActive: false, dismissalType: wicketType, fielderName: fielder, bowlerName: curBowler?.name }
      : b
    );
    setBatsmenS(updatedBatsmen); await saveBatsmen(innings.id, updatedBatsmen);
    const updatedBowlers = computeAllBowlersFromBalls(newBalls, bowlers);
    setBowlersS(updatedBowlers); await saveBowlers(innings.id, updatedBowlers);
    promptNextBatterIfNeeded(updatedBatsmen, newBalls);
    await checkInningsEnd(newBalls);
  };

  const handleWWForWicketConfirm = (arrow) => {
    setShowWWForWicket(false);
    setPendingWicketArrow(arrow);
    if (pendingWicketType === 'caught') { setFielderNameInput(''); setShowFielderNamePrompt(true); }
    else if (pendingWicketType === 'run_out_ww') {
      setPendingWicketType('run_out'); setFielderNameInput(''); setShowFielderNamePrompt(true);
    }
  };

  const handleFielderNameConfirmed = () => {
    setShowFielderNamePrompt(false);
    const fielder = fielderNameInput.trim() || 'Unknown';
    if (pendingWicketType === 'caught') {
      commitWicket('caught', striker?.name, fielder, null, pendingWicketArrow, null);
    } else if (pendingWicketType === 'run_out') {
      const batRuns = parseInt(runOutBatRuns, 10) || 0;
      commitWicket('run_out', runOutDismissedBatter, fielder, null, pendingWicketArrow, batRuns);
    }
    setPendingWicketArrow(null); setPendingWicketType(null);
    setFielderNameInput(''); setRunOutDismissedBatter(null); setRunOutBatRuns('0');
  };

  const handleKeeperConfirmed = () => {
    setShowKeeperPrompt(false);
    const keeper = keeperNameInput.trim() || 'Unknown';
    commitWicket('stumped', striker?.name, null, keeper, null, null);
    setPendingWicketType(null); setKeeperNameInput('');
  };

  const handleRunOutBatterSelected = (batterName) => {
    setShowRunOutBatterSelect(false);
    setRunOutDismissedBatter(batterName);
    setRunOutBatRuns('0'); setShowRunOutRunsPrompt(true);
  };

  const handleRunOutRunsConfirmed = () => {
    setShowRunOutRunsPrompt(false);
    const batRuns = parseInt(runOutBatRuns, 10) || 0;
    if (batRuns > 0) {
      setPendingWicketType('run_out_ww');
      setShowWWForWicket(true);
    } else {
      setPendingWicketType('run_out');
      setFielderNameInput(''); setShowFielderNamePrompt(true);
    }
  };

  const handleNSROFielderConfirmed = () => {
    const fielder = nsroFielderInput.trim() || 'Unknown';
    const dismissedName = nonStriker?.name || batsmen.find(b => !b.onStrike && b.isActive)?.name || '';
    commitNoBallEvent('non_striker_run_out', dismissedName, fielder);
    setNsroFielderInput('');
  };

  const commitWicket = async (wicketType, dismissedBatter, fielderName, keeperName, arrow, batRunsScored) => {
    if (!curBowler) return;
    const dismissedPlayer = batsmen.find(b => b.name === dismissedBatter && b.isActive)
      || batsmen.find(b => b.onStrike && b.isActive);
    if (!dismissedPlayer) return;
    const { currentOver, ballsInOver } = getCurrentOverState(balls);
    const { x, y } = arrowToXY(arrow);
    const ball = {
      id: generateId(), innings_id: innings.id, match_id: matchId,
      over_number: currentOver, ball_number: ballsInOver + 1,
      ball_display: `${currentOver}.${ballsInOver + 1}`,
      batsman_name: dismissedPlayer.name, bowler_name: curBowler.name,
      runs_scored: batRunsScored || 0, extras_runs: 0,
      is_wide: false, is_no_ball: false, is_bye: false, is_leg_bye: false,
      is_wicket: true, wicket_type: wicketType,
      dismissed_batsman: dismissedPlayer.name,
      fielder_name: fielderName || null, keeper_name: keeperName || null,
      shot_direction_x: x, shot_direction_y: y,
      narrative: generateNarrative({ is_wicket: true, wicket_type: wicketType, fielder_name: fielderName || keeperName, bowler_name: curBowler.name }),
    };
    const newBalls = [...balls, ball];
    await saveBall(innings.id, ball); setBalls(newBalls);
    const closedP = partnerships.map(p => p.active ? { ...p, active: false, dismissed: dismissedPlayer.name } : p);
    setPartnershipsState(closedP); await savePartnerships(innings.id, closedP);
    const updatedBatsmen = batsmen.map(b => b.name === dismissedPlayer.name
      ? { ...b, isOut: true, isActive: false, dismissalType: wicketType, fielderName, keeperName, bowlerName: curBowler.name, onStrike: false, balls: b.balls + 1 }
      : b
    );
    setBatsmenS(updatedBatsmen); await saveBatsmen(innings.id, updatedBatsmen);
    const updatedBowlers = computeAllBowlersFromBalls(newBalls, bowlers);
    setBowlersS(updatedBowlers); await saveBowlers(innings.id, updatedBowlers);

    const s = computeInningsSummary(newBalls, match.total_overs);
    const oversUp = !isTestMatch && s.legalBalls >= (match.total_overs || 10) * 6;
    const chaseWon = innings.target != null && s.runs >= innings.target;
    if (oversUp || chaseWon) { await endInnings(newBalls, chaseWon ? 'target_chased' : null); return; }

    promptNextBatterIfNeeded(updatedBatsmen, newBalls);
    await checkInningsEnd(newBalls);
  };
  const promptNextBatterIfNeeded = (updatedBatsmen, newBalls) => {
    const s = computeInningsSummary(newBalls, match.total_overs);
    if (!isTestMatch && s.legalBalls >= (match.total_overs || 10) * 6) return;
    const activeCount = updatedBatsmen.filter(b => b.isActive).length;
    if (activeCount >= 2) return;
    const alreadyIn = updatedBatsmen.filter(b => b.isActive || b.isOut).map(b => b.name);
    const availableNew = battingRoster.filter(p => !alreadyIn.includes(p));
    const retiredReturnable = updatedBatsmen.filter(b => b.dismissalType === 'retired_hurt' || b.dismissalType === 'retired_out');
    
    if (availableNew.length === 0 && retiredReturnable.length === 0) {
      Alert.alert('All Wickets Down', 'No more batters available.', [
        { text: '+ Add More Batters', onPress: () => { setInningsBatSelMode(false); setShowSelectBat(true); } },
        { text: 'End Innings', style: 'destructive', onPress: () => endInnings(newBalls) },
      ]);
    } else {
      setInningsBatSelMode(false); setShowSelectBat(true);
    }
  };

  const endInnings = async (finalBalls, reason = null) => {
    const fb  = finalBalls || balls;
    const s   = computeInningsSummary(fb, match.total_overs);
    const isDeclared = reason === 'declared';
    const updatedInn = { ...innings, status: isDeclared ? 'declared' : 'completed', total_runs: s.runs, total_wickets: s.wickets, declared: isDeclared };
    await saveInnings(matchId, updatedInn);
    setAllInnings(prev => prev.map(i => i.id === updatedInn.id ? updatedInn : i));
    const innNum = innings.innings_number;
    const matchUpdate = { ...match };
    matchUpdate[`innings${innNum}_score`]   = s.runs;
    matchUpdate[`innings${innNum}_wickets`] = s.wickets;
    matchUpdate[`innings${innNum}_overs`]   = s.oversCompleted;

    if (innNum === 1) {
      matchUpdate.status = 'innings2'; matchUpdate.inn1_total = s.runs;
      await saveMatch(matchUpdate); setMatch(matchUpdate);
      const msg = isDeclared ? `${innings.batting_team_name} declared at ${s.runs}/${s.wickets}.` : `${innings.batting_team_name} scored ${s.runs}/${s.wickets}.`;
      Alert.alert('📋 1st Innings Complete', `${msg}\n\n${innings.bowling_team_name} begin their innings.`,
        [{ text: 'Start Innings 2 →', onPress: () => startNextInnings(2, innNum, s, matchUpdate) }]);

    } else if (innNum === 2) {
      const inn1Total = matchUpdate.inn1_total || matchUpdate.innings1_score || 0;
      const deficit   = inn1Total - s.runs;
      const threshold = match.follow_on_threshold || 200;
      if (isTestMatch && deficit >= threshold && !isDeclared) {
        matchUpdate.status = 'innings3'; matchUpdate.inn2_total = s.runs; matchUpdate.follow_on_deficit = deficit;
        await saveMatch(matchUpdate); setMatch(matchUpdate);
        setShowFollowOnPrompt(true);
      } else {
        matchUpdate.status = 'innings3'; matchUpdate.inn2_total = s.runs;
        await saveMatch(matchUpdate); setMatch(matchUpdate);
        if (isTestMatch) {
          Alert.alert('📋 2nd Innings Complete', `${innings.batting_team_name} scored ${s.runs}/${s.wickets}.\n\n${innings.bowling_team_name} bat again.`,
            [{ text: 'Start Innings 3 →', onPress: () => startNextInnings(3, innNum, s, matchUpdate) }]);
        } else {
          await finishMatch(matchUpdate, s, inn1Total, reason);
        }
      }

    } else if (innNum === 3) {
      const inn1Total = matchUpdate.inn1_total || matchUpdate.innings1_score || 0;
      const inn2Total = matchUpdate.inn2_total || matchUpdate.innings2_score || 0;
      matchUpdate.status = 'innings4'; matchUpdate.inn3_total = s.runs;
      await saveMatch(matchUpdate); setMatch(matchUpdate);
      if (isTestMatch && matchUpdate.follow_on_enforced) {
        const combinedScore = inn2Total + s.runs;
        if (combinedScore < inn1Total) {
          await finishMatchWithResult(matchUpdate, `${innings.bowling_team_name} won by an innings and ${inn1Total - combinedScore} runs!`); return;
        }
        const target = combinedScore - inn1Total + 1;
        Alert.alert('📋 3rd Innings Complete', `${innings.batting_team_name} scored ${s.runs}/${s.wickets}.\n\n${innings.bowling_team_name} need ${target} to win.`,
          [{ text: 'Start Innings 4 →', onPress: () => startNextInnings(4, innNum, s, matchUpdate, target) }]);
      } else {
        const target = (matchUpdate.inn1_total || 0) + s.runs - (matchUpdate.inn2_total || 0) + 1;
        Alert.alert('📋 3rd Innings Complete', `${innings.batting_team_name} scored ${s.runs}/${s.wickets}.\n\n${innings.bowling_team_name} need ${target} to win.`,
          [{ text: 'Start Innings 4 →', onPress: () => startNextInnings(4, innNum, s, matchUpdate, target) }]);
      }

    } else if (innNum === 4) {
      matchUpdate.inn4_total = s.runs;
      const prevScore = matchUpdate.inn3_total || matchUpdate.innings3_score || 0;
      await finishMatch(matchUpdate, s, prevScore, reason);
    }
  };

  const handleFollowOnEnforce = async () => {
    setShowFollowOnPrompt(false);
    const updatedMatch = { ...match, follow_on_enforced: true };
    await saveMatch(updatedMatch); setMatch(updatedMatch);
    Alert.alert('⚡ Follow-On Enforced', 'Opposition team must bat again.', [
      { text: 'Start Innings 3 →', onPress: () => startNextInnings(3, 2, { runs: match.inn2_total || 0, wickets: 0, oversCompleted: '0.0' }, updatedMatch) }
    ]);
  };

  const handleFollowOnDecline = async () => {
    setShowFollowOnPrompt(false);
    const updatedMatch = { ...match, follow_on_enforced: false };
    await saveMatch(updatedMatch); setMatch(updatedMatch);
    Alert.alert('📋 Follow-On Declined', 'We bat again to set a target.', [
      { text: 'Start Innings 3 →', onPress: () => startNextInnings(3, 2, { runs: match.inn2_total || 0, wickets: 0, oversCompleted: '0.0' }, updatedMatch) }
    ]);
  };

  const startNextInnings = async (newInnNum, prevInnNum, prevSummary, matchState, target = null) => {
    const prevInn = allInnings.find(i => i.innings_number === prevInnNum);
    const followOn = matchState.follow_on_enforced;
    let newBatTeam, newBowlTeam;
    if (newInnNum === 2) { newBatTeam = prevInn?.bowling_team_name; newBowlTeam = prevInn?.batting_team_name; }
    else if (newInnNum === 3) {
      if (followOn) { newBatTeam = prevInn?.batting_team_name; newBowlTeam = prevInn?.bowling_team_name; }
      else { newBatTeam = allInnings.find(i => i.innings_number === 1)?.batting_team_name; newBowlTeam = allInnings.find(i => i.innings_number === 1)?.bowling_team_name; }
    } else if (newInnNum === 4) { newBatTeam = prevInn?.bowling_team_name; newBowlTeam = prevInn?.batting_team_name; }
    
    const newInn = { id: generateId(), match_id: matchId, innings_number: newInnNum, batting_team_name: newBatTeam, bowling_team_name: newBowlTeam, status: 'active', target, day_number: currentDay };
    await saveInnings(matchId, newInn);
    setAllInnings(prev => [...prev, newInn]); setInnings(newInn);
    setAllBallsMap(prev => ({ ...prev, [newInn.id]: [] }));
    setAllBatsmenMap(prev => ({ ...prev, [newInn.id]: [] }));
    setAllBowlersMap(prev => ({ ...prev, [newInn.id]: [] }));
    setAllPartnershipsMap(prev => ({ ...prev, [newInn.id]: [] }));
    setStatsView(newInnNum); setScorecardView(newInnNum); setBallsView(newInnNum);
    setInningsBatSelMode(true); setSelectedBatters([]); setShowSelectBat(true);
  };

  const finishMatch = async (matchState, lastSummary, prevScore, reason) => {
    const target = (prevScore || 0) + 1;
    let result;
    if (reason === 'target_chased' || lastSummary.runs >= target) result = `${innings.batting_team_name} won by ${battingRoster.length - lastSummary.wickets} wickets!`;
    else if (lastSummary.runs === (prevScore || 0)) result = 'Match Tied! 🤝';
    else result = `${innings.bowling_team_name} won by ${(prevScore || 0) - lastSummary.runs} runs!`;
    await finishMatchWithResult(matchState, result);
  };

  const finishMatchWithResult = async (matchState, result) => {
    const updatedMatch = { ...matchState, status: 'completed', result };
    await saveMatch(updatedMatch); setMatch(updatedMatch);
    Alert.alert('🏆 Match Complete!', result, [
      { text: 'View Scorecard', onPress: () => setActiveTab('scorecard') }, { text: 'Close' },
    ]);
  };

  const handleDeclare = () => {
    Alert.alert('📋 Declare Innings?', `Declare at ${summary?.runs}/${summary?.wickets} in ${summary?.oversCompleted} overs?`, [
      { text: 'Cancel' },
      { text: 'Declare', style: 'destructive', onPress: () => endInnings(balls, 'declared') },
    ]);
  };

  const handleEndInnings = () => {
    Alert.alert('End Innings?', `End innings now at ${summary?.runs}/${summary?.wickets}?`, [
      { text: 'Cancel' },
      { text: 'End Innings', style: 'destructive', onPress: () => endInnings(balls) },
    ]);
  };

  const handleSpecialAction = (action) => {
    if (action === 'drawn') {
      Alert.alert('🤝 Match Drawn?', 'Both captains agree to end the match as a draw.', [
        { text: 'Cancel' },
        { text: 'Confirm Draw', onPress: async () => { const u = { ...match, status: 'drawn', result: 'Match Drawn by mutual agreement' }; await saveMatch(u); setMatch(u); } },
      ]);
    } else if (action === 'forfeit') {
      Alert.alert('🚩 Forfeit Match?', `${innings?.batting_team_name} forfeit?`, [
        { text: 'Cancel' },
        { text: 'Forfeit', style: 'destructive', onPress: async () => { const u = { ...match, status: 'forfeited', result: `${innings?.batting_team_name} forfeited` }; await saveMatch(u); setMatch(u); } },
      ]);
    }
  };

  const handleEndOfDay = async () => {
    const snap = { day: currentDay, innings_number: innings?.innings_number, batting_team: innings?.batting_team_name, runs: summary?.runs, wickets: summary?.wickets, overs: summary?.oversCompleted, timestamp: new Date().toISOString() };
    await saveDaySnapshot(matchId, snap);
    const newDay = currentDay + 1;
    setCurrentDay(newDay);
    const updatedMatch = { ...match, current_day: newDay };
    await saveMatch(updatedMatch); setMatch(updatedMatch);
    setShowDaySnapshot(false);
    const rotated = batsmen.map(b => ({ ...b, onStrike: b.isActive ? !b.onStrike : b.onStrike }));
    setBatsmenS(rotated); await saveBatsmen(innings.id, rotated);
    Alert.alert(
      `🌆 End of Day ${currentDay}`,
      `Day ${currentDay}: ${innings?.batting_team_name} ${summary?.runs}/${summary?.wickets} (${summary?.oversCompleted})\n\nDay ${newDay} starts tomorrow. Same innings continues.`,
      [{ text: 'OK', onPress: () => setTimeout(() => setShowSelectBowl(true), 300) }]
    );
  };

  const handleUndo = async () => {
    if (!balls.length) return;
    const lastBall = balls[balls.length - 1];
    const wasWicket = lastBall.is_wicket;
    const dismissedName = wasWicket ? lastBall.dismissed_batsman : null;
    const removed = await undoLastBall(innings.id);
    if (!removed) return;
    const newBalls = balls.slice(0, -1);
    setBalls(newBalls);
    let correctedBatsmen;
    if (wasWicket && dismissedName) {
      const recomputed = computeAllBatsmenFromBalls(newBalls, batsmen);
      correctedBatsmen = recomputed.map(b => {
        if (b.name === dismissedName) return { ...b, isActive: true, isOut: false, dismissalType: null, fielderName: null, keeperName: null, bowlerName: null, onStrike: lastBall.batsman_name === dismissedName };
        return b;
      });
      correctedBatsmen = correctedBatsmen.filter(b => {
        if (b.name === dismissedName) return true;
        if (newBalls.some(ball => ball.batsman_name === b.name)) return true;
        if (b.isActive) return false;
        return true;
      });
      const activeAfter = correctedBatsmen.filter(c => c.isActive);
      if (activeAfter.length === 2) {
        correctedBatsmen = correctedBatsmen.map(b => {
          if (!b.isActive) return b;
          return { ...b, onStrike: b.name === lastBall.batsman_name };
        });
      }
      const restoredP = partnerships.map(p => !p.active && p.dismissed === dismissedName ? { ...p, active: true, dismissed: undefined } : p);
      setPartnershipsState(restoredP); await savePartnerships(innings.id, restoredP);
    } else {
      correctedBatsmen = computeAllBatsmenFromBalls(newBalls, batsmen);
      const facingBatterName = lastBall.batsman_name;
      if (facingBatterName) {
        correctedBatsmen = correctedBatsmen.map(b => {
          if (!b.isActive) return b;
          return { ...b, onStrike: b.name === facingBatterName };
        });
      }
    }
    setBatsmenS(correctedBatsmen); await saveBatsmen(innings.id, correctedBatsmen);
    const updatedBowlers = computeAllBowlersFromBalls(newBalls, bowlers);
    setBowlersS(updatedBowlers); await saveBowlers(innings.id, updatedBowlers);
    if (!wasWicket) await updateCurrentPartnership(newBalls, correctedBatsmen);
    Alert.alert('↩ Undone', wasWicket ? `${dismissedName} is back at the crease.` : `Ball ${removed.ball_display} removed.`);
  };

  if (loading || !match) return <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;

  const chartW = SW - 32;

  return (
    <View style={{ flex: 1, backgroundColor: '#f4f6f4' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40 }}>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={s.headerTitle}>Match Centre</Text>
          {isTestMatch && <Text style={{ color: '#a5d6a7', fontSize: 11 }}>Test Match · Day {currentDay}</Text>}
        </View>
        <TouchableOpacity
          style={{ backgroundColor: ACCENT, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 }}
          onPress={() => generateMatchPDF(match, allInnings, {
            batsmen, bowlers, balls, summary, partnerships, innings,
            allBallsMap, allBatsmenMap, allBowlersMap, allPartnershipsMap, roster
          })}
        >
          <Text style={{ color: PRIMARY, fontSize: 11, fontWeight: 'bold' }}>📄 PDF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ paddingHorizontal: 6 }}>
        {['Scoring','Scorecard','Stats','Balls','Info'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, activeTab === t.toLowerCase() && s.tabActive]} onPress={() => setActiveTab(t.toLowerCase())}>
            <Text style={[s.tabText, activeTab === t.toLowerCase() && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === 'scoring' && innings && summary && (
        <View style={{ flex: 1 }}>
          <View style={s.scoreHeader}>
            <Text style={s.scoreTeam}>{innings.batting_team_name}</Text>
            <Text style={s.scoreInn}>
              {['1st','2nd','3rd','4th'][innings.innings_number - 1] || `${innings.innings_number}th`} Innings {isTestMatch ? ` · Day ${currentDay}` : ''}
            </Text>
            <Text style={s.scoreMain}>
              {summary.runs}<Text style={{ color: '#a5d6a7', fontSize: 38 }}>-</Text>{summary.wickets}
            </Text>
            {isChasing && (
              <View style={s.chaseBox}>
                <Text style={s.chaseMain}>Need {runsNeeded} from {ballsRemLeft} balls</Text>
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 3 }}>
                  <Text style={s.chaseSub}>Target {innings.target}</Text>
                  <Text style={s.chaseRRR}>RRR: {liveRRR}</Text>
                </View>
              </View>
            )}
            {!isChasing && innings.target != null && (
              <View style={s.targetRow}>
                <Text style={s.targetText}>Target {innings.target} · Need {Math.max(0, innings.target - summary.runs)}</Text>
              </View>
            )}
            <View style={s.subRow}>
              <Text style={s.sub}>Extras {summary.extras}</Text>
              <Text style={s.sub}>Overs {summary.oversCompleted}{isTestMatch ? '' : `/${match.total_overs}`}</Text>
              <Text style={s.sub}>CRR {summary.crr}</Text>
            </View>
          </View>
          <ScrollView>
            <View style={s.table}>
              <View style={s.thead}>
                <TouchableOpacity style={{ width: 24 }}><Text>✏️</Text></TouchableOpacity>
                <Text style={[s.th, { flex: 2 }]}>Batsman</Text>
                {['R','B','4s','6s','SR'].map(h => <Text key={h} style={s.th}>{h}</Text>)}
              </View>
              {activeBat.map(b => {
                const isStr = b.onStrike;
                return (
                  <TouchableOpacity key={b.name} style={[s.tr, isStr && s.trStr]}
                    onPress={() => { const upd = batsmen.map(x => ({ ...x, onStrike: x.name === b.name && x.isActive })); setBatsmenS(upd); saveBatsmen(innings.id, upd); }}>
                    <View style={{ width: 24 }} />
                    <Text style={[s.td, { flex: 2, fontWeight: isStr ? 'bold' : '400' }, isStr && { color: '#fff' }]}>{b.name}{isStr ? ' *' : ''}</Text>
                    {[b.runs, b.balls, b.fours, b.sixes].map((v, i) => <Text key={i} style={[s.td, isStr && { color: '#fff' }]}>{v}</Text>)}
                    <Text style={[s.td, isStr && { color: '#fff' }]}>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</Text>
                  </TouchableOpacity>
                );
              })}
              {activeBat.length < 2 && (
                <TouchableOpacity style={s.addBatRow} onPress={() => { setInningsBatSelMode(false); setShowSelectBat(true); }}>
                  <Text style={s.addBatText}>+ Select Batsman</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.table}>
              <View style={s.thead}>
                <TouchableOpacity style={{ width: 24 }} onPress={() => setShowSelectBowl(true)}><Text>✏️</Text></TouchableOpacity>
                <Text style={[s.th, { flex: 2 }]}>Bowler</Text>
                {['O','M','R','W','Eco'].map(h => <Text key={h} style={s.th}>{h}</Text>)}
              </View>
              {bowlers.filter(b => b.isCurrent).map(b => (
                <View key={b.name} style={s.tr}>
                  <View style={{ width: 24 }} />
                  <Text style={[s.td, { flex: 2 }]}>{b.name}</Text>
                  <Text style={s.td}>{b.overs || formatOvers(b.balls || 0)}</Text>
                  <Text style={s.td}>{b.maidens || 0}</Text>
                  <Text style={s.td}>{b.runs || 0}</Text>
                  <Text style={s.td}>{b.wickets || 0}</Text>
                  <Text style={s.td}>{b.economy || '0.0'}</Text>
                </View>
              ))}
              <TouchableOpacity style={{ padding: 10, alignItems: 'center', backgroundColor: '#f8f8f8', borderTopWidth: 1, borderTopColor: '#eee' }} onPress={() => setShowSubBowlerModal(true)} >
                <Text style={{ fontSize: 12, color: '#1565c0', fontWeight: '600' }}>🔄 Change Bowler (injury / sub)</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.overHistory} contentContainerStyle={{ paddingHorizontal: 10, gap: 6, alignItems: 'center' }}>
              {overBalls.map((b, i) => <OverBall key={i} ball={b} />)}
              {overBalls.length === 0 && <Text style={{ color: '#aaa', fontSize: 12 }}>Start of over</Text>}
            </ScrollView>
            {summary.legalBalls > 0 && !isChasing && (
              <View style={s.projRow}>
                <Text style={s.projText}>📈 Projected: {projected} runs at current rate</Text>
              </View>
            )}
            <View style={s.pad}>
              <View style={s.padRow}>
                {[1,2,3,4,6].map(r => (
                  <TouchableOpacity key={r} style={s.padBtn} onPress={() => handleRunBtn(r)}>
                    <Text style={s.padBtnTxt}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.padRow}>
                {[
                  { l: 'LB',   a: () => { setPendingExtraType('legbye'); setExtraRunInput('1'); setShowExtrasPrompt(true); } },
                  { l: 'Bye',  a: () => { setPendingExtraType('bye');    setExtraRunInput('1'); setShowExtrasPrompt(true); } },
                  { l: 'Wide', a: () => handleRunBtn(0, 'wide') },
                  { l: 'NB',   a: () => handleRunBtn(0, 'noball') },
                  { l: '•',    a: () => handleRunBtn(0) },
                ].map(btn => (
                  <TouchableOpacity key={btn.l} style={s.padBtn} onPress={btn.a}>
                    <Text style={s.padBtnTxt}>{btn.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.padRow}>
                <TouchableOpacity style={s.padBtnAlt} onPress={() => handleRunBtn(5)}><Text style={s.padBtnAltTxt}>5</Text></TouchableOpacity>
                <TouchableOpacity style={s.padBtnAlt} onPress={() => handleRunBtn(7)}><Text style={s.padBtnAltTxt}>7</Text></TouchableOpacity>
                <TouchableOpacity style={s.padBtnAlt} onPress={handleUndo}><Text style={s.padBtnAltTxt}>↩ Undo</Text></TouchableOpacity>
                <TouchableOpacity style={[s.padBtnAlt, { backgroundColor: '#c62828' }]} onPress={() => setShowWicket(true)}>
                  <Text style={[s.padBtnAltTxt, { color: '#fff' }]}>Out</Text>
                </TouchableOpacity>
              </View>
              <View style={s.padRow}>
                {isTestMatch ? (
                  <>
                    <TouchableOpacity style={[s.padBtnAlt, { flex: 2, backgroundColor: '#1a5c35' }]} onPress={handleDeclare}>
                      <Text style={[s.padBtnAltTxt, { color: ACCENT }]}>📋 Declare</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.padBtnAlt, { flex: 2, backgroundColor: '#37474f' }]} onPress={() => setShowDaySnapshot(true)}>
                      <Text style={[s.padBtnAltTxt, { color: '#fff' }]}>🌆 Stumps</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.padBtnAlt, { flex: 2, backgroundColor: '#455a64' }]} onPress={() => handleSpecialAction('drawn')}>
                      <Text style={[s.padBtnAltTxt, { color: '#fff' }]}>🤝 Draw</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={[s.padBtnAlt, { flex: 3, backgroundColor: '#37474f' }]} onPress={handleEndInnings}>
                      <Text style={[s.padBtnAltTxt, { color: '#fff' }]}>⏹ End Innings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.padBtnAlt, { flex: 3, backgroundColor: '#455a64' }]} onPress={() => handleSpecialAction('forfeit')}>
                      <Text style={[s.padBtnAltTxt, { color: '#fff' }]}>🚩 Forfeit</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {activeTab === 'scorecard' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <InningsToggle inningsList={allInnings} currentView={scorecardView} onSelect={setScorecardView} />
          {(() => {
            const viewInn = getInnById(scorecardView);
            if (!viewInn) return <View style={{ padding: 24, alignItems: 'center' }}><Text style={{ color: '#aaa', fontSize: 14 }}>Innings {scorecardView} has not started yet.</Text></View>;
            const vBalls     = getBallsForInn(scorecardView);
            const vBatsmen   = getBatsmenForInn(scorecardView);
            const vBowlers   = getBowlersForInn(scorecardView);
            const vPships    = getPshipsForInn(scorecardView);
            const vSummary   = computeInningsSummary(vBalls, match.total_overs);
            const vBatTeam   = viewInn.batting_team_name;
            const vBowlTeam  = viewInn.bowling_team_name;
            const vBatRoster = vBatTeam === match.team_a_name ? roster.a : roster.b;
            const vActiveBat = vBatsmen.filter(b => b.isActive);
            const ordinal = ['1st','2nd','3rd','4th'][scorecardView - 1] || `${scorecardView}th`;
            return (
              <>
                <Text style={sc.team}>{vBatTeam} — {ordinal} Innings{viewInn.declared ? ' (Declared)' : ''}</Text>
                <View style={sc.table}>
                  <View style={sc.head}>
                    <Text style={[sc.th, { flex: 2.5 }]}>Batsman</Text>
                    {['R','B','4s','6s','SR'].map(h => <Text key={h} style={sc.th}>{h}</Text>)}
                  </View>
                  {vBatsmen.filter(b => b.isActive || b.isOut || b.runs > 0 || b.balls > 0).map((b, idx) => (
                    <View key={b.id || `${b.name}_${idx}`} style={sc.row}>
                      <View style={{ flex: 2.5 }}>
                        <Text style={sc.name}>{b.name}</Text>
                        <Text style={sc.sub}>{buildDismissalString(b)}</Text>
                      </View>
                      {[b.runs, b.balls, b.fours, b.sixes].map((v, i) => <Text key={i} style={sc.td}>{v}</Text>)}
                      <Text style={sc.td}>{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</Text>
                    </View>
                  ))}
                </View>
                <View style={sc.extRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={sc.extLabel}>Extras {vSummary.extras}</Text>
                    <Text style={sc.extDetail}>
                      {vSummary.wides    > 0 ? `WD ${vSummary.wides}  `   : ''}
                      {vSummary.noBalls > 0 ? `NB ${vSummary.noBalls}  ` : ''}
                      {vSummary.byes    > 0 ? `B ${vSummary.byes}      `     : ''}
                      {vSummary.legByes > 0 ? `LB ${vSummary.legByes}`   : ''}
                    </Text>
                  </View>
                  <Text style={sc.overs}>Overs {vSummary.oversCompleted}</Text>
                </View>
                <View style={sc.totalRow}>
                  <Text style={sc.totalLabel}>Total</Text>
                  <Text style={sc.totalScore}>{vSummary.runs}/{vSummary.wickets}</Text>
                  <Text style={sc.rr}>RR: {vSummary.crr}</Text>
                </View>
                {vBatRoster.filter(p => !vBatsmen.find(b => b.name === p)).length > 0 && (
                  <Text style={sc.ytb}><Text style={{ fontWeight: 'bold' }}>Yet To Bat — </Text>{vBatRoster.filter(p => !vBatsmen.find(b => b.name === p)).join(', ')}</Text>
                )}
                <View style={[sc.table, { marginTop: 14 }]}>
                  <View style={sc.head}>
                    <Text style={[sc.th, { flex: 2 }]}>Bowler ({vBowlTeam})</Text>
                    {['O','M','R','W','Eco'].map(h => <Text key={h} style={sc.th}>{h}</Text>)}
                  </View>
                  {vBowlers.map((b, idx) => (
                    <View key={b.id || `${b.name}_${idx}`} style={sc.row}>
                      <Text style={[sc.name, { flex: 2 }]}>{b.name}</Text>
                      <Text style={sc.td}>{b.overs || formatOvers(b.balls || 0)}</Text>
                      <Text style={sc.td}>{b.maidens || 0}</Text>
                      <Text style={sc.td}>{b.runs || 0}</Text>
                      <Text style={sc.td}>{b.wickets || 0}</Text>
                      <Text style={sc.td}>{b.economy || '0.0'}</Text>
                    </View>
                  ))}
                </View>
                {vPships.length > 0 && (
                  <View style={[sc.table, { marginTop: 14, padding: 12 }]}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: PRIMARY, marginBottom: 10 }}>Partnerships</Text>
                    <AllPartnerships partnerships={vPships} />
                  </View>
                )}
                {vActiveBat.length >= 2 && viewInn.status === 'active' && (
                  <View style={[sc.table, { marginTop: 10, padding: 12 }]}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: PRIMARY, marginBottom: 8 }}>Current Partnership</Text>
                    <CompactPartnership batter1={vActiveBat[0]} batter2={vActiveBat[1]} />
                  </View>
                )}
              </>
            );
          })()}
        </ScrollView>
      )}

      {activeTab === 'stats' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <InningsToggle inningsList={allInnings} currentView={statsView} onSelect={setStatsView} />
          {(() => {
            const viewInn = getInnById(statsView);
            if (!viewInn) return (
              <View style={stat.card}>
                <Text style={{ textAlign: 'center', color: '#aaa', padding: 24, fontSize: 14 }}>Innings {statsView} has not started yet.</Text>
              </View>
            );
            const vBalls    = getBallsForInn(statsView);
            const vOverRuns = computeOverRuns(vBalls);
            const vPhases   = computePhaseStats(vBalls, match.total_overs, match.has_powerplay, match.powerplay_end);
            const vPships   = getPshipsForInn(statsView);
            const wormData  = allInnings.map(inn => ({ prog: computeScoreProgression(getBallsForInn(inn.innings_number)), team: inn.batting_team_name }));
            return (
              <>
                {vPhases.length > 0 && (
                  <View style={stat.card}>
                    <Text style={stat.cardTitle}>📊 Phase Breakdown</Text>
                    <PhaseStats phases={vPhases} />
                  </View>
                )}
                <View style={stat.card}>
                  <Text style={stat.cardTitle}>🎡 Wagon Wheel</Text>
                  {(() => {
                    const validShots = vBalls.filter(b => b.shot_direction_x != null);
                    const SIZE = chartW * 0.78, cx = SIZE / 2, cy = SIZE / 2, r = SIZE * 0.43;
                    return (
                      <>
                        <Svg width={SIZE} height={SIZE} style={{ alignSelf: 'center' }}>
                          <Ellipse cx={cx} cy={cy} rx={r} ry={r * 0.93} fill="#3a7d2c" stroke="#2d6a22" strokeWidth={1.5} />
                          <Ellipse cx={cx} cy={cy} rx={r * 0.6} ry={r * 0.56} fill="none" stroke="#6dbf5e" strokeWidth={0.7} strokeDasharray="4,3" />
                          <Rect x={cx - 7} y={cy - 20} width={14} height={40} fill="#d4b483" rx={2} />
                          <SvgText x={cx} y={10} fontSize={9} fill="#c8e6c9" textAnchor="middle">Straight</SvgText>
                          <SvgText x={SIZE - 4} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="end">Off</SvgText>
                          <SvgText x={4} y={cy + 4} fontSize={9} fill="#c8e6c9" textAnchor="start">Leg</SvgText>
                          {validShots.length === 0 && <SvgText x={cx} y={cy + 4} fontSize={11} fill="#c8e6c988" textAnchor="middle">No shots logged yet</SvgText>}
                          {validShots.map((b, i) => {
                            const bx = (b.shot_direction_x / 100) * SIZE, by = (b.shot_direction_y / 100) * SIZE;
                            const runs = Math.min(b.runs_scored || 0, 6);
                            const color = RUN_COLORS[runs] || RUN_COLORS[1];
                            return (
                              <G key={i}>
                                <Line x1={cx} y1={cy} x2={bx} y2={by} stroke={color} strokeWidth={runs >= 4 ? 2.5 : 1.5} opacity={0.85} />
                                {runs >= 4 && <Circle cx={bx} cy={by} r={4} fill={color} />}
                              </G>
                            );
                          })}
                          <Circle cx={cx} cy={cy} r={4} fill={ACCENT} />
                        </Svg>
                        <WWLegend />
                      </>
                    );
                  })()}
                </View>
                <View style={stat.card}>
                  <Text style={stat.cardTitle}>📊 Over-by-Over (Manhattan)</Text>
                  <ManhattanChart overRuns={vOverRuns} width={chartW - 16} />
                </View>
                <View style={stat.card}>
                  <Text style={stat.cardTitle}>🐍 Innings Progression (Worm)</Text>
                  <WormGraph
                    progression1={wormData[0]?.prog || []} progression2={wormData[1]?.prog || []}
                    team1={wormData[0]?.team} team2={wormData[1]?.team}
                    totalOvers={match.total_overs} width={chartW - 16}
                  />
                </View>
                <View style={stat.card}>
                  <Text style={stat.cardTitle}>🤝 Partnerships</Text>
                  {vPships.length > 0 ? <AllPartnerships partnerships={vPships} /> : <Text style={{ color: '#aaa', textAlign: 'center', padding: 12, fontSize: 13 }}>No partnerships recorded yet.</Text> }
                </View>
              </>
            );
          })()}
        </ScrollView>
      )}

      {activeTab === 'balls' && (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          <InningsToggle inningsList={allInnings} currentView={ballsView} onSelect={setBallsView} />
          {(() => {
            const viewInn = getInnById(ballsView);
            if (!viewInn) return <Text style={{ textAlign: 'center', color: '#aaa', marginTop: 20, fontSize: 14 }}>Innings {ballsView} has not started yet.</Text>;
            const vBalls = getBallsForInn(ballsView);
            if (!vBalls.length) return <Text style={{ textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 14 }}>No balls logged yet.</Text>;
            const overs = {};
            vBalls.forEach(b => { const key = b.over_number ?? 'event'; if (!overs[key]) overs[key] = []; overs[key].push(b); });
            const overNums = Object.keys(overs).sort((a, b) => { if (a === 'event') return 1; if (b === 'event') return -1; return Number(b) - Number(a); });
            return overNums.map(o => (
              <View key={o}>
                {[...overs[o]].reverse().map((b, i) => (
                  <View key={i} style={bl.entry}>
                    <Text style={bl.over}>{b.ball_display}</Text>
                    {!isNoBallEvent(b)
                      ? <OverBall ball={b} />
                      : <View style={[ob.ball, { backgroundColor: '#78909c' }]}><Text style={ob.text}>EVT</Text></View>
                    }
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={bl.title}>{b.bowler_name} to {b.batsman_name}</Text>
                      <Text style={bl.narr}>{b.narrative}</Text>
                      {b.fielder_name && <Text style={bl.fielder}>{b.wicket_type === 'caught' ? `c ${b.fielder_name}` : `Field: ${b.fielder_name}`}</Text>}
                    </View>
                  </View>
                ))}
                {o !== 'event' && (
                  <View style={bl.summary}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {overs[o].filter(b => !isNoBallEvent(b)).map((b, i) => <OverBall key={i} ball={b} />)}
                      </View>
                    </ScrollView>
                    <Text style={bl.summaryText}>
                      Over {Number(o) + 1} · {overs[o].reduce((ss, b) => ss + b.runs_scored + b.extras_runs, 0)} runs
                      {overs[o].filter(b => b.is_wicket).length > 0 ? ` · ${overs[o].filter(b => b.is_wicket).length} wkt` : ''}
                    </Text>
                  </View>
                )}
              </View>
            ));
          })()}
        </ScrollView>
      )}

      {activeTab === 'info' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: PRIMARY, textAlign: 'center', marginBottom: 12 }}>
            {match.team_a_name} vs {match.team_b_name}
          </Text>
          {match.result && (
            <View style={{ backgroundColor: '#e8f5e9', borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: PRIMARY }}>{match.result}</Text>
            </View>
          )}
          <View style={{ backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
            {[
              ['Format', match.match_format === 'test' ? `Test Match · ${match.overs_per_day} overs/day` : `${match.total_overs} overs · ${match.ball_type} ball`],
              ['Powerplay', match.has_powerplay ? `Overs 1-${match.powerplay_end}` : 'None'],
              ['Venue', match.venue || '—'],
              ['Date', match.match_date || '—'],
              ['Toss', match.toss_winner ? `${match.toss_winner} won, chose to ${match.toss_decision}` : '—'],
              ['Batting first', match.batting_first || '—'],
              ['Status', match.status?.toUpperCase() || '—'],
              ...(match.result ? [['Result', match.result]] : []),
              ...(isTestMatch ? [['Current Day', `Day ${currentDay}`]] : []),
              ...(isTestMatch ? [['Follow-on threshold', `${match.follow_on_threshold} runs`]] : []),
            ].map(([label, value]) => (
              <View key={label} style={{ flexDirection: 'row', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }}>
                <Text style={{ fontSize: 13, color: '#888', width: 150 }}>{label}</Text>
                <Text style={{ fontSize: 13, color: '#222', fontWeight: '500', flex: 1 }}>{value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ══════════ MODALS ══════════ */}

      <Modal visible={showToss} transparent animationType="fade">
        <View style={s.tossOverlay}>
          <View style={s.tossBox}>
            <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>🪙</Text>
            <Text style={s.tossQ}>Who won the toss?</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              {[match.team_a_name, match.team_b_name].map(team => (
                <TouchableOpacity key={team} style={[s.tossBtn, tossWinner === team && s.tossBtnActive]} onPress={() => setTossWinner(team)}>
                  <Text style={[s.tossBtnTxt, tossWinner === team && { color: '#fff' }]}>{team}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {tossWinner && (
              <>
                <Text style={s.tossQ}>{tossWinner} chose to...</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['bat','bowl'].map(d => (
                    <TouchableOpacity key={d} style={s.tossDecBtn} onPress={() => handleToss(tossWinner, d)}>
                      <Text style={s.tossDecBtnTxt}>{d.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <WagonWheelModal visible={showWW} runs={pendingRuns} title="Shot Direction" onConfirm={handleWWConfirm} />
      <WagonWheelModal visible={showWWForWicket && (pendingWicketType === 'caught' || pendingWicketType === 'run_out_ww')} runs={null} title={pendingWicketType === 'caught' ? 'Caught — Shot Direction' : 'Run Out — Shot Direction'} onConfirm={handleWWForWicketConfirm} />
      <WagonWheelModal visible={showWWForNB} runs={null} title="No Ball — Shot Direction" onConfirm={handleWWForNBConfirm} />

      <Modal visible={showWicket} transparent animationType="slide">
        <View style={s.wicketOverlay}>
          <View style={s.wicketBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 }}>
              <TouchableOpacity onPress={() => setShowWicket(false)}><Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>✕</Text></TouchableOpacity>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>Wicket</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: 'Bowled',               key: 'bowled' },
                { label: 'Caught',               key: 'caught' },
                { label: 'Stumped',              key: 'stumped' },
                { label: 'LBW',                  key: 'lbw' },
                { label: 'Run Out',              key: 'run_out' },
                { label: 'Non-Striker Run Out', key: 'non_striker_run_out' },
                { label: 'Retired Hurt',        key: 'retired_hurt' },
                { label: 'Over The Fence',      key: 'over_the_fence' },
              ].map(w => (
                <TouchableOpacity key={w.key} style={s.wicketBtn} onPress={() => handleWicketTypeSelected(w.key)}>
                  <Text style={s.wicketBtnTxt}>{w.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showRunOutBatterSelect} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={md.title}>Run Out — Who is out?</Text>
            <Text style={md.sub}>Select the batsman who was run out</Text>
            {activeBat.map(b => (
              <TouchableOpacity key={b.name} style={md.bigBtn} onPress={() => handleRunOutBatterSelected(b.name)}>
                <Text style={md.bigBtnText}>{b.name}{b.onStrike ? ' (striker)' : ' (non-striker)'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={md.cancelBtn} onPress={() => { setShowRunOutBatterSelect(false); setPendingWicketType(null); }}>
              <Text style={md.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showRunOutRunsPrompt} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={md.title}>Run Out — Runs Scored</Text>
            <Text style={md.sub}>How many runs were completed before the run-out?{'\n'}(0 = dismissed on first run attempt)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
              {[0,1,2,3,4,5].map(r => (
                <TouchableOpacity key={r} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: runOutBatRuns === String(r) ? PRIMARY : '#f0f0f0', alignItems: 'center', justifyContent: 'center' }} onPress={() => setRunOutBatRuns(String(r))} >
                  <Text style={{ color: runOutBatRuns === String(r) ? '#fff' : '#333', fontWeight: 'bold', fontSize: 18 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={md.cancelBtn2} onPress={() => { setShowRunOutRunsPrompt(false); setPendingWicketType(null); }}><Text style={md.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={md.confirmBtn} onPress={handleRunOutRunsConfirmed}><Text style={md.confirmText}>Next →</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showFielderNamePrompt} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={md.title}>{pendingWicketType === 'caught' ? 'Caught by' : 'Fielder (Run Out)'}</Text>
            <Text style={md.sub}>{pendingWicketType === 'caught' ? 'Enter fielder who took the catch (substitutes valid)' : 'Enter fielder responsible for the run out'}</Text>
            <TextInput style={md.input} placeholder="Fielder name..." value={fielderNameInput} onChangeText={setFielderNameInput} autoFocus />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={md.cancelBtn2} onPress={() => { setShowFielderNamePrompt(false); setPendingWicketType(null); setPendingWicketArrow(null); setRunOutDismissedBatter(null); setFielderNameInput(''); }}><Text style={md.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={md.confirmBtn} onPress={handleFielderNameConfirmed}><Text style={md.confirmText}>Confirm</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={() => { setFielderNameInput(''); handleFielderNameConfirmed(); }}>
              <Text style={{ color: '#aaa', fontSize: 12 }}>Skip (unknown fielder)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showKeeperPrompt} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={md.title}>Stumped — Keeper's Name</Text>
            <Text style={md.sub}>Enter the wicketkeeper who made the stumping</Text>
            <TextInput style={md.input} placeholder="Keeper name..." value={keeperNameInput} onChangeText={setKeeperNameInput} autoFocus />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={md.cancelBtn2} onPress={() => { setShowKeeperPrompt(false); setPendingWicketType(null); setKeeperNameInput(''); }}><Text style={md.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={md.confirmBtn} onPress={handleKeeperConfirmed}><Text style={md.confirmText}>Confirm</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNSROFielder} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={md.title}>Non-Striker Run Out</Text>
            <Text style={md.sub}>{nonStriker?.name || 'Non-striker'} is dismissed.{'\n'}Enter the bowler / fielder who removed the bails:</Text>
            <TextInput style={md.input} placeholder="Bowler / fielder name..." value={nsroFielderInput} onChangeText={setNsroFielderInput} autoFocus />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={md.cancelBtn2} onPress={() => { setShowNSROFielder(false); setNsroFielderInput(''); }}><Text style={md.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={md.confirmBtn} onPress={handleNSROFielderConfirmed}><Text style={md.confirmText}>Confirm</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showNoBallRunsPrompt} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={[md.title, { color: '#e65100' }]}>No Ball</Text>
            <Text style={md.sub}>1 penalty run added automatically.{'\n'}How many runs did the batter score?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
              {[0,1,2,3,4,5,6].map(r => (
                <TouchableOpacity key={r}
                  style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: noBallBatRuns === String(r) ? '#e65100' : '#f0f0f0', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setNoBallBatRuns(String(r))}
                >
                  <Text style={{ color: noBallBatRuns === String(r) ? '#fff' : '#333', fontWeight: 'bold', fontSize: 18 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 12, color: '#aaa', marginBottom: 14, textAlign: 'center' }}>
              Total to bowler: {parseInt(noBallBatRuns, 10) + 1} runs
              {parseInt(noBallBatRuns, 10) > 0 ? ` · ${noBallBatRuns} to batsman · Shot direction next` : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={md.cancelBtn2} onPress={() => setShowNoBallRunsPrompt(false)}><Text style={md.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[md.confirmBtn, { backgroundColor: '#e65100' }]} onPress={handleNoBallRunsChosen}>
                <Text style={md.confirmText}>{parseInt(noBallBatRuns, 10) > 0 ? 'Next →' : 'Log No Ball'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showWideExtraPrompt} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={[md.title, { color: '#1565c0' }]}>Wide Ball</Text>
            <Text style={md.sub}>1 wide run added automatically.{'\n'}Did the ball go further (keeper fumble / overthrows)?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
              {[0,1,2,3,4].map(r => (
                <TouchableOpacity key={r} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: wideExtraRuns === String(r) ? '#1565c0' : '#f0f0f0', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setWideExtraRuns(String(r))}
                >
                  <Text style={{ color: wideExtraRuns === String(r) ? '#fff' : '#333', fontWeight: 'bold', fontSize: 18 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 12, color: '#aaa', marginBottom: 14, textAlign: 'center' }}>
              Total: {parseInt(wideExtraRuns, 10) + 1} runs (1 Wide + {wideExtraRuns} bye{parseInt(wideExtraRuns, 10) !== 1 ? 's' : ''})
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={md.cancelBtn2} onPress={() => setShowWideExtraPrompt(false)}><Text style={md.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[md.confirmBtn, { backgroundColor: '#1565c0' }]} onPress={handleWideConfirmed}><Text style={md.confirmText}>Log Wide</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showWideExtraPrompt} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={[md.title, { color: '#1565c0' }]}>Wide Ball</Text>
            <Text style={md.sub}>1 wide run added automatically.{'\n'}Did the ball go further (keeper fumble / overthrows)?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
              {[0,1,2,3,4].map(r => (
                <TouchableOpacity key={r} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: wideExtraRuns === String(r) ? '#1565c0' : '#f0f0f0', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setWideExtraRuns(String(r))}
                >
                  <Text style={{ color: wideExtraRuns === String(r) ? '#fff' : '#333', fontWeight: 'bold', fontSize: 18 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 12, color: '#aaa', marginBottom: 14, textAlign: 'center' }}>
              Total: {parseInt(wideExtraRuns,10) + 1} runs (1 Wide + {wideExtraRuns} bye{parseInt(wideExtraRuns,10) !== 1 ? 's' : ''})
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={md.cancelBtn2} onPress={() => setShowWideExtraPrompt(false)}><Text style={md.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[md.confirmBtn, { backgroundColor: '#1565c0' }]} onPress={handleWideConfirmed}><Text style={md.confirmText}>Log Wide</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showExtrasPrompt} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={md.title}>{pendingExtraType === 'bye' ? 'Bye' : 'Leg Bye'} — How many runs?</Text>
            <Text style={md.sub}>Added to team total only. Not counted for batter or bowler.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
              {[1,2,3,4,5].map(r => (
                <TouchableOpacity key={r} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: extraRunInput === String(r) ? PRIMARY : '#f0f0f0', alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setExtraRunInput(String(r))}
                >
                  <Text style={{ color: extraRunInput === String(r) ? '#fff' : '#333', fontWeight: 'bold', fontSize: 18 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={md.cancelBtn2} onPress={() => setShowExtrasPrompt(false)}><Text style={md.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={md.confirmBtn} onPress={() => {
                setShowExtrasPrompt(false);
                const runs = parseInt(extraRunInput, 10) || 1;
                doLogBall({ runs_scored: 0, extras_runs: runs, is_bye: pendingExtraType === 'bye', is_leg_bye: pendingExtraType === 'legbye' });
              }}><Text style={md.confirmText}>Confirm {extraRunInput} run{extraRunInput !== '1' ? 's' : ''}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showFollowOnPrompt} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={[md.title, { fontSize: 20 }]}>⚡ Follow-On?</Text>
            <Text style={md.sub}>
              {allInnings.find(i => i.innings_number === 2)?.batting_team_name || ''} are {match.follow_on_deficit || ''} runs behind.{'\n\n'}
              Follow-on threshold: {match.follow_on_threshold || 200} runs.
            </Text>
            <TouchableOpacity style={[md.bigBtn, { backgroundColor: '#c62828', marginBottom: 10 }]} onPress={handleFollowOnEnforce}>
              <Text style={md.bigBtnText}>⚡ Enforce Follow-On</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[md.bigBtn, { backgroundColor: PRIMARY }]} onPress={handleFollowOnDecline}>
              <Text style={md.bigBtnText}>✕ Decline — We Bat Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDaySnapshot} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={[md.title, { fontSize: 20 }]}>🌆 End of Day {currentDay}</Text>
            <Text style={md.sub}>
              {innings?.batting_team_name}: {summary?.runs}/{summary?.wickets} ({summary?.oversCompleted}){'\n\n'}
              Save day's summary and pause until Day {currentDay + 1}.{'\n'}
              The same innings continues tomorrow.
            </Text>
            <TouchableOpacity style={[md.bigBtn, { backgroundColor: '#37474f' }]} onPress={handleEndOfDay}>
              <Text style={md.bigBtnText}>🌆 Confirm Stumps — End of Day {currentDay}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[md.cancelBtn, { marginTop: 10 }]} onPress={() => setShowDaySnapshot(false)}>
              <Text style={md.cancelText}>Continue Playing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSubBowlerModal} transparent animationType="fade">
        <View style={md.overlay}>
          <View style={md.box}>
            <Text style={md.title}>🔄 Change Bowler (Mid-Over)</Text>
            <Text style={md.sub}>Select a bowler to finish this over. Their balls will continue from where the over is now.</Text>
            {bowlingRoster.map(name => {
              const isCur = !!bowlers.find(b => b.name === name && b.isCurrent);
              return (
                <TouchableOpacity key={name}
                  style={[md.bigBtn, { marginBottom: 8, backgroundColor: isCur ? '#888' : PRIMARY }]}
                  disabled={isCur}
                  onPress={async () => {
                    setShowSubBowlerModal(false);
                    const existing = bowlers.find(b => b.name === name);
                    let updated;
                    if (existing) updated = bowlers.map(b => ({ ...b, isCurrent: b.name === name }));
                    else updated = [...bowlers.map(b => ({ ...b, isCurrent: false })), { name, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0, maidens: 0, isCurrent: true }];
                    setBowlersS(updated); await saveBowlers(innings.id, updated);
                  }}
                >
                  <Text style={md.bigBtnText}>{name}{isCur ? ' (current)' : ''}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[md.cancelBtn, { marginTop: 4 }]} onPress={() => setShowSubBowlerModal(false)}>
              <Text style={md.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PlayerSelectModal
        visible={showSelectBat}
        title={inningsBatSelMode ? 'Build Squad & Select Openers' : 'Select Next Batsman'}
        accentColor={SCORING}
        players={innings ? (() => {
          const alreadyIn = batsmen.filter(b => b.isActive || (b.isOut && b.dismissalType !== 'retired_hurt')).map(b => b.name);
          return battingRoster.filter(p => !alreadyIn.includes(p));
        })() : []}
        alreadySelected={inningsBatSelMode ? selectedBatters : []}
        allowDone={inningsBatSelMode}
        onSelect={handleSelectBatter}
        onDeselect={(name) => setSelectedBatters(prev => prev.filter(n => n !== name))}
        onAdd={(name) => { addToRoster(name, true); }}
        onDelete={(name) => removeFromRoster(name, true)}
        onDone={handleBattersConfirmed}
        onClose={() => {
          if (inningsBatSelMode && selectedBatters.length === 0) return;
          if (inningsBatSelMode) handleBattersConfirmed();
          else setShowSelectBat(false);
        }}
      />

      <PlayerSelectModal
        visible={showSelectBowl}
        title={inningsBowlSelMode && !bowlSquadDone ? 'Build Bowling Squad — then select opener' : 'Select Bowler'}
        accentColor={PRIMARY}
        players={innings ? bowlingRoster : []}
        alreadySelected={[]}
        allowDone={inningsBowlSelMode && !bowlSquadDone}
        onSelect={handleSelectBowler}
        onDeselect={() => {}}
        onAdd={(name) => {
          addToRoster(name, false).then(() => {
            if (!(inningsBowlSelMode && !bowlSquadDone)) {
              setTimeout(() => handleSelectBowler(name), 100);
            }
          });
        }}
        onDelete={(name) => removeFromRoster(name, false)}
        onDone={handleBowlingSquadDone}
        onClose={() => {
          if (inningsBowlSelMode && !bowlSquadDone) { handleBowlingSquadDone(); }
          else { setShowSelectBowl(false); }
        }}
      />

    </View>
  );
}

const s = StyleSheet.create({
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:           { backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16 },
  headerTitle:      { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  ftBadge:          { backgroundColor: '#757575', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ftBadgeText:      { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  tabBar:           { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', maxHeight: 46 },
  tab:              { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive:        { borderBottomColor: PRIMARY },
  tabText:          { fontSize: 13, color: '#888' },
  tabTextActive:    { color: PRIMARY, fontWeight: 'bold' },
  scoreHeader:      { backgroundColor: PRIMARY, padding: 14, alignItems: 'center' },
  scoreTeam:        { color: '#a5d6a7', fontSize: 14, fontWeight: '600' },
  scoreInn:         { color: '#a5d6a7', fontSize: 12, marginBottom: 4 },
  scoreMain:        { color: '#fff', fontSize: 52, fontWeight: 'bold', lineHeight: 58 },
  chaseBox:         { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, marginTop: 6, alignItems: 'center', width: '90%' },
  chaseMain:        { color: ACCENT, fontSize: 16, fontWeight: 'bold' },
  chaseSub:         { color: '#c8e6c9', fontSize: 12 },
  chaseRRR:         { color: '#ef9a9a', fontSize: 12, fontWeight: '600' },
  targetRow:        { flexDirection: 'row', gap: 12, marginTop: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  targetText:       { color: ACCENT, fontSize: 13, fontWeight: '600' },
  subRow:           { flexDirection: 'row', gap: 14, marginTop: 4 },
  sub:              { color: '#c8e6c9', fontSize: 12 },
  table:            { backgroundColor: '#fff', margin: 8, borderRadius: 10, overflow: 'hidden' },
  thead:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, backgroundColor: '#f8f8f8', borderBottomWidth: 1, borderBottomColor: '#eee' },
  th:               { flex: 1, fontSize: 12, color: '#888', fontWeight: '700', textAlign: 'center' },
  tr:               { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  trStr:            { backgroundColor: SCORING },
  td:               { flex: 1, fontSize: 13, color: '#333', textAlign: 'center' },
  addBatRow:        { padding: 12, alignItems: 'center' },
  addBatText:       { color: PRIMARY, fontWeight: '600', fontSize: 13 },
  overHistory:      { backgroundColor: '#fff', marginHorizontal: 8, borderRadius: 10, paddingVertical: 8, maxHeight: 54 },
  projRow:          { backgroundColor: '#e8f5e9', marginHorizontal: 8, borderRadius: 8, padding: 10, marginBottom: 4 },
  projText:         { fontSize: 12, color: PRIMARY, fontWeight: '500' },
  pad:              { backgroundColor: SCORING, margin: 8, borderRadius: 12, overflow: 'hidden' },
  padRow:           { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)' },
  padBtn:           { flex: 1, paddingVertical: 18, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.15)' },
  padBtnTxt:        { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  padBtnAlt:        { flex: 1, paddingVertical: 16, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.12)' },
  padBtnAltTxt:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  tossOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  tossBox:          { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%' },
  tossQ:            { fontSize: 16, color: '#444', textAlign: 'center', marginBottom: 12, fontWeight: '600' },
  tossBtn:          { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: PRIMARY, alignItems: 'center' },
  tossBtnActive:    { backgroundColor: PRIMARY },
  tossBtnTxt:       { fontSize: 15, fontWeight: 'bold', color: PRIMARY },
  tossDecBtn:       { flex: 1, padding: 14, borderRadius: 12, backgroundColor: PRIMARY, alignItems: 'center' },
  tossDecBtnTxt:    { color: ACCENT, fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  wicketOverlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  wicketBox:        { backgroundColor: SCORING, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 34 },
  wicketBtn:        { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' },
  wicketBtnTxt:     { color: '#fff', fontWeight: '600', fontSize: 14 },
});

const sc = StyleSheet.create({
  team:      { fontSize: 18, fontWeight: 'bold', color: PRIMARY, marginBottom: 10 },
  table:     { backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', marginBottom: 6 },
  head:      { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f0f4f0' },
  th:        { flex: 1, fontSize: 12, color: PRIMARY, fontWeight: '700', textAlign: 'center' },
  row:       { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#f5f5f5', alignItems: 'flex-start' },
  name:      { fontSize: 14, fontWeight: '600', color: '#222' },
  sub:       { fontSize: 11, color: '#888', fontStyle: 'italic' },
  td:        { flex: 1, fontSize: 13, color: '#333', textAlign: 'center' },
  extRow:    { backgroundColor: '#fff', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  extLabel:  { fontSize: 14, fontWeight: '600', color: '#333' },
  extDetail: { fontSize: 11, color: '#888', marginTop: 2 },
  overs:     { fontSize: 14, color: '#555' },
  totalRow:  { backgroundColor: '#fff', padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  totalLabel:{ fontSize: 13, color: '#888' },
  totalScore:{ fontSize: 22, fontWeight: 'bold', color: PRIMARY },
  rr:        { fontSize: 13, color: '#666' },
  ytb:       { fontSize: 13, color: '#444', lineHeight: 20, backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8 },
});

const stat = StyleSheet.create({
  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: PRIMARY, marginBottom: 10 },
});

const bl = StyleSheet.create({
  entry:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  over:        { fontSize: 13, color: '#888', width: 32, fontWeight: '600' },
  title:       { fontSize: 13, fontWeight: '600', color: '#222' },
  narr:        { fontSize: 12, color: '#666', marginTop: 2 },
  fielder:     { fontSize: 11, color: '#1565c0', marginTop: 2, fontStyle: 'italic' },
  summary:     { backgroundColor: '#f8f9fa', borderRadius: 10, padding: 10, marginVertical: 8, borderWidth: 1, borderColor: '#e8e8e8' },
  summaryText: { fontSize: 12, color: PRIMARY, fontWeight: '600', marginTop: 6 },
});

const md = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  box:        { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' },
  title:      { fontSize: 18, fontWeight: 'bold', color: PRIMARY, marginBottom: 6 },
  sub:        { fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 19 },
  input:      { borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 16, color: '#222' },
  bigBtn:     { padding: 16, borderRadius: 12, marginBottom: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  bigBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn:  { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', marginTop: 4, width: '100%' },
  cancelBtn2: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  cancelText: { color: '#666', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  confirmText:{ color: ACCENT, fontWeight: 'bold' },
});