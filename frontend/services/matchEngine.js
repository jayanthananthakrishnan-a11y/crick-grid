// ── Pure cricket logic — no storage, no UI ────────────────────────────────────

export function formatOvers(legalBalls) {
  const overs = Math.floor(legalBalls / 6);
  const rem   = legalBalls % 6;
  return `${overs}.${rem}`;
}

export function calcStrikeRate(runs, balls) {
  if (!balls) return 0;
  return parseFloat(((runs / balls) * 100).toFixed(1));
}

export function calcEconomy(runs, balls) {
  if (!balls) return 0;
  return parseFloat(((runs / balls) * 6).toFixed(1));
}

export function calcCRR(runs, legalBalls) {
  if (!legalBalls) return 0;
  return parseFloat(((runs / legalBalls) * 6).toFixed(1));
}

export function calcRRR(target, currentRuns, ballsRemaining) {
  const needed = target - currentRuns;
  if (ballsRemaining <= 0) return 0;
  return parseFloat(((needed / ballsRemaining) * 6).toFixed(2));
}

export function isLegalDelivery(ball) {
  return !ball.is_wide && !ball.is_no_ball;
}

// ── Special delivery types that do NOT count as a ball faced ─────────────────
// Mankad (non_striker_run_out) and retired_hurt are events, not deliveries.
export function isNoBallEvent(ball) {
  return (
    ball.is_wicket &&
    (ball.wicket_type === 'non_striker_run_out' || ball.wicket_type === 'retired_hurt')
  );
}

export function shouldStrikeRotate(runs) {
  return runs % 2 === 1;
}

// ── Follow-on threshold (official Test Match law) ─────────────────────────────
// If a match has 5+ days: 200 runs behind
// If 3-4 days: 150 runs
// If 1-2 days: 100 runs
// For our purposes we use a simple fixed threshold since we track overs not days.
// We expose a helper that the UI can use with a configurable threshold.
export function getFollowOnThreshold(totalOvers) {
  // Approximate: 200+ overs = 200, 100-199 = 150, <100 = 100
  if (totalOvers >= 200) return 200;
  if (totalOvers >= 100) return 150;
  return 100;
}

// ── Recompute innings summary from raw balls ──────────────────────────────────
export function computeInningsSummary(balls, totalOvers) {
  let runs = 0, wickets = 0, legalBalls = 0;
  let extras = 0, wides = 0, noBalls = 0, byes = 0, legByes = 0;

  for (const b of balls) {
    // Mankad / retired_hurt: count wicket but NOT as a ball
    if (isNoBallEvent(b)) {
      if (b.is_wicket) wickets++;
      continue;
    }

    const ballRuns = (b.runs_scored || 0) + (b.extras_runs || 0);
    runs += ballRuns;
    if (b.is_wicket) wickets++;
    if (isLegalDelivery(b)) legalBalls++;

    if (b.is_wide) {
      wides++;
      extras += 1 + (b.extras_runs || 0);
    }
    if (b.is_no_ball) {
      noBalls++;
      extras += 1 + (b.extras_runs || 0);
    }
    if (b.is_bye) {
      byes++;
      extras += (b.extras_runs || 0);
    }
    if (b.is_leg_bye) {
      legByes++;
      extras += (b.extras_runs || 0);
    }
  }

  return {
    runs, wickets, legalBalls, extras,
    wides, noBalls, byes, legByes,
    crr:              calcCRR(runs, legalBalls),
    oversCompleted:   formatOvers(legalBalls),
    ballsRemaining:   totalOvers * 6 - legalBalls,
    totalOversAllowed: totalOvers,
  };
}

// ── Recompute ALL batsman stats from raw ball array ───────────────────────────
export function computeAllBatsmenFromBalls(balls, existingBatsmen) {
  const stats = {};

  for (const b of existingBatsmen) {
    stats[b.name] = { ...b, runs: 0, balls: 0, fours: 0, sixes: 0 };
  }

  for (const ball of balls) {
    if (!ball.batsman_name || !stats[ball.batsman_name]) continue;
    const b = stats[ball.batsman_name];

    // Mankad / retired_hurt: not a ball faced, skip
    if (isNoBallEvent(ball)) continue;

    // Balls faced: legal deliveries + no-balls (not wides)
    if (!ball.is_wide) {
      b.balls += 1;
    }

    // Runs: only bat runs (not byes, not leg byes, not wides)
    if (!ball.is_wide && !ball.is_bye && !ball.is_leg_bye) {
      b.runs += (ball.runs_scored || 0);
      if (ball.runs_scored === 4) b.fours += 1;
      if (ball.runs_scored === 6) b.sixes += 1;
    }
  }

  return Object.values(stats);
}

// ── Recompute ALL bowler stats from raw ball array ────────────────────────────
export function computeAllBowlersFromBalls(balls, existingBowlers) {
  const stats = {};

  for (const b of existingBowlers) {
    stats[b.name] = {
      ...b,
      balls: 0, runs: 0, wickets: 0,
      wides: 0, noBalls: 0, maidens: 0,
    };
  }

  for (const ball of balls) {
    if (!ball.bowler_name || !stats[ball.bowler_name]) continue;
    const b = stats[ball.bowler_name];

    // Mankad / retired_hurt: not a ball, not a bowler wicket
    if (isNoBallEvent(ball)) continue;

    if (isLegalDelivery(ball)) b.balls += 1;

    // Correct cricket law for bowler runs:
    // Leg byes and byes NOT credited to bowler
    // Wides and no-balls ARE credited (penalty runs)
    if (!ball.is_bye && !ball.is_leg_bye) {
      b.runs += (ball.runs_scored || 0);
    }
    if (ball.is_wide || ball.is_no_ball) {
      b.runs += (ball.extras_runs || 0);
    }

    if (ball.is_wide)    b.wides   += 1;
    if (ball.is_no_ball) b.noBalls += 1;

    // Wickets: run_outs, non_striker_run_out, retired don't count for bowler
    if (
      ball.is_wicket &&
      ball.wicket_type !== 'run_out' &&
      ball.wicket_type !== 'non_striker_run_out' &&
      ball.wicket_type !== 'retired_hurt'
    ) {
      b.wickets += 1;
    }
  }

  // ── Maiden over calculation ───────────────────────────────────────────────
  const overGroups = {};
  for (const ball of balls) {
    if (!ball.bowler_name || !isLegalDelivery(ball)) continue;
    if (isNoBallEvent(ball)) continue;
    const key = `${ball.bowler_name}_${ball.over_number}`;
    if (!overGroups[key]) {
      overGroups[key] = { runs: 0, balls: 0, bowler: ball.bowler_name };
    }
    if (!ball.is_bye && !ball.is_leg_bye) {
      overGroups[key].runs += (ball.runs_scored || 0);
    }
    if (ball.is_wide || ball.is_no_ball) {
      overGroups[key].runs += (ball.extras_runs || 0);
    }
    overGroups[key].balls += 1;
  }
  for (const key of Object.keys(overGroups)) {
    const g = overGroups[key];
    if (g.balls >= 6 && g.runs === 0 && stats[g.bowler]) {
      stats[g.bowler].maidens += 1;
    }
  }

  return Object.values(stats).map(b => ({
    ...b,
    overs:   formatOvers(b.balls),
    economy: calcEconomy(b.runs, b.balls),
  }));
}

// ── Over state helpers ────────────────────────────────────────────────────────
export function getCurrentOverState(balls) {
  // Only count legal deliveries for over tracking (exclude Mankad/retired events)
  const filtered = balls.filter(b => !isNoBallEvent(b));
  const legalBalls  = filtered.filter(b => isLegalDelivery(b)).length;
  const currentOver = Math.floor(legalBalls / 6);
  const ballsInOver = legalBalls % 6;
  return { currentOver, ballsInOver, legalBalls };
}

export function getBallsInCurrentOver(balls) {
  const filtered = balls.filter(b => !isNoBallEvent(b));
  const { currentOver } = getCurrentOverState(filtered);
  return filtered.filter(b => b.over_number === currentOver);
}

export function isOverComplete(balls) {
  const { ballsInOver, legalBalls } = getCurrentOverState(balls);
  return ballsInOver === 0 && legalBalls > 0;
}

// ── Over-by-over runs for bar chart ──────────────────────────────────────────
export function computeOverRuns(balls) {
  const filtered = balls.filter(b => !isNoBallEvent(b));
  const overMap = {};
  for (const ball of filtered) {
    const o = ball.over_number;
    if (!overMap[o]) {
      overMap[o] = {
        over: o + 1,
        runs: 0, wickets: 0,
        fours: 0, sixes: 0,
        bowler: ball.bowler_name,
        legalBalls: 0,
      };
    }
    overMap[o].runs      += (ball.runs_scored || 0) + (ball.extras_runs || 0);
    overMap[o].legalBalls += isLegalDelivery(ball) ? 1 : 0;
    if (ball.is_wicket)          overMap[o].wickets += 1;
    if (ball.runs_scored === 4)  overMap[o].fours   += 1;
    if (ball.runs_scored === 6)  overMap[o].sixes   += 1;
  }
  return Object.values(overMap)
    .filter(o => o.legalBalls >= 6)
    .sort((a, b) => a.over - b.over);
}

// ── Cumulative score progression for worm graph ───────────────────────────────
export function computeScoreProgression(balls) {
  const filtered = balls.filter(b => !isNoBallEvent(b));
  const points = [{ ball: 0, runs: 0, over: '0.0', wicket: false }];
  let cumRuns = 0, legalBalls = 0;

  for (const ball of filtered) {
    cumRuns    += (ball.runs_scored || 0) + (ball.extras_runs || 0);
    if (isLegalDelivery(ball)) legalBalls++;
    points.push({
      ball:    legalBalls,
      runs:    cumRuns,
      over:    formatOvers(legalBalls),
      wicket:  ball.is_wicket,
      batter:  ball.is_wicket ? ball.batsman_name : null,
    });
  }
  return points;
}

// ── Phase stats (dynamic, with optional powerplay config) ─────────────────────
export function computePhaseStats(
  balls,
  totalOvers,
  hasPowerplay = false,
  powerplayEnd = 6
) {
  const filtered = balls.filter(b => !isNoBallEvent(b));
  let ppEnd, deathStart;

  if (hasPowerplay) {
    ppEnd      = Math.min(powerplayEnd, totalOvers - 1);
    deathStart = Math.max(ppEnd + 1, Math.floor(totalOvers * 0.7));
  } else {
    const earlyOvers = Math.max(1, Math.round(totalOvers * 0.3));
    const deathOvers = Math.max(1, Math.round(totalOvers * 0.3));
    ppEnd      = earlyOvers;
    deathStart = totalOvers - deathOvers;
  }

  if (ppEnd >= deathStart) {
    deathStart = ppEnd + 1;
  }

  const phases = {
    early: {
      name:  hasPowerplay ? 'Powerplay' : 'Early',
      overs: `1-${ppEnd}`,
      runs: 0, wickets: 0, balls: 0,
    },
    middle: {
      name:  'Middle',
      overs: ppEnd < deathStart - 1 ? `${ppEnd + 1}-${deathStart}` : 'N/A',
      runs: 0, wickets: 0, balls: 0,
    },
    death: {
      name:  'Death',
      overs: `${deathStart + 1}-${totalOvers}`,
      runs: 0, wickets: 0, balls: 0,
    },
  };

  for (const ball of filtered) {
    const o = ball.over_number;
    let phase;
    if (o < ppEnd)           phase = 'early';
    else if (o < deathStart) phase = 'middle';
    else                     phase = 'death';

    phases[phase].runs += (ball.runs_scored || 0) + (ball.extras_runs || 0);
    if (ball.is_wicket)        phases[phase].wickets += 1;
    if (isLegalDelivery(ball)) phases[phase].balls   += 1;
  }

  return Object.values(phases).map(p => ({
    ...p,
    rr: p.balls > 0
      ? parseFloat(((p.runs / p.balls) * 6).toFixed(2))
      : 0,
    overs_played: formatOvers(p.balls),
  }));
}

// ── Projected score (linear extrapolation) ────────────────────────────────────
export function projectScore(currentRuns, legalBalls, totalOvers) {
  const totalBalls = totalOvers * 6;
  if (!legalBalls) return currentRuns;
  const rpp = currentRuns / legalBalls;
  return Math.round(currentRuns + rpp * (totalBalls - legalBalls));
}

// ── Generate narrative string for ball log ────────────────────────────────────
export function generateNarrative(ball) {
  if (ball.is_wicket) {
    const fielder = ball.fielder_name ? ` (${ball.fielder_name})` : '';
    const bowler  = ball.bowler_name  ? ` b ${ball.bowler_name}`  : '';
    const types = {
      bowled:                `Bowled! The stumps are shattered!${bowler}`,
      caught:                `Caught!${fielder}${bowler} Excellent catch!`,
      stumped:               `Stumped!${fielder}${bowler} Quick work by the keeper!`,
      lbw:                   `LBW! Plumb in front!${bowler}`,
      run_out:               `Run out!${fielder} Direct hit!`,
      non_striker_run_out:   `Non-striker run out!${fielder} Backing up too far!`,
      retired_hurt:          'Retired hurt.',
      over_the_fence:        'Over the fence — six and out!',
    };
    return types[ball.wicket_type] || 'Wicket!';
  }
  if (ball.is_wide)    return 'Wide ball.';
  if (ball.is_no_ball) return `No ball!${ball.runs_scored > 0 ? ` ${ball.runs_scored} run(s) off the bat.` : ''}`;
  if (ball.is_bye)     return `Bye! ${ball.extras_runs || 1} run(s). Not off the bat.`;
  if (ball.is_leg_bye) return `Leg bye! ${ball.extras_runs || 1} run(s). Off the pad.`;
  if (ball.runs_scored === 0) return 'Dot ball.';
  if (ball.runs_scored === 4) return "It's a boundary. Four!";
  if (ball.runs_scored === 6) return "Huge! It's a six!";
  const words = ['', 'Single.', 'Two runs.', 'Three runs.', '', '', ''];
  return words[ball.runs_scored] || `${ball.runs_scored} runs.`;
}

// ── Build dismissal description string for scorecard ─────────────────────────
export function buildDismissalString(batter) {
  if (!batter.isOut) return 'batting';
  const type    = batter.dismissalType || '';
  const fielder = batter.fielderName   || '';
  const bowler  = batter.bowlerName    || '';
  const keeper  = batter.keeperName    || '';

  switch (type) {
    case 'bowled':
      return `b ${bowler}`;
    case 'caught':
      return `c ${fielder || 'unknown'} b ${bowler}`;
    case 'stumped':
      return `st ${keeper || fielder || 'unknown'} b ${bowler}`;
    case 'lbw':
      return `lbw b ${bowler}`;
    case 'run_out':
      return `run out (${fielder || 'unknown'})`;
    case 'non_striker_run_out':
      return `non-striker run out (${fielder || bowler || 'unknown'})`;
    case 'retired_hurt':
      return 'retired hurt';
    case 'over_the_fence':
      return 'handled ball (over the fence)';
    default:
      return type.replace(/_/g, ' ');
  }
}