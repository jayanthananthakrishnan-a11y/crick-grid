const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all sessions
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM sessions ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single session
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM sessions WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create session
router.post('/', async (req, res) => {
  const { session_name, bowler_name, batsman_name, notes } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO sessions (session_name, bowler_name, batsman_name, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [session_name, bowler_name, batsman_name, notes]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update session
router.put('/:id', async (req, res) => {
  const { session_name, bowler_name, batsman_name, notes, total_balls } = req.body;
  try {
    const result = await db.query(
      `UPDATE sessions SET session_name=$1, bowler_name=$2, batsman_name=$3,
       notes=$4, total_balls=$5 WHERE id=$6 RETURNING *`,
      [session_name, bowler_name, batsman_name, notes, total_balls, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete session
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM sessions WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;