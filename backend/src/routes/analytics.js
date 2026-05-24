const express = require('express');
const router = express.Router();
const db = require('../db');

// Full analytics for a session
router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const [session, balls] = await Promise.all([
      db.query('SELECT * FROM sessions WHERE id=$1', [sessionId]),
      db.query('SELECT * FROM balls WHERE session_id=$1 ORDER BY ball_number', [sessionId])
    ]);

    if (session.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const ballData = balls.rows;
    const total = ballData.length;

    // --- Bowler analytics ---
    const lengthCounts = {};
    const lineCounts = {};
    const deliveryCounts = {};
    let totalSwing = 0, swingCount = 0;
    let totalTurn = 0, turnCount = 0;
    let totalTurnIn = 0, turnInCount = 0;
    let totalTurnAway = 0, turnAwayCount = 0;
    const pitchMap = [];

    // --- Batsman analytics ---
    const contactCounts = {};
    const shotCounts = {};
    const contactMap = [];
    let wides = 0, noBalls = 0;

    ballData.forEach(b => {
      // Length
      if (b.length_type) lengthCounts[b.length_type] = (lengthCounts[b.length_type] || 0) + 1;
      // Line
      if (b.line_type) lineCounts[b.line_type] = (lineCounts[b.line_type] || 0) + 1;
      // Delivery
      if (b.delivery_type) deliveryCounts[b.delivery_type] = (deliveryCounts[b.delivery_type] || 0) + 1;

      // Swing
      if (b.swing_degree != null) { totalSwing += parseFloat(b.swing_degree); swingCount++; }

      // Turn
      if (b.turn_degree != null) {
        const t = parseFloat(b.turn_degree);
        totalTurn += t; turnCount++;
        if (b.delivery_type === 'off_spin') { totalTurnIn += t; turnInCount++; }
        if (b.delivery_type === 'leg_spin') { totalTurnAway += t; turnAwayCount++; }
      }

      // Pitch map
      if (b.pitch_x != null && b.pitch_y != null) {
        pitchMap.push({ x: parseFloat(b.pitch_x), y: parseFloat(b.pitch_y), ball_number: b.ball_number });
      }

      // Contact type
      if (b.contact_type) contactCounts[b.contact_type] = (contactCounts[b.contact_type] || 0) + 1;
      // Shot type
      if (b.shot_type) shotCounts[b.shot_type] = (shotCounts[b.shot_type] || 0) + 1;

      // Contact map
      if (b.contact_x != null && b.contact_y != null) {
        contactMap.push({ x: parseFloat(b.contact_x), y: parseFloat(b.contact_y), ball_number: b.ball_number });
      }

      // Extras
      if (b.is_wide) wides++;
      if (b.is_no_ball) noBalls++;
    });

    res.json({
      success: true,
      data: {
        session: session.rows[0],
        total_balls: total,
        bowler: {
          length_distribution: lengthCounts,
          line_distribution: lineCounts,
          delivery_distribution: deliveryCounts,
          avg_swing_degree: swingCount > 0 ? (totalSwing / swingCount).toFixed(2) : null,
          avg_turn_degree: turnCount > 0 ? (totalTurn / turnCount).toFixed(2) : null,
          avg_turn_into_batter: turnInCount > 0 ? (totalTurnIn / turnInCount).toFixed(2) : null,
          avg_turn_away_from_batter: turnAwayCount > 0 ? (totalTurnAway / turnAwayCount).toFixed(2) : null,
          pitch_map: pitchMap,
        },
        batsman: {
          contact_distribution: contactCounts,
          shot_distribution: shotCounts,
          contact_map: contactMap,
          wides,
          no_balls: noBalls,
          middle_percentage: total > 0
            ? ((contactCounts['middle'] || 0) / total * 100).toFixed(1)
            : null,
          edge_percentage: total > 0
            ? ((contactCounts['edge'] || 0) / total * 100).toFixed(1)
            : null,
          miss_percentage: total > 0
            ? ((contactCounts['miss'] || 0) / total * 100).toFixed(1)
            : null,
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;