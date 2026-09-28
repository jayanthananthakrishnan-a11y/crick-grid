const express = require('express');
const router = express.Router();
const db = require('../db');

// ── Matches ──────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM matches ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM matches WHERE id=$1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Match not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  const {
    team_a_name, team_b_name, venue, match_date, match_time,
    total_overs, ball_type, scorer_name
  } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO matches
        (team_a_name, team_b_name, venue, match_date, match_time, total_overs, ball_type, scorer_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [team_a_name, team_b_name, venue, match_date, match_time, total_overs, ball_type, scorer_name]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const fields = req.body;
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
  try {
    const result = await db.query(
      `UPDATE matches SET ${setClauses} WHERE id=$${keys.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM matches WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Innings ───────────────────────────────────────────────────────────────────

router.post('/:matchId/innings', async (req, res) => {
  const { innings_number, batting_team_name, bowling_team_name } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO innings (match_id, innings_number, batting_team_name, bowling_team_name)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.matchId, innings_number, batting_team_name, bowling_team_name]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:matchId/innings', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM innings WHERE match_id=$1 ORDER BY innings_number',
      [req.params.matchId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/innings/:inningsId', async (req, res) => {
  const fields = req.body;
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
  try {
    const result = await db.query(
      `UPDATE innings SET ${setClauses} WHERE id=$${keys.length + 1} RETURNING *`,
      [...values, req.params.inningsId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Balls ─────────────────────────────────────────────────────────────────────

router.post('/:matchId/ball', async (req, res) => {
  const {
    innings_id, over_number, ball_number, ball_display,
    batsman_name, bowler_name, runs_scored,
    is_wide, is_no_ball, is_bye, is_leg_bye,
    is_wicket, wicket_type, dismissed_batsman,
    shot_direction_x, shot_direction_y,
    extras_runs, narrative
  } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO match_balls (
        match_id, innings_id, over_number, ball_number, ball_display,
        batsman_name, bowler_name, runs_scored,
        is_wide, is_no_ball, is_bye, is_leg_bye,
        is_wicket, wicket_type, dismissed_batsman,
        shot_direction_x, shot_direction_y,
        extras_runs, narrative
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      RETURNING *`,
      [
        req.params.matchId, innings_id, over_number, ball_number, ball_display,
        batsman_name, bowler_name, runs_scored,
        is_wide || false, is_no_ball || false, is_bye || false, is_leg_bye || false,
        is_wicket || false, wicket_type || null, dismissed_batsman || null,
        shot_direction_x || null, shot_direction_y || null,
        extras_runs || 0, narrative || ''
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:matchId/balls/:inningsId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM match_balls
       WHERE match_id=$1 AND innings_id=$2
       ORDER BY over_number ASC, ball_number ASC`,
      [req.params.matchId, req.params.inningsId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete last ball (undo)
router.delete('/:matchId/ball/last/:inningsId', async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM match_balls WHERE id = (
        SELECT id FROM match_balls
        WHERE match_id=$1 AND innings_id=$2
        ORDER BY created_at DESC LIMIT 1
      ) RETURNING *`,
      [req.params.matchId, req.params.inningsId]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Batsman stats ─────────────────────────────────────────────────────────────

router.post('/innings/:inningsId/batsman', async (req, res) => {
  const { player_name, batting_position, on_strike, is_active } = req.body;
  try {
    // Check if already exists
    const existing = await db.query(
      'SELECT * FROM batsman_innings WHERE innings_id=$1 AND player_name=$2',
      [req.params.inningsId, player_name]
    );
    if (existing.rows.length > 0) {
      return res.json({ success: true, data: existing.rows[0] });
    }
    const result = await db.query(
      `INSERT INTO batsman_innings
        (innings_id, player_name, batting_position, on_strike, is_active)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.inningsId, player_name, batting_position, on_strike || false, is_active || true]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/innings/:inningsId/batsman/:playerName', async (req, res) => {
  const fields = req.body;
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
  try {
    const result = await db.query(
      `UPDATE batsman_innings SET ${setClauses}
       WHERE innings_id=$${keys.length + 1} AND player_name=$${keys.length + 2}
       RETURNING *`,
      [...values, req.params.inningsId, req.params.playerName]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/innings/:inningsId/batsmen', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM batsman_innings WHERE innings_id=$1 ORDER BY batting_position',
      [req.params.inningsId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Bowler stats ──────────────────────────────────────────────────────────────

router.post('/innings/:inningsId/bowler', async (req, res) => {
  const { player_name } = req.body;
  try {
    const existing = await db.query(
      'SELECT * FROM bowler_innings WHERE innings_id=$1 AND player_name=$2',
      [req.params.inningsId, player_name]
    );
    if (existing.rows.length > 0) {
      // Set as current bowler
      await db.query('UPDATE bowler_innings SET is_current_bowler=FALSE WHERE innings_id=$1', [req.params.inningsId]);
      await db.query('UPDATE bowler_innings SET is_current_bowler=TRUE WHERE id=$1', [existing.rows[0].id]);
      return res.json({ success: true, data: existing.rows[0] });
    }
    await db.query('UPDATE bowler_innings SET is_current_bowler=FALSE WHERE innings_id=$1', [req.params.inningsId]);
    const result = await db.query(
      `INSERT INTO bowler_innings (innings_id, player_name, is_current_bowler)
       VALUES ($1,$2,TRUE) RETURNING *`,
      [req.params.inningsId, player_name]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/innings/:inningsId/bowler/:playerName', async (req, res) => {
  const fields = req.body;
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClauses = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
  try {
    const result = await db.query(
      `UPDATE bowler_innings SET ${setClauses}
       WHERE innings_id=$${keys.length + 1} AND player_name=$${keys.length + 2}
       RETURNING *`,
      [...values, req.params.inningsId, req.params.playerName]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/innings/:inningsId/bowlers', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM bowler_innings WHERE innings_id=$1 ORDER BY created_at',
      [req.params.inningsId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Roster ────────────────────────────────────────────────────────────────────

router.post('/:matchId/roster', async (req, res) => {
  const { team_name, player_name, status } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO match_roster (match_id, team_name, player_name, status)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.matchId, team_name, player_name, status || 'playing']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:matchId/roster', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM match_roster WHERE match_id=$1 ORDER BY team_name, created_at',
      [req.params.matchId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/roster/:id', async (req, res) => {
  const { status } = req.body;
  try {
    const result = await db.query(
      'UPDATE match_roster SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;