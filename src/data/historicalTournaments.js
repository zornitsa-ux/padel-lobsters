// ============================================================================
//  historicalTournaments.js — pre-Supabase tournament archive
// ============================================================================
//
//  Hardcoded record of tournaments that ran before the app went live, kept
//  here so the History page, the Lifetime Stats card, the playerHistory
//  helper, and the Glicko-2 ratings recompute can all read from a single
//  source. Each entry has:
//
//    id         — slug used as a stable React key
//    name       — display name
//    date       — ISO date or human-readable month
//    type       — 'mixed' or 'ladies'
//    players    — final standings, sorted descending by total
//    rounds     — round-by-round match data (or null when not recorded)
//    numRounds  — count of rounds played
//    numCourts  — count of courts used (or null)
//    note       — optional caveat shown on the History page
//
//  When data is missing (no per-round matches, just final totals) the
//  consumers gracefully degrade — `rounds: null` is allowed.
// ============================================================================

// ── December 2025 ─────────────────────────────────────────────────────────────
const DEC_STANDINGS = [
  { name: 'Ian', total: 34 },
  { name: 'Alex M', total: 33 },
  { name: 'Mariano', total: 33 },
  { name: 'Lucia', total: 29 },
  { name: 'Lisa', total: 28 },
  { name: 'Uziel', total: 25 },
  { name: 'Elena', total: 25 },
  { name: 'Hakan', total: 24 },
  { name: 'Daniel', total: 24 },
  { name: 'Chris', total: 24 },
  { name: 'Paola', total: 24 },
  { name: 'Damiao', total: 23 },
  { name: 'Valesca', total: 22 },
  { name: 'Ingrid', total: 22 },
  { name: 'Gonzalo U', total: 22 },
  { name: 'Lara', total: 21 },
  { name: 'Davide', total: 21 },
  { name: 'Shahar', total: 20 },
  { name: 'Marielle', total: 19 },
  { name: 'Alex G', total: 19 },
  { name: 'Kemal', total: 19 },
  { name: 'Gino', total: 18 },
  { name: 'Zornitsa', total: 17 },
  { name: 'Karlijn', total: 17 },
  { name: 'Mel', total: 17 },
  { name: 'Gonzalo E', total: 17 },
  { name: 'Rowan', total: 17 },
  { name: 'Markus', total: 16 },
  { name: 'Jon', total: 15 },
  { name: 'Arda', total: 13 },
  { name: 'Omar', total: 11 },
  { name: 'Maria', total: 11 },
].sort((a, b) => b.total - a.total)

const DEC_ROUNDS = [
  {
    round: 1,
    matches: [
      { court: 1, t1: ['Zornitsa', 'Gonzalo E'], t2: ['Lara', 'Alex M'], s1: 3, s2: 6 },
      { court: 2, t1: ['Karlijn', 'Uziel'], t2: ['Valesca', 'Gino'], s1: 5, s2: 2 },
      { court: 3, t1: ['Marielle', 'Jon'], t2: ['Ingrid', 'Markus'], s1: 3, s2: 4 },
      { court: 4, t1: ['Lucia', 'Daniel'], t2: ['Elena', 'Davide'], s1: 4, s2: 2 },
      { court: 5, t1: ['Lisa', 'Arda'], t2: ['Paola', 'Nico B'], s1: 3, s2: 6 },
      { court: 6, t1: ['Mel', 'Chris'], t2: ['Rowan', 'Gonzalo U'], s1: 2, s2: 3 },
      { court: 7, t1: ['Hakan', 'Damiao'], t2: ['Alex G', 'Shahar'], s1: 3, s2: 2 },
      { court: 8, t1: ['Omar', 'Maria'], t2: ['Erica', 'Kemal'], s1: 1, s2: 5 },
    ],
  },
  {
    round: 2,
    matches: [
      { court: 1, t1: ['Zornitsa', 'Uziel'], t2: ['Ingrid', 'Damiao'], s1: 4, s2: 3 },
      { court: 2, t1: ['Lara', 'Davide'], t2: ['Elena', 'Markus'], s1: 3, s2: 5 },
      { court: 3, t1: ['Lisa', 'Alex M'], t2: ['Karlijn', 'Omar'], s1: 5, s2: 2 },
      { court: 4, t1: ['Mel', 'Daniel'], t2: ['Hakan', 'Marielle'], s1: 3, s2: 4 },
      { court: 5, t1: ['Lucia', 'Chris'], t2: ['Gonzalo U', 'Paola'], s1: 4, s2: 3 },
      { court: 6, t1: ['Shahar', 'Gonzalo E'], t2: ['Kemal', 'Alex G'], s1: 2, s2: 4 },
      { court: 7, t1: ['Valesca', 'Arda'], t2: ['Rowan', 'Nico B'], s1: 3, s2: 4 },
      { court: 8, t1: ['Gino', 'Erica'], t2: ['Jon', 'Maria'], s1: 5, s2: 2 },
    ],
  },
  {
    round: 3,
    matches: [
      { court: 1, t1: ['Karlijn', 'Gonzalo E'], t2: ['Lucia', 'Uziel'], s1: 2, s2: 4 },
      { court: 2, t1: ['Valesca', 'Daniel'], t2: ['Zornitsa', 'Jon'], s1: 5, s2: 1 },
      { court: 3, t1: ['Elena', 'Omar'], t2: ['Marielle', 'Nico B'], s1: 3, s2: 6 },
      { court: 4, t1: ['Mel', 'Alex M'], t2: ['Lara', 'Markus'], s1: 5, s2: 2 },
      { court: 5, t1: ['Rowan', 'Shahar'], t2: ['Hakan', 'Paola'], s1: 3, s2: 4 },
      { court: 6, t1: ['Ingrid', 'Davide'], t2: ['Lisa', 'Damiao'], s1: 2, s2: 6 },
      { court: 7, t1: ['Gonzalo U', 'Maria'], t2: ['Erica', 'Chris'], s1: 2, s2: 5 },
      { court: 8, t1: ['Gino', 'Kemal'], t2: ['Arda', 'Alex G'], s1: 3, s2: 3 },
    ],
  },
  {
    round: 4,
    matches: [
      { court: 1, t1: ['Ingrid', 'Gonzalo U'], t2: ['Lucia', 'Damiao'], s1: 2, s2: 5 },
      { court: 2, t1: ['Marielle', 'Uziel'], t2: ['Elena', 'Alex G'], s1: 2, s2: 5 },
      { court: 3, t1: ['Lisa', 'Hakan'], t2: ['Markus', 'Rowan'], s1: 6, s2: 1 },
      { court: 4, t1: ['Zornitsa', 'Omar'], t2: ['Chris', 'Paola'], s1: 3, s2: 4 },
      { court: 5, t1: ['Karlijn', 'Daniel'], t2: ['Shahar', 'Lara'], s1: 4, s2: 4 },
      { court: 6, t1: ['Erica', 'Gonzalo E'], t2: ['Kemal', 'Maria'], s1: 7, s2: 0 },
      { court: 7, t1: ['Valesca', 'Alex M'], t2: ['Arda', 'Mel'], s1: 6, s2: 1 },
      { court: 8, t1: ['Gino', 'Jon'], t2: ['Nico B', 'Davide'], s1: 2, s2: 4 },
    ],
  },
  {
    round: 5,
    matches: [
      { court: 1, t1: ['Marielle', 'Gonzalo E'], t2: ['Ingrid', 'Uziel'], s1: 1, s2: 5 },
      { court: 2, t1: ['Lucia', 'Gonzalo U'], t2: ['Zornitsa', 'Alex G'], s1: 6, s2: 1 },
      { court: 3, t1: ['Lisa', 'Nico B'], t2: ['Karlijn', 'Markus'], s1: 7, s2: 1 },
      { court: 4, t1: ['Mel', 'Damiao'], t2: ['Elena', 'Alex M'], s1: 1, s2: 6 },
      { court: 5, t1: ['Lara', 'Daniel'], t2: ['Shahar', 'Erica'], s1: 2, s2: 6 },
      { court: 6, t1: ['Valesca', 'Jon'], t2: ['Hakan', 'Maria'], s1: 5, s2: 3 },
      { court: 7, t1: ['Gino', 'Omar'], t2: ['Chris', 'Kemal'], s1: 1, s2: 6 },
      { court: 8, t1: ['Davide', 'Paola'], t2: ['Arda', 'Rowan'], s1: 5, s2: 1 },
    ],
  },
  {
    round: 6,
    matches: [
      { court: 1, t1: ['Zornitsa', 'Uziel'], t2: ['Marielle', 'Markus'], s1: 5, s2: 3 },
      { court: 2, t1: ['Lisa', 'Kemal'], t2: ['Ingrid', 'Nico B'], s1: 1, s2: 6 },
      { court: 3, t1: ['Mel', 'Davide'], t2: ['Valesca', 'Omar'], s1: 5, s2: 1 },
      { court: 4, t1: ['Lara', 'Alex G'], t2: ['Elena', 'Hakan'], s1: 4, s2: 4 },
      { court: 5, t1: ['Lucia', 'Daniel'], t2: ['Paola', 'Gonzalo E'], s1: 6, s2: 2 },
      { court: 6, t1: ['Rowan', 'Damiao'], t2: ['Shahar', 'Karlijn'], s1: 5, s2: 3 },
      { court: 7, t1: ['Chris', 'Maria'], t2: ['Erica', 'Gonzalo U'], s1: 3, s2: 6 },
      { court: 8, t1: ['Arda', 'Jon'], t2: ['Gino', 'Alex M'], s1: 2, s2: 5 },
    ],
  },
]

// ── January 2026 ──────────────────────────────────────────────────────────────
const JAN_PLAYERS = [
  { name: 'Ingrid', r: [5, 4, 5, 5, 4, 6], total: 29 },
  { name: 'Marielle', r: [4, 3, 5, 4, 6, 6], total: 28 },
  { name: 'Vasilya', r: [7, 4, 3, 7, 5, 2], total: 28 },
  { name: 'Ian', r: [5, 4, 3, 4, 5, 6], total: 27 },
  { name: 'Baturay', r: [4, 3, 5, 5, 3, 6], total: 26 },
  { name: 'Gonzalo U', r: [2, 4, 5, 7, 6, 2], total: 26 },
  { name: 'Chloe', r: [3, 4, 3, 4, 5, 6], total: 25 },
  { name: 'Damiao', r: [2, 4, 4, 3, 5, 5], total: 23 },
  { name: 'Gonzalo E', r: [2, 3, 5, 3, 6, 4], total: 23 },
  { name: 'Zornitsa', r: [3, 5, 3, 4, 4, 4], total: 23 },
  { name: 'Aimee', r: [2, 4, 3, 2, 6, 5], total: 22 },
  { name: 'Chris', r: [2, 2, 5, 5, 5, 3], total: 22 },
  { name: 'Gino', r: [3, 5, 3, 5, 2, 4], total: 22 },
  { name: 'Markus', r: [1, 5, 3, 4, 5, 4], total: 22 },
  { name: 'Mel', r: [4, 5, 3, 5, 2, 3], total: 22 },
  { name: 'Nico B', r: [3, 4, 3, 3, 4, 5], total: 22 },
  { name: 'Sebas', r: [4, 5, 4, 5, 1, 3], total: 22 },
  { name: 'Zico', r: [2, 4, 3, 4, 6, 3], total: 22 },
  { name: 'Alex M', r: [3, 3, 5, 4, 1, 5], total: 21 },
  { name: 'Daniel', r: [7, 3, 4, 2, 1, 4], total: 21 },
  { name: 'Mauri', r: [4, 5, 3, 2, 6, 0], total: 20 },
  { name: 'Seb V', r: [3, 3, 4, 3, 4, 3], total: 20 },
  { name: 'Cindy', r: [3, 3, 4, 1, 4, 4], total: 19 },
  { name: 'Gagan', r: [2, 2, 4, 5, 2, 4], total: 19 },
  { name: 'Alex G', r: [2, 4, 2, 2, 4, 4], total: 18 },
  { name: 'Amanda', r: [1, 3, 3, 4, 4, 3], total: 18 },
  { name: 'Jon', r: [1, 4, 3, 3, 1, 6], total: 18 },
  { name: 'Nico T', r: [4, 3, 3, 1, 4, 3], total: 18 },
  { name: 'Juan', r: [1, 3, 3, 5, 2, 3], total: 17 },
  { name: 'Adri', r: [2, 3, 5, 3, 3, 0], total: 16 },
  { name: 'Paola', r: [2, 4, 3, 3, 1, 3], total: 16 },
  { name: 'Valesca', r: [3, 3, 2, 3, 1, 3], total: 15 },
]

// ── March 2026 ────────────────────────────────────────────────────────────────
const MAR_STANDINGS = [
  { name: 'Alex B', total: 29 },
  { name: 'Alex M', total: 27 },
  { name: 'Karlijn', total: 27 },
  { name: 'Uziel', total: 27, podium: 2 },
  { name: 'Zornitsa', total: 27 },
  { name: 'Erica', total: 26 },
  { name: 'Ini', total: 26 },
  { name: 'Anthony', total: 25 },
  { name: 'Elena', total: 24 },
  { name: 'Stamatis', total: 24 },
  { name: 'Juan', total: 24 },
  { name: 'Milan', total: 24 },
  { name: 'Sebas', total: 24 },
  { name: 'Chris', total: 22 },
  { name: 'Jon', total: 22 },
  { name: 'Laura', total: 22 },
  { name: 'Mauri', total: 22 },
  { name: 'Arda', total: 20 },
  { name: 'Gonzalo U', total: 19 },
  { name: 'Nico', total: 19 },
  { name: 'Omar', total: 19 },
  { name: 'Rowan', total: 19 },
  { name: 'Marielle', total: 17 },
  { name: 'Markus', total: 17 },
  { name: 'Alex G', total: 18 },
  { name: 'Maria', total: 16 },
  { name: 'Gagan', total: 15 },
  { name: 'Kathy', total: 14 },
  { name: 'Lara', total: 14 },
  { name: 'Lucia', total: 14 },
  { name: 'Paola', total: 14 },
  { name: 'Juan Manuel', total: 13 },
].sort((a, b) => b.total - a.total)

const MAR_ROUNDS = [
  {
    round: 1,
    matches: [
      { court: 1, t1: ['Anthony', 'Alex M'], t2: ['Milan', 'Jon'], s1: 6, s2: 2 },
      { court: 2, t1: ['Chris', 'Karlijn'], t2: ['Paola', 'Gagan'], s1: 5, s2: 2 },
      { court: 3, t1: ['Alex G', 'Elena'], t2: ['Juan', 'Lucia'], s1: 2, s2: 2 },
      { court: 4, t1: ['Ini', 'Erica'], t2: ['Laura', 'Maria'], s1: 5, s2: 2 },
      { court: 5, t1: ['Alex B', 'Omar'], t2: ['Markus', 'Nico'], s1: 5, s2: 4 },
      { court: 6, t1: ['Gonzalo U', 'Uziel'], t2: ['Sebas', 'Stamatis'], s1: 2, s2: 4 },
      { court: 7, t1: ['Marielle', 'Arda'], t2: ['Lara', 'Mauri'], s1: 2, s2: 3 },
      { court: 8, t1: ['Zornitsa', 'Rowan'], t2: ['Juan Manuel', 'Kathy'], s1: 5, s2: 3 },
    ],
  },
  {
    round: 2,
    matches: [
      { court: 1, t1: ['Omar', 'Nico'], t2: ['Gagan', 'Alex G'], s1: 1, s2: 2 },
      { court: 2, t1: ['Alex B', 'Marielle'], t2: ['Zornitsa', 'Markus'], s1: 6, s2: 3 },
      { court: 3, t1: ['Mauri', 'Juan'], t2: ['Stamatis', 'Paola'], s1: 5, s2: 2 },
      { court: 4, t1: ['Rowan', 'Laura'], t2: ['Lucia', 'Maria'], s1: 3, s2: 1 },
      { court: 5, t1: ['Karlijn', 'Arda'], t2: ['Elena', 'Chris'], s1: 4, s2: 4 },
      { court: 6, t1: ['Alex M', 'Gonzalo U'], t2: ['Uziel', 'Anthony'], s1: 2, s2: 4 },
      { court: 7, t1: ['Juan Manuel', 'Ini'], t2: ['Sebas', 'Lara'], s1: 2, s2: 3 },
      { court: 8, t1: ['Milan', 'Kathy'], t2: ['Erica', 'Jon'], s1: 2, s2: 4 },
    ],
  },
  {
    round: 3,
    matches: [
      { court: 1, t1: ['Arda', 'Zornitsa'], t2: ['Sebas', 'Maria'], s1: 4, s2: 4 },
      { court: 2, t1: ['Juan Manuel', 'Markus'], t2: ['Chris', 'Alex M'], s1: 2, s2: 6 },
      { court: 3, t1: ['Nico', 'Marielle'], t2: ['Alex B', 'Karlijn'], s1: 1, s2: 6 },
      { court: 4, t1: ['Ini', 'Paola'], t2: ['Kathy', 'Rowan'], s1: 5, s2: 2 },
      { court: 5, t1: ['Omar', 'Lucia'], t2: ['Alex G', 'Laura'], s1: 3, s2: 3 },
      { court: 6, t1: ['Gagan', 'Juan'], t2: ['Milan', 'Lara'], s1: 5, s2: 5 },
      { court: 7, t1: ['Elena', 'Mauri'], t2: ['Gonzalo U', 'Erica'], s1: 5, s2: 2 },
      { court: 8, t1: ['Anthony', 'Jon'], t2: ['Uziel', 'Stamatis'], s1: 3, s2: 5 },
    ],
  },
  {
    round: 4,
    matches: [
      { court: 1, t1: ['Zornitsa', 'Chris'], t2: ['Elena', 'Nico'], s1: 5, s2: 3 },
      { court: 2, t1: ['Mauri', 'Gagan'], t2: ['Anthony', 'Arda'], s1: 1, s2: 7 },
      { court: 3, t1: ['Laura', 'Lucia'], t2: ['Lara', 'Kathy'], s1: 6, s2: 1 },
      { court: 4, t1: ['Milan', 'Stamatis'], t2: ['Juan Manuel', 'Sebas'], s1: 6, s2: 2 },
      { court: 5, t1: ['Juan', 'Omar'], t2: ['Maria', 'Erica'], s1: 4, s2: 1 },
      { court: 6, t1: ['Alex B', 'Markus'], t2: ['Uziel', 'Jon'], s1: 3, s2: 5 },
      { court: 7, t1: ['Marielle', 'Karlijn'], t2: ['Alex G', 'Rowan'], s1: 3, s2: 4 },
      { court: 8, t1: ['Gonzalo U', 'Ini'], t2: ['Paola', 'Alex M'], s1: 4, s2: 2 },
    ],
  },
  {
    round: 5,
    matches: [
      { court: 1, t1: ['Rowan', 'Zornitsa'], t2: ['Lucia', 'Paola'], s1: 4, s2: 2 },
      { court: 2, t1: ['Gonzalo U', 'Sebas'], t2: ['Gagan', 'Jon'], s1: 5, s2: 4 },
      { court: 3, t1: ['Juan', 'Ini'], t2: ['Anthony', 'Laura'], s1: 4, s2: 2 },
      { court: 4, t1: ['Arda', 'Omar'], t2: ['Alex B', 'Elena'], s1: 2, s2: 6 },
      { court: 5, t1: ['Mauri', 'Alex G'], t2: ['Milan', 'Juan Manuel'], s1: 3, s2: 3 },
      { court: 6, t1: ['Lara', 'Nico'], t2: ['Uziel', 'Maria'], s1: 1, s2: 5 },
      { court: 7, t1: ['Karlijn', 'Markus'], t2: ['Kathy', 'Stamatis'], s1: 4, s2: 3 },
      { court: 8, t1: ['Chris', 'Marielle'], t2: ['Erica', 'Alex M'], s1: 1, s2: 7 },
    ],
  },
  {
    round: 6,
    matches: [
      { court: 1, t1: ['Alex M', 'Marielle'], t2: ['Elena', 'Stamatis'], s1: 4, s2: 4 },
      { court: 2, t1: ['Gagan', 'Juan Manuel'], t2: ['Milan', 'Uziel'], s1: 1, s2: 6 },
      { court: 3, t1: ['Paola', 'Arda'], t2: ['Erica', 'Nico'], s1: 1, s2: 7 },
      { court: 4, t1: ['Juan', 'Gonzalo U'], t2: ['Omar', 'Jon'], s1: 4, s2: 4 },
      { court: 5, t1: ['Rowan', 'Lara'], t2: ['Zornitsa', 'Laura'], s1: 1, s2: 6 },
      { court: 6, t1: ['Karlijn', 'Mauri'], t2: ['Maria', 'Anthony'], s1: 5, s2: 3 },
      { court: 7, t1: ['Markus', 'Chris'], t2: ['Ini', 'Sebas'], s1: 1, s2: 6 },
      { court: 8, t1: ['Kathy', 'Alex B'], t2: ['Alex G', 'Lucia'], s1: 3, s2: 4 },
    ],
  },
]

// ── April 2026 — Padel Queen Sunday Smash (Friday Edition) — Ladies ──────────
const APR_STANDINGS = [
  { name: 'Julie', total: 23 },
  { name: 'Aimee', total: 23 },
  { name: 'Ini', total: 18 },
  { name: 'Lucia', total: 18 },
  { name: 'Leentje', total: 18 },
  { name: 'Cristina', total: 17 },
  { name: 'Amanda', total: 16 },
  { name: 'Marleen', total: 16 },
  { name: 'Lisa', total: 15 },
  { name: 'Domi', total: 15 },
  { name: 'Marloes', total: 14 },
  { name: 'Kate', total: 13 },
  { name: 'Sofia', total: 13 },
  { name: 'Zornitsa', total: 12 },
  { name: 'Marielle', total: 12 },
  { name: 'Maria', total: 11 },
  { name: 'Mel', total: 10 },
  { name: 'Ara', total: 10 },
  { name: 'Bianca', total: 10 },
  { name: 'Chrissy', total: 9 },
].sort((a, b) => b.total - a.total)

const APR_ROUNDS = [
  {
    round: 1,
    matches: [
      { court: 1, t1: ['Lucia', 'Kate'], t2: ['Domi', 'Lisa'], s1: 5, s2: 1 },
      { court: 2, t1: ['Amanda', 'Julie'], t2: ['Maria', 'Chrissy'], s1: 5, s2: 2 },
      { court: 3, t1: ['Leentje', 'Aimee'], t2: ['Ini', 'Ara'], s1: 3, s2: 2 },
      { court: 4, t1: ['Cristina', 'Bianca'], t2: ['Marielle', 'Sofia'], s1: 2, s2: 4 },
      { court: 5, t1: ['Marleen', 'Zornitsa'], t2: ['Marloes', 'Mel'], s1: 7, s2: 0 },
    ],
  },
  {
    round: 2,
    matches: [
      { court: 1, t1: ['Lucia', 'Julie'], t2: ['Amanda', 'Sofia'], s1: 3, s2: 0 },
      { court: 2, t1: ['Domi', 'Aimee'], t2: ['Lisa', 'Bianca'], s1: 2, s2: 4 },
      { court: 3, t1: ['Leentje', 'Ini'], t2: ['Marloes', 'Zornitsa'], s1: 3, s2: 1 },
      { court: 4, t1: ['Cristina', 'Chrissy'], t2: ['Maria', 'Ara'], s1: 3, s2: 1 },
      { court: 5, t1: ['Marielle', 'Kate'], t2: ['Marleen', 'Mel'], s1: 1, s2: 2 },
    ],
  },
  {
    round: 3,
    matches: [
      { court: 1, t1: ['Lucia', 'Chrissy'], t2: ['Mel', 'Zornitsa'], s1: 3, s2: 1 },
      { court: 2, t1: ['Amanda', 'Ara'], t2: ['Marleen', 'Marloes'], s1: 1, s2: 2 },
      { court: 3, t1: ['Domi', 'Ini'], t2: ['Maria', 'Sofia'], s1: 4, s2: 2 },
      { court: 4, t1: ['Leentje', 'Lisa'], t2: ['Marielle', 'Bianca'], s1: 3, s2: 3 },
      { court: 5, t1: ['Aimee', 'Julie'], t2: ['Cristina', 'Kate'], s1: 6, s2: 1 },
    ],
  },
  {
    round: 4,
    matches: [
      { court: 1, t1: ['Lucia', 'Ara'], t2: ['Ini', 'Julie'], s1: 5, s2: 9 },
      { court: 2, t1: ['Amanda', 'Kate'], t2: ['Marielle', 'Zornitsa'], s1: 5, s2: 4 },
      { court: 3, t1: ['Domi', 'Mel'], t2: ['Leentje', 'Marloes'], s1: 5, s2: 7 },
      { court: 4, t1: ['Aimee', 'Sofia'], t2: ['Lisa', 'Chrissy'], s1: 12, s2: 0 },
      { court: 5, t1: ['Cristina', 'Maria'], t2: ['Marleen', 'Bianca'], s1: 8, s2: 3 },
    ],
  },
]

// ── Tournament list (newest first) ────────────────────────────────────────────
export const TOURNAMENTS = [
  {
    id: 'apr2026',
    name: 'Padel Queen Sunday Smash (Friday Edition)',
    date: '2026-04-10',
    type: 'ladies',
    players: APR_STANDINGS,
    rounds: APR_ROUNDS,
    numRounds: 4,
    numCourts: 5,
  },
  {
    id: 'mar2026',
    name: 'LOBStournament #4',
    date: 'March 2026',
    type: 'mixed',
    players: MAR_STANDINGS,
    rounds: MAR_ROUNDS,
    numRounds: 6,
    numCourts: 8,
  },
  {
    id: 'jan2026',
    name: 'LOBStournament #3',
    date: 'January 2026',
    type: 'mixed',
    players: JAN_PLAYERS,
    rounds: null,
    numRounds: 6,
    numCourts: null,
    note: 'Full match pairings not available for this tournament.',
  },
  {
    id: 'dec2025',
    name: 'LOBStournament #2',
    date: 'December 2025',
    type: 'mixed',
    players: DEC_STANDINGS,
    rounds: DEC_ROUNDS,
    numRounds: 6,
    numCourts: 8,
  },
]
