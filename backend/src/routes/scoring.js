const express = require('express');
const router = express.Router();
const db = require('../db');

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

function scoreBall({
  shotX, shotY, contactType, isLofted, batterSteppedOut,
  isStumped, fielderPositions, fieldDiameter, manualRuns, isBoundaryHit, isWide,
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

  // Manual Run Override (if user selected explicit 0, 1, 2, 3, 4, 6)
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

  // ── Stumped ──────────────────────────────────────────────────────────────
  if (isStumped) {
    return {
      runs: 0, result: 'Wicket', wicket_type: 'Stumped',
      fielder_caught: 'Wicket Keeper',
      reason: 'Stumped — batter stepped out and missed',
    };
  }

  // ── No contact / Miss ────────────────────────────────────────────────────
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

  // ── Pad ──────────────────────────────────────────────────────────────────
  if (contactType === 'pad') {
    return { runs: 0, result: 'Dot', wicket_type: null, fielder_caught: null, reason: 'Hit pad — dot ball' };
  }

  // ── Explicit Catch Behind / Catch & Bowled ────────────────────────────────
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

  // If no direction logged
  if (shotX == null || shotY == null) {
    if (contactType === 'edge' || contactType === 'leading_edge') {
      return { runs: 4, result: '4', wicket_type: null, fielder_caught: null, reason: 'Edge flies away for four' };
    }
    return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: 'Contact made — 1 run' };
  }

  // Vector & Boundary Check
  const shotFromCenter = dist(shotX, shotY, 50, 50);
  const shotAngle = getAngle(shotX, shotY);
  const isAtBoundary = isBoundaryHit || shotFromCenter >= 40;

  // Find nearest fielder
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

  // ── Edge / Leading Edge Calculation ──────────────────────────────────────
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

  // ── Lofted Shot Rules ───────────────────────────────────────────────────
  if (isLofted) {
    // Catch check (reaction radius <= 12 units)
    if (closestFielder && minFielderDist <= 12) {
      return {
        runs: 0, result: 'Wicket', wicket_type: 'Caught',
        fielder_caught: closestFielder.name,
        reason: `Lofted shot in fielder's reach — caught by ${closestFielder.name}!`,
      };
    }

    // A lofted shot to/over the boundary is ONLY a 6!
    if (isAtBoundary) {
      return { runs: 6, result: '6', wicket_type: null, fielder_caught: null, reason: 'Lofted arrow reached boundary line — SIX!' };
    }

    // Inside boundary: max 3, 2, 1 runs
    if (minFielderDist > 26) return { runs: 3, result: '3', wicket_type: null, fielder_caught: null, reason: 'Lofted into deep gap — 3 runs' };
    if (minFielderDist > 18) return { runs: 2, result: '2', wicket_type: null, fielder_caught: null, reason: 'Lofted into gap — 2 runs' };
    return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: 'Lofted into field — 1 run' };
  }

  // ── Ground Shot Rules ───────────────────────────────────────────────────
  // A ground shot to/beyond boundary is ONLY a 4!
  if (isAtBoundary) {
    return { runs: 4, result: '4', wicket_type: null, fielder_caught: null, reason: 'Ground shot arrow reached boundary line — FOUR!' };
  }

  // Intercepted by fielder
  if (fielderInPath) {
    const fDistFromBatter = dist(fielderInPath.x, fielderInPath.y, 50, 85);
    if (fDistFromBatter < 35 && minFielderDist <= 15) {
      return { runs: 0, result: 'Dot', wicket_type: null, fielder_caught: null, reason: `Driven straight to ${fielderInPath.name} — dot ball` };
    }
    if (minFielderDist <= 15) {
      return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: `Cut off by ${fielderInPath.name} — 1 run` };
    }
  }

  // Ground shot inside boundary
  if (minFielderDist > 24) return { runs: 3, result: '3', wicket_type: null, fielder_caught: null, reason: 'Placed into deep space — 3 runs' };
  if (minFielderDist > 14) return { runs: 2, result: '2', wicket_type: null, fielder_caught: null, reason: 'Pushed into gap — 2 runs' };
  return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: 'Fielded — 1 run' };
}

// POST /api/scoring/calculate
router.post('/calculate', async (req, res) => {
  try {
    const {
      session_id, ball_id, shotX, shotY, contactType,
      isLofted, batterSteppedOut, isStumped, manual_runs, is_boundary_hit,
    } = req.body;

    const fieldResult = await db.query(
      'SELECT * FROM field_settings WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1',
      [parseInt(session_id, 10)]
    );
    const field = fieldResult.rows[0];
    
    let positions = field?.positions || [];
    if (typeof positions === 'string') {
      try { positions = JSON.parse(positions); } catch { positions = []; }
    }
    const fieldDiameter = field?.field_diameter || 65;

    const result = scoreBall({
      shotX: shotX != null ? parseFloat(shotX) : null,
      shotY: shotY != null ? parseFloat(shotY) : null,
      contactType, isLofted, batterSteppedOut, isStumped,
      fielderPositions: positions, fieldDiameter,
      manualRuns: manual_runs != null ? parseInt(manual_runs, 10) : null,
      isBoundaryHit: !!is_boundary_hit,
      isWide: !!(req.body.isWide || req.body.is_wide),
    });

    if (ball_id) {
      await db.query(
        `UPDATE balls SET
          contact_x=$1, contact_y=$2, is_lofted=$3,
          wicket_type=$4, fielder_caught=$5, runs_scored=$6,
          batter_stepped_out=$7, is_stumped=$8
         WHERE id=$9`,
        [
          shotX != null ? parseFloat(shotX) : null,
          shotY != null ? parseFloat(shotY) : null,
          isLofted || false,
          result.wicket_type, result.fielder_caught, result.runs,
          batterSteppedOut || false, isStumped || false,
          ball_id,
        ]
      );
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/scoring/session/:sessionId
router.get('/session/:sessionId', async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    const [ballsResult, fieldResult] = await Promise.all([
      db.query('SELECT * FROM balls WHERE session_id=$1 ORDER BY ball_number ASC', [sessionId]),
      db.query('SELECT * FROM field_settings WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1', [sessionId]),
    ]);

    const field = fieldResult.rows[0];
    let positions = field?.positions || [];
    if (typeof positions === 'string') {
      try { positions = JSON.parse(positions); } catch { positions = []; }
    }
    const fieldDiameter = field?.field_diameter || 65;

    let totalRuns = 0;
    const ballScores = [];

    for (const ball of ballsResult.rows) {
      const scored = scoreBall({
        shotX: ball.contact_x != null ? parseFloat(ball.contact_x) : null,
        shotY: ball.contact_y != null ? parseFloat(ball.contact_y) : null,
        contactType: ball.contact_type,
        isLofted: ball.is_lofted,
        batterSteppedOut: ball.batter_stepped_out,
        isStumped: ball.is_stumped,
        fielderPositions: positions,
        fieldDiameter,
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
        runs: runs,
        result: ball.wicket_type ? 'Wicket' : String(runs),
        wicket_type: ball.wicket_type || scored.wicket_type,
        fielder_caught: ball.fielder_caught || scored.fielder_caught,
        reason: scored.reason,
      });
    }

    const balls = ballsResult.rows.length;
    res.json({
      success: true,
      data: {
        total_runs: totalRuns,
        total_balls: balls,
        run_rate: balls > 0 ? ((totalRuns / balls) * 6).toFixed(2) : '0.00',
        ball_scores: ballScores,
        boundaries: ballScores.filter(b => b.runs === 4).length,
        sixes: ballScores.filter(b => b.runs === 6).length,
        dot_balls: ballScores.filter(b => b.runs === 0 && !b.wicket_type).length,
        wickets: ballScores.filter(b => b.wicket_type).length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;