// game.js (FULL)  MOB BR Demo Controller
// - Boot diagnostics (shows errors on-screen even if imports fail)
// - Auto-start SP1 on boot
// - SP1 -> WAIT -> SP2 -> WAIT -> CHAMP
// File names MUST match your repo:
//   ui.js / assets.js / state.js / sim_tournament.js / index.html / style.css

const WAIT_WEEKS = {
  SP1_TO_SP2: 2,
  SP2_TO_CHAMP: 2,
};

const AUTO_START_SP1_ON_BOOT = true;
const AUTO_START_ONCE_ONLY = false;
const AUTO_START_ONCE_KEY = "mobbr_autostart_sp1_done";

const LS_KEY = "mobbr_runtime_v1";

// ---------- ultra-safe on-screen logger (works without ui.js) ----------
function ensureDebugPanel() {
  let el = document.getElementById("__boot_debug__");
  if (el) return el;

  el = document.createElement("div");
  el.id = "__boot_debug__";
  el.style.position = "fixed";
  el.style.left = "10px";
  el.style.right = "10px";
  el.style.bottom = "10px";
  el.style.zIndex = "99999";
  el.style.maxHeight = "40vh";
  el.style.overflow = "auto";
  el.style.padding = "10px";
  el.style.borderRadius = "12px";
  el.style.background = "rgba(0,0,0,0.78)";
  el.style.color = "#fff";
  el.style.fontFamily = "ui-monospace, Menlo, Consolas, monospace";
  el.style.fontSize = "12px";
  el.style.whiteSpace = "pre-wrap";
  el.style.display = "none";
  document.body.appendChild(el);
  return el;
}
function dbg(msg, show = true) {
  const el = ensureDebugPanel();
  el.textContent += (el.textContent ? "\n" : "") + msg;
  if (show) el.style.display = "block";
  console.log(msg);
}
function dbgErr(title, err) {
  const msg = `${title}\n${String(err?.stack || err?.message || err)}`;
  dbg("❌ " + msg, true);
}

// show unhandled errors too
window.addEventListener("error", (e) => dbgErr("window.error", e?.error || e?.message || e));
window.addEventListener("unhandledrejection", (e) => dbgErr("unhandledrejection", e?.reason || e));

// ---------- runtime ----------
function defaultRuntime() {
  return {
    year: 1989,
    week: 1,
    inProgress: false,
    phase: "NONE", // NONE | SP1 | WAIT_SP2 | SP2 | WAIT_CHAMP | CHAMP | DONE
    waitWeeks: 0,
    nextPhase: null, // "SP2" | "CHAMP"
    lastResult: null,
    lastResultByLeague: {},
    history: [],
  };
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
function loadRuntime() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalizeRuntime(JSON.parse(raw));
  } catch (_) {}
  return defaultRuntime();
}
function saveRuntime(runtime) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(runtime)); } catch (_) {}
}

// ---------- ID roles ----------
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

// ---------- boot ----------
let runtime = loadRuntime();

// dynamic module handles (so we can show errors even if import fails)
let UI = null;
let Assets = null;
let State = null;
let Tournament = null;

(async function boot() {
  dbg("BOOT: start");

  // 1) Load modules with exact filenames in your repo
  try {
    UI = await import("./ui.js");
    dbg("BOOT: ui.js loaded");
  } catch (e) {
    dbgErr("FAILED to import ./ui.js", e);
    return;
  }

  try {
    Assets = await import("./assets.js");
    dbg("BOOT: assets.js loaded");
  } catch (e) {
    dbgErr("FAILED to import ./assets.js", e);
    // continue (assets are optional for boot)
  }

  try {
    State = await import("./state.js");
    dbg("BOOT: state.js loaded");
  } catch (e) {
    dbgErr("FAILED to import ./state.js", e);
    // continue (state optional; we use localStorage anyway)
  }

  try {
    Tournament = await import("./sim_tournament.js");
    dbg("BOOT: sim_tournament.js loaded");
  } catch (e) {
    dbgErr("FAILED to import ./sim_tournament.js", e);
    // Without sim, we can still show UI but cannot run leagues
  }

  // 2) init UI
  try {
    UI.init({ rootId: "app" });
    dbg("BOOT: UI.init ok");
  } catch (e) {
    dbgErr("UI.init failed", e);
    return;
  }

  // 3) assets load (optional)
  if (Assets && typeof Assets.loadAll === "function") {
    try { await Assets.loadAll(); dbg("BOOT: Assets.loadAll ok"); }
    catch (e) { dbgErr("Assets.loadAll failed (optional)", e); }
  }

  // 4) ensure images
  try {
    const mainImg = document.getElementById("mainImage");
    const mapImg  = document.getElementById("mapImage");
    if (mainImg) mainImg.src = mainImg.getAttribute("src") || "./main.png";
    if (mapImg)  mapImg.src  = mapImg.getAttribute("src")  || "./map.png";
    dbg("BOOT: image src set");
  } catch (e) {
    dbgErr("BOOT: image set failed (optional)", e);
  }

  // 5) bind buttons
  bindButtons();

  // 6) HUD + screen
  refreshHud();
  UI.showScreen("main");
  dbg("BOOT: showScreen(main)");

  // 7) auto-start SP1
  if (AUTO_START_SP1_ON_BOOT) {
    if (AUTO_START_ONCE_ONLY) {
      if (!localStorage.getItem(AUTO_START_ONCE_KEY)) {
        localStorage.setItem(AUTO_START_ONCE_KEY, "1");
        setTimeout(() => onAction("ID3"), 0);
        dbg("BOOT: auto-start SP1 (once)");
      } else {
        dbg("BOOT: auto-start skipped (once key exists)");
      }
    } else {
      setTimeout(() => onAction("ID3"), 0);
      dbg("BOOT: auto-start SP1 (always)");
    }
  }
})();

// ---------- buttons ----------
function bindButtons() {
  const found = Array.from(document.querySelectorAll("[data-action]"));
  dbg(`BOOT: found buttons = ${found.length}`);
  for (const el of found) {
    el.addEventListener("click", () => onAction(el.getAttribute("data-action")));
  }
}

// ---------- helpers ----------
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pushLog(msg) {
  if (UI && typeof UI.pushLog === "function") UI.pushLog(msg);
  else dbg("LOG: " + msg, true);
}

function showModal(title, lines) {
  if (UI && typeof UI.showModal === "function") UI.showModal(title, lines);
  else dbg(`MODAL: ${title}\n- ${lines.join("\n- ")}`, true);
}

function setHud(lines) {
  if (UI && typeof UI.setHud === "function") UI.setHud(lines);
}

// ---------- HUD ----------
function refreshHud() {
  const lines = [];
  lines.push(`現在: ${runtime.year}年 ${runtime.week}週`);
  lines.push(`状態: ${runtime.phase}`);
  lines.push(`参加: ${runtime.inProgress ? "参加中" : "未参加"}`);
  if (runtime.phase === "WAIT_SP2" || runtime.phase === "WAIT_CHAMP") {
    lines.push(`次: ${runtime.nextPhase}（あと${runtime.waitWeeks}週）`);
  }
  setHud(lines);
}

// ---------- time ----------
function advanceWeek(n = 1, reason = "") {
  const add = Math.max(0, Math.floor(n));
  if (!add) return;

  for (let i = 0; i < add; i++) {
    runtime.week += 1;
    if (runtime.week > 52) { runtime.week = 1; runtime.year += 1; }
  }
  if (reason) pushLog(`【${runtime.year}年${runtime.week}週】${reason}`);
  saveRuntime(runtime);
  refreshHud();
}

// ---------- tournament ----------
function getChampionName(result) {
  const teamId = result?.championTeamId || "";
  if (!teamId) return "";
  const a = result?.finalStandings?.find(x => x.teamId === teamId || x.team?.id === teamId);
  if (a?.team?.name) return a.team.name;
  if (a?.name) return a.name;
  return teamId;
}

async function runLeagueAndStore(leagueKey) {
  if (!Tournament || typeof Tournament.runLeague !== "function") {
    showModal("エラー", [
      "sim_tournament.js が読み込めていません。",
      "ファイル名が一致しているか確認してください。",
      "必要: ./sim_tournament.js",
    ]);
    dbg("Tournament missing: cannot runLeague");
    return null;
  }

  let result;
  try {
    result = Tournament.runLeague(leagueKey, { seed: Date.now() });
  } catch (e) {
    dbgErr("Tournament.runLeague failed", e);
    showModal("エラー", ["シミュレーションが停止しました。", String(e?.message || e)]);
    return null;
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

  saveRuntime(runtime);
  refreshHud();

  if (UI && typeof UI.renderTournamentResult === "function") {
    UI.renderTournamentResult(result);
  } else {
    showModal(`${leagueKey} 結果`, [
      `優勝: ${champName || "?"}`,
      "（ui.js の renderTournamentResult が未実装ならここが簡易表示になります）",
    ]);
  }

  return result;
}

// ---------- main action handler ----------
async function onAction(action) {
  const label = ROLE[action] || action || "UNKNOWN";
  dbg(`ACTION: ${action} (${label})`);

  switch (action) {
    case "ID3": // 大会エントリー
      await handleEntry();
      return;

    case "ID4": // 参加中の大会
      await handleContinue();
      return;

    case "ID7": // 大会結果
      if (runtime.lastResult) {
        if (UI && typeof UI.renderTournamentResult === "function") UI.renderTournamentResult(runtime.lastResult);
        else showModal("大会結果", ["lastResult はあるが UI表示が未実装です。"]);
      } else if (runtime.history.length) {
        showModal("大会結果（履歴）", runtime.history.slice(-6).reverse().map(x => `${x.league} 優勝: ${x.championName}`));
      } else {
        showModal("大会結果", ["まだ結果がありません。"]);
      }
      return;

    case "ID8": // スケジュール
      showModal("スケジュール", buildScheduleLines());
      return;

    case "ID15": // 総合
      showModal("総合（デモ）", buildSummaryLines());
      return;

    case "ID5": // セーブ
      saveRuntime(runtime);
      showModal("セーブ", ["保存しました（デモ）"]);
      return;

    case "ID6": // 戦績
      showModal("戦績", buildRecordLines());
      return;

    case "ID19": // 最近の出来事
      showModal("最近の出来事", [
        `現在: ${runtime.year}年 ${runtime.week}週`,
        `状態: ${runtime.phase}`,
        "（デモでは簡易表示。後でイベント抽選と連動）",
      ]);
      return;

    // demo: week advance
    case "ID9":
    case "ID10":
    case "ID11":
    case "ID12":
    case "ID13":
    case "ID14":
    case "ID16":
    case "ID17":
    case "ID18":
      advanceWeek(1, `${label}（デモ：1週進行）`);
      return;

    // unimplemented screens
    case "ID1":
    case "ID2":
      showModal(label, ["この画面はデモ版では未実装です。"]);
      return;

    default:
      showModal("未割当", [`押された: ${action}`, `役割: ${label}`]);
      return;
  }
}

function buildScheduleLines() {
  const lines = [];
  lines.push(`現在: ${runtime.year}年 ${runtime.week}週`);
  lines.push(`状態: ${runtime.phase}`);
  if (!runtime.inProgress && runtime.phase === "NONE") {
    lines.push("未参加：大会エントリーでSP1開始");
    return lines;
  }
  if (runtime.phase === "WAIT_SP2" || runtime.phase === "WAIT_CHAMP") {
    lines.push(`次: ${runtime.nextPhase}（あと${runtime.waitWeeks}週）`);
    lines.push("参加中の大会で進行できます。");
  }
  return lines;
}

function buildSummaryLines() {
  const lines = [];
  lines.push(`現在: ${runtime.year}年 ${runtime.week}週`);
  lines.push(`参加: ${runtime.inProgress ? "参加中" : "未参加"}`);
  lines.push(`状態: ${runtime.phase}`);
  const sp1 = runtime.lastResultByLeague["SP1"];
  const sp2 = runtime.lastResultByLeague["SP2"];
  const ch  = runtime.lastResultByLeague["CHAMPIONSHIP"];
  if (sp1) lines.push(`SP1 優勝: ${getChampionName(sp1)}`);
  if (sp2) lines.push(`SP2 優勝: ${getChampionName(sp2)}`);
  if (ch)  lines.push(`CHAMP 優勝: ${getChampionName(ch)}`);
  return lines;
}

function buildRecordLines() {
  if (!runtime.history.length) return ["戦績はまだありません。"];
  return runtime.history.slice(-8).reverse().map(it => `${it.league} 優勝: ${it.championName}（${it.at.year}年${it.at.week}週）`);
}

// ---------- entry / continue ----------
async function handleEntry() {
  if (runtime.inProgress) {
    showModal("大会エントリー", ["すでに参加中の大会があります。", "「参加中の大会」から進めます。"]);
    return;
  }

  runtime.inProgress = true;
  runtime.phase = "SP1";
  runtime.waitWeeks = 0;
  runtime.nextPhase = null;
  saveRuntime(runtime);
  refreshHud();

  // show map briefly then run
  if (UI && typeof UI.showScreen === "function") UI.showScreen("map");
  await sleep(600);

  const r = await runLeagueAndStore("SP1");
  if (!r) return;

  runtime.phase = "WAIT_SP2";
  runtime.waitWeeks = WAIT_WEEKS.SP1_TO_SP2;
  runtime.nextPhase = "SP2";
  saveRuntime(runtime);
  refreshHud();

  showModal("SP1 終了", [
    `SP2 開始まで ${runtime.waitWeeks} 週 待機します。`,
    "「参加中の大会」で進行できます。",
  ]);
}

async function handleContinue() {
  if (!runtime.inProgress) {
    showModal("参加中の大会", ["参加中の大会はありません。", "「大会エントリー」から開始してください。"]);
    return;
  }

  if (runtime.phase === "WAIT_SP2" || runtime.phase === "WAIT_CHAMP") {
    if (runtime.waitWeeks > 0) {
      advanceWeek(1, "大会待機（デモ：1週進行）");
      runtime.waitWeeks = Math.max(0, runtime.waitWeeks - 1);
      saveRuntime(runtime);
      refreshHud();

      if (runtime.waitWeeks > 0) {
        showModal("大会待機中", [`${runtime.nextPhase} 開始まで あと ${runtime.waitWeeks} 週`]);
        return;
      }
    }

    // ready to start next
    if (runtime.nextPhase === "SP2") {
      runtime.phase = "SP2";
      runtime.nextPhase = null;
      saveRuntime(runtime);
      refreshHud();

      showModal("SP2 開始", ["待機期間が終了しました。SP2を開始します。"]);
      if (UI && typeof UI.showScreen === "function") UI.showScreen("map");
      await sleep(600);

      const r = await runLeagueAndStore("SP2");
      if (!r) return;

      runtime.phase = "WAIT_CHAMP";
      runtime.waitWeeks = WAIT_WEEKS.SP2_TO_CHAMP;
      runtime.nextPhase = "CHAMP";
      saveRuntime(runtime);
      refreshHud();

      showModal("SP2 終了", [
        `チャンピオンシップ開始まで ${runtime.waitWeeks} 週 待機します。`,
        "「参加中の大会」で進行できます。",
      ]);
      return;
    }

    if (runtime.nextPhase === "CHAMP") {
      runtime.phase = "CHAMP";
      runtime.nextPhase = null;
      saveRuntime(runtime);
      refreshHud();

      showModal("チャンピオンシップ開始", ["待機期間が終了しました。チャンピオンシップを開始します。"]);
      if (UI && typeof UI.showScreen === "function") UI.showScreen("map");
      await sleep(600);

      const r = await runLeagueAndStore("CHAMPIONSHIP");
      if (!r) return;

      runtime.phase = "DONE";
      runtime.inProgress = false;
      runtime.waitWeeks = 0;
      runtime.nextPhase = null;
      saveRuntime(runtime);
      refreshHud();

      showModal("シーズン完走", ["チャンピオンシップまで完走しました。", "「大会結果」「総合」で確認できます。"]);
      return;
    }

    showModal("状態エラー", ["nextPhase が不明です。"]);
    return;
  }

  if (runtime.phase === "DONE") {
    showModal("参加中の大会", ["シーズンは完了しています。", "「大会結果」「総合」で確認できます。"]);
    return;
  }

  showModal("参加中の大会", [`状態: ${runtime.phase}`, "（デモはリーグ単位で実行します）"]);
}
