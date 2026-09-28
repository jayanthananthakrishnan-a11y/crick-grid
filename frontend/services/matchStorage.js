import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Key helpers (all scoped to matchId) ──────────────────────────────────────
const KEY = {
  matches:      () => `cricket_matches_v2`,
  innings:      (mid) => `innings_${mid}`,
  balls:        (iid) => `balls_${iid}`,
  batsmen:      (iid) => `batsmen_${iid}`,
  bowlers:      (iid) => `bowlers_${iid}`,
  roster:       (mid) => `roster_${mid}`,
  partnerships: (iid) => `partnerships_${iid}`,
  daySnapshots: (mid) => `day_snapshots_${mid}`,   // Test match day pauses
};

// ── ID generator ──────────────────────────────────────────────────────────────
export function generateId() {
  return `m_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

// ── Matches ───────────────────────────────────────────────────────────────────
export async function saveMatch(match) {
  const matches = await getMatches();
  const idx = matches.findIndex(m => m.id === match.id);
  if (idx >= 0) matches[idx] = { ...matches[idx], ...match };
  else matches.unshift(match);
  await AsyncStorage.setItem(KEY.matches(), JSON.stringify(matches));
  return match;
}

export async function getMatches() {
  try {
    const raw = await AsyncStorage.getItem(KEY.matches());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function getMatch(matchId) {
  const matches = await getMatches();
  return matches.find(m => m.id === matchId) || null;
}

export async function deleteMatch(matchId) {
  const matches = await getMatches();
  const filtered = matches.filter(m => m.id !== matchId);
  await AsyncStorage.setItem(KEY.matches(), JSON.stringify(filtered));

  const innings = await getInningsList(matchId);
  for (const inn of innings) {
    await AsyncStorage.removeItem(KEY.balls(inn.id));
    await AsyncStorage.removeItem(KEY.batsmen(inn.id));
    await AsyncStorage.removeItem(KEY.bowlers(inn.id));
    await AsyncStorage.removeItem(KEY.partnerships(inn.id));
  }
  await AsyncStorage.removeItem(KEY.innings(matchId));
  await AsyncStorage.removeItem(KEY.roster(matchId));
  await AsyncStorage.removeItem(KEY.daySnapshots(matchId));
}

// ── Innings ───────────────────────────────────────────────────────────────────
// innings object shape:
// {
//   id, match_id, innings_number (1-4),
//   batting_team_name, bowling_team_name,
//   status: 'active' | 'completed' | 'declared' | 'paused',
//   total_runs, total_wickets,
//   target (for 2nd innings of each team),
//   follow_on_enforced (boolean),
//   declared (boolean),
//   day_number (current day for test matches),
// }
export async function saveInnings(matchId, innings) {
  const all = await getInningsList(matchId);
  const idx = all.findIndex(i => i.id === innings.id);
  if (idx >= 0) all[idx] = innings;
  else all.push(innings);
  await AsyncStorage.setItem(KEY.innings(matchId), JSON.stringify(all));
  return innings;
}

export async function getInningsList(matchId) {
  try {
    const raw = await AsyncStorage.getItem(KEY.innings(matchId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function getInnings(matchId, inningsNumber) {
  const all = await getInningsList(matchId);
  return all.find(i => i.innings_number === inningsNumber) || null;
}

// ── Balls ─────────────────────────────────────────────────────────────────────
export async function saveBall(inningsId, ball) {
  const balls = await getBalls(inningsId);
  balls.push(ball);
  await AsyncStorage.setItem(KEY.balls(inningsId), JSON.stringify(balls));
  return ball;
}

export async function getBalls(inningsId) {
  try {
    const raw = await AsyncStorage.getItem(KEY.balls(inningsId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveBalls(inningsId, balls) {
  await AsyncStorage.setItem(KEY.balls(inningsId), JSON.stringify(balls));
}

export async function undoLastBall(inningsId) {
  const balls = await getBalls(inningsId);
  if (!balls.length) return null;
  const removed = balls.pop();
  await AsyncStorage.setItem(KEY.balls(inningsId), JSON.stringify(balls));
  return removed;
}

// ── Batsmen ───────────────────────────────────────────────────────────────────
export async function saveBatsmen(inningsId, batsmen) {
  await AsyncStorage.setItem(KEY.batsmen(inningsId), JSON.stringify(batsmen));
}

export async function getBatsmen(inningsId) {
  try {
    const raw = await AsyncStorage.getItem(KEY.batsmen(inningsId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Bowlers ───────────────────────────────────────────────────────────────────
export async function saveBowlers(inningsId, bowlers) {
  await AsyncStorage.setItem(KEY.bowlers(inningsId), JSON.stringify(bowlers));
}

export async function getBowlers(inningsId) {
  try {
    const raw = await AsyncStorage.getItem(KEY.bowlers(inningsId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Roster ────────────────────────────────────────────────────────────────────
export async function saveRoster(matchId, roster) {
  await AsyncStorage.setItem(KEY.roster(matchId), JSON.stringify(roster));
}

export async function getRoster(matchId) {
  try {
    const raw = await AsyncStorage.getItem(KEY.roster(matchId));
    if (!raw) return { a: [], b: [] };
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return {
        a: data.filter(p => p.team === 'a').map(p => p.name),
        b: data.filter(p => p.team === 'b').map(p => p.name),
      };
    }
    return data;
  } catch { return { a: [], b: [] }; }
}

// ── Partnerships ──────────────────────────────────────────────────────────────
export async function savePartnerships(inningsId, partnerships) {
  await AsyncStorage.setItem(KEY.partnerships(inningsId), JSON.stringify(partnerships));
}

export async function getPartnerships(inningsId) {
  try {
    const raw = await AsyncStorage.getItem(KEY.partnerships(inningsId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Day Snapshots (Test Match) ────────────────────────────────────────────────
// Saved when scorer taps "Stumps / End of Day"
// Shape: [{ day, innings_number, runs, wickets, overs, timestamp }]
export async function saveDaySnapshot(matchId, snapshot) {
  const all = await getDaySnapshots(matchId);
  all.push(snapshot);
  await AsyncStorage.setItem(KEY.daySnapshots(matchId), JSON.stringify(all));
}

export async function getDaySnapshots(matchId) {
  try {
    const raw = await AsyncStorage.getItem(KEY.daySnapshots(matchId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}