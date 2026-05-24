const express = require('express');
const router = express.Router();
const db = require('../db');

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Get angle in degrees from batter (50,85) to shot landing
function getAngle(shotX, shotY) {
  const dx = shotX - 50;
  const dy = 85 - shotY;
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

// Check if a fielder is within the cone of the shot direction
function fielderInCone(fielderX, fielderY, shotAngle, coneWidth = 18) {
  const fAngle = getAngle(fielderX, fielderY);
  let diff = Math.abs(fAngle - shotAngle);
  if (diff > 180) diff = 360 - diff;
  return diff < coneWidth;
}

function scoreBall({
  shotX, shotY, contactType, isLofted, batterSteppedOut,
  isStumped, fielderPositions, fieldDiameter,
}) {
  const fd = fieldDiameter || 65;

  // Stumped
  if (isStumped) {
    return {
      runs: 0,
      result: 'Wicket',
      wicket_type: 'Stumped',
      fielder_caught: 'Keeper',
      reason: 'Stumped — batter stepped out and missed',
    };
  }

  // No contact
  if (!contactType || contactType === 'miss') {
    if (batterSteppedOut) {
      return {
        runs: 0,
        result: 'Wicket',
        wicket_type: 'Stumped',
        fielder_caught: 'Keeper',
        reason: 'Stepped out, missed — stumped',
      };
    }
    return { runs: 0, result: 'Dot', wicket_type: null, fielder_caught: null, reason: 'Dot ball — no contact' };
  }

  // Pad — LBW possible but we score as dot
  if (contactType === 'pad') {
    return { runs: 0, result: 'Dot', wicket_type: null, fielder_caught: null, reason: 'Hit pad' };
  }

  // Edge
  if (contactType === 'edge' || contactType === 'leading_edge') {
    const keeperPos = fielderPositions?.find(f => f.name === 'Keeper');
    const slipPos = fielderPositions?.find(f => f.name === 'Slip');
    const fielder = contactType === 'leading_edge'
      ? (fielderPositions?.find(f => ['Cover', 'Mid-off', 'Point'].includes(f.name)))
      : (keeperPos || slipPos);
    if (fielder) {
      return {
        runs: 0,
        result: 'Wicket',
        wicket_type: contactType === 'leading_edge' ? 'Caught' : 'Caught behind',
        fielder_caught: fielder.name,
        reason: `${contactType === 'leading_edge' ? 'Leading edge' : 'Edge'} — caught by ${fielder.name}`,
      };
    }
    return { runs: 4, result: '4', wicket_type: null, fielder_caught: null, reason: 'Edge races to boundary' };
  }

  if (shotX == null || shotY == null) {
    return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: 'Contact but no direction' };
  }

  const shotAngle = getAngle(shotX, shotY);
  const fromCentre = dist(shotX, shotY, 50, 50);

  // Check fielders in shot path
  let fielderInPath = null;
  for (const f of (fielderPositions || [])) {
    if (fielderInCone(f.x, f.y, shotAngle, 16)) {
      fielderInPath = f;
      break;
    }
  }

  // LOFTED BALL LOGIC
  if (isLofted) {
    // Check if ball carries to boundary height
    const carriesBoundary = fromCentre > 38;

    if (fielderInPath) {
      // Fielder in path — catch attempt
      // If fielder is inside circle (< 30 units from centre) and ball is lofted high = catch
      const fielderDist = dist(fielderInPath.x, fielderInPath.y, 50, 50);
      if (fielderDist < 30 && fromCentre > 25) {
        // Fielder inside circle — only catches if ball is hit hard enough to reach them
        return {
          runs: 0,
          result: 'Wicket',
          wicket_type: 'Caught',
          fielder_caught: fielderInPath.name,
          reason: `Lofted — caught by ${fielderInPath.name}`,
        };
      }
      if (fielderDist >= 30) {
        // Outfield catch
        return {
          runs: 0,
          result: 'Wicket',
          wicket_type: 'Caught',
          fielder_caught: fielderInPath.name,
          reason: `Lofted to outfield — caught by ${fielderInPath.name}`,
        };
      }
    }

    // No fielder in path
    if (carriesBoundary) {
      return { runs: 6, result: '6', wicket_type: null, fielder_caught: null, reason: 'Lofted over boundary — six!' };
    }
    if (fromCentre > 28) {
      return { runs: 4, result: '4', wicket_type: null, fielder_caught: null, reason: 'Lofted, lands in gap — four!' };
    }
    return { runs: 2, result: '2', wicket_type: null, fielder_caught: null, reason: 'Lofted into gap — 2 runs' };
  }

  // GROUND SHOT LOGIC
  if (fromCentre > 44) {
    return { runs: 4, result: '4', wicket_type: null, fielder_caught: null, reason: 'Races to boundary!' };
  }

  if (fielderInPath) {
    const fielderDist = dist(fielderInPath.x, fielderInPath.y, 50, 50);
    const distMetres = (fromCentre / 50) * (fd / 2);
    if (fielderDist < 28) {
      return { runs: 0, result: 'Dot', wicket_type: null, fielder_caught: null, reason: `Fielded by ${fielderInPath.name}` };
    }
    return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: `Cut off by ${fielderInPath.name}` };
  }

  // Gap
  const distMetres = (fromCentre / 50) * (fd / 2);
  if (distMetres > 30) return { runs: 4, result: '4', wicket_type: null, fielder_caught: null, reason: 'Through the gap — four!' };
  if (distMetres > 22) return { runs: 3, result: '3', wicket_type: null, fielder_caught: null, reason: 'Good running — 3' };
  if (distMetres > 14) return { runs: 2, result: '2', wicket_type: null, fielder_caught: null, reason: 'Into the gap — 2' };
  return { runs: 1, result: '1', wicket_type: null, fielder_caught: null, reason: 'Fielded — 1 run' };
}

// POST /api/scoring/calculate
router.post('/calculate', async (req, res) => {
  try {
    const {
      session_id, ball_id, shotX, shotY, contactType,
      isLofted, batterSteppedOut, isStumped,
    } = req.body;

    const fieldResult = await db.query(
      'SELECT * FROM field_settings WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1',
      [session_id]
    );
    const field = fieldResult.rows[0];
    const positions = field?.positions || [];
    const fieldDiameter = field?.field_diameter || 65;

    const result = scoreBall({
      shotX, shotY, contactType, isLofted, batterSteppedOut,
      isStumped, fielderPositions: positions, fieldDiameter,
    });

    if (ball_id) {
      await db.query(
        `UPDATE balls SET
          contact_x=$1, contact_y=$2, is_lofted=$3,
          wicket_type=$4, fielder_caught=$5, runs_scored=$6,
          batter_stepped_out=$7, is_stumped=$8
         WHERE id=$9`,
        [
          shotX, shotY, isLofted || false,
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
    const [ballsResult, fieldResult] = await Promise.all([
      db.query('SELECT * FROM balls WHERE session_id=$1 ORDER BY ball_number', [req.params.sessionId]),
      db.query('SELECT * FROM field_settings WHERE session_id=$1 ORDER BY created_at DESC LIMIT 1', [req.params.sessionId]),
    ]);

    const field = fieldResult.rows[0];
    const positions = field?.positions || [];
    const fieldDiameter = field?.field_diameter || 65;

    let totalRuns = 0;
    const ballScores = [];

    for (const ball of ballsResult.rows) {
      const scored = scoreBall({
        shotX: ball.contact_x ? parseFloat(ball.contact_x) : null,
        shotY: ball.contact_y ? parseFloat(ball.contact_y) : null,
        contactType: ball.contact_type,
        isLofted: ball.is_lofted,
        batterSteppedOut: ball.batter_stepped_out,
        isStumped: ball.is_stumped,
        fielderPositions: positions,
        fieldDiameter,
      });
      totalRuns += scored.runs;
      ballScores.push({
        ball_number: ball.ball_number,
        length_type: ball.length_type,
        line_type: ball.line_type,
        delivery_type: ball.delivery_type,
        shot_type: ball.shot_type,
        contact_type: ball.contact_type,
        is_lofted: ball.is_lofted,
        is_wide: ball.is_wide,
        is_no_ball: ball.is_no_ball,
        batter_stepped_out: ball.batter_stepped_out,
        is_stumped: ball.is_stumped,
        ...scored,
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