// ui.js (ES Modules)
// Display-only module: logs, modal highlights, result tables.
// - Does NOT run simulation. It only renders what game.js / sim_tournament.js produce.
//
// Usage (recommended):
//   import * as UI from './ui.js';
//   UI.init();                          // once
//   UI.showScreen('main'|'map'|'result');
//   UI.renderTournamentResult(result);  // after sim
//
// This module is resilient:
// - If your index.html doesn't have containers, it auto-creates minimal containers.
// - If you later create real UI containers, it will use them instead.

const SCREEN = Object.freeze({
  MAIN: "main",
  MAP: "map",
  RESULT: "result",
});

// ---------------------------
// DOM references (auto-created if missing)
// ---------------------------
const dom = {
  root: null,

  // images
  mainImage: null,
  mapImage: null,

  // overlays/panels
  hud: null,
  logBox: null,
  modal: null,
  modalInner: null,

  // result area
  resultWrap: null,
  resultTitle: null,
  matchTableWrap: null,
  totalTableWrap: null,
};

let _inited = false;

// ---------------------------
// Public API
// ---------------------------

export function init(options = {}) {
  if (_inited) return;
  _inited = true;

  dom.root = document.getElementById(options.rootId || "app") || document.body;

  // find or create images
  dom.mainImage = document.getElementById("mainImage") || createImage("mainImage");
  dom.mapImage = document.getElementById("mapImage") || createImage("mapImage");

  // ensure basic result containers
  dom.hud = document.getElementById("hud") || createHud();
  dom.logBox = document.getElementById("logBox") || createLogBox();
  dom.modal = document.getElementById("modal") || createModal();

  dom.resultWrap = document.getElementById("resultWrap") || createResultWrap();
  dom.resultTitle = dom.resultWrap.querySelector("#resultTitle");
  dom.matchTableWrap = dom.resultWrap.querySelector("#matchTableWrap");
  dom.totalTableWrap = dom.resultWrap.querySelector("#totalTableWrap");

  // modal click to close
  dom.modal.addEventListener("click", () => hideModal());

  // default hidden
  hide(dom.hud);
  hide(dom.logBox);
  hide(dom.resultWrap);
  hideModal();
}

export function showScreen(screen) {
  ensureInit();

  const s = screen || SCREEN.MAIN;

  if (s === SCREEN.MAIN) {
    show(dom.mainImage);
    hide(dom.mapImage);
    hide(dom.resultWrap);
    hide(dom.hud);
    hide(dom.logBox);
    hideModal();
    return;
  }

  if (s === SCREEN.MAP) {
    hide(dom.mainImage);
    show(dom.mapImage);
    hide(dom.resultWrap);
    hide(dom.hud);
    hide(dom.logBox);
    hideModal();
    return;
  }

  if (s === SCREEN.RESULT) {
    hide(dom.mainImage);
    hide(dom.mapImage);
    show(dom.resultWrap);
    show(dom.hud);
    show(dom.logBox);
    // modal is optional
    return;
  }
}

export function clearLog() {
  ensureInit();
  dom.logBox.innerHTML = "";
}

export function pushLog(text) {
  ensureInit();
  const line = document.createElement("div");
  line.textContent = String(text ?? "");
  line.style.padding = "2px 0";
  dom.logBox.appendChild(line);

  // keep last ~80 lines
  const max = 80;
  while (dom.logBox.childNodes.length > max) dom.logBox.removeChild(dom.logBox.firstChild);

  dom.logBox.scrollTop = dom.logBox.scrollHeight;
}

export function showModal(title, bodyLines = []) {
  ensureInit();
  const t = escapeHtml(title || "重要シーン");
  const body = (bodyLines || []).map(x => `<div style="padding:2px 0;">${escapeHtml(x)}</div>`).join("");

  dom.modalInner.innerHTML = `
    <div style="font-weight:800;margin-bottom:8px;">${t}</div>
    <div style="opacity:.95;">${body || "<div>（なし）</div>"}</div>
    <div style="margin-top:10px;opacity:.75;font-size:12px;">（クリックで閉じる）</div>
  `;
  dom.modal.style.display = "flex";
}

export function hideModal() {
  ensureInit();
  dom.modal.style.display = "none";
  dom.modalInner.innerHTML = "";
}

export function setHud(lines = []) {
  ensureInit();
  dom.hud.innerHTML = (lines || []).map(x => `<div>${escapeHtml(x)}</div>`).join("");
}

export function renderTournamentResult(result) {
  ensureInit();
  showScreen(SCREEN.RESULT);

  // Title
  const league = result?.league || "UNKNOWN";
  const championId = result?.championTeamId || "";
  const championName = resolveTeamName(result, championId) || championId || "?";

  dom.resultTitle.textContent = `【${league}】優勝：${championName}`;

  // Latest match (from last stage last match)
  const lastStage = result?.stages?.[result.stages.length - 1];
  const lastMatch = lastStage?.matches?.[lastStage.matches.length - 1];

  const matchRows = (lastMatch?.rows || []).map(r => ({
    rank: r.rank,
    name: r.name,
    kills: r.kills,
    pts: r.pts,
    placePts: r.placePts ?? null,
  }));

  // Total standings (final)
  const totalRows = (result?.finalStandings || []).map(r => ({
    rank: r.rank,
    name: r.team?.name || r.name || r.teamId,
    kills: r.kills,
    pts: r.pts,
  }));

  // Render tables
  dom.matchTableWrap.innerHTML = renderTable(matchRows, { mode: "match" });
  dom.totalTableWrap.innerHTML = renderTable(totalRows, { mode: "total" });

  // HUD
  const stageName = lastStage?.stage || "";
  const matchIndex = lastMatch ? (lastMatch.index || lastStage?.matches?.length || 1) : 1;
  const matchTotal = lastStage?.matches?.length || 5;

  setHud([
    `リーグ: ${league}`,
    `ステージ: ${stageName}`,
    `試合: ${matchIndex}/${matchTotal}`,
    `優勝: ${championName}`,
  ]);

  // Logs
  clearLog();
  const highlights = lastMatch?.highlights || [];
  if (highlights.length) {
    pushLog("=== 重要シーン ===");
    for (const h of highlights) pushLog(h);
  }
  pushLog("=== 進行ログ ===");
  pushLog(`ステージ: ${stageName} / 最終試合: ${matchIndex}/${matchTotal}`);
  pushLog(`総合チーム数: ${totalRows.length}`);

  // modal (optional): show top 3 highlights
  if (highlights.length) {
    showModal("重要シーン", highlights.slice(0, 6));
  } else {
    hideModal();
  }
}

// ---------------------------
// DOM creation helpers
// ---------------------------

function ensureInit() {
  if (!_inited) init();
}

function createImage(id) {
  const img = document.createElement("img");
  img.id = id;
  img.alt = id;
  img.style.display = "none";
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  img.style.margin = "0 auto";
  img.style.userSelect = "none";
  img.draggable = false;
  dom.root.appendChild(img);
  return img;
}

function createHud() {
  const hud = document.createElement("div");
  hud.id = "hud";
  hud.style.position = "fixed";
  hud.style.left = "12px";
  hud.style.top = "12px";
  hud.style.zIndex = "9999";
  hud.style.background = "rgba(0,0,0,0.55)";
  hud.style.color = "#fff";
  hud.style.padding = "10px 12px";
  hud.style.borderRadius = "10px";
  hud.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  hud.style.fontSize = "13px";
  hud.style.pointerEvents = "none";
  dom.root.appendChild(hud);
  return hud;
}

function createLogBox() {
  const box = document.createElement("div");
  box.id = "logBox";
  box.style.position = "fixed";
  box.style.left = "12px";
  box.style.bottom = "12px";
  box.style.zIndex = "9999";
  box.style.width = "min(560px, calc(100vw - 24px))";
  box.style.maxHeight = "34vh";
  box.style.overflow = "auto";
  box.style.background = "rgba(0,0,0,0.55)";
  box.style.color = "#fff";
  box.style.padding = "10px 12px";
  box.style.borderRadius = "10px";
  box.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  box.style.fontSize = "12px";
  box.style.lineHeight = "1.35";
  box.style.pointerEvents = "auto";
  dom.root.appendChild(box);
  return box;
}

function createModal() {
  const modal = document.createElement("div");
  modal.id = "modal";
  modal.style.position = "fixed";
  modal.style.left = "0";
  modal.style.top = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.display = "none";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.background = "rgba(0,0,0,0.6)";
  modal.style.zIndex = "10000";
  modal.style.pointerEvents = "auto";

  const inner = document.createElement("div");
  inner.id = "modalInner";
  inner.style.maxWidth = "min(680px, calc(100vw - 40px))";
  inner.style.maxHeight = "min(70vh, calc(100vh - 40px))";
  inner.style.overflow = "auto";
  inner.style.background = "rgba(20,20,20,0.92)";
  inner.style.color = "#fff";
  inner.style.padding = "14px 16px";
  inner.style.borderRadius = "12px";
  inner.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  inner.style.fontSize = "14px";
  inner.style.pointerEvents = "none"; // click closes anywhere
  modal.appendChild(inner);

  dom.modalInner = inner;
  dom.root.appendChild(modal);
  return modal;
}

function createResultWrap() {
  const wrap = document.createElement("div");
  wrap.id = "resultWrap";
  wrap.style.position = "relative";
  wrap.style.margin = "0 auto";
  wrap.style.padding = "12px";
  wrap.style.maxWidth = "980px";
  wrap.style.color = "#111";
  wrap.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

  wrap.innerHTML = `
    <div id="resultTitle" style="font-weight:900;font-size:18px;margin:8px 0 12px;"></div>

    <div style="font-weight:800;margin:10px 0 6px;">最新試合リザルト</div>
    <div id="matchTableWrap"></div>

    <div style="font-weight:800;margin:16px 0 6px;">総合順位</div>
    <div id="totalTableWrap"></div>

    <div style="margin-top:12px;opacity:.7;font-size:12px;">
      ※ この表示は ui.js の仮実装です。あなたの完成UI（画像ベース）に合わせて最終的に差し替えます。
    </div>
  `;
  dom.root.appendChild(wrap);
  return wrap;
}

// ---------------------------
// Table rendering
// ---------------------------

function renderTable(rows, opt = {}) {
  if (!rows || rows.length === 0) {
    return `<div style="opacity:.8;">（データなし）</div>`;
  }

  const header = ["#", "チーム", "K", "Pts"];

  const body = rows.map(r => {
    return `<tr>
      <td style="padding:6px 8px;text-align:right;opacity:.85;">${escapeHtml(String(r.rank ?? ""))}</td>
      <td style="padding:6px 8px;">${escapeHtml(String(r.name ?? ""))}</td>
      <td style="padding:6px 8px;text-align:right;">${escapeHtml(String(r.kills ?? 0))}</td>
      <td style="padding:6px 8px;text-align:right;">${escapeHtml(String(r.pts ?? 0))}</td>
    </tr>`;
  }).join("");

  return `
  <div style="overflow:auto;max-height:52vh;border:1px solid rgba(0,0,0,.15);border-radius:12px;background:#fff;">
    <table style="border-collapse:collapse;width:100%;min-width:560px;">
      <thead>
        <tr>
          ${header.map(h => `<th style="position:sticky;top:0;background:#f4f4f4;padding:8px;text-align:left;border-bottom:1px solid rgba(0,0,0,.12);">${escapeHtml(h)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

// ---------------------------
// Utilities
// ---------------------------

function show(el) { el.style.display = ""; }
function hide(el) { el.style.display = "none"; }

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resolveTeamName(result, teamId) {
  if (!teamId) return "";
  const a = result?.finalStandings?.find(x => x.teamId === teamId || x.team?.id === teamId);
  if (a?.team?.name) return a.team.name;
  if (a?.name) return a.name;
  return "";
}
