const express = require('express');
const router = express.Router();
const db = require('../db');

// Save or update a clip tag for a ball
router.post('/', async (req, res) => {
  const { ball_id, video_id, start_time, end_time, notes } = req.body;
  try {
    // Upsert — one clip per ball per video
    await db.query(
      'DELETE FROM ball_clips WHERE ball_id=$1 AND video_id=$2',
      [ball_id, video_id]
    );
    const result = await db.query(
      `INSERT INTO ball_clips (ball_id, video_id, start_time, end_time, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [ball_id, video_id, start_time, end_time, notes || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all clips for a video, joined with ball data
router.get('/video/:videoId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT bc.*, b.ball_number, b.length_type, b.line_type, b.delivery_type,
              b.contact_type, b.shot_type, b.is_wide, b.is_no_ball,
              b.pitch_x, b.pitch_y, b.contact_x, b.contact_y
       FROM ball_clips bc
       JOIN balls b ON b.id = bc.ball_id
       WHERE bc.video_id = $1
       ORDER BY bc.start_time ASC`,
      [req.params.videoId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get clip for a specific ball
router.get('/ball/:ballId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM ball_clips WHERE ball_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.params.ballId]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a clip
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM ball_clips WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;