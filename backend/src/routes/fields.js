const express = require('express');
const router = express.Router();
const db = require('../db');

// GET field for one specific session
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
    const row = result.rows[0] || null;
    if (row && row.session_id !== sessionId) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST — save field strictly for one session
router.post('/', async (req, res) => {
  const { session_id, positions, field_diameter } = req.body;

  if (!session_id) {
    return res.status(400).json({ success: false, error: 'session_id is required' });
  }
  const sessionId = parseInt(session_id, 10);
  if (isNaN(sessionId)) {
    return res.status(400).json({ success: false, error: 'session_id must be a valid integer' });
  }

  try {
    const sessionCheck = await db.query(
      'SELECT id FROM sessions WHERE id = $1', [sessionId]
    );
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Session ${sessionId} does not exist`
      });
    }

    await db.query(
      'DELETE FROM field_settings WHERE session_id = $1',
      [sessionId]
    );

    const result = await db.query(
      `INSERT INTO field_settings (session_id, positions, field_diameter)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sessionId, JSON.stringify(positions), parseFloat(field_diameter) || 65]
    );

    const saved = result.rows[0];
    if (saved.session_id !== sessionId) {
      return res.status(500).json({
        success: false,
        error: 'Field save session mismatch'
      });
    }

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;