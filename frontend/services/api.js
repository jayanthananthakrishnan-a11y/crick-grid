import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Current WiFi IP — confirmed from ipconfig
const BASE_URL = 'http://10.0.243.66:3001/api';
export const SERVER_URL = 'http://10.0.243.66:3001';

// Fast 400ms timeout so offline mode activates instantly without screen lag
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 400,
  headers: { 'Content-Type': 'application/json' },
});

// Storage Keys for Local Offline Engine
const KEYS = {
  SESSIONS: '@crick_grid_net_sessions',
  BALLS: '@crick_grid_net_balls',
  FIELDS: '@crick_grid_net_fields',
  VIDEOS: '@crick_grid_net_videos',
  CLIPS: '@crick_grid_net_clips',
  REVIEWS: '@crick_grid_net_reviews',
};

// Default Fielder Positions for Scoring Calculations
const DEFAULT_FIELDERS = [
  { id: '1', name: 'Wicket Keeper', x: 50, y: 94 },
  { id: '2', name: 'Slip', x: 58, y: 90 },
  { id: '3', name: 'Gully', x: 68, y: 82 },
  { id: '4', name: 'Point', x: 80, y: 70 },
  { id: '5', name: 'Cover', x: 78, y: 50 },
  { id: '6', name: 'Mid Off', x: 60, y: 40 },
  { id: '7', name: 'Mid On', x: 40, y: 40 },
  { id: '8', name: 'Mid Wicket', x: 22, y: 52 },
  { id: '9', name: 'Square Leg', x: 20, y: 70 },
  { id: '10', name: 'Fine Leg', x: 32, y: 88 },
  { id: '11', name: 'Third Man', x: 68, y: 88 },
];

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function getAngle(shotX, shotY) {
  const dx = shotX - 50;
  const dy = 85 - shotY;
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

function fielderInCone(fielderX, fielderY, shotAngle, coneWidth = 18) {
  const fAngle = getAngle(fielderX, fielderY);
  let diff = Math.abs(fAngle - shotAngle);
  if (diff > 180) diff = 360 - diff;
  return diff < coneWidth;
}

// ── Pure JavaScript Scoring Algorithm (Matches Backend scoreBall) ───────────
function scoreBallLocal({
  shotX, shotY, contactType, isLofted, batterSteppedOut,
  isStumped, fielderPositions, manualRuns, isBoundaryHit, isWide,
}) {
  if (isWide) {
    const r = (manualRuns != null && !isNaN(manualRuns)) ? parseInt(manualRuns, 10) : 1;
    return {
      runs: r,
      result: 'Wide',
      wicket_type: null,
      fielder_caught: null,
      reason: `Wide ball — ${r} extra run${r !== 1 ? 's' : ''}`,
    };
  }

  // Manual Run Override (0, 1, 2, 3, 4, 6)
  if (manualRuns != null && !isNaN(manualRuns)) {
    const r = parseInt(manualRuns, 10);
    const resStr = r === 0 ? 'Dot' : String(r);
    return {
      runs: r,
      result: resStr,
      wicket_type: null,
      fielder_caught: null,
      reason: `Manual score override — ${r} run${r !== 1 ? 's' : ''}`,
    };
  }

  const fielders = fielderPositions?.length ? fielderPositions : DEFAULT_FIELDERS;

  if (isStumped) {
    return {
      runs: 0, result: 'Wicket', wicket_type: 'Stumped',
      fielder_caught: 'Wicket Keeper',
      reason: 'Stumped — batter stepped out and missed',
    };
  }

  if (!contactType || contactType === 'miss') {
    if (batterSteppedOut) {
      return {
        runs: 0, result: 'Wicket', wicket_type: 'Stumped',
        fielder_caught: 'Wicket Keeper',
        reason: 'Stepped out, missed — stumped by keeper',
      };
    }
    return { runs: 0, result: 'Dot', wicket_type: null, fielder_caught: null, reason: 'Dot ball — no contact' };
  }

  if (contactType === 'pad') {
    return { runs: 0, result: 'Dot', wicket_type: null, fielder_caught: null, reason: 'Hit pad — dot ball' };
  }

  if (contactType === 'caught_behind') {
    return {
      runs: 0, result: 'Wicket', wicket_type: 'Caught Behind',
      fielder_caught: 'Wicket Keeper',
      reason: 'Edged behind — caught by Wicket Keeper',
    };
  }
  if (contactType === 'caught_and_bowled') {
    return {
      runs: 0, result: 'Wicket', wicket_type: 'Caught & Bowled',
      fielder_caught: 'Bowler',
      reason: 'Popped up back to bowler — caught & bowled',
    };
  }

  if (shotX == null || shotY == null) {
    if (contactType === 'edge' || contactType === 'leading_edge') {
      return { runs: 4, result: '4', wicket_type: null, fielder_caught: null, reason: 'Edge flies away for four' };
    }
    return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: 'Contact made — 1 run' };
  }

  const shotFromCenter = dist(shotX, shotY, 50, 50);
  const shotAngle = getAngle(shotX, shotY);
  const isAtBoundary = isBoundaryHit || shotFromCenter >= 40;

  let minFielderDist = 999;
  let closestFielder = null;
  let fielderInPath = null;

  for (const f of fielders) {
    const d = dist(shotX, shotY, f.x, f.y);
    if (d < minFielderDist) {
      minFielderDist = d;
      closestFielder = f;
    }
    if (fielderInCone(f.x, f.y, shotAngle, 16)) {
      if (!fielderInPath || dist(f.x, f.y, 50, 85) < dist(fielderInPath.x, fielderInPath.y, 50, 85)) {
        fielderInPath = f;
      }
    }
  }

  if (contactType === 'edge' || contactType === 'leading_edge') {
    if (closestFielder && minFielderDist <= 14) {
      return {
        runs: 0, result: 'Wicket', wicket_type: 'Caught',
        fielder_caught: closestFielder.name,
        reason: `${contactType === 'leading_edge' ? 'Leading edge' : 'Edge'} — caught by ${closestFielder.name}`,
      };
    }
    if (isAtBoundary) {
      return { runs: 4, result: '4', wicket_type: null, fielder_caught: null, reason: 'Edge races to boundary — FOUR!' };
    }
    return { runs: 2, result: '2', wicket_type: null, fielder_caught: null, reason: 'Edge into the gap — 2 runs' };
  }

  if (isLofted) {
    if (closestFielder && minFielderDist <= 12) {
      return {
        runs: 0, result: 'Wicket', wicket_type: 'Caught',
        fielder_caught: closestFielder.name,
        reason: `Lofted shot in fielder's reach — caught by ${closestFielder.name}!`,
      };
    }
    if (isAtBoundary) {
      return { runs: 6, result: '6', wicket_type: null, fielder_caught: null, reason: 'Lofted arrow reached boundary line — SIX!' };
    }
    if (minFielderDist > 26) return { runs: 3, result: '3', wicket_type: null, fielder_caught: null, reason: 'Lofted into deep gap — 3 runs' };
    if (minFielderDist > 18) return { runs: 2, result: '2', wicket_type: null, fielder_caught: null, reason: 'Lofted into gap — 2 runs' };
    return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: 'Lofted into field — 1 run' };
  }

  if (isAtBoundary) {
    return { runs: 4, result: '4', wicket_type: null, fielder_caught: null, reason: 'Ground shot arrow reached boundary line — FOUR!' };
  }

  if (fielderInPath) {
    const fDistFromBatter = dist(fielderInPath.x, fielderInPath.y, 50, 85);
    if (fDistFromBatter < 35 && minFielderDist <= 15) {
      return { runs: 0, result: 'Dot', wicket_type: null, fielder_caught: null, reason: `Driven straight to ${fielderInPath.name} — dot ball` };
    }
    if (minFielderDist <= 15) {
      return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: `Cut off by ${fielderInPath.name} — 1 run` };
    }
  }

  if (minFielderDist > 24) return { runs: 3, result: '3', wicket_type: null, fielder_caught: null, reason: 'Placed into deep space — 3 runs' };
  if (minFielderDist > 14) return { runs: 2, result: '2', wicket_type: null, fielder_caught: null, reason: 'Pushed into gap — 2 runs' };
  return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: 'Fielded — 1 run' };
}

// Response helper
const makeRes = (data, message = 'Success') => ({
  data: { success: true, message, data },
});

// Storage Helper
async function getStorageItem(key, defaultVal = []) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (err) {
    return defaultVal;
  }
}

async function setStorageItem(key, val) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn(`[AsyncStorage Error] Writing ${key}:`, err);
  }
}

// Track server reachability to avoid repeated network timeouts
let isServerAvailable = false;
let lastCheckTime = 0;

async function checkServer() {
  const now = Date.now();
  if (now - lastCheckTime < 10000) return isServerAvailable;
  lastCheckTime = now;
  try {
    await axios.get(`${BASE_URL}/sessions`, { timeout: 300 });
    isServerAvailable = true;
  } catch {
    isServerAvailable = false;
  }
  return isServerAvailable;
}

// Universal API wrapper: Uses 100% local AsyncStorage in production builds (!__DEV__)
async function tryApi(httpFn, offlineFn) {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    // Standalone Play Store production build: 100% local device storage
    return await offlineFn();
  }
  const serverUp = await checkServer();
  if (serverUp) {
    try {
      return await httpFn();
    } catch {
      isServerAvailable = false;
    }
  }
  return await offlineFn();
}

// Format session object with all required properties
function formatSession(s, allBalls = []) {
  const sessionBalls = allBalls.filter((b) => String(b.session_id) === String(s.id));
  const bName = s.bowler_name || s.bowlerName || 'Bowler';
  const batName = s.batsman_name || s.batter_name || s.batsmanName || 'Batter';
  const name = s.session_name || s.sessionName || `${bName} vs ${batName}`;

  return {
    id: s.id,
    session_name: name,
    bowler_name: bName,
    batsman_name: batName,
    batter_name: batName,
    bowler_handedness: s.bowler_handedness || 'right',
    batter_handedness: s.batter_handedness || s.batterHandedness || 'right',
    venue: s.venue || 'Nets Ground',
    notes: s.notes || '',
    pitch_length_m: s.pitch_length_m || 20.12,
    date: s.date || s.created_at || new Date().toISOString().split('T')[0],
    created_at: s.created_at || s.date || new Date().toISOString(),
    total_balls: sessionBalls.length,
  };
}

// ── SESSIONS API ─────────────────────────────────────────────────────────────
export const getSessions = () =>
  tryApi(
    () => api.get('/sessions'),
    async () => {
      const list = await getStorageItem(KEYS.SESSIONS);
      const balls = await getStorageItem(KEYS.BALLS);
      const formatted = list.map((s) => formatSession(s, balls));
      formatted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return makeRes(formatted);
    }
  );

export const getSession = (id) =>
  tryApi(
    () => api.get(`/sessions/${id}`),
    async () => {
      const list = await getStorageItem(KEYS.SESSIONS);
      const balls = await getStorageItem(KEYS.BALLS);
      const s = list.find((item) => String(item.id) === String(id));
      return makeRes(s ? formatSession(s, balls) : null);
    }
  );

export const createSession = (data) =>
  tryApi(
    () => api.post('/sessions', data),
    async () => {
      const list = await getStorageItem(KEYS.SESSIONS);
      const balls = await getStorageItem(KEYS.BALLS);
      const bName = data.bowler_name || 'Bowler';
      const batName = data.batsman_name || data.batter_name || 'Batter';
      const sName = data.session_name || `${bName} vs ${batName}`;

      const rawSession = {
        id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        session_name: sName,
        bowler_name: bName,
        batsman_name: batName,
        batter_name: batName,
        bowler_handedness: data.bowler_handedness || 'right',
        batter_handedness: data.batter_handedness || 'right',
        venue: data.venue || 'Nets Ground',
        notes: data.notes || '',
        pitch_length_m: data.pitch_length_m || 20.12,
        date: data.date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      };

      list.unshift(rawSession);
      await setStorageItem(KEYS.SESSIONS, list);
      return makeRes(formatSession(rawSession, balls));
    }
  );

export const updateSession = (id, data) =>
  tryApi(
    () => api.put(`/sessions/${id}`, data),
    async () => {
      let list = await getStorageItem(KEYS.SESSIONS);
      const balls = await getStorageItem(KEYS.BALLS);
      let updated = null;
      list = list.map((s) => {
        if (String(s.id) === String(id)) {
          updated = { ...s, ...data };
          return updated;
        }
        return s;
      });
      await setStorageItem(KEYS.SESSIONS, list);
      return makeRes(updated ? formatSession(updated, balls) : null);
    }
  );

export const deleteSession = (id) =>
  tryApi(
    () => api.delete(`/sessions/${id}`),
    async () => {
      let list = await getStorageItem(KEYS.SESSIONS);
      list = list.filter((s) => String(s.id) !== String(id));
      await setStorageItem(KEYS.SESSIONS, list);

      let balls = await getStorageItem(KEYS.BALLS);
      balls = balls.filter((b) => String(b.session_id) !== String(id));
      await setStorageItem(KEYS.BALLS, balls);

      let fields = await getStorageItem(KEYS.FIELDS);
      fields = fields.filter((f) => String(f.session_id) !== String(id));
      await setStorageItem(KEYS.FIELDS, fields);

      return makeRes(null, 'Session deleted');
    }
  );

// ── BALLS API ────────────────────────────────────────────────────────────────
export const getBallsForSession = (sessionId) =>
  tryApi(
    () => api.get(`/balls/session/${sessionId}`),
    async () => {
      const balls = await getStorageItem(KEYS.BALLS);
      const filtered = balls.filter((b) => String(b.session_id) === String(sessionId));
      filtered.sort((a, b) => Number(a.ball_number || 0) - Number(b.ball_number || 0));
      return makeRes(filtered);
    }
  );

export const logBall = (data) =>
  tryApi(
    () => api.post('/balls', data),
    async () => {
      const balls = await getStorageItem(KEYS.BALLS);
      const fields = await getStorageItem(KEYS.FIELDS);
      const sessionField = fields.find((f) => String(f.session_id) === String(data.session_id));

      const scored = scoreBallLocal({
        shotX: data.contact_x ?? data.shot_x ?? null,
        shotY: data.contact_y ?? data.shot_y ?? null,
        contactType: data.contact_type,
        isLofted: !!data.is_lofted,
        batterSteppedOut: !!data.batter_stepped_out,
        isStumped: !!data.is_stumped,
        fielderPositions: sessionField?.positions || DEFAULT_FIELDERS,
        manualRuns: data.manual_runs != null ? parseInt(data.manual_runs, 10) : null,
        isBoundaryHit: !!data.is_boundary_hit,
        isWide: !!data.is_wide,
      });

      const runs = scored.runs;

      const newBall = {
        id: `b_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        session_id: data.session_id,
        ball_number: data.ball_number || balls.filter((b) => String(b.session_id) === String(data.session_id)).length + 1,
        length_type: data.length_type || null,
        line_type: data.line_type || null,
        delivery_type: data.delivery_type || null,
        contact_type: data.contact_type || null,
        shot_type: data.shot_type || null,
        pitch_x: data.pitch_x ?? null,
        pitch_y: data.pitch_y ?? null,
        contact_x: data.contact_x ?? data.shot_x ?? null,
        contact_y: data.contact_y ?? data.shot_y ?? null,
        is_lofted: !!data.is_lofted,
        is_wide: !!data.is_wide,
        is_no_ball: !!data.is_no_ball,
        batter_stepped_out: !!data.batter_stepped_out,
        is_stumped: !!data.is_stumped,
        runs_scored: runs,
        run_outcome: runs,
        is_wicket: !!(data.is_wicket || scored.wicket_type),
        wicket_type: data.wicket_type || scored.wicket_type || null,
        fielder_caught: scored.fielder_caught || null,
        created_at: new Date().toISOString(),
      };

      balls.push(newBall);
      await setStorageItem(KEYS.BALLS, balls);
      return makeRes(newBall);
    }
  );

export const updateBall = (id, data) =>
  tryApi(
    () => api.put(`/balls/${id}`, data),
    async () => {
      let balls = await getStorageItem(KEYS.BALLS);
      let updated = null;
      balls = balls.map((b) => {
        if (String(b.id) === String(id)) {
          updated = { ...b, ...data };
          return updated;
        }
        return b;
      });
      await setStorageItem(KEYS.BALLS, balls);
      return makeRes(updated);
    }
  );

export const deleteBall = (id) =>
  tryApi(
    () => api.delete(`/balls/${id}`),
    async () => {
      let balls = await getStorageItem(KEYS.BALLS);
      balls = balls.filter((b) => String(b.id) !== String(id));
      await setStorageItem(KEYS.BALLS, balls);
      return makeRes(null, 'Ball deleted');
    }
  );

// ── ANALYTICS API ────────────────────────────────────────────────────────────
export const getAnalytics = (sessionId) =>
  tryApi(
    () => api.get(`/analytics/session/${sessionId}`),
    async () => {
      const list = await getStorageItem(KEYS.SESSIONS);
      const balls = await getStorageItem(KEYS.BALLS);
      const sessionObj = list.find((s) => String(s.id) === String(sessionId)) || { id: sessionId };
      const formattedSession = formatSession(sessionObj, balls);

      const sessionBalls = balls.filter((b) => String(b.session_id) === String(sessionId));
      sessionBalls.sort((a, b) => Number(a.ball_number || 0) - Number(b.ball_number || 0));

      const lengthCounts = {};
      const lineCounts = {};
      const deliveryCounts = {};
      const contactCounts = {};
      const shotCounts = {};

      const pitchMap = [];
      const contactMap = [];
      let wides = 0, noBalls = 0;

      sessionBalls.forEach((b) => {
        if (b.length_type) lengthCounts[b.length_type] = (lengthCounts[b.length_type] || 0) + 1;
        if (b.line_type) lineCounts[b.line_type] = (lineCounts[b.line_type] || 0) + 1;
        if (b.delivery_type) deliveryCounts[b.delivery_type] = (deliveryCounts[b.delivery_type] || 0) + 1;

        if (b.pitch_x != null && b.pitch_y != null) {
          pitchMap.push({
            x: parseFloat(b.pitch_x),
            y: parseFloat(b.pitch_y),
            ball_number: b.ball_number,
            length_type: b.length_type,
          });
        }

        // Exclude wide balls from batter contact/shot statistics
        if (!b.is_wide) {
          if (b.contact_type) contactCounts[b.contact_type] = (contactCounts[b.contact_type] || 0) + 1;
          if (b.shot_type) shotCounts[b.shot_type] = (shotCounts[b.shot_type] || 0) + 1;

          if (b.contact_x != null && b.contact_y != null) {
            contactMap.push({
              x: parseFloat(b.contact_x),
              y: parseFloat(b.contact_y),
              contact_x: parseFloat(b.contact_x),
              contact_y: parseFloat(b.contact_y),
              ball_number: b.ball_number,
              runs: typeof b.runs_scored === 'number' ? b.runs_scored : 0,
              contact_type: b.contact_type,
              shot_type: b.shot_type,
            });
          }
        }

        if (b.is_wide) wides++;
        if (b.is_no_ball) noBalls++;
      });

      const total = sessionBalls.length;
      const batterBalls = total - wides;

      const analyticsData = {
        session: formattedSession,
        total_balls: total,
        bowler: {
          length_distribution: lengthCounts,
          line_distribution: lineCounts,
          delivery_distribution: deliveryCounts,
          avg_swing_degree: null,
          avg_turn_degree: null,
          avg_turn_into_batter: null,
          avg_turn_away_from_batter: null,
          pitch_map: pitchMap,
        },
        batsman: {
          contact_distribution: contactCounts,
          shot_distribution: shotCounts,
          contact_map: contactMap,
          wides,
          no_balls: noBalls,
          middle_percentage: batterBalls > 0 ? (((contactCounts['middle'] || 0) / batterBalls) * 100).toFixed(1) : '0.0',
          edge_percentage: batterBalls > 0 ? (((contactCounts['edge'] || 0) / batterBalls) * 100).toFixed(1) : '0.0',
          miss_percentage: batterBalls > 0 ? (((contactCounts['miss'] || 0) / batterBalls) * 100).toFixed(1) : '0.0',
        },
      };

      return makeRes(analyticsData);
    }
  );

// ── FIELDS API ───────────────────────────────────────────────────────────────
export const getField = (sessionId) =>
  tryApi(
    () => api.get(`/fields/session/${sessionId}`),
    async () => {
      const fields = await getStorageItem(KEYS.FIELDS);
      const field = fields.find((f) => String(f.session_id) === String(sessionId));
      return makeRes(field || null);
    }
  );

export const saveField = (data) =>
  tryApi(
    () => api.post('/fields', data),
    async () => {
      let fields = await getStorageItem(KEYS.FIELDS);
      const existingIdx = fields.findIndex((f) => String(f.session_id) === String(data.session_id));
      const fieldObj = {
        id: existingIdx >= 0 ? fields[existingIdx].id : `f_${Date.now()}`,
        session_id: data.session_id,
        positions: data.positions,
        field_diameter: data.field_diameter || 65,
        updated_at: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        fields[existingIdx] = fieldObj;
      } else {
        fields.push(fieldObj);
      }
      await setStorageItem(KEYS.FIELDS, fields);
      return makeRes(fieldObj);
    }
  );

// ── SCORING API ──────────────────────────────────────────────────────────────
export const calculateScore = (data) =>
  tryApi(
    () => api.post('/scoring/calculate', data),
    async () => {
      const fields = await getStorageItem(KEYS.FIELDS);
      const sessionField = fields.find((f) => String(f.session_id) === String(data.session_id));

      const result = scoreBallLocal({
        shotX: data.shotX != null ? parseFloat(data.shotX) : null,
        shotY: data.shotY != null ? parseFloat(data.shotY) : null,
        contactType: data.contactType,
        isLofted: data.isLofted,
        batterSteppedOut: data.batterSteppedOut,
        isStumped: data.isStumped,
        fielderPositions: sessionField?.positions || DEFAULT_FIELDERS,
        manualRuns: data.manual_runs != null ? parseInt(data.manual_runs, 10) : null,
        isBoundaryHit: !!data.is_boundary_hit,
        isWide: !!(data.isWide || data.is_wide),
      });

      if (data.ball_id) {
        let balls = await getStorageItem(KEYS.BALLS);
        balls = balls.map((b) => {
          if (String(b.id) === String(data.ball_id)) {
            return {
              ...b,
              runs_scored: result.runs,
              run_outcome: result.runs,
              is_wicket: !!(b.is_wicket || result.wicket_type),
              wicket_type: b.wicket_type || result.wicket_type || null,
              fielder_caught: result.fielder_caught || null,
            };
          }
          return b;
        });
        await setStorageItem(KEYS.BALLS, balls);
      }

      return makeRes(result);
    }
  );

export const getSessionScoring = (sessionId) =>
  tryApi(
    () => api.get(`/scoring/session/${sessionId}`),
    async () => {
      const balls = await getStorageItem(KEYS.BALLS);
      const fields = await getStorageItem(KEYS.FIELDS);
      const sessionField = fields.find((f) => String(f.session_id) === String(sessionId));
      const sessionBalls = balls.filter((b) => String(b.session_id) === String(sessionId));
      sessionBalls.sort((a, b) => Number(a.ball_number || 0) - Number(b.ball_number || 0));

      let totalRuns = 0;
      const ballScores = [];

      sessionBalls.forEach((ball) => {
        const scored = scoreBallLocal({
          shotX: ball.contact_x != null ? parseFloat(ball.contact_x) : null,
          shotY: ball.contact_y != null ? parseFloat(ball.contact_y) : null,
          contactType: ball.contact_type,
          isLofted: ball.is_lofted,
          batterSteppedOut: ball.batter_stepped_out,
          isStumped: ball.is_stumped,
          fielderPositions: sessionField?.positions || DEFAULT_FIELDERS,
          manualRuns: typeof ball.runs_scored === 'number' ? ball.runs_scored : null,
          isWide: !!ball.is_wide,
        });

        const runs = typeof ball.runs_scored === 'number' ? ball.runs_scored : scored.runs;
        totalRuns += runs;

        ballScores.push({
          id: ball.id,
          ball_number: ball.ball_number,
          length_type: ball.length_type,
          line_type: ball.line_type,
          delivery_type: ball.delivery_type,
          shot_type: ball.shot_type,
          contact_type: ball.contact_type,
          contact_x: ball.contact_x != null ? parseFloat(ball.contact_x) : null,
          contact_y: ball.contact_y != null ? parseFloat(ball.contact_y) : null,
          pitch_x: ball.pitch_x != null ? parseFloat(ball.pitch_x) : null,
          pitch_y: ball.pitch_y != null ? parseFloat(ball.pitch_y) : null,
          is_lofted: ball.is_lofted,
          is_wide: ball.is_wide,
          is_no_ball: ball.is_no_ball,
          batter_stepped_out: ball.batter_stepped_out,
          is_stumped: ball.is_stumped,
          runs,
          result: ball.wicket_type ? 'Wicket' : String(runs),
          wicket_type: ball.wicket_type || scored.wicket_type,
          fielder_caught: ball.fielder_caught || scored.fielder_caught,
          reason: scored.reason,
        });
      });

      const total = sessionBalls.length;

      return makeRes({
        total_runs: totalRuns,
        total_balls: total,
        run_rate: total > 0 ? ((totalRuns / total) * 6).toFixed(2) : '0.00',
        ball_scores: ballScores,
        boundaries: ballScores.filter((b) => b.runs === 4).length,
        sixes: ballScores.filter((b) => b.runs === 6).length,
        dot_balls: ballScores.filter((b) => b.runs === 0 && !b.wicket_type).length,
        wickets: ballScores.filter((b) => b.wicket_type).length,
      });
    }
  );

// ── VIDEOS / CLIPS / REVIEWS ────────────────────────────────────────────────
export const uploadVideo = (formData, onProgress) =>
  axios.post(`${BASE_URL}/videos/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
    onUploadProgress: onProgress,
  });

export const getVideosForSession = (sessionId) =>
  tryApi(
    () => api.get(`/videos/session/${sessionId}`),
    async () => makeRes([])
  );

export const deleteVideo = (id) =>
  tryApi(
    () => api.delete(`/videos/${id}`),
    async () => makeRes(null, 'Deleted')
  );

export const saveClip = (data) =>
  tryApi(
    () => api.post('/clips', data),
    async () => makeRes({ id: `clip_${Date.now()}`, ...data })
  );

export const getClipsForVideo = (videoId) =>
  tryApi(
    () => api.get(`/clips/video/${videoId}`),
    async () => makeRes([])
  );

export const getClipForBall = (ballId) =>
  tryApi(
    () => api.get(`/clips/ball/${ballId}`),
    async () => makeRes(null)
  );

export const deleteClip = (id) =>
  tryApi(
    () => api.delete(`/clips/${id}`),
    async () => makeRes(null, 'Deleted')
  );

export const submitLBWReview = (data) =>
  tryApi(
    () => api.post('/reviews', data),
    async () => makeRes({ id: `rev_${Date.now()}`, ...data, decision: 'NOT OUT' })
  );

export const getReviewsForSession = (sessionId) =>
  tryApi(
    () => api.get(`/reviews/session/${sessionId}`),
    async () => makeRes([])
  );

export default api;