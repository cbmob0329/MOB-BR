// game.js (ES Modules)
// Controller: boot, screen switching, button wiring, run sim, delegate all rendering to ui.js

import * as UI from "./ui.js";
import * as Tournament from "./sim_tournament.js";
import * as Assets from "./assets.js"; // ある前提（あなたが確認済み）
import * as State from "./state.js";

// ----------------------------
// Safe adapters（state.jsの中身が違っても落ちない）
// ----------------------------
const S = {
  getState: () => (typeof State.getState === "function" ? State.getState() : ({ year: 1989, week: 1 })),
  setRuntime: (obj) => { if (typeof State.setRuntime === "function") State.setRuntime(obj); },
};

// ----------------------------
// Actions (later you can remap buttons freely)
// ----------------------------
const ACTION = Object.freeze({
  GO_MAIN: "GO_MAIN",
  START_SP1: "START_SP1",
  START_SP2: "START_SP2",
  START_CHAMP: "START_CHAMP",
  START_ALL: "START_ALL",
});

// ----------------------------
// Boot
// ----------------------------
(async function boot() {
  // 1) init UI
  UI.init({ rootId: "app" });

  // 2) load assets safely (assets.jsがどんな実装でも落ちない)
  if (typeof Assets.loadAll === "function") {
    try { await Assets.loadAll(); } catch (e) { console.warn("Assets.loadAll failed:", e); }
  }

  // 3) ensure images are set (if your HTML already sets them, this is harmless)
  const mainImg = document.getElementById("mainImage");
  const mapImg  = document.getElementById("mapImage");
  if (mainImg && !mainImg.src) mainImg.src = "main.png";
  if (mapImg && !mapImg.src) mapImg.src = "map.png";

  // 4) bind buttons
  bindButtons();

  // 5) show main
  UI.showScreen("main");
})();

// ----------------------------
// Button wiring
// ----------------------------
// If index.html has transparent buttons with data-action, we use them.
// If not, we show small debug buttons so you can test immediately.
function bindButtons() {
  const found = Array.from(document.querySelectorAll("[data-action]"));
  if (found.length > 0) {
    for (const el of found) {
      el.addEventListener("click", () => onAction(el.getAttribute("data-action")));
    }
    return;
  }

  // fallback debug buttons (temporary)
  createDebugButtons();
  UI.pushLog("index.htmlに data-action ボタンが無いので、右上にデバッグボタンを出しました。");
  UI.pushLog("あなたの完成UIができたら、透明ボタンを置いて data-action を付ければOKです。");
}

function createDebugButtons() {
  const bar = document.createElement("div");
  bar.id = "debugButtons";
  bar.style.position = "fixed";
  bar.style.right = "12px";
  bar.style.top = "12px";
  bar.style.zIndex = "10001";
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

  mk("SP1 開始", ACTION.START_SP1);
  mk("SP2 開始", ACTION.START_SP2);
  mk("CHAMP 開始", ACTION.START_CHAMP);
  mk("SP1→SP2→CHAMP", ACTION.START_ALL);
  mk("メインへ", ACTION.GO_MAIN);
}

// ----------------------------
// Action handler
// ----------------------------
async function onAction(action) {
  switch (action) {
    case ACTION.GO_MAIN:
    case "GO_MAIN":
      UI.showScreen("main");
      return;

    case ACTION.START_SP1:
    case "START_SP1":
      await runLeague("SP1");
      return;

    case ACTION.START_SP2:
    case "START_SP2":
      await runLeague("SP2");
      return;

    case ACTION.START_CHAMP:
    case "START_CHAMP":
      await runLeague("CHAMPIONSHIP");
      return;

    case ACTION.START_ALL:
    case "START_ALL":
      await runAll();
      return;

    default:
      UI.showScreen("main");
      UI.showModal("未割当ボタン", [
        `data-action="${action}" が押されました`,
        "後でこの action に何を割り当てるか指示をください。",
      ]);
      return;
  }
}

// ----------------------------
// Flow: show map -> simulate -> render
// ----------------------------
async function runLeague(leagueKey) {
  // 1) map shown briefly (no clicking)
  UI.showScreen("map");
  await sleep(900);

  // 2) simulate
  let result = null;
  try {
    result = Tournament.runLeague(leagueKey, { seed: Date.now() });
  } catch (e) {
    console.error(e);
    UI.showScreen("main");
    UI.showModal("エラー", [
      "シミュレーションが停止しました。",
      String(e?.message || e),
    ]);
    return;
  }

  // 3) render via UI
  UI.renderTournamentResult(result);
}

async function runAll() {
  UI.showScreen("map");
  await sleep(900);

  let out = null;
  try {
    out = Tournament.runSeasonAll({ seed: Date.now() });
  } catch (e) {
    console.error(e);
    UI.showScreen("main");
    UI.showModal("エラー", [
      "シーズン実行が停止しました。",
      String(e?.message || e),
    ]);
    return;
  }

  // show the final (champ)
  UI.renderTournamentResult(out.champ);
}

// ----------------------------
// Utils
// ----------------------------
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
