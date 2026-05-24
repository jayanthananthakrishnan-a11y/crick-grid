const express = require('express');
const router = express.Router();
const db = require('../db');

// Get field for a specific session ONLY
router.get('/session/:sessionId', async (req, res) => {
  const sessionId = parseInt(req.params.sessionId, 10);
  if (isNaN(sessionId)) {
    return res.status(400).json({ success: false, error: 'Invalid session ID' });
  }
  try {
    const result = await db.query(
      `SELECT * FROM field_settings
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save field for a specific session — strictly scoped to that session_id
router.post('/', async (req, res) => {
  const { session_id, positions, field_diameter } = req.body;

  if (!session_id) {
    return res.status(400).json({ success: false, error: 'session_id is required' });
  }

  const sessionId = parseInt(session_id, 10);
  if (isNaN(sessionId)) {
    return res.status(400).json({ success: false, error: 'session_id must be a number' });
  }

  try {
    // Delete ONLY this session's existing field — not all sessions
    await db.query(
      'DELETE FROM field_settings WHERE session_id = $1',
      [sessionId]
    );

    const result = await db.query(
      `INSERT INTO field_settings (session_id, positions, field_diameter)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sessionId, JSON.stringify(positions), field_diameter || 65]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;