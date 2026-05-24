const express = require('express');
const router = express.Router();
const db = require('../db');

const STUMP = { leg: 40, middle: 50, off: 60, legLine: 35, offLine: 65 };

function calcLBWVerdict({ pitchX, pitchY, impactX, impactY, impactHeightPct, batterHandedness = 'right' }) {
  const reasons = [];

  const outsideLeg = batterHandedness === 'right' ? pitchX < STUMP.legLine : pitchX > (100 - STUMP.legLine);
  if (outsideLeg) {
    return {
      verdict: 'NOT_OUT',
      verdict_reason: 'Pitched outside leg stump',
      pitched_in_line: false,
      pitched_outside_leg: true,
      impact_in_line: false,
      hitting_stumps: false,
      hitting_zone: 'missing',
      projected_path: [],
      projected_stump_x: null,
    };
  }

  const pitchedInLine = pitchX >= STUMP.legLine && pitchX <= STUMP.offLine;
  const impactInLine = impactX >= STUMP.legLine && impactX <= STUMP.offLine;

  let verdict = 'OUT';
  if (!impactInLine) { verdict = 'NOT_OUT'; reasons.push('Impact outside off stump line'); }
  if (impactHeightPct > 105) { verdict = 'NOT_OUT'; reasons.push('Impact too high — above bails'); }

  const dx = impactX - pitchX;
  const dy = impactY - pitchY;
  const stumpY = 100;
  const t = dy !== 0 ? (stumpY - pitchY) / dy : 0;
  const projectedStumpX = pitchX + t * dx;
  const heightAtStumps = impactHeightPct * ((stumpY - pitchY) / Math.max(impactY - pitchY, 1));

  const hittingStumps = projectedStumpX >= STUMP.legLine && projectedStumpX <= STUMP.offLine && heightAtStumps <= 105;

  const projectedPath = [];
  for (let i = 0; i <= 10; i++) {
    const st = i / 10;
    projectedPath.push({
      x: pitchX + st * (projectedStumpX - pitchX) * 1.1,
      y: pitchY + st * (stumpY - pitchY),
    });
  }

  let hittingZone = 'missing';
  if (hittingStumps) {
    const marginX = Math.min(Math.abs(projectedStumpX - STUMP.legLine), Math.abs(projectedStumpX - STUMP.offLine));
    hittingZone = (marginX < 3 || heightAtStumps > 95) ? 'umpires_call' : 'full';
    if (hittingZone === 'umpires_call' && verdict === 'OUT') {
      verdict = 'UMPIRES_CALL';
      reasons.push("Umpire's call — clipping stumps");
    }
  } else if (verdict === 'OUT') {
    verdict = 'NOT_OUT';
    reasons.push('Ball missing stumps');
  }

  if (verdict === 'OUT' && reasons.length === 0) reasons.push('Pitched in line, impact in line, hitting stumps');

  return {
    verdict, verdict_reason: reasons.join('. ') || 'OUT',
    pitched_in_line: pitchedInLine, pitched_outside_leg: false,
    impact_in_line: impactInLine, hitting_stumps: hittingStumps,
    hitting_zone: hittingZone, projected_path: projectedPath,
    projected_stump_x: projectedStumpX,
  };
}

function calcWideVerdict({ impactX, batterMovedX = 50 }) {
  const shift = batterMovedX - 50;
  const legLine = 25 + shift * 0.5;
  const offLine = 75 + shift * 0.5;
  if (impactX < legLine) return { verdict: 'WIDE', reason: 'Outside leg tramline' };
  if (impactX > offLine) return { verdict: 'WIDE', reason: 'Outside off tramline' };
  if (impactX < legLine + 3 || impactX > offLine - 3) return { verdict: 'UMPIRES_CALL', reason: "On the tramline" };
  return { verdict: 'NOT_WIDE', reason: 'Within tramlines' };
}

function calcHeightNoBall({ impactHeightPct, isFullToss }) {
  if (!isFullToss) return { verdict: 'FAIR_DELIVERY', reason: 'Not a full toss' };
  if (impactHeightPct > 150) return { verdict: 'NO_BALL', reason: 'Full toss above hip height' };
  if (impactHeightPct > 130) return { verdict: 'UMPIRES_CALL', reason: "Borderline hip height" };
  return { verdict: 'FAIR_DELIVERY', reason: 'Full toss below hip height' };
}

router.post('/', async (req, res) => {
  const {
    ball_id, session_id,
    pitchX, pitchY, impactX, impactY, impactHeightPct,
    batterHandedness, isWideReview, batterMovedX, isFullToss,
  } = req.body;

  try {
    const lbw = calcLBWVerdict({ pitchX, pitchY, impactX, impactY, impactHeightPct, batterHandedness });
    const wide = isWideReview ? calcWideVerdict({ impactX, batterMovedX }) : null;
    const heightNoBall = isFullToss ? calcHeightNoBall({ impactHeightPct, isFullToss }) : null;

    const result = await db.query(
      `INSERT INTO lbw_reviews (
        ball_id, session_id, pitch_x, pitch_y, pitched_in_line, pitched_outside_leg,
        impact_x, impact_y, impact_in_line, impact_height,
        hitting_stumps, hitting_zone, projected_path, verdict, verdict_reason,
        is_wide_review, wide_verdict, is_height_no_ball, no_ball_verdict
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        ball_id || null, session_id,
        pitchX, pitchY, lbw.pitched_in_line, lbw.pitched_outside_leg,
        impactX, impactY, lbw.impact_in_line, impactHeightPct,
        lbw.hitting_stumps, lbw.hitting_zone, JSON.stringify(lbw.projected_path),
        lbw.verdict, lbw.verdict_reason,
        isWideReview || false, wide?.verdict || null,
        isFullToss || false, heightNoBall?.verdict || null,
      ]
    );

    res.status(201).json({ success: true, data: { ...result.rows[0], lbw, wide, height_no_ball: heightNoBall } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/session/:sessionId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, b.ball_number FROM lbw_reviews r
       LEFT JOIN balls b ON b.id = r.ball_id
       WHERE r.session_id=$1 ORDER BY r.reviewed_at DESC`,
      [req.params.sessionId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;