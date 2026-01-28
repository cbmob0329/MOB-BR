// game.js (ES Modules)
// Controller: screen switching, button wiring, time progression, tournament progression.
// - SP1 auto-start on boot (local demo)
// - SP1 -> (wait weeks) -> SP2 -> (wait weeks) -> CHAMP
// - ID1..ID19 actions follow your "role" labels; unimplemented shows modal safely.

import * as UI from "./ui.js";
import * as Tournament from "./sim_tournament.js";
import * as Assets from "./assets.js";
import * as State from "./state.js";

/** ----------------------------
 *  Config (adjust later easily)
 *  ---------------------------- */
const WAIT_WEEKS = {
  SP1_TO_SP2: 2,      // SP1終了→SP2開始までの待機週
  SP2_TO_CHAMP: 2,    // SP2終了→CHAMP開始までの待機週
};

// 起動直後にSP1を自動開始するか
const AUTO_START_SP1_ON_BOOT = true;
// true なら「初回だけ」自動開始（2回目以降は自動開始しない）
const AUTO_START_ONCE_ONLY = false;
const AUTO_START_ONCE_KEY = "mobbr_autostart_sp1_done";

const LS_KEY = "mobbr_runtime_v1";

/** ----------------------------
 *  Safe adapters (state.jsがどう書かれていても落とさない)
 *  ---------------------------- */
const S = {
  getState: () => (typeof State.getState === "function" ? (State.getState() || {}) : ({})),
  setRuntime: (obj) => { if (typeof State.setRuntime === "function") State.setRuntime(obj); },
};

/** ----------------------------
 *  Runtime (this is the true working state for the demo)
 *  ---------------------------- */
function defaultRuntime() {
  return {
    year: 1989,
    week: 1,

    // tournament progress
    inProgress: false,
    phase: "NONE",          // NONE | SP1 | WAIT_SP2 | SP2 | WAIT_CHAMP | CHAMP | DONE
    waitWeeks: 0,
    nextPhase: null,        // "SP2" or "CHAMP"

    // results
    lastResult: null,
    lastResultByLeague: {}, // { SP1:..., SP2:..., CHAMPIONSHIP:... }
    history: [],            // [{league, championName, at:{year,week}, summary}]
  };
}

let runtime = loadRuntime();

/** ----------------------------
 *  Boot
 *  ---------------------------- */
(async function boot() {
  UI.init({ rootId: "app" });

  // assets safe load
  if (typeof Assets.loadAll === "function") {
    try { await Assets.loadAll(); } catch (e) { console.warn("Assets.loadAll failed:", e); }
  }

  // ensure images have src (harmless if already set)
  const mainImg = document.getElementById("mainImage");
  const mapImg  = document.getElementById("mapImage");
  if (mainImg) mainImg.src = mainImg.getAttribute("src") || "./main.png";
  if (mapImg)  mapImg.src  = mapImg.getAttribute("src")  || "./map.png";

  bindButtons();

  // initial HUD
  refreshHud();
  UI.showScreen("main");

  // ✅追加：起動直後にSP1（ローカル）を自動開始
  if (AUTO_START_SP1_ON_BOOT) {
    if (AUTO_START_ONCE_ONLY) {
      if (!localStorage.getItem(AUTO_START_ONCE_KEY)) {
        localStorage.setItem(AUTO_START_ONCE_KEY, "1");
        setTimeout(() => onAction("ID3"), 0); // ID3 = 大会エントリー（SP1開始）
      }
    } else {
      setTimeout(() => onAction("ID3"), 0);
    }
  }
})();

/** ----------------------------
 *  Button wiring
 *  ---------------------------- */
function bindButtons() {
  const found = Array.from(document.querySelectorAll("[data-action]"));
  for (const el of found) {
    el.addEventListener("click", () => onAction(el.getAttribute("data-action")));
  }
}

/** ----------------------------
 *  ID role labels (あなたの説明を保持)
 *  ---------------------------- */
const ROLE = Object.freeze({
  ID1:  "チーム編成",
  ID2:  "ガチャ",
  ID3:  "大会エントリー",
  ID4:  "参加中の大会",
  ID5:  "セーブ",
  ID6:  "戦績",
  ID7:  "大会結果",
  ID8:  "スケジュール",
  ID9:  "射撃",
  ID10: "ダッシュ",
  ID11: "パズル",
  ID12: "実戦",
  ID13: "滝",
  ID14: "研究",
  ID15: "総合",
  ID16: "コレクション",
  ID17: "ショップ",
  ID18: "遠征",
  ID19: "最近の出来事",
});

/** ----------------------------
 *  Action handler
 *  ---------------------------- */
async function onAction(action) {
  const label = ROLE[action] || action || "UNKNOWN";

  switch (action) {
    /** ---------- Tournament core ---------- */
    case "ID3": // 大会エントリー（参加開始）
      await handleEntry();
      return;

    case "ID4": // 参加中の大会（進行/続き）
      await handleContinue();
      return;

    case "ID7": // 大会結果（直近or履歴）
      await handleResults();
      return;

    case "ID15": // 総合（まとめ）
      showSummary();
      return;

    /** ---------- Schedule / time ---------- */
    case "ID8": // スケジュール
      showSchedule();
      return;

    /** ---------- Week-advance actions (demo) ---------- */
    // デモでは「週を進める」手段として扱う（後で差し替えOK）
    case "ID9":
    case "ID10":
    case "ID11":
    case "ID12":
    case "ID13":
    case "ID14":
    case "ID16":
    case "ID17":
    case "ID18":
      advanceWeek(1, `${label} を実行（デモ：1週進行）`);
      return;

    /** ---------- Save ---------- */
    case "ID5":
      saveRuntime(true);
      UI.showModal("セーブ", [
        `保存しました（デモ）`,
        `現在: ${runtime.year}年 ${runtime.week}週`,
        `参加状況: ${runtime.inProgress ? "参加中" : "未参加"}`,
      ]);
      return;

    /** ---------- History / record ---------- */
    case "ID6":
      showRecord();
      return;

    case "ID19":
      showRecentEvents();
      return;

    /** ---------- Unimplemented screens ---------- */
    case "ID1":
    case "ID2":
      UI.showModal(label, [
        "この画面はデモ版では未実装です。",
        "（役割は固定。後で中身を実装します）",
      ]);
      return;

    default:
      UI.showModal("未割当", [
        `押された: ${action}`,
        `役割: ${label}`,
        "必要ならここに処理を割り当てます。",
      ]);
      return;
  }
}

/** ----------------------------
 *  Tournament handlers
 *  ---------------------------- */
async function handleEntry() {
  // すでに参加中なら、参加中画面へ誘導
  if (runtime.inProgress) {
    UI.showModal("大会エントリー", [
      "すでに参加中の大会があります。",
      "「参加中の大会」から続きへ進めます。",
    ]);
    return;
  }

  // start SP1
  runtime.inProgress = true;
  runtime.phase = "SP1";
  runtime.waitWeeks = 0;
  runtime.nextPhase = null;
  saveRuntime();

  // show map briefly then run
  UI.showScreen("map");
  await sleep(900);

  await runLeagueAndStore("SP1");

  // after SP1: enter wait
  runtime.phase = "WAIT_SP2";
  runtime.waitWeeks = WAIT_WEEKS.SP1_TO_SP2;
  runtime.nextPhase = "SP2";
  saveRuntime();

  UI.showModal("SP1 終了", [
    `SP2 開始まで ${runtime.waitWeeks} 週 待機します。`,
    "「参加中の大会」で進行できます。",
    "（またはミニゲーム等で週を進めてもOK）",
  ]);
  refreshHud();
}

async function handleContinue() {
  if (!runtime.inProgress) {
    UI.showModal("参加中の大会", [
      "現在、参加中の大会はありません。",
      "「大会エントリー」から開始してください。",
    ]);
    return;
  }

  // waiting -> advance time and start next when ready
  if (runtime.phase === "WAIT_SP2" || runtime.phase === "WAIT_CHAMP") {
    if (runtime.waitWeeks > 0) {
      advanceWeek(1, "大会待機（デモ：1週進行）");
      runtime.waitWeeks = Math.max(0, runtime.waitWeeks - 1);
      saveRuntime();
      refreshHud();

      if (runtime.waitWeeks > 0) {
        UI.showModal("大会待機中", [
          `${runtime.nextPhase} 開始まで あと ${runtime.waitWeeks} 週`,
          "「参加中の大会」で進行できます。",
        ]);
        return;
      }

      // reached 0 -> start next
      const next = runtime.nextPhase;
      if (next === "SP2") {
        runtime.phase = "SP2";
        runtime.nextPhase = null;
        saveRuntime();

        UI.showModal("SP2 開始", [
          "待機期間が終了しました。",
          "これより SP2 を開始します。",
        ]);

        UI.showScreen("map");
        await sleep(900);

        await runLeagueAndStore("SP2");

        runtime.phase = "WAIT_CHAMP";
        runtime.waitWeeks = WAIT_WEEKS.SP2_TO_CHAMP;
        runtime.nextPhase = "CHAMP";
        saveRuntime();

        UI.showModal("SP2 終了", [
          `チャンピオンシップ開始まで ${runtime.waitWeeks} 週 待機します。`,
          "「参加中の大会」で進行できます。",
        ]);
        refreshHud();
        return;
      }

      if (next === "CHAMP") {
        runtime.phase = "CHAMP";
        runtime.nextPhase = null;
        saveRuntime();

        UI.showModal("チャンピオンシップ開始", [
          "待機期間が終了しました。",
          "これより チャンピオンシップ を開始します。",
        ]);

        UI.showScreen("map");
        await sleep(900);

        await runLeagueAndStore("CHAMPIONSHIP");

        runtime.phase = "DONE";
        runtime.inProgress = false;
        runtime.waitWeeks = 0;
        runtime.nextPhase = null;
        saveRuntime();

        UI.showModal("シーズン完走", [
          "チャンピオンシップまで完走しました。",
          "「大会結果」「総合」で確認できます。",
        ]);
        refreshHud();
        return;
      }

      UI.showModal("状態エラー", [
        "次の大会が不明です。",
        "runtime.nextPhase を確認してください。",
      ]);
      return;
    }

    UI.showModal("大会準備完了", [
      `${runtime.nextPhase} を開始できます。`,
      "もう一度「参加中の大会」を押してください。",
    ]);
    return;
  }

  // Running phases (safety)
  if (runtime.phase === "SP1" || runtime.phase === "SP2" || runtime.phase === "CHAMP") {
    UI.showModal("進行中", [
      "このデモは「リーグ単位」で一気に実行する形式です。",
      "結果は「大会結果」から確認できます。",
    ]);
    return;
  }

  // DONE
  if (runtime.phase === "DONE") {
    UI.showModal("参加中の大会", [
      "シーズンは完了しています。",
      "「大会結果」「総合」で確認できます。",
    ]);
    return;
  }

  UI.showModal("参加中の大会", [
    "状態が不明です。",
    `phase=${runtime.phase}`,
  ]);
}

async function handleResults() {
  const r = runtime.lastResult;
  if (r) {
    UI.renderTournamentResult(r);
    return;
  }

  if (!runtime.history.length) {
    UI.showModal("大会結果", [
      "まだ大会結果がありません。",
      "「大会エントリー」から開始してください。",
    ]);
    return;
  }

  const lines = runtime.history.slice(-8).reverse().map(linesFromHistoryItem);
  UI.showModal("大会結果（履歴）", lines.flat());
}

function showSummary() {
  const lines = [];

  lines.push(`現在: ${runtime.year}年 ${runtime.week}週`);
  lines.push(`参加状況: ${runtime.inProgress ? "参加中" : "未参加"}`);
  lines.push(`状態: ${runtime.phase}`);

  if (runtime.phase === "WAIT_SP2" || runtime.phase === "WAIT_CHAMP") {
    lines.push(`次: ${runtime.nextPhase}（あと ${runtime.waitWeeks}週）`);
  }

  const sp1 = runtime.lastResultByLeague["SP1"];
  const sp2 = runtime.lastResultByLeague["SP2"];
  const ch  = runtime.lastResultByLeague["CHAMPIONSHIP"];

  if (sp1) lines.push(`SP1 優勝: ${getChampionName(sp1)}`);
  if (sp2) lines.push(`SP2 優勝: ${getChampionName(sp2)}`);
  if (ch)  lines.push(`CHAMP 優勝: ${getChampionName(ch)}`);

  UI.showModal("総合（デモ）", lines);
}

function showSchedule() {
  const lines = [];
  lines.push(`現在: ${runtime.year}年 ${runtime.week}週`);

  if (!runtime.inProgress && runtime.phase === "NONE") {
    lines.push("未参加：大会エントリーでSP1開始");
    UI.showModal("スケジュール", lines);
    return;
  }

  lines.push(`状態: ${runtime.phase}`);

  if (runtime.phase === "WAIT_SP2") {
    lines.push(`SP2 開始まで あと ${runtime.waitWeeks}週`);
    lines.push("参加中の大会で進行できます。");
  } else if (runtime.phase === "WAIT_CHAMP") {
    lines.push(`CHAMP 開始まで あと ${runtime.waitWeeks}週`);
    lines.push("参加中の大会で進行できます。");
  } else if (runtime.phase === "DONE") {
    lines.push("今シーズンは完了。");
  } else {
    lines.push("リーグ進行は大会エントリー/参加中の大会から行います。");
  }

  UI.showModal("スケジュール", lines);
}

function showRecord() {
  const lines = [];
  lines.push(`現在: ${runtime.year}年 ${runtime.week}週`);

  if (!runtime.history.length) {
    lines.push("戦績はまだありません。");
    UI.showModal("戦績", lines);
    return;
  }

  lines.push("直近の戦績:");
  const recent = runtime.history.slice(-6).reverse();
  for (const it of recent) {
    lines.push(`- ${it.league} 優勝: ${it.championName}（${it.at.year}年${it.at.week}週）`);
  }
  UI.showModal("戦績", lines);
}

function showRecentEvents() {
  const lines = [];
  lines.push(`現在: ${runtime.year}年 ${runtime.week}週`);
  lines.push(`状態: ${runtime.phase}`);
  if (runtime.inProgress) lines.push("参加中の大会があります。");
  if (runtime.phase === "WAIT_SP2" || runtime.phase === "WAIT_CHAMP") {
    lines.push(`次: ${runtime.nextPhase} / あと${runtime.waitWeeks}週`);
  }
  lines.push("（最近の出来事はデモでは簡易表示。後でイベント抽選と連動）");
  UI.showModal("最近の出来事", lines);
}

/** ----------------------------
 *  League execution + store
 *  ---------------------------- */
async function runLeagueAndStore(leagueKey) {
  let result;
  try {
    result = Tournament.runLeague(leagueKey, { seed: Date.now() });
  } catch (e) {
    console.error(e);
    UI.showScreen("main");
    UI.showModal("エラー", [
      "シミュレーションが停止しました。",
      String(e?.message || e),
    ]);
    throw e;
  }

  runtime.lastResult = result;
  runtime.lastResultByLeague[leagueKey] = result;

  const champName = getChampionName(result);
  runtime.history.push({
    league: leagueKey,
    championName: champName || "?",
    at: { year: runtime.year, week: runtime.week },
    summary: `${leagueKey} 優勝: ${champName || "?"}`,
  });

  saveRuntime();
  refreshHud();

  UI.renderTournamentResult(result);
}

/** ----------------------------
 *  Time progression
 *  ---------------------------- */
function advanceWeek(n = 1, reason = "") {
  const add = Math.max(0, Math.floor(n));
  if (!add) return;

  for (let i = 0; i < add; i++) {
    runtime.week += 1;
    if (runtime.week > 52) { runtime.week = 1; runtime.year += 1; }
  }

  if (reason) UI.pushLog(`【${runtime.year}年${runtime.week}週】${reason}`);

  saveRuntime();
  refreshHud();
}

/** ----------------------------
 *  HUD
 *  ---------------------------- */
function refreshHud() {
  const lines = [];
  lines.push(`現在: ${runtime.year}年 ${runtime.week}週`);
  lines.push(`状態: ${runtime.phase}`);
  lines.push(`参加: ${runtime.inProgress ? "参加中" : "未参加"}`);

  if (runtime.phase === "WAIT_SP2" || runtime.phase === "WAIT_CHAMP") {
    lines.push(`次: ${runtime.nextPhase}（あと${runtime.waitWeeks}週）`);
  }

  UI.setHud(lines);
}

/** ----------------------------
 *  Persistence
 *  ---------------------------- */
function loadRuntime() {
  // 1) try state.js getState().runtime
  try {
    const st = S.getState();
    if (st && st.runtime && typeof st.runtime === "object") {
      return normalizeRuntime(st.runtime);
    }
  } catch (_) {}

  // 2) try localStorage
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeRuntime(JSON.parse(raw));
  } catch (_) {}

  return defaultRuntime();
}

function saveRuntime(showToast = false) {
  // 1) write to localStorage always (safe)
  try { localStorage.setItem(LS_KEY, JSON.stringify(runtime)); } catch (_) {}

  // 2) also try state.js runtime slot (if exists)
  try {
    S.setRuntime(runtime);
  } catch (_) {}

  if (showToast) UI.pushLog("保存しました（デモ）");
}

function normalizeRuntime(r) {
  const base = defaultRuntime();
  const out = { ...base, ...(r || {}) };

  out.year = Number.isFinite(out.year) ? out.year : base.year;
  out.week = Number.isFinite(out.week) ? out.week : base.week;
  out.inProgress = !!out.inProgress;
  out.phase = String(out.phase || base.phase);
  out.waitWeeks = Number.isFinite(out.waitWeeks) ? out.waitWeeks : 0;
  out.nextPhase = out.nextPhase ? String(out.nextPhase) : null;

  if (!out.lastResultByLeague || typeof out.lastResultByLeague !== "object") out.lastResultByLeague = {};
  if (!Array.isArray(out.history)) out.history = [];

  return out;
}

/** ----------------------------
 *  Helpers
 *  ---------------------------- */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getChampionName(result) {
  const teamId = result?.championTeamId || "";
  if (!teamId) return "";
  const a = result?.finalStandings?.find(x => x.teamId === teamId || x.team?.id === teamId);
  if (a?.team?.name) return a.team.name;
  if (a?.name) return a.name;
  return teamId;
}

function linesFromHistoryItem(it) {
  return [
    `${it.league}：優勝 ${it.championName}`,
    `（${it.at.year}年${it.at.week}週）`,
  ];
}
