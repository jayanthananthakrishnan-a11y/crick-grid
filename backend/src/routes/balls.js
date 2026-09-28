const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all balls for a session
router.get('/session/:sessionId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM balls WHERE session_id = $1 ORDER BY ball_number ASC',
      [req.params.sessionId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Log a single ball
router.post('/', async (req, res) => {
  const {
    session_id, ball_number, length_type, line_type, delivery_type,
    swing_degree, turn_degree, pitch_x, pitch_y,
    shot_type, contact_type, contact_x, contact_y,
    is_wide, is_no_ball, runs_scored, run_outcome, is_lofted,
    is_wicket, wicket_type, fielder_caught, batter_stepped_out, is_stumped
  } = req.body;

  const finalRuns = typeof runs_scored === 'number' ? runs_scored : (typeof run_outcome === 'number' ? run_outcome : 0);

  try {
    const result = await db.query(
      `INSERT INTO balls (
        session_id, ball_number, length_type, line_type, delivery_type,
        swing_degree, turn_degree, pitch_x, pitch_y,
        shot_type, contact_type, contact_x, contact_y,
        is_wide, is_no_ball, runs_scored, is_lofted,
        is_wicket, wicket_type, fielder_caught, batter_stepped_out, is_stumped
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *`,
      [
        session_id, ball_number, length_type, line_type, delivery_type,
        swing_degree, turn_degree, pitch_x, pitch_y,
        shot_type, contact_type, contact_x, contact_y,
        is_wide || false, is_no_ball || false, finalRuns,
        is_lofted || false, is_wicket || false, wicket_type || null,
        fielder_caught || null, batter_stepped_out || false, is_stumped || false
      ]
    );

    // Update total_balls count in session
    await db.query(
      'UPDATE sessions SET total_balls = total_balls + 1 WHERE id = $1',
      [session_id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a ball
router.put('/:id', async (req, res) => {
  const {
    length_type, line_type, delivery_type,
    swing_degree, turn_degree, pitch_x, pitch_y,
    shot_type, contact_type, contact_x, contact_y,
    is_wide, is_no_ball
  } = req.body;

  try {
    const result = await db.query(
      `UPDATE balls SET
        length_type=$1, line_type=$2, delivery_type=$3,
        swing_degree=$4, turn_degree=$5, pitch_x=$6, pitch_y=$7,
        shot_type=$8, contact_type=$9, contact_x=$10, contact_y=$11,
        is_wide=$12, is_no_ball=$13
       WHERE id=$14 RETURNING *`,
      [
        length_type, line_type, delivery_type,
        swing_degree, turn_degree, pitch_x, pitch_y,
        shot_type, contact_type, contact_x, contact_y,
        is_wide, is_no_ball, req.params.id
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a ball
router.delete('/:id', async (req, res) => {
  try {
    const ball = await db.query('SELECT session_id FROM balls WHERE id=$1', [req.params.id]);
    if (ball.rows.length > 0) {
      await db.query(
        'UPDATE sessions SET total_balls = total_balls - 1 WHERE id = $1',
        [ball.rows[0].session_id]
      );
    }
    await db.query('DELETE FROM balls WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Ball deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;