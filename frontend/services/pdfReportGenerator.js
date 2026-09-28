import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';
import {
  computeInningsSummary, computeOverRuns, computePhaseStats,
  computeScoreProgression, buildDismissalString, formatOvers
} from './matchEngine';

async function exportAndSharePDF(htmlContent, filenamePrefix) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html: htmlContent });
    return;
  }

  try {
    // 1. Generate Base64 PDF data
    const { base64 } = await Print.printToFileAsync({ html: htmlContent, base64: true });

    if (base64) {
      const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const safePrefix = (filenamePrefix || 'Cricket_Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      const pdfFileName = `${safePrefix}_${Date.now()}.pdf`;
      const targetPath = `${docDir}${pdfFileName}`;

      // 2. Write file directly to app's documentDirectory (accessible storage)
      await FileSystem.writeAsStringAsync(targetPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 3. Trigger system file share / download modal using file:// URI
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        try {
          await Sharing.shareAsync(targetPath, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save / Download PDF Report',
            UTI: 'com.adobe.pdf',
          });
          return;
        } catch (shareErr) {
          console.warn('Direct file URI share attempt warning, trying fallback share:', shareErr);
          let shareUri = targetPath;
          if (Platform.OS === 'android' && FileSystem.getContentUriAsync) {
            try {
              const contentUri = await FileSystem.getContentUriAsync(targetPath);
              if (contentUri) shareUri = contentUri;
            } catch (e) {
              console.warn('getContentUriAsync warning:', e);
            }
          }
          await Sharing.shareAsync(shareUri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Save / Download PDF Report',
            UTI: 'com.adobe.pdf',
          });
          return;
        }
      }
    }
  } catch (err) {
    console.warn('Direct file download modal failed, falling back to System Print screen:', err);
  }

  // Fallback to System Print Manager screen (Direct Save as PDF option)
  try {
    await Print.printAsync({ html: htmlContent });
  } catch (printErr) {
    Alert.alert('PDF Export Error', `Could not generate PDF: ${printErr.message}`);
  }
}

function renderBowlerSvg(cx, cy, size, handedness) {
  const s = size;
  const armSide = handedness === 'left' ? -1 : 1;
  return `
    <g>
      <circle cx="${cx}" cy="${cy - s * 0.9}" r="${s * 0.28}" fill="none" stroke="#1565c0" stroke-width="1.5" />
      <line x1="${cx}" y1="${cy - s * 0.62}" x2="${cx}" y2="${cy + s * 0.2}" stroke="#1565c0" stroke-width="2" stroke-linecap="round" />
      <line x1="${cx}" y1="${cy - s * 0.4}" x2="${cx + armSide * s * 0.6}" y2="${cy - s * 0.8}" stroke="#1565c0" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="${cx + armSide * s * 0.6}" cy="${cy - s * 0.8}" r="${s * 0.18}" fill="#c62828" />
      <line x1="${cx}" y1="${cy - s * 0.4}" x2="${cx - armSide * s * 0.4}" y2="${cy - s * 0.1}" stroke="#1565c0" stroke-width="1.5" stroke-linecap="round" />
      <line x1="${cx}" y1="${cy + s * 0.2}" x2="${cx - s * 0.3}" y2="${cy + s * 0.8}" stroke="#1565c0" stroke-width="1.5" stroke-linecap="round" />
      <line x1="${cx}" y1="${cy + s * 0.2}" x2="${cx + s * 0.2}" y2="${cy + s * 0.8}" stroke="#1565c0" stroke-width="1.5" stroke-linecap="round" />
    </g>
  `;
}

function renderBatterSvg(cx, cy, size, handedness, strokeColor = "#2e7d32") {
  const s = size;
  const batSide = handedness === 'right' ? 1 : -1;
  return `
    <g>
      <circle cx="${cx}" cy="${cy - s * 0.9}" r="${s * 0.26}" fill="none" stroke="${strokeColor}" stroke-width="1.5" />
      <line x1="${cx}" y1="${cy - s * 0.64}" x2="${cx}" y2="${cy + s * 0.2}" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" />
      <line x1="${cx}" y1="${cy - s * 0.35}" x2="${cx + batSide * s * 0.45}" y2="${cy}" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" />
      <line x1="${cx + batSide * s * 0.45}" y1="${cy}" x2="${cx + batSide * s * 0.5}" y2="${cy + s * 0.5}" stroke="#f0c040" stroke-width="3" stroke-linecap="round" />
      <line x1="${cx}" y1="${cy - s * 0.35}" x2="${cx - batSide * s * 0.3}" y2="${cy}" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" />
      <line x1="${cx}" y1="${cy + s * 0.2}" x2="${cx - batSide * s * 0.2}" y2="${cy + s * 0.75}" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" />
      <line x1="${cx}" y1="${cy + s * 0.2}" x2="${cx + batSide * s * 0.15}" y2="${cy + s * 0.75}" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" />
      <path d="M ${cx - s * 0.28} ${cy - s * 0.9} A ${s * 0.28} ${s * 0.28} 0 0 1 ${cx + s * 0.28} ${cy - s * 0.9}" fill="${strokeColor}" stroke="none" />
    </g>
  `;
}

export async function generateNetsPDF(session, analytics, scoring) {
  try {
    const sessionName = session?.session_name || analytics?.session?.session_name || 'Nets Session Report';
    const bowler = session?.bowler_name || analytics?.session?.bowler_name || 'Bowler';
    const batsman = session?.batsman_name || analytics?.session?.batsman_name || 'Batsman';
    const bowlerHand = session?.bowler_handedness || analytics?.session?.bowler_handedness || 'right';
    const batterHand = session?.batter_handedness || analytics?.session?.batter_handedness || 'right';
    const dateStr = session?.date ? new Date(session.date).toLocaleDateString() : new Date().toLocaleDateString();

    const balls = scoring?.ball_scores || [];
    const totalRuns = scoring?.total_runs || 0;
    const totalBalls = scoring?.total_balls || analytics?.total_balls || balls.length;
    const runRate = scoring?.run_rate || (totalBalls > 0 ? ((totalRuns / totalBalls) * 6).toFixed(2) : '0.00');
    const boundaries = scoring?.boundaries || balls.filter(b => b.runs === 4).length;
    const sixes = scoring?.sixes || balls.filter(b => b.runs === 6).length;
    const dotBalls = scoring?.dot_balls || balls.filter(b => b.runs === 0 && !b.wicket_type).length;
    const wickets = scoring?.wickets || balls.filter(b => b.wicket_type).length;

    const b = analytics?.bowler;
    const bat = analytics?.batsman;

    // --- Pitch Map SVG Points Generation ---
    const rawPitchPoints = (b?.pitch_map && b.pitch_map.length > 0)
      ? b.pitch_map
      : balls.filter(p => (p.pitch_x != null || p.x != null) && (p.pitch_y != null || p.y != null)).map(p => ({
          x: p.pitch_x != null ? p.pitch_x : p.x,
          y: p.pitch_y != null ? p.pitch_y : p.y,
          length_type: p.length_type,
          ball_number: p.ball_number,
        }));

    const pitchMapPoints = rawPitchPoints.map((p, idx) => {
      const rawX = p.x != null ? parseFloat(p.x) : (p.pitch_x != null ? parseFloat(p.pitch_x) : null);
      const rawY = p.y != null ? parseFloat(p.y) : (p.pitch_y != null ? parseFloat(p.pitch_y) : null);
      if (rawX == null || rawY == null) return '';

      const pxVal = batterHand === 'left' ? 100 - rawX : rawX;
      const dotX = 40 + (pxVal / 100) * 120;
      const dotY = 41.8 + (rawY / 100) * 360;

      const ZONE_COLORS = {
        short: '#ef9a9a',
        good_length: '#66bb6a',
        slot: '#ffd54f',
        full_toss: '#ffb74d',
        full: '#ffb74d',
        yorker: '#ba68c8',
        bouncer: '#ef9a9a',
      };
      const color = ZONE_COLORS[p.length_type] || '#e53935';

      return `
        <g>
          <circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="7" fill="${color}" opacity="0.85" stroke="#ffffff" stroke-width="1.5" />
          <text x="${dotX.toFixed(1)}" y="${(dotY + 3.5).toFixed(1)}" font-size="8" fill="#ffffff" font-weight="bold" text-anchor="middle" font-family="sans-serif">${p.ball_number || (idx + 1)}</text>
        </g>
      `;
    }).filter(Boolean).join('\n');

    // --- Wagon Wheel SVG Vectors Generation ---
    const rawWagonShots = (scoring?.ball_scores || [])
      .concat(analytics?.batsman?.contact_map || [])
      .concat(balls || []);

    const validWagonShots = [];
    const seenShots = new Set();

    rawWagonShots.forEach(s => {
      const cxVal = s.contact_x != null ? parseFloat(s.contact_x) : (s.x != null ? parseFloat(s.x) : null);
      const cyVal = s.contact_y != null ? parseFloat(s.contact_y) : (s.y != null ? parseFloat(s.y) : null);
      if (cxVal != null && cyVal != null) {
        const key = `${s.ball_number}_${cxVal}_${cyVal}`;
        if (!seenShots.has(key)) {
          seenShots.add(key);
          validWagonShots.push({
            contact_x: cxVal,
            contact_y: cyVal,
            runs: typeof s.runs === 'number' ? s.runs : (typeof s.runs_scored === 'number' ? s.runs_scored : 0),
            ball_number: s.ball_number,
          });
        }
      }
    });

    const RUN_COLORS = {
      0: '#bdbdbd',
      1: '#64b5f6',
      2: '#81c784',
      3: '#ffb74d',
      4: '#e53935',
      6: '#9c27b0',
    };

    const wagonVectors = validWagonShots.map(bs => {
      let fx = bs.contact_x;
      if (batterHand === 'left') fx = 100 - fx;
      const normX = (fx - 50) / 50;
      const normY = (bs.contact_y - 50) / 50;
      const endX = 140 + normX * 123.2;
      const endY = 140 + normY * 114.576; // outerR * 0.93

      const runs = Math.min(Math.max(0, bs.runs), 6);
      const color = RUN_COLORS[runs] || '#64b5f6';
      const isBig = bs.runs >= 4;

      return `
        <line x1="140" y1="140" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}" stroke="${color}" stroke-width="${isBig ? '2.5' : '1.5'}" opacity="0.85" />
        ${isBig ? `<circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="4" fill="${color}" opacity="0.9" />` : ''}
      `;
    }).join('\n');

    // Length Distribution HTML
    const lengthHtml = b?.length_distribution ? Object.entries(b.length_distribution).map(([k, v]) => {
      const pct = totalBalls > 0 ? ((v / totalBalls) * 100).toFixed(0) : 0;
      return `
        <div class="stat-row">
          <span class="stat-label">${k.replace(/_/g, ' ')}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:#1a472a;"></div></div>
          <span class="stat-val">${v} (${pct}%)</span>
        </div>
      `;
    }).join('') : '';

    // Line Distribution HTML
    const lineHtml = b?.line_distribution ? Object.entries(b.line_distribution).map(([k, v]) => {
      const pct = totalBalls > 0 ? ((v / totalBalls) * 100).toFixed(0) : 0;
      return `
        <div class="stat-row">
          <span class="stat-label">${k.replace(/_/g, ' ')}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:#2e7d32;"></div></div>
          <span class="stat-val">${v} (${pct}%)</span>
        </div>
      `;
    }).join('') : '';

    // Shot Selection HTML
    const shotHtml = bat?.shot_distribution ? Object.entries(bat.shot_distribution).map(([k, v]) => {
      const pct = totalBalls > 0 ? ((v / totalBalls) * 100).toFixed(0) : 0;
      return `
        <div class="stat-row">
          <span class="stat-label">${k.replace(/_/g, ' ')}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%; background:#6a1b9a;"></div></div>
          <span class="stat-val">${v} (${pct}%)</span>
        </div>
      `;
    }).join('') : '';

    // Ball-by-Ball Tracker Rows HTML
    const ballRowsHtml = balls.map(b => {
      let resBadgeClass = 'dot';
      let resLabel = b.runs != null ? String(b.runs) : '0';
      if (b.wicket_type) { resBadgeClass = 'wicket'; resLabel = 'W'; }
      else if (b.is_wide) { resBadgeClass = 'wide'; resLabel = 'Wd'; }
      else if (b.is_no_ball) { resBadgeClass = 'noball'; resLabel = 'NB'; }
      else if (b.runs === 4) { resBadgeClass = 'four'; }
      else if (b.runs === 6) { resBadgeClass = 'six'; }

      const delivery = [b.delivery_type, b.length_type, b.line_type].filter(Boolean).join(' · ').replace(/_/g, ' ') || '—';
      const shot = [b.shot_type, b.is_lofted ? '(lofted)' : null, b.batter_stepped_out ? '[stepped out]' : null].filter(Boolean).join(' ');
      const desc = b.wicket_type ? `Wicket (${b.wicket_type}${b.fielder_caught ? ' by ' + b.fielder_caught : ''})` : (b.reason || `${b.runs} runs`);

      return `
        <tr>
          <td><strong>#${b.ball_number}</strong></td>
          <td>${delivery}</td>
          <td>${shot || '—'}</td>
          <td>${desc}</td>
          <td><span class="badge ${resBadgeClass}">${resLabel}</span></td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${sessionName} - Comprehensive Nets Report</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; margin: 0; padding: 24px; background: #fff; }
          .header { background: #1a472a; color: #fff; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px; }
          .header h1 { margin: 0 0 6px 0; font-size: 26px; color: #fff; }
          .header p { margin: 0; color: #a5d6a7; font-size: 14px; }
          .stats-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
          .stat-box { flex: 1; min-width: 90px; background: #f4f6f4; border-radius: 8px; padding: 10px; text-align: center; border: 1px solid #e0e6e0; }
          .stat-num { font-size: 20px; font-weight: bold; color: #1a472a; }
          .stat-label { font-size: 10px; color: #666; text-transform: uppercase; margin-top: 3px; }
          .section-title { font-size: 16px; font-weight: bold; color: #1a472a; margin-top: 24px; margin-bottom: 12px; border-bottom: 2px solid #1a472a; padding-bottom: 4px; }
          .visuals-container { display: flex; gap: 20px; justify-content: space-around; margin-bottom: 20px; flex-wrap: wrap; align-items: flex-start; }
          .visual-card { background: #fafafa; border: 1px solid #eee; border-radius: 10px; padding: 14px; text-align: center; flex: 1; min-width: 240px; }
          .visual-title { font-weight: bold; color: #1a472a; font-size: 14px; margin-bottom: 10px; }
          .stat-row { display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; }
          .stat-label { width: 110px; color: #444; text-transform: capitalize; }
          .bar-track { flex: 1; height: 10px; background: #e8f5e9; border-radius: 5px; overflow: hidden; margin: 0 8px; }
          .bar-fill { height: 100%; border-radius: 5px; }
          .stat-val { width: 70px; text-align: right; color: #555; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #e8f5e9; color: #1a472a; text-align: left; padding: 8px; border-bottom: 2px solid #c8e6c9; }
          td { padding: 8px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #fafafa; }
          .badge { display: inline-block; width: 22px; height: 22px; line-height: 22px; border-radius: 11px; text-align: center; font-size: 11px; font-weight: bold; color: #fff; }
          .badge.dot { background: #9e9e9e; }
          .badge.wicket { background: #b71c1c; }
          .badge.wide { background: #0277bd; }
          .badge.noball { background: #f57f17; }
          .badge.four { background: #c62828; }
          .badge.six { background: #6a1b9a; }
          .tri-stat { display: flex; gap: 10px; margin-bottom: 14px; }
          .tri-box { flex: 1; background: #f0fff4; border: 1px solid #c8e6c9; border-radius: 8px; padding: 10px; text-align: center; }
          .tri-num { font-size: 20px; font-weight: bold; color: #1a472a; }
          .tri-lbl { font-size: 11px; color: #666; margin-top: 2px; }
          .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏏 ${sessionName}</h1>
          <p>Bowler: ${bowler} (${bowlerHand.toUpperCase()}) | Batsman: ${batsman} (${batterHand.toUpperCase()}) | Date: ${dateStr}</p>
        </div>

        <div class="stats-grid">
          <div class="stat-box"><div class="stat-num">${totalBalls}</div><div class="stat-label">Balls Logged</div></div>
          <div class="stat-box"><div class="stat-num" style="color:#d4a017">${totalRuns}</div><div class="stat-label">Total Runs</div></div>
          <div class="stat-box"><div class="stat-num">${runRate}</div><div class="stat-label">Run Rate</div></div>
          <div class="stat-box"><div class="stat-num" style="color:#c62828">${boundaries}</div><div class="stat-label">Fours (4s)</div></div>
          <div class="stat-box"><div class="stat-num" style="color:#6a1b9a">${sixes}</div><div class="stat-label">Sixes (6s)</div></div>
          <div class="stat-box"><div class="stat-num" style="color:#9e9e9e">${dotBalls}</div><div class="stat-label">Dot Balls</div></div>
          <div class="stat-box"><div class="stat-num" style="color:#b71c1c">${wickets}</div><div class="stat-label">Wickets</div></div>
        </div>

        <div class="visuals-container">
          <div class="visual-card">
            <div class="visual-title">🗺️ Pitch Map</div>
            <svg width="200" height="430" style="background:#ffffff; border-radius:12px; display:block; margin:0 auto; box-shadow:0 2px 6px rgba(0,0,0,0.08); border:1px solid #e0e0e0;">
              <defs>
                <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#d4e6b5" />
                  <stop offset="100%" stop-color="#a5c96a" />
                </linearGradient>
              </defs>

              <!-- Bowler graphic silhouette (top) -->
              ${renderBowlerSvg(100, 22 * 0.95, 22, bowlerHand)}

              <!-- Main Pitch Box -->
              <rect x="40" y="41.8" width="120" height="360" fill="url(#pitchGrad)" stroke="#5d8a3c" stroke-width="1.5" rx="4" />

              <!-- Zone Bands -->
              <rect x="40" y="41.8" width="120" height="79.2" fill="#ffcdd2" opacity="0.35" />
              <line x1="40" y1="41.8" x2="160" y2="41.8" stroke="#8bc34a" stroke-width="0.8" stroke-dasharray="5,3" />
              <text x="36" y="81.4" font-size="9" fill="#555" text-anchor="end" font-family="sans-serif">Short</text>

              <rect x="40" y="121" width="120" height="90" fill="#c8e6c9" opacity="0.35" />
              <line x1="40" y1="121" x2="160" y2="121" stroke="#8bc34a" stroke-width="0.8" stroke-dasharray="5,3" />
              <text x="36" y="166" font-size="9" fill="#555" text-anchor="end" font-family="sans-serif">Good Length</text>

              <rect x="40" y="211" width="120" height="57.6" fill="#fff9c4" opacity="0.35" />
              <line x1="40" y1="211" x2="160" y2="211" stroke="#8bc34a" stroke-width="0.8" stroke-dasharray="5,3" />
              <text x="36" y="239.8" font-size="9" fill="#555" text-anchor="end" font-family="sans-serif">The Slot</text>

              <rect x="40" y="268.6" width="120" height="54" fill="#ffe0b2" opacity="0.35" />
              <line x1="40" y1="268.6" x2="160" y2="268.6" stroke="#8bc34a" stroke-width="0.8" stroke-dasharray="5,3" />
              <text x="36" y="295.6" font-size="9" fill="#555" text-anchor="end" font-family="sans-serif">Full</text>

              <rect x="40" y="322.6" width="120" height="79.2" fill="#e1bee7" opacity="0.35" />
              <line x1="40" y1="322.6" x2="160" y2="322.6" stroke="#8bc34a" stroke-width="0.8" stroke-dasharray="5,3" />
              <text x="36" y="362.2" font-size="9" fill="#555" text-anchor="end" font-family="sans-serif">Yorker</text>

              <!-- Batter Crease (bottom: y = 41.8 + 360 * 0.88 = 358.6) -->
              <line x1="40" y1="358.6" x2="160" y2="358.6" stroke="#ffffff" stroke-width="2" />

              <!-- Bowler Crease (top: y = 41.8 + 360 * 0.06 = 63.4) -->
              <line x1="40" y1="63.4" x2="160" y2="63.4" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="5,3" />

              <!-- Stumps at Batter's end (bottom) -->
              <line x1="${40 + 120 * (batterHand === 'left' ? 0.6 : 0.4)}" y1="358.6" x2="${40 + 120 * (batterHand === 'left' ? 0.6 : 0.4)}" y2="372.6" stroke="#f5e642" stroke-width="2.5" />
              <line x1="100" y1="358.6" x2="100" y2="372.6" stroke="#f5e642" stroke-width="2.5" />
              <line x1="${40 + 120 * (batterHand === 'left' ? 0.4 : 0.6)}" y1="358.6" x2="${40 + 120 * (batterHand === 'left' ? 0.4 : 0.6)}" y2="372.6" stroke="#f5e642" stroke-width="2.5" />
              <line x1="${40 + 120 * (batterHand === 'left' ? 0.6 : 0.4)}" y1="358.6" x2="${40 + 120 * (batterHand === 'left' ? 0.4 : 0.6)}" y2="358.6" stroke="#f5e642" stroke-width="1.5" />
              <text x="${40 + 120 * (batterHand === 'left' ? 0.4 : 0.6)}" y="380.6" font-size="8" fill="#d4a017" font-weight="bold" text-anchor="middle" font-family="sans-serif">Off</text>
              <text x="${40 + 120 * (batterHand === 'left' ? 0.6 : 0.4)}" y="380.6" font-size="8" fill="#d4a017" font-weight="bold" text-anchor="middle" font-family="sans-serif">Leg</text>

              <!-- Stumps at Bowler's end (top) -->
              <line x1="${40 + 120 * (batterHand === 'left' ? 0.6 : 0.4)}" y1="51.4" x2="${40 + 120 * (batterHand === 'left' ? 0.6 : 0.4)}" y2="63.4" stroke="#f5e642" stroke-width="1.8" />
              <line x1="100" y1="51.4" x2="100" y2="63.4" stroke="#f5e642" stroke-width="1.8" />
              <line x1="${40 + 120 * (batterHand === 'left' ? 0.4 : 0.6)}" y1="51.4" x2="${40 + 120 * (batterHand === 'left' ? 0.4 : 0.6)}" y2="63.4" stroke="#f5e642" stroke-width="1.8" />
              <line x1="${40 + 120 * (batterHand === 'left' ? 0.6 : 0.4)}" y1="51.4" x2="${40 + 120 * (batterHand === 'left' ? 0.4 : 0.6)}" y2="51.4" stroke="#f5e642" stroke-width="1.2" />

              <!-- Ball Points -->
              ${pitchMapPoints || '<text x="100" y="220" fill="#888" font-size="11" text-anchor="middle" font-family="sans-serif">No pitch points</text>'}

              <!-- Batter graphic silhouette (bottom) -->
              ${renderBatterSvg(100, 41.8 + 360 + 22 * 0.9, 22, batterHand, "#2e7d32")}
            </svg>
          </div>

          <div class="visual-card">
            <div class="visual-title">🎡 Wagon Wheel</div>
            <svg width="280" height="280" style="background:#3a7d2c; border-radius:50%; display:block; margin:0 auto; box-shadow:0 2px 6px rgba(0,0,0,0.1);">
              <!-- Outfield boundary line -->
              <ellipse cx="140" cy="140" rx="123.2" ry="114.6" fill="#3a7d2c" stroke="#2d6a22" stroke-width="1.5" />
              <!-- 30-yard inner circle -->
              <ellipse cx="140" cy="140" rx="75.6" ry="70.3" fill="none" stroke="#6dbf5e" stroke-width="0.8" stroke-dasharray="5,4" />

              <!-- Direction Labels -->
              <text x="140" y="14" font-size="9" fill="#c8e6c9" text-anchor="middle" font-family="sans-serif">Straight</text>
              <text x="274" y="144" font-size="9" fill="#c8e6c9" text-anchor="end" font-family="sans-serif">${batterHand === 'right' ? 'Off side' : 'Leg side'}</text>
              <text x="6" y="144" font-size="9" fill="#c8e6c9" text-anchor="start" font-family="sans-serif">${batterHand === 'right' ? 'Leg side' : 'Off side'}</text>
              <text x="140" y="274" font-size="9" fill="#c8e6c9" text-anchor="middle" font-family="sans-serif">Fine leg / 3rd man</text>

              <!-- Pitch Strip (center) -->
              <rect x="133" y="118" width="14" height="44" fill="#d4b483" stroke="#8a6d3b" stroke-width="1" rx="2" />

              <!-- Batter Silhouette at center -->
              ${renderBatterSvg(140, 140, 16, batterHand, "#ffffff")}

              <!-- Shot Vectors -->
              ${wagonVectors || '<text x="140" y="144" fill="#a5d6a7" font-size="11" text-anchor="middle" font-family="sans-serif">No wagon shots</text>'}

              <!-- Center yellow dot -->
              <circle cx="140" cy="140" r="3" fill="#f0c040" />
            </svg>

            <!-- Wagon Wheel Legend -->
            <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:12px;">
              <div style="display:flex; align-items:center; gap:4px; font-size:11px; color:#555;"><span style="width:14px; height:3px; background:#bdbdbd; border-radius:2px; display:inline-block;"></span> Dot</div>
              <div style="display:flex; align-items:center; gap:4px; font-size:11px; color:#555;"><span style="width:14px; height:3px; background:#64b5f6; border-radius:2px; display:inline-block;"></span> 1s</div>
              <div style="display:flex; align-items:center; gap:4px; font-size:11px; color:#555;"><span style="width:14px; height:3px; background:#81c784; border-radius:2px; display:inline-block;"></span> 2s</div>
              <div style="display:flex; align-items:center; gap:4px; font-size:11px; color:#555;"><span style="width:14px; height:3px; background:#ffb74d; border-radius:2px; display:inline-block;"></span> 3s</div>
              <div style="display:flex; align-items:center; gap:4px; font-size:11px; color:#555;"><span style="width:14px; height:3px; background:#e53935; border-radius:2px; display:inline-block;"></span> 4s</div>
              <div style="display:flex; align-items:center; gap:4px; font-size:11px; color:#555;"><span style="width:14px; height:3px; background:#9c27b0; border-radius:2px; display:inline-block;"></span> 6s</div>
            </div>
          </div>
        </div>

        ${bat ? `
          <div class="section-title">🏏 Contact & Batting Quality</div>
          <div class="tri-stat">
            <div class="tri-box"><div class="tri-num">${bat.middle_percentage || 0}%</div><div class="tri-lbl">Middled</div></div>
            <div class="tri-box"><div class="tri-num" style="color:#c0392b">${bat.edge_percentage || 0}%</div><div class="tri-lbl">Edges</div></div>
            <div class="tri-box"><div class="tri-num" style="color:#e67e22">${bat.miss_percentage || 0}%</div><div class="tri-lbl">Misses</div></div>
          </div>
        ` : ''}

        ${lengthHtml ? `<div class="section-title">📏 Length Breakdown</div>${lengthHtml}` : ''}
        ${lineHtml ? `<div class="section-title">🎯 Line Breakdown</div>${lineHtml}` : ''}
        ${shotHtml ? `<div class="section-title">🏏 Shot Selection Breakdown</div>${shotHtml}` : ''}

        <div class="section-title">📋 Ball-by-Ball Tracker</div>
        <table>
          <thead>
            <tr>
              <th>Ball</th>
              <th>Delivery</th>
              <th>Shot</th>
              <th>Result</th>
              <th>Runs</th>
            </tr>
          </thead>
          <tbody>
            ${ballRowsHtml || '<tr><td colspan="5">No balls logged in this session</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Generated by Cricket App · Nets Analytics Report
        </div>
      </body>
      </html>
    `;

    await exportAndSharePDF(htmlContent, sessionName);
  } catch (err) {
    Alert.alert('Error', `Could not generate PDF: ${err.message}`);
  }
}

function renderManhattanChartSvg(overRuns = []) {
  if (!overRuns || overRuns.length === 0) {
    return `<div style="text-align:center; color:#888; font-size:12px; padding:10px;">No over data recorded for Manhattan chart</div>`;
  }
  const maxRuns = Math.max(12, ...overRuns.map(o => o.runs || 0));
  const svgWidth = 460;
  const svgHeight = 150;
  const paddingLeft = 28;
  const paddingBottom = 22;
  const chartWidth = svgWidth - paddingLeft - 10;
  const chartHeight = svgHeight - paddingBottom - 10;
  const stepX = chartWidth / Math.max(1, overRuns.length);
  const barWidth = Math.max(6, Math.min(26, stepX - 4));

  const bars = overRuns.map((o, idx) => {
    const runs = o.runs || 0;
    const wickets = o.wickets || 0;
    const h = (runs / maxRuns) * chartHeight;
    const x = paddingLeft + idx * stepX + (stepX - barWidth) / 2;
    const y = 10 + (chartHeight - h);

    let color = '#1a472a';
    if (wickets > 0 && runs === 0) color = '#757575';
    else if (runs === 0) color = '#9e9e9e';
    else if (wickets > 0) color = '#c62828';
    else if ((o.fours || 0) + (o.sixes || 0) >= 3) color = '#1565c0';

    const wktCircles = [];
    for (let w = 0; w < wickets; w++) {
      wktCircles.push(`<circle cx="${(x + barWidth / 2).toFixed(1)}" cy="${Math.max(4, y - 5 - w * 6).toFixed(1)}" r="3" fill="#d32f2f" stroke="#ffffff" stroke-width="0.8" />`);
    }

    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" fill="${color}" rx="2" />
      ${runs > 0 ? `<text x="${(x + barWidth / 2).toFixed(1)}" y="${Math.max(10, y - 3).toFixed(1)}" font-size="8" fill="#333" font-weight="bold" text-anchor="middle">${runs}</text>` : ''}
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${svgHeight - 6}" font-size="8" fill="#666" text-anchor="middle">${o.over}</text>
      ${wktCircles.join('')}
    `;
  }).join('\n');

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="150" style="background:#fcfdfc; border-radius:8px; border:1px solid #e0e0e0; display:block; margin:0 auto;">
      <line x1="${paddingLeft}" y1="10" x2="${svgWidth - 10}" y2="10" stroke="#eee" stroke-width="1" />
      <line x1="${paddingLeft}" y1="${10 + chartHeight * 0.5}" x2="${svgWidth - 10}" y2="${10 + chartHeight * 0.5}" stroke="#eee" stroke-dasharray="3,3" />
      <line x1="${paddingLeft}" y1="${10 + chartHeight}" x2="${svgWidth - 10}" y2="${10 + chartHeight}" stroke="#ccc" stroke-width="1.5" />
      
      <text x="${paddingLeft - 4}" y="14" font-size="8" fill="#888" text-anchor="end">${maxRuns}</text>
      <text x="${paddingLeft - 4}" y="${14 + chartHeight * 0.5}" font-size="8" fill="#888" text-anchor="end">${Math.round(maxRuns / 2)}</text>
      <text x="${paddingLeft - 4}" y="${12 + chartHeight}" font-size="8" fill="#888" text-anchor="end">0</text>
      
      ${bars}
    </svg>
    <div style="display:flex; justify-content:center; gap:12px; margin-top:6px; font-size:10px; color:#555;">
      <span><span style="display:inline-block; width:10px; height:10px; background:#1a472a; border-radius:2px; margin-right:4px;"></span>Normal Over</span>
      <span><span style="display:inline-block; width:10px; height:10px; background:#1565c0; border-radius:2px; margin-right:4px;"></span>Big Over (3+ 4s/6s)</span>
      <span><span style="display:inline-block; width:8px; height:8px; background:#c62828; border-radius:50%; margin-right:4px;"></span>Wicket</span>
    </div>
  `;
}

function renderCombinedWormGraphSvg(wormDataArr = [], totalOvers = 20) {
  if (!wormDataArr || wormDataArr.length === 0) {
    return `<div style="text-align:center; color:#888; font-size:12px; padding:10px;">No progression data available</div>`;
  }

  const svgWidth = 480;
  const svgHeight = 160;
  const paddingLeft = 32;
  const paddingBottom = 24;
  const paddingTop = 12;
  const paddingRight = 12;

  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  const maxBalls = totalOvers * 6;
  const allRuns = [];
  wormDataArr.forEach(w => {
    (w.prog || []).forEach(p => allRuns.push(p.runs || 0));
  });
  const maxRuns = Math.max(20, ...allRuns);

  const colors = ['#1565c0', '#c62828', '#d4a017', '#7b1fa2'];

  const linesHtml = wormDataArr.map((w, idx) => {
    const prog = w.prog || [];
    if (prog.length < 2) return '';
    const strokeColor = w.color || colors[idx % colors.length];

    const pts = prog.map(p => {
      const x = paddingLeft + (p.ball / maxBalls) * chartW;
      const y = paddingTop + chartH - (p.runs / maxRuns) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const wktCircles = prog.filter(p => p.wicket).map(p => {
      const x = paddingLeft + (p.ball / maxBalls) * chartW;
      const y = paddingTop + chartH - (p.runs / maxRuns) * chartH;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${strokeColor}" stroke="#ffffff" stroke-width="1.5" />`;
    }).join('\n');

    return `
      <polyline points="${pts}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${wktCircles}
    `;
  }).join('\n');

  const legendHtml = wormDataArr.map((w, idx) => {
    const color = w.color || colors[idx % colors.length];
    return `<span><span style="display:inline-block; width:14px; height:3px; background:${color}; margin-right:4px; vertical-align:middle;"></span>${w.team || `Innings ${idx+1}`}</span>`;
  }).join('&nbsp;&nbsp;&nbsp;&nbsp;');

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="160" style="background:#fcfdfc; border-radius:8px; border:1px solid #e0e0e0; display:block; margin:0 auto;">
      <line x1="${paddingLeft}" y1="${paddingTop}" x2="${svgWidth - paddingRight}" y2="${paddingTop}" stroke="#eee" stroke-width="1" />
      <line x1="${paddingLeft}" y1="${paddingTop + chartH * 0.5}" x2="${svgWidth - paddingRight}" y2="${paddingTop + chartH * 0.5}" stroke="#eee" stroke-dasharray="3,3" />
      <line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${svgWidth - paddingRight}" y2="${paddingTop + chartH}" stroke="#ccc" stroke-width="1.5" />
      
      <text x="${paddingLeft - 4}" y="${paddingTop + 4}" font-size="8" fill="#999" text-anchor="end">${maxRuns}</text>
      <text x="${paddingLeft - 4}" y="${paddingTop + chartH * 0.5 + 3}" font-size="8" fill="#999" text-anchor="end">${Math.round(maxRuns / 2)}</text>
      <text x="${paddingLeft - 4}" y="${paddingTop + chartH + 3}" font-size="8" fill="#999" text-anchor="end">0</text>
      <text x="${svgWidth - paddingRight}" y="${svgHeight - 6}" font-size="8" fill="#999" text-anchor="end">Overs (${totalOvers})</text>

      ${linesHtml}
    </svg>
    <div style="display:flex; justify-content:center; gap:14px; margin-top:6px; font-size:10px; color:#555;">
      ${legendHtml}
    </div>
  `;
}

function renderMatchWagonWheelSvg(balls = [], batterHand = 'right') {
  const validShots = (balls || []).filter(b => b.shot_direction_x != null || b.contact_x != null || b.x != null);

  const SIZE = 240;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const r = SIZE * 0.43;

  const RUN_COLORS = { 0: '#bdbdbd', 1: '#64b5f6', 2: '#81c784', 3: '#ffb74d', 4: '#e53935', 6: '#9c27b0' };

  const vectors = validShots.map(b => {
    const rawX = b.shot_direction_x != null ? parseFloat(b.shot_direction_x) : (b.contact_x != null ? parseFloat(b.contact_x) : parseFloat(b.x));
    const rawY = b.shot_direction_y != null ? parseFloat(b.shot_direction_y) : (b.contact_y != null ? parseFloat(b.contact_y) : parseFloat(b.y));
    if (isNaN(rawX) || isNaN(rawY)) return '';

    const bx = (rawX / 100) * SIZE;
    const by = (rawY / 100) * SIZE;
    const runs = Math.min(Math.max(0, b.runs_scored != null ? b.runs_scored : (b.runs || 0)), 6);
    const color = RUN_COLORS[runs] || RUN_COLORS[1];
    const isBig = runs >= 4;

    return `
      <line x1="${cx}" y1="${cy}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${color}" stroke-width="${isBig ? '2.5' : '1.5'}" opacity="0.85" />
      ${isBig ? `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="4" fill="${color}" opacity="0.9" />` : ''}
    `;
  }).filter(Boolean).join('\n');

  return `
    <div style="text-align:center;">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="100%" height="210" style="background:#3a7d2c; border-radius:50%; display:block; margin:0 auto; box-shadow:0 2px 6px rgba(0,0,0,0.1);">
        <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.93}" fill="#3a7d2c" stroke="#2d6a22" stroke-width="1.5" />
        <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.6}" ry="${r * 0.56}" fill="none" stroke="#6dbf5e" stroke-width="0.8" stroke-dasharray="4,3" />
        
        <rect x="${cx - 7}" y="${cy - 20}" width="14" height="40" fill="#d4b483" rx="2" />
        
        <text x="${cx}" y="12" font-size="9" fill="#c8e6c9" text-anchor="middle">Straight</text>
        <text x="${SIZE - 4}" y="${cy + 4}" font-size="9" fill="#c8e6c9" text-anchor="end">Off side</text>
        <text x="4" y="${cy + 4}" font-size="9" fill="#c8e6c9" text-anchor="start">Leg side</text>
        <text x="${cx}" y="${SIZE - 8}" font-size="9" fill="#c8e6c9" text-anchor="middle">Fine leg / 3rd man</text>
        
        ${vectors || `<text x="${cx}" y="${cy + 4}" fill="#c8e6c9" opacity="0.7" font-size="10" text-anchor="middle">No wagon shots recorded</text>`}
        <circle cx="${cx}" cy="${cy}" r="3.5" fill="#f0c040" />
      </svg>
      <div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin-top:8px;">
        <div style="display:flex; align-items:center; gap:3px; font-size:10px; color:#555;"><span style="width:10px; height:3px; background:#bdbdbd;"></span> Dot</div>
        <div style="display:flex; align-items:center; gap:3px; font-size:10px; color:#555;"><span style="width:10px; height:3px; background:#64b5f6;"></span> 1s</div>
        <div style="display:flex; align-items:center; gap:3px; font-size:10px; color:#555;"><span style="width:10px; height:3px; background:#81c784;"></span> 2s</div>
        <div style="display:flex; align-items:center; gap:3px; font-size:10px; color:#555;"><span style="width:10px; height:3px; background:#ffb74d;"></span> 3s</div>
        <div style="display:flex; align-items:center; gap:3px; font-size:10px; color:#555;"><span style="width:10px; height:3px; background:#e53935;"></span> 4s</div>
        <div style="display:flex; align-items:center; gap:3px; font-size:10px; color:#555;"><span style="width:10px; height:3px; background:#9c27b0;"></span> 6s</div>
      </div>
    </div>
  `;
}

function renderPhaseBreakdownHtml(phases = []) {
  if (!phases || phases.length === 0) {
    return `<div style="color:#888; font-size:12px; margin-top:6px;">No phase breakdown data available.</div>`;
  }
  const boxes = phases.map(p => {
    return `
      <div style="flex:1; min-width:110px; background:#f0fff4; border:1px solid #c8e6c9; border-radius:8px; padding:8px; text-align:center;">
        <div style="font-size:11px; font-weight:bold; color:#1a472a; margin-bottom:2px;">${p.name}</div>
        <div style="font-size:9px; color:#777; margin-bottom:4px;">(Overs ${p.overs})</div>
        <div style="font-size:17px; font-weight:bold; color:#222;">${p.runs}/${p.wickets}</div>
        <div style="font-size:10px; color:#555; margin-top:2px;">RR: ${p.rr}</div>
      </div>
    `;
  }).join('');

  return `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">${boxes}</div>`;
}

function renderPartnershipsHtml(partnerships = []) {
  if (!partnerships || partnerships.length === 0) {
    return `<div style="color:#888; font-size:12px; margin-top:6px;">No partnership details recorded for this innings.</div>`;
  }
  const rows = partnerships.map((p, idx) => {
    const b1 = p.batter1 || p.b1_name || 'Batter 1';
    const b2 = p.batter2 || p.b2_name || 'Batter 2';
    const runs = p.runs != null ? p.runs : 0;
    const balls = p.balls != null ? p.balls : 0;

    return `
      <tr>
        <td><strong>Wkt ${p.wicketNo || (idx + 1)}</strong></td>
        <td>${b1}</td>
        <td>${b2}</td>
        <td><strong>${runs}</strong> runs</td>
        <td>${balls} balls</td>
      </tr>
    `;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Wkt</th>
          <th>Batter 1</th>
          <th>Batter 2</th>
          <th>Partnership</th>
          <th>Balls</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderMatchInfoHtml(matchData = {}, activeContext = {}, effectiveInningsList = [], squadA = [], squadB = []) {
  const teamA = matchData?.team_a_name || matchData?.team_a || matchData?.teamA || effectiveInningsList[0]?.batting_team_name || 'Team A';
  const teamB = matchData?.team_b_name || matchData?.team_b || matchData?.teamB || effectiveInningsList[0]?.bowling_team_name || effectiveInningsList[1]?.batting_team_name || 'Team B';
  const venue = matchData?.venue || 'Standard Ground';
  const tossWinner = matchData?.toss_winner || 'N/A';
  const tossChoice = matchData?.toss_choice || 'N/A';
  const result = matchData?.result || matchData?.status || 'Completed';

  return `
    <div style="margin-top:30px; background:#f4f6f4; border-radius:10px; padding:18px; border:1px solid #e0e0e0;">
      <h3 style="margin:0 0 12px 0; color:#1a472a; border-bottom:2px solid #1a472a; padding-bottom:4px;">📌 Match Info & Playing Squads</h3>
      <div style="display:flex; flex-wrap:wrap; gap:16px; font-size:12px; color:#444; margin-bottom:16px;">
        <div style="flex:1; min-width:180px;"><strong>Match:</strong> ${teamA} vs ${teamB}</div>
        <div style="flex:1; min-width:180px;"><strong>Venue:</strong> ${venue}</div>
        <div style="flex:1; min-width:180px;"><strong>Toss:</strong> ${tossWinner} (chose to ${tossChoice})</div>
        <div style="flex:1; min-width:180px;"><strong>Result:</strong> ${result}</div>
      </div>

      <div style="display:flex; gap:20px; flex-wrap:wrap;">
        <div style="flex:1; min-width:200px; background:#fff; padding:12px; border-radius:8px; border:1px solid #ddd;">
          <h4 style="margin:0 0 8px 0; color:#1a472a;">👥 ${teamA} XI</h4>
          <ol style="margin:0; padding-left:20px; font-size:12px; color:#333;">
            ${squadA.length > 0 ? squadA.map(p => `<li style="margin-bottom:3px;">${typeof p === 'string' ? p : p.name}</li>`).join('') : '<li>No players listed</li>'}
          </ol>
        </div>

        <div style="flex:1; min-width:200px; background:#fff; padding:12px; border-radius:8px; border:1px solid #ddd;">
          <h4 style="margin:0 0 8px 0; color:#1a472a;">👥 ${teamB} XI</h4>
          <ol style="margin:0; padding-left:20px; font-size:12px; color:#333;">
            ${squadB.length > 0 ? squadB.map(p => `<li style="margin-bottom:3px;">${typeof p === 'string' ? p : p.name}</li>`).join('') : '<li>No players listed</li>'}
          </ol>
        </div>
      </div>
    </div>
  `;
}

export async function generateMatchPDF(matchData, inningsList = [], activeContext = {}) {
  try {
    const allBallsMap = activeContext?.allBallsMap || {};
    const allBatsmenMap = activeContext?.allBatsmenMap || {};
    const allBowlersMap = activeContext?.allBowlersMap || {};
    const allPartnershipsMap = activeContext?.allPartnershipsMap || {};

    const effectiveInningsList = (inningsList && inningsList.length > 0) ? inningsList : [
      {
        id: activeContext?.innings?.id || 1,
        innings_number: activeContext?.innings?.innings_number || 1,
        batting_team_name: activeContext?.innings?.batting_team_name || 'Team A',
        total_runs: activeContext?.summary?.runs || 0,
        total_wickets: activeContext?.summary?.wickets || 0,
        overs: activeContext?.summary?.oversCompleted || '0.0',
        extras: activeContext?.summary?.extras || 0
      }
    ];

    const teamA = matchData?.team_a_name || matchData?.team_a || matchData?.teamA || effectiveInningsList[0]?.batting_team_name || 'Team A';
    const teamB = matchData?.team_b_name || matchData?.team_b || matchData?.teamB || effectiveInningsList[0]?.bowling_team_name || effectiveInningsList[1]?.batting_team_name || 'Team B';
    const matchName = matchData?.title || matchData?.match_name || `${teamA} vs ${teamB}`;
    const matchType = matchData?.match_format || matchData?.type || matchData?.match_type || 'Match';
    const status = matchData?.result || matchData?.status || 'Completed';
    const dateStr = matchData?.date ? new Date(matchData.date).toLocaleDateString() : new Date().toLocaleDateString();
    const totalOvers = matchData?.total_overs || 20;

    let squadA = (activeContext?.roster?.a && activeContext.roster.a.length > 0) ? activeContext.roster.a : (matchData?.team_a_squad || []);
    let squadB = (activeContext?.roster?.b && activeContext.roster.b.length > 0) ? activeContext.roster.b : (matchData?.team_b_squad || []);

    if (squadA.length === 0 || squadB.length === 0) {
      const setA = new Set(squadA);
      const setB = new Set(squadB);

      effectiveInningsList.forEach((inn, idx) => {
        const innId = inn.id || inn.innings_number || (idx + 1);
        const batTeam = inn.batting_team_name || (idx % 2 === 0 ? teamA : teamB);
        const bowlTeam = inn.bowling_team_name || (idx % 2 === 0 ? teamB : teamA);
        const targetSetBat = (batTeam === teamA) ? setA : setB;
        const targetSetBowl = (bowlTeam === teamA) ? setA : setB;

        const bList = allBatsmenMap[innId] || inn.batsmen || [];
        const bwList = allBowlersMap[innId] || inn.bowlers || [];

        bList.forEach(b => { if (b.name) targetSetBat.add(b.name); });
        bwList.forEach(bw => { if (bw.name) targetSetBowl.add(bw.name); });
      });

      squadA = Array.from(setA);
      squadB = Array.from(setB);
    }

    const colors = ['#1565c0', '#c62828', '#d4a017', '#7b1fa2'];
    const wormDataArr = effectiveInningsList.map((inn, idx) => {
      const innId = inn.id || inn.innings_number || (idx + 1);
      const isCurrentInnings = inn.id === activeContext?.innings?.id || idx === (effectiveInningsList.length - 1);
      const balls = allBallsMap[innId] || (isCurrentInnings ? (activeContext?.balls || activeContext?.allBalls || []) : []);
      const prog = computeScoreProgression(balls);
      const team = inn.batting_team_name || `Innings ${idx + 1}`;
      return {
        prog,
        team: `${team} (Inn ${inn.innings_number || idx + 1})`,
        color: colors[idx % colors.length]
      };
    });

    const inningsHtmlArr = effectiveInningsList.map((inn, idx) => {
      const innId = inn.id || inn.innings_number || (idx + 1);
      const isCurrentInnings = inn.id === activeContext?.innings?.id || idx === (effectiveInningsList.length - 1);
      
      const balls = allBallsMap[innId] || (isCurrentInnings ? (activeContext?.balls || activeContext?.allBalls || []) : []);
      
      const computed = computeInningsSummary(balls, totalOvers);

      let bList = (allBatsmenMap[innId] && allBatsmenMap[innId].length > 0)
        ? allBatsmenMap[innId]
        : ((inn.batsmen && inn.batsmen.length > 0)
            ? inn.batsmen
            : (computed.batsmen && computed.batsmen.length > 0
                ? computed.batsmen
                : (isCurrentInnings ? activeContext?.batsmen || [] : [])));

      let bwList = (allBowlersMap[innId] && allBowlersMap[innId].length > 0)
        ? allBowlersMap[innId]
        : ((inn.bowlers && inn.bowlers.length > 0)
            ? inn.bowlers
            : (computed.bowlers && computed.bowlers.length > 0
                ? computed.bowlers
                : (isCurrentInnings ? activeContext?.bowlers || [] : [])));

      const overRuns = computeOverRuns(balls);
      const phaseStats = computePhaseStats(balls, totalOvers, matchData?.has_powerplay ?? true, matchData?.powerplay_end || 6);
      const partnerships = allPartnershipsMap[innId] || inn.partnerships || (isCurrentInnings ? activeContext?.partnerships || [] : []);

      const batRows = bList.map(b => `
        <tr>
          <td><strong>${b.name || 'Batter'}</strong> ${b.onStrike ? '*' : ''}</td>
          <td>${b.isOut ? (buildDismissalString(b) || b.dismissalType || 'Out') : 'not out'}</td>
          <td><strong>${b.runs || 0}</strong></td>
          <td>${b.balls || 0}</td>
          <td>${b.fours || 0}</td>
          <td>${b.sixes || 0}</td>
          <td>${b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
        </tr>
      `).join('');

      const bowlRows = bwList.map(bw => `
        <tr>
          <td><strong>${bw.name || 'Bowler'}</strong></td>
          <td>${bw.overs || (typeof bw.balls === 'number' ? formatOvers(bw.balls) : '0.0')}</td>
          <td>${bw.maidens || 0}</td>
          <td>${bw.runs || 0}</td>
          <td><strong>${bw.wickets || 0}</strong></td>
          <td>${bw.overs > 0 ? (bw.runs / parseFloat(bw.overs)).toFixed(2) : (bw.balls > 0 ? ((bw.runs / bw.balls) * 6).toFixed(2) : '0.00')}</td>
        </tr>
      `).join('');

      const runsVal = inn.total_runs != null ? inn.total_runs : (computed.runs || 0);
      const wktsVal = inn.total_wickets != null ? inn.total_wickets : (computed.wickets || 0);
      const oversVal = inn.overs || computed.oversCompleted || '0.0';
      const extrasVal = inn.extras != null ? inn.extras : (computed.extras || 0);

      return `
        <div style="margin-top: 24px; background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #c8e6c9; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
          <div style="background: #1a472a; color: #ffffff; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; color: #ffffff;">
              Innings ${inn.innings_number || (idx + 1)}: ${inn.batting_team_name || (idx === 0 ? teamA : teamB)} 
              — ${runsVal}/${wktsVal}
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #a5d6a7;">
              Overs: ${oversVal} | Extras: ${extrasVal}
            </p>
          </div>

          <h4 style="margin: 14px 0 6px 0; color: #1a472a; font-size: 15px;">🏏 Batting Scorecard</h4>
          <table>
            <thead>
              <tr>
                <th>Batter</th>
                <th>Dismissal</th>
                <th>Runs</th>
                <th>Balls</th>
                <th>4s</th>
                <th>6s</th>
                <th>SR</th>
              </tr>
            </thead>
            <tbody>
              ${batRows || '<tr><td colspan="7">No batting details recorded</td></tr>'}
            </tbody>
          </table>

          <h4 style="margin: 18px 0 6px 0; color: #1a472a; font-size: 15px;">🎯 Bowling Scorecard</h4>
          <table>
            <thead>
              <tr>
                <th>Bowler</th>
                <th>Overs</th>
                <th>Mdn</th>
                <th>Runs</th>
                <th>Wkts</th>
                <th>Econ</th>
              </tr>
            </thead>
            <tbody>
              ${bowlRows || '<tr><td colspan="6">No bowling details recorded</td></tr>'}
            </tbody>
          </table>

          <h4 style="margin: 20px 0 8px 0; color: #1a472a; font-size: 15px;">📊 Innings Statistics & Visual Breakdown</h4>
          <div style="display:flex; flex-wrap:wrap; gap:20px; margin-top:10px;">
            <div style="flex:1; min-width:240px; background:#fafafa; padding:12px; border-radius:8px; border:1px solid #eee;">
              <h5 style="margin:0 0 10px 0; color:#1a472a; text-align:center;">📈 Over-by-Over Manhattan</h5>
              ${renderManhattanChartSvg(overRuns)}
            </div>
            
            <div style="flex:1; min-width:240px; background:#fafafa; padding:12px; border-radius:8px; border:1px solid #eee;">
              <h5 style="margin:0 0 10px 0; color:#1a472a; text-align:center;">🐍 Innings Progression (Worm)</h5>
              ${renderCombinedWormGraphSvg(wormDataArr, totalOvers)}
            </div>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:20px; margin-top:16px;">
            <div style="flex:1; min-width:240px; background:#fafafa; padding:12px; border-radius:8px; border:1px solid #eee;">
              <h5 style="margin:0 0 10px 0; color:#1a472a; text-align:center;">🎡 Wagon Wheel</h5>
              ${renderMatchWagonWheelSvg(balls, 'right')}
            </div>

            <div style="flex:1; min-width:240px; background:#fafafa; padding:12px; border-radius:8px; border:1px solid #eee;">
              <h5 style="margin:0 0 10px 0; color:#1a472a;">⚡ Phase Breakdown</h5>
              ${renderPhaseBreakdownHtml(phaseStats)}

              <h5 style="margin:16px 0 6px 0; color:#1a472a;">🤝 Key Partnerships</h5>
              ${renderPartnershipsHtml(partnerships)}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const matchInfoHtml = renderMatchInfoHtml(matchData, activeContext, effectiveInningsList, squadA, squadB);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${matchName} - Official Match PDF Report</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; margin: 0; padding: 24px; background: #fff; }
          .header { background: #1a472a; color: #fff; padding: 20px 24px; border-radius: 12px; margin-bottom: 20px; }
          .header h1 { margin: 0 0 6px 0; font-size: 26px; color: #fff; }
          .header p { margin: 0; color: #a5d6a7; font-size: 14px; }
          .match-status { background: #e8f5e9; border-left: 5px solid #1a472a; padding: 14px; margin-bottom: 20px; border-radius: 6px; font-weight: bold; color: #1a472a; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
          th { background: #e8f5e9; color: #1a472a; text-align: left; padding: 8px; border-bottom: 2px solid #c8e6c9; }
          td { padding: 8px; border-bottom: 1px solid #eee; }
          tr:nth-child(even) { background: #fafafa; }
          .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏆 ${matchName}</h1>
          <p>${teamA} vs ${teamB} | Type: ${matchType} | Date: ${dateStr}</p>
        </div>

        <div class="match-status">
          Match Status: ${status}
        </div>

        <h2 style="color: #1a472a; margin-top: 20px; border-bottom: 2px solid #1a472a; padding-bottom: 4px;">🏏 Complete Match Scorecards & Analytics</h2>
        ${inningsHtmlArr}

        ${matchInfoHtml}

        <div class="footer">
          Generated by Cricket App · Official Match Centre Report
        </div>
      </body>
      </html>
    `;

    await exportAndSharePDF(htmlContent, matchName);
  } catch (err) {
    Alert.alert('Error', `Could not generate Match PDF: ${err.message}`);
  }
}


