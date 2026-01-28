// state.js (ES Modules)
// - Central state store (no UI rendering here)
// - Save/Load (localStorage)
// - Time progression (Year/Week)
// - Tournament progress skeleton (SP1/SP2/CHAMP)
// NOTE: This file must be logic-light; simulation stays in sim.js.

export const VERSION = "v0.1";
export const SAVE_KEY = "mob_battle_royale_coach_save_v1";

export const SCREENS = Object.freeze({
  MAIN:   "main",
  MAP:    "map",
  MATCH:  "match",
  RESULT: "result",
  TOTAL:  "total",
});

export const LEAGUES = Object.freeze({
  SP1: "SP1",
  SP2: "SP2",
  CHAMP: "CHAMPIONSHIP",
});

export const DEFAULT_STATE = Object.freeze({
  version: VERSION,

  // Profile
  companyName: "MOB COMPANY",
  companyRank: "C", // A/B/C/D...
  teamName: "PLAYER TEAM",

  // Time
  year: 1989,
  week: 1, // 1..52 (we keep flexible)
  gold: 0,

  // UI
  screen: SCREENS.MAIN,
  autoNext: false, // for match step auto 3s etc.

  // Player team selection / roster
  playerTeamId: "PLAYER",
  roster: [], // player-controlled characters (ids) - loaded from data_players.js later

  // League progress & history (for MAIN screen "戦績")
  league: {
    current: null, // LEAGUES.SP1 / SP2 / CHAMP
    stage: null,   // "LOCAL" / "NATIONAL" / "LASTCHANCE" / "WF" / etc
    seasonWeekAnchor: null, // optional anchor for calendars
  },

  // Records for results display (SP1/SP2/CHAMP)
  records: {
    // Each item example: { league:"SP1", stage:"LOCAL", rank:12, pts:40, kills:15, date:{year,week} }
    history: [],
    // Standing points totals per league
    totals: {
      SP1: { pts: 0, champWins: 0 },
      SP2: { pts: 0, champWins: 0 },
      CHAMPIONSHIP: { pts: 0, champWins: 0 },
    }
  },

  // Match runtime (driven by sim.js)
  runtime: {
    matchIndex: 1,
    matchTotal: 5,
    round: "R1",
    aliveTeams: 20,

    // Latest event / highlight (for UI)
    lastEvent: "",
    lastImportantScene: "",

    // Tables to render
    lastMatchResultRows: [], // 20 rows
    lastTotalRows: [],       // 20 or 40 rows

    // When running: internal sim snapshots
    sim: {
      tournamentId: null,
      teamsCount: 20,
      teams: [], // expanded team objects (from data_teams.js)
    }
  }
});

function deepCopy(obj){
  return JSON.parse(JSON.stringify(obj));
}

const listeners = new Set();

/**
 * In-memory mutable state
 */
let state = deepCopy(DEFAULT_STATE);

export function getState(){
  return state;
}

export function setState(patch){
  // shallow merge at top, and merge nested objects if present
  state = {
    ...state,
    ...patch,
    league: { ...state.league, ...(patch.league || {}) },
    records: {
      ...state.records,
      ...(patch.records || {}),
      totals: { ...state.records.totals, ...((patch.records||{}).totals || {}) }
    },
    runtime: {
      ...state.runtime,
      ...(patch.runtime || {}),
      sim: { ...state.runtime.sim, ...((patch.runtime||{}).sim || {}) }
    }
  };
  emit();
}

export function resetState(){
  state = deepCopy(DEFAULT_STATE);
  emit();
}

export function subscribe(fn){
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(){
  for (const fn of listeners) {
    try { fn(state); } catch(e) { console.error(e); }
  }
}

/**
 * Save/Load
 */
export function save(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  }catch(e){
    console.warn("Save failed:", e);
    return false;
  }
}

export function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw);

    // Minimal validation
    if (!obj || typeof obj !== "object") return false;

    // Merge with defaults to avoid missing keys
    state = {
      ...deepCopy(DEFAULT_STATE),
      ...obj,
      league: { ...deepCopy(DEFAULT_STATE).league, ...(obj.league || {}) },
      records: {
        ...deepCopy(DEFAULT_STATE).records,
        ...(obj.records || {}),
        totals: { ...deepCopy(DEFAULT_STATE).records.totals, ...((obj.records||{}).totals || {}) }
      },
      runtime: {
        ...deepCopy(DEFAULT_STATE).runtime,
        ...(obj.runtime || {}),
        sim: { ...deepCopy(DEFAULT_STATE).runtime.sim, ...((obj.runtime||{}).sim || {}) }
      }
    };
    emit();
    return true;
  }catch(e){
    console.warn("Load failed:", e);
    return false;
  }
}

/**
 * Time progression (1 action = 1 week)
 * Week range is flexible; if it exceeds 52, roll year.
 */
export function advanceWeek(weeks=1){
  let y = state.year;
  let w = state.week;

  for(let i=0;i<weeks;i++){
    w += 1;
    if (w > 52) { w = 1; y += 1; }
  }
  setState({ year: y, week: w });
}

/**
 * Gold operations
 */
export function addGold(amount){
  const g = Math.max(0, Math.floor((state.gold || 0) + amount));
  setState({ gold: g });
}
export function spendGold(amount){
  const g0 = state.gold || 0;
  const need = Math.max(0, Math.floor(amount));
  if (g0 < need) return false;
  setState({ gold: g0 - need });
  return true;
}

/**
 * Screen navigation
 */
export function goto(screen){
  if (!Object.values(SCREENS).includes(screen)) return;
  setState({ screen });
}

/**
 * Match runtime helpers
 */
export function setAutoNext(on){
  setState({ autoNext: !!on });
}

export function setRuntime(patch){
  setState({ runtime: { ...state.runtime, ...patch, sim: { ...state.runtime.sim, ...(patch.sim || {}) } } });
}

/**
 * Records
 */
export function addRecord(entry){
  const history = state.records.history.slice();
  history.push(entry);
  setState({ records: { ...state.records, history } });
}

/**
 * Totals update helper (pts, champWins)
 */
export function addLeagueTotals(leagueKey, addPts=0, addChampWins=0){
  const totals = deepCopy(state.records.totals);
  if (!totals[leagueKey]) totals[leagueKey] = { pts: 0, champWins: 0 };
  totals[leagueKey].pts = (totals[leagueKey].pts || 0) + (addPts || 0);
  totals[leagueKey].champWins = (totals[leagueKey].champWins || 0) + (addChampWins || 0);
  setState({ records: { ...state.records, totals } });
}

/**
 * Boot: try load saved state, else keep default.
 */
load();
