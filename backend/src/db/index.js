const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cricket_app',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgresql',
  connectionTimeoutMillis: 2000,
});

let isPostgresConnected = false;

// In-Memory Database Store for fallback when PostgreSQL service is not active
const memoryStore = {
  sessions: [],
  balls: [],
  fields: [],
  scoring: [],
  videos: [],
  clips: [],
  reviews: [],
  matches: [],
  autoId: 1,
};

pool.connect((err) => {
  if (err) {
    console.log('⚠️ PostgreSQL connection unverified — activating In-Memory Database fallback.');
    isPostgresConnected = false;
  } else {
    console.log('✅ Connected to PostgreSQL database');
    isPostgresConnected = true;
  }
});

// Helper for Mock DB queries
function executeMockQuery(text, params = []) {
  const normalized = text.trim().toLowerCase();

  // --- SESSIONS ---
  if (normalized.includes('from sessions')) {
    if (normalized.includes('where id =')) {
      const id = parseInt(params[0], 10);
      const session = memoryStore.sessions.find(s => s.id === id);
      return { rows: session ? [session] : [] };
    }
    const sorted = [...memoryStore.sessions].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    return { rows: sorted };
  }

  if (normalized.includes('insert into sessions')) {
    const newSession = {
      id: memoryStore.autoId++,
      session_name: params[0] || 'Cricket Session',
      bowler_name: params[1] || '',
      batsman_name: params[2] || '',
      notes: params[3] || '',
      total_balls: 0,
      bowler_handedness: params[4] || 'right',
      batter_handedness: params[5] || 'right',
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    memoryStore.sessions.push(newSession);
    return { rows: [newSession] };
  }

  if (normalized.includes('update sessions')) {
    const id = parseInt(params[params.length - 1], 10);
    const idx = memoryStore.sessions.findIndex(s => s.id === id);
    if (idx >= 0) {
      if (params.length >= 5) {
        memoryStore.sessions[idx].session_name = params[0];
        memoryStore.sessions[idx].bowler_name = params[1];
        memoryStore.sessions[idx].batsman_name = params[2];
        memoryStore.sessions[idx].notes = params[3];
        memoryStore.sessions[idx].total_balls = params[4];
      }
      return { rows: [memoryStore.sessions[idx]] };
    }
    return { rows: [] };
  }

  if (normalized.includes('delete from sessions')) {
    const id = parseInt(params[0], 10);
    memoryStore.sessions = memoryStore.sessions.filter(s => parseInt(s.id, 10) !== id);
    memoryStore.balls = memoryStore.balls.filter(b => parseInt(b.session_id, 10) !== id);
    memoryStore.fields = memoryStore.fields.filter(f => parseInt(f.session_id, 10) !== id);
    return { rows: [] };
  }

  // --- BALLS ---
  if (normalized.includes('from balls')) {
    if (normalized.includes('where id=')) {
      const id = parseInt(params[0], 10);
      const b = memoryStore.balls.find(x => x.id === id);
      return { rows: b ? [b] : [] };
    }
    if (normalized.includes('session_id =') || normalized.includes('session_id=')) {
      const sessionId = parseInt(params[0], 10);
      const sessionBalls = memoryStore.balls.filter(b => b.session_id === sessionId);
      sessionBalls.sort((a, b) => a.ball_number - b.ball_number);
      return { rows: sessionBalls };
    }
    return { rows: memoryStore.balls };
  }

  if (normalized.includes('insert into balls')) {
    const newBall = {
      id: memoryStore.autoId++,
      session_id: parseInt(params[0], 10),
      ball_number: parseInt(params[1], 10),
      length_type: params[2],
      line_type: params[3],
      delivery_type: params[4],
      swing_degree: params[5] || null,
      turn_degree: params[6] || null,
      pitch_x: params[7] != null ? parseFloat(params[7]) : null,
      pitch_y: params[8] != null ? parseFloat(params[8]) : null,
      shot_type: params[9],
      contact_type: params[10],
      contact_x: params[11] != null ? parseFloat(params[11]) : null,
      contact_y: params[12] != null ? parseFloat(params[12]) : null,
      is_wide: params[13] || false,
      is_no_ball: params[14] || false,
      is_lofted: false,
      batter_stepped_out: false,
      is_stumped: false,
      runs_scored: 0,
      wicket_type: null,
      fielder_caught: null,
      created_at: new Date().toISOString(),
    };
    memoryStore.balls.push(newBall);

    // Update session total balls count
    const session = memoryStore.sessions.find(s => s.id === newBall.session_id);
    if (session) {
      session.total_balls = (session.total_balls || 0) + 1;
    }
    return { rows: [newBall] };
  }

  if (normalized.includes('update balls set')) {
    const id = parseInt(params[params.length - 1], 10);
    const ball = memoryStore.balls.find(b => b.id === id);
    if (ball) {
      if (normalized.includes('contact_x=')) {
        ball.contact_x = params[0] != null ? parseFloat(params[0]) : null;
        ball.contact_y = params[1] != null ? parseFloat(params[1]) : null;
        ball.is_lofted = !!params[2];
        ball.wicket_type = params[3] || null;
        ball.fielder_caught = params[4] || null;
        ball.runs_scored = parseInt(params[5], 10) || 0;
        ball.batter_stepped_out = !!params[6];
        ball.is_stumped = !!params[7];
      }
      return { rows: [ball] };
    }
    return { rows: [] };
  }

  if (normalized.includes('delete from balls')) {
    const id = parseInt(params[0], 10);
    memoryStore.balls = memoryStore.balls.filter(b => b.id !== id);
    return { rows: [] };
  }

  // --- FIELD SETTINGS ---
  if (normalized.includes('from field_settings')) {
    const sessionId = parseInt(params[0], 10);
    const field = memoryStore.fields.find(f => f.session_id === sessionId);
    return { rows: field ? [field] : [] };
  }

  if (normalized.includes('delete from field_settings')) {
    const sessionId = parseInt(params[0], 10);
    memoryStore.fields = memoryStore.fields.filter(f => f.session_id !== sessionId);
    return { rows: [] };
  }

  if (normalized.includes('insert into field_settings')) {
    const sessionId = parseInt(params[0], 10);
    const positions = params[1];
    const field_diameter = parseFloat(params[2]) || 65;
    
    const fieldRecord = {
      id: memoryStore.autoId++,
      session_id: sessionId,
      positions: typeof positions === 'string' ? positions : JSON.stringify(positions),
      field_diameter: field_diameter,
      created_at: new Date().toISOString(),
    };
    memoryStore.fields.push(fieldRecord);
    return { rows: [fieldRecord] };
  }

  // --- MATCHES ---
  if (normalized.includes('from matches')) {
    return { rows: memoryStore.matches };
  }

  // Fallback for any other queries
  return { rows: [] };
}

module.exports = {
  query: async (text, params) => {
    if (isPostgresConnected) {
      try {
        return await pool.query(text, params);
      } catch (err) {
        console.warn('PostgreSQL query error, falling back to mock DB:', err.message);
        return executeMockQuery(text, params);
      }
    }
    return executeMockQuery(text, params);
  },
  pool,
};