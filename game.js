// game.js (ES Modules)
// MOB BR - Demo controller (screen routing + button wiring + run sim + render minimal UI)
//
// ✅方針
// - 既存の index.html / style.css / assets.js / state.js を「壊さず」使う
// - UIが未完成でも動作確認できるように、最低限の表示（結果テーブル/ログ）をこのファイルだけで出す
// - 後で ui.js を作ったら、このファイルの描画部分だけ ui.js に移す（構造はそのまま）

import * as Assets from "./assets.js";
import * as Tournament from "./sim_tournament.js";
import * as State from "./state.js";

// ----------------------------
// Safe adapters（state.jsがどんな形でも落ちないように吸収）
// ----------------------------
const S = {
  getState: () => (typeof State.getState === "function" ? State.getState() : ({ year: 1989, week: 1 })),
  setRuntime: (obj) => { if (typeof State.setRuntime === "function") State.setRuntime(obj); },
  addRecord: (obj) => { if (typeof State.addRecord === "function") State.addRecord(obj); },
  addLeagueTotals: (...args) => { if (typeof State.addLeagueTotals === "function") State.addLeagueTotals(...args); },
};

// ----------------------------
// Screen State
// ----------------------------
const SCREEN = Object.freeze({
  MAIN: "MAIN",
  MAP: "MAP",
  RESULT: "RESULT",
});

let currentScreen = SCREEN.MAIN;

// ----------------------------
// DOM bootstrap (won't depend on your HTML layout)
// ----------------------------
const dom = {
  root: document.getElementById("app") || document.body,
  overlay: null,
  panel: null,
  imgMain: null,
  imgMap: null,
};

function ensureBaseDom() {
  // overlay
  if (!dom.overlay) {
    dom.overlay = document.createElement("div");
    dom.overlay.id = "overlay";
    dom.overlay.style.position = "fixed";
    dom.overlay.style.left = "0";
    dom.overlay.style.top = "0";
    dom.overlay.style.width = "100%";
    dom.overlay.style.height = "100%";
    dom.overlay.style.pointerEvents = "none";
    dom.overlay.style.zIndex = "9999";
    dom.root.appendChild(dom.overlay);
  }

  // panel
  if (!dom.panel) {
    dom.panel = document.createElement("div");
    dom.panel.id = "debugPanel";
    dom.panel.style.position = "absolute";
    dom.panel.style.left = "12px";
    dom.panel.style.top = "12px";
    dom.panel.style.maxWidth = "min(720px, calc(100vw - 24px))";
    dom.panel.style.background = "rgba(0,0,0,0.55)";
    dom.panel.style.color = "#fff";
    dom.panel.style.padding = "10px 12px";
    dom.panel.style.borderRadius = "10px";
    dom.panel.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    dom.panel.style.fontSize = "13px";
    dom.panel.style.lineHeight = "1.4";
    dom.panel.style.pointerEvents = "auto";
    dom.panel.style.display = "none"; // 初期は隠す（必要時だけ出す）
    dom.overlay.appendChild(dom.panel);
  }

  // main / map images if not already present
  // (あなたのindex.htmlに既に画像がある場合はそれを優先)
  dom.imgMain = document.getElementById("mainImage") || dom.imgMain;
  dom.imgMap  = document.getElementById("mapImage")  || dom.imgMap;

  if (!dom.imgMain) {
    dom.imgMain = document.createElement("img");
    dom.imgMain.id = "mainImage";
    dom.imgMain.alt = "main";
    dom.imgMain.style.display = "block";
    dom.imgMain.style.maxWidth = "100%";
    dom.imgMain.style.height = "auto";
    dom.imgMain.style.margin = "0 auto";
    dom.imgMain.style.userSelect = "none";
    dom.imgMain.draggable = false;
    dom.root.appendChild(dom.imgMain);
  }

  if (!dom.imgMap) {
    dom.imgMap = document.createElement("img");
    dom.imgMap.id = "mapImage";
    dom.imgMap.alt = "map";
    dom.imgMap.style.display = "none";
    dom.imgMap.style.maxWidth = "100%";
    dom.imgMap.style.height = "auto";
    dom.imgMap.style.margin = "0 auto";
    dom.imgMap.style.userSelect = "none";
    dom.imgMap.draggable = false;
    dom.root.appendChild(dom.imgMap);
  }
}

// ----------------------------
// Asset loading (safe)
// ----------------------------
async function loadImages() {
  // assets.js の実装が何でも落ちないように扱う
  // 優先: Assets.loadAll() があればそれを使う
  if (typeof Assets.loadAll === "function") {
    try { await Assets.loadAll(); } catch(e) { console.warn("Assets.loadAll failed:", e); }
  }

  // main.png / map.png を表示用にロード
  dom.imgMain.src = "main.png";
  dom.imgMap.src = "map.png";

  dom.imgMain.onerror = () => showPanel(`main.png が見つからないので、代替表示になります。`);
  dom.imgMap.onerror  = () => showPanel(`map.png が見つからないので、代替表示になります。`);
}

// ----------------------------
// Button wiring
// ----------------------------
// あなたのボタン配置は「画像上の装飾」なので、HTML側で
// data-action を付けた透明ボタンがあれば拾う。
// 無ければ「デバッグ用の最小ボタン」を自動生成して進められるようにする。
function bindButtons() {
  const found = Array.from(document.querySelectorAll("[data-action]"));

  if (found.length > 0) {
    for (const el of found) {
      el.addEventListener("click", () => onAction(el.getAttribute("data-action")));
    }
    return;
  }

  // fallback debug buttons
  const bar = document.createElement("div");
  bar.id = "fallbackButtons";
  bar.style.position = "fixed";
  bar.style.right = "12px";
  bar.style.top = "12px";
  bar.style.zIndex = "10000";
  bar.style.display = "flex";
  bar.style.flexDirection = "column";
  bar.style.gap = "8px";
  document.body.appendChild(bar);

  const mk = (label, action) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.padding = "10px 12px";
    b.style.borderRadius = "10px";
    b.style.border = "0";
    b.style.cursor = "pointer";
    b.style.fontSize = "14px";
    b.addEventListener("click", () => onAction(action));
    bar.appendChild(b);
  };

  mk("SP1 開始", "START_SP1");
  mk("SP2 開始", "START_SP2");
  mk("CHAMP 開始", "START_CHAMP");
  mk("SP1→SP2→CHAMP", "START_ALL");
  mk("メインへ", "GO_MAIN");

  showPanel(
    "index.html側に data-action ボタンがまだ無いので、右上にデバッグボタンを出しました。\n" +
    "（後であなたの完成UIに合わせて、ここは自然に置き換えます）"
  );
}

// ----------------------------
// Actions
// ----------------------------
async function onAction(action) {
  switch (action) {
    case "GO_MAIN":
      goMain();
      return;

    case "START_SP1":
      await runFlow("SP1");
      return;

    case "START_SP2":
      await runFlow("SP2");
      return;

    case "START_CHAMP":
      await runFlow("CHAMPIONSHIP");
      return;

    case "START_ALL":
      await runAll();
      return;

    default:
      showPanel(`未割当アクション: ${action}\n（後であなたが「このボタンはこれ」って指示したら、ここだけ差し替えます）`);
      return;
  }
}

// ----------------------------
// Flow: show map -> simulate -> show result
// ----------------------------
async function runFlow(leagueKey) {
  // 1) MAP表示（クリックなし・一定時間だけ）
  goMap();
  await sleep(900);

  // 2) simulate
  let result = null;
  try {
    result = Tournament.runLeague(leagueKey, { seed: Date.now() });
  } catch (e) {
    console.error(e);
    showPanel(`シミュレーションでエラー:\n${String(e?.message || e)}`);
    goMain();
    return;
  }

  // 3) RESULT表示
  goResult(result);
}

async function runAll() {
  goMap();
  await sleep(900);

  let out = null;
  try {
    out = Tournament.runSeasonAll({ seed: Date.now() });
  } catch (e) {
    console.error(e);
    showPanel(`シーズン実行でエラー:\n${String(e?.message || e)}`);
    goMain();
    return;
  }
  goResult(out.champ || out.sp2 || out.sp1);
}

// ----------------------------
// Screen switching
// ----------------------------
function goMain() {
  currentScreen = SCREEN.MAIN;
  dom.imgMain.style.display = "block";
  dom.imgMap.style.display = "none";
  hidePanel();
}

function goMap() {
  currentScreen = SCREEN.MAP;
  dom.imgMain.style.display = "none";
  dom.imgMap.style.display = "block";
  hidePanel();
}

function goResult(result) {
  currentScreen = SCREEN.RESULT;
  dom.imgMain.style.display = "none";
  dom.imgMap.style.display = "none";

  // minimal render
  const league = result?.league || "UNKNOWN";
  const champId = result?.championTeamId || "";
  const champName = resolveTeamNameFromResult(result, champId);

  const lastStage = result?.stages?.[result.stages.length - 1];
  const lastMatch = lastStage?.matches?.[lastStage.matches.length - 1];
  const rowsMatch = lastMatch?.rows || [];
  const rowsTotal = result?.finalStandings || [];

  const s = S.getState();
  const head =
    `【${league}】\n` +
    `現在: ${s.year ?? "?"}年 ${s.week ?? "?"}週\n` +
    `優勝: ${champName || champId || "?"}\n`;

  const html =
    `<div style="white-space:pre-wrap;margin-bottom:10px;">${escapeHtml(head)}</div>` +
    `<div style="margin:8px 0 6px;font-weight:700;">最新試合リザルト</div>` +
    renderTable(rowsMatch, { mode: "match" }) +
    `<div style="margin:10px 0 6px;font-weight:700;">総合順位</div>` +
    renderTable(rowsTotal, { mode: "total" }) +
    `<div style="margin-top:10px;opacity:.9;">※これは仮表示。次に ui.js で「あなたの完成UI」に合わせて綺麗にします。</div>`;

  showPanelHtml(html, true);
}

// ----------------------------
// Helpers: render
// ----------------------------
function renderTable(rows, opt) {
  if (!rows || rows.length === 0) {
    return `<div style="opacity:.85;">（データなし）</div>`;
  }

  const isMatch = opt?.mode === "match";

  const header = isMatch
    ? ["#", "チーム", "K", "Pts"]
    : ["#", "チーム", "K", "Pts"];

  const body = rows.map(r => {
    const rank = r.rank ?? r?.rankIndex ?? "";
    const name = r.name ?? r.team?.name ?? r.teamName ?? r.teamId ?? "";
    const kills = r.kills ?? 0;
    const pts = r.pts ?? 0;
    return `<tr>
      <td style="padding:4px 6px;text-align:right;opacity:.9;">${escapeHtml(String(rank))}</td>
      <td style="padding:4px 6px;">${escapeHtml(String(name))}</td>
      <td style="padding:4px 6px;text-align:right;">${escapeHtml(String(kills))}</td>
      <td style="padding:4px 6px;text-align:right;">${escapeHtml(String(pts))}</td>
    </tr>`;
  }).join("");

  return `
  <div style="overflow:auto;max-height:50vh;border:1px solid rgba(255,255,255,.25);border-radius:10px;">
    <table style="border-collapse:collapse;width:100%;min-width:520px;">
      <thead>
        <tr>
          ${header.map(h => `<th style="position:sticky;top:0;background:rgba(0,0,0,.65);padding:6px;text-align:left;border-bottom:1px solid rgba(255,255,255,.2);">${escapeHtml(h)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function resolveTeamNameFromResult(result, teamId) {
  if (!teamId) return "";
  // try finalStandings
  const a = result?.finalStandings?.find(x => x.teamId === teamId || x.team?.id === teamId);
  if (a?.team?.name) return a.team.name;
  if (a?.name) return a.name;

  // try stages
  const st = result?.stages || [];
  for (const s of st) {
    const fs = s?.finalStandings || [];
    const b = fs.find(x => x.teamId === teamId || x.team?.id === teamId);
    if (b?.team?.name) return b.team.name;
    if (b?.name) return b.name;
  }
  return "";
}

// ----------------------------
// Panel UI
// ----------------------------
function showPanel(text) {
  showPanelHtml(`<div style="white-space:pre-wrap;">${escapeHtml(text)}</div>`, true);
}

function showPanelHtml(html, visible) {
  dom.panel.innerHTML = html;
  dom.panel.style.display = visible ? "block" : "none";
}

function hidePanel() {
  dom.panel.style.display = "none";
  dom.panel.innerHTML = "";
}

// ----------------------------
// Utils
// ----------------------------
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ----------------------------
// Boot
// ----------------------------
(async function boot() {
  ensureBaseDom();
  await loadImages();
  bindButtons();
  goMain();
})();
