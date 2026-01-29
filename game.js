/* =========================================================
  MOB APEX SIM  (Prototype)
  game.js  (FULL)
  - index.html から読み込む script は game.js 1本のみ
  - 画像素材は指定ファイル名を使用
========================================================= */

/* -------------------------
   Version
-------------------------- */
const VERSION = "v0.1";

/* -------------------------
   Assets (fixed names)
-------------------------- */
const ASSETS = {
  P1: "P1.png",
  MAIN: "main.png",
  IDO: "ido.png",
  MAP: "map.png",
  SHOP: "shop.png",
  HEAL: "heal.png",
  BATTLE: "battle.png",
  WINNER: "winner.png",
};

/* -------------------------
   DOM
-------------------------- */
const el = {
  companyName: document.getElementById("companyName"),
  companyRank: document.getElementById("companyRank"),
  teamName: document.getElementById("teamName"),
  weekInfo: document.getElementById("weekInfo"),
  goldValue: document.getElementById("goldValue"),
  nextTournamentValue: document.getElementById("nextTournamentValue"),
  statusValue: document.getElementById("statusValue"),
  hintText: document.getElementById("hintText"),
  versionText: document.getElementById("versionText"),

  canvas: document.getElementById("screen"),
  overlayMessage: document.getElementById("overlayMessage"),
  miniLog: document.getElementById("miniLog"),

  panelTitle: document.getElementById("panelTitle"),
  panelBody: document.getElementById("panelBody"),
  panelFooter: document.getElementById("panelFooter"),
  panelClose: document.getElementById("panelClose"),

  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalOk: document.getElementById("modalOk"),
};

const ctx = el.canvas.getContext("2d");

/* -------------------------
   Helpers
-------------------------- */
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function rand() {
  return Math.random();
}

function randi(n) {
  return Math.floor(Math.random() * n);
}

function pick(arr) {
  return arr[randi(arr.length)];
}

function nowMs() {
  return performance.now();
}

function fmtPct(x) {
  return Math.round(x * 100) + "%";
}

/* -------------------------
   Mini Log
-------------------------- */
const miniLogLines = [];
function miniLogPush(text) {
  miniLogLines.push({ t: Date.now(), text });
  if (miniLogLines.length > 5) miniLogLines.shift();
  renderMiniLog();
}

function renderMiniLog() {
  el.miniLog.innerHTML = "";
  for (const l of miniLogLines) {
    const div = document.createElement("div");
    div.className = "line";
    div.textContent = l.text;
    el.miniLog.appendChild(div);
  }
}

/* -------------------------
   Overlay Message
-------------------------- */
function showOverlay(msg, ms = 800) {
  el.overlayMessage.textContent = msg;
  el.overlayMessage.classList.remove("hidden");
  if (ms > 0) {
    setTimeout(() => {
      el.overlayMessage.classList.add("hidden");
    }, ms);
  }
}

function hideOverlay() {
  el.overlayMessage.classList.add("hidden");
}

/* -------------------------
   Modal
-------------------------- */
function openModal(title, html) {
  el.modalTitle.textContent = title;
  el.modalBody.innerHTML = html;
  el.modal.classList.remove("hidden");
}

function closeModal() {
  el.modal.classList.add("hidden");
}

el.modalOk.addEventListener("click", closeModal);

/* -------------------------
   Right Panel
-------------------------- */
function openPanel(title, html, closable = true) {
  el.panelTitle.textContent = title;
  el.panelBody.innerHTML = html;
  if (closable) el.panelFooter.classList.remove("hidden");
  else el.panelFooter.classList.add("hidden");
}

function closePanel() {
  openPanel("詳細", "<div>左のコマンドから選んでください。</div>", false);
}

el.panelClose.addEventListener("click", closePanel);

/* -------------------------
   Buttons
-------------------------- */
const cmdBtns = Array.from(document.querySelectorAll(".cmd"));
cmdBtns.forEach((b) => {
  b.addEventListener("click", () => {
    cmdBtns.forEach((x) => x.classList.remove("is-active"));
    b.classList.add("is-active");
    handleCommand(b.dataset.cmd);
  });
});

/* =========================================================
   DATA (Prototype)
   - ここは後で data.js / state.js に分離される想定
========================================================= */

/* -------------------------
   Company / Team
-------------------------- */
const COMPANY_RANKS = [
  { name: "D", weeklyGold: 80 },
  { name: "C", weeklyGold: 120 },
  { name: "B", weeklyGold: 180 },
  { name: "A", weeklyGold: 260 },
  { name: "S", weeklyGold: 360 },
];

const STATE = {
  year: 1,
  week: 1,
  gold: 200,
  companyName: "MOB COMPANY",
  companyRank: "D",
  teamName: "PLAYER TEAM",
  roster: [],

  nextTournament: "SP1 ローカルリーグ",
  statusText: "準備中",
};

const BASE_STATS_KEYS = [
  "HP",
  "Armor",
  "Mental",
  "Move",
  "Aim",
  "Agility",
  "Technique",
  "Support",
  "Hunt",
  "Synergy",
];

/* -------------------------
   Player Characters (initial 3)
---------------------------------------------------------- */
function makeChar(name, role, passive, ability, ult, stats) {
  return {
    name,
    role,
    passive,
    ability,
    ult,
    stats: { ...stats },
    hpNow: stats.HP,
    armorNow: stats.Armor,
  };
}

const PLAYER_START_CHARS = [
  makeChar(
    "ウニチー",
    "アサルト",
    "常時与ダメ+5%",
    "攻撃フェーズ中、命中+10%（1回）",
    "全員与ダメ+10%（1ラウンド）",
    {
      HP: 120,
      Armor: 40,
      Mental: 60,
      Move: 50,
      Aim: 55,
      Agility: 45,
      Technique: 50,
      Support: 40,
      Hunt: 55,
      Synergy: 50,
    }
  ),
  makeChar(
    "ネコクー",
    "サポート",
    "毎ラウンド開始時、HP+5回復",
    "味方全員HP+15回復（1回）",
    "味方全員Armor+20回復（1回）",
    {
      HP: 110,
      Armor: 50,
      Mental: 70,
      Move: 45,
      Aim: 45,
      Agility: 50,
      Technique: 40,
      Support: 65,
      Hunt: 45,
      Synergy: 60,
    }
  ),
  makeChar(
    "ドオー",
    "コントロール",
    "被ダメ-5%",
    "敵1人の命中-15%（1回）",
    "敵全員の命中-10%（1ラウンド）",
    {
      HP: 140,
      Armor: 55,
      Mental: 55,
      Move: 40,
      Aim: 40,
      Agility: 35,
      Technique: 55,
      Support: 45,
      Hunt: 40,
      Synergy: 55,
    }
  ),
];

STATE.roster = PLAYER_START_CHARS;

/* =========================================================
   VISUALS
========================================================= */

const images = {};
function loadImage(src) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

async function loadAssets() {
  images.main = await loadImage(ASSETS.MAIN);
  images.ido = await loadImage(ASSETS.IDO);
  images.map = await loadImage(ASSETS.MAP);
  images.shop = await loadImage(ASSETS.SHOP);
  images.heal = await loadImage(ASSETS.HEAL);
  images.battle = await loadImage(ASSETS.BATTLE);
  images.winner = await loadImage(ASSETS.WINNER);
  images.p1 = await loadImage(ASSETS.P1);
}

function drawFallback(title, sub = "") {
  ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  ctx.fillStyle = "#0b0f18";
  ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, el.canvas.width - 36, el.canvas.height - 36);

  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(title, 42, 90);

  ctx.fillStyle = "rgba(255,255,255,.68)";
  ctx.font = "16px sans-serif";
  ctx.fillText(sub, 42, 122);

  ctx.fillStyle = "rgba(57,217,138,.85)";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("※ assets が未配置の場合はこの画面になります", 42, el.canvas.height - 42);
}

function drawImageOrFallback(im, title) {
  if (!im) {
    drawFallback(title, "画像が見つかりません（assetsフォルダに配置してください）");
    return;
  }
  ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, 0, 0, el.canvas.width, el.canvas.height);
}

/* =========================================================
   UI Render
========================================================= */
function renderTop() {
  el.companyName.textContent = `企業名：${STATE.companyName}`;
  el.companyRank.textContent = `企業ランク：${STATE.companyRank}`;
  el.teamName.textContent = `チーム名：${STATE.teamName}`;
  el.weekInfo.textContent = `YEAR ${STATE.year} / WEEK ${STATE.week}`;
}

function renderBottom() {
  el.goldValue.textContent = String(STATE.gold);
  el.nextTournamentValue.textContent = STATE.nextTournament;
  el.statusValue.textContent = STATE.statusText;
  el.hintText.textContent = "左のコマンドから選んでください。";
  el.versionText.textContent = VERSION;
}

function renderAll() {
  renderTop();
  renderBottom();
}

/* =========================================================
   COMMANDS
========================================================= */
function handleCommand(cmd) {
  switch (cmd) {
    case "team":
      drawImageOrFallback(images.main, "チーム編成");
      openPanel("チーム編成", renderTeamPanel());
      miniLogPush("チーム編成を開いた");
      break;

    case "offer":
      drawImageOrFallback(images.ido, "勧誘");
      openPanel("勧誘", renderOfferPanel());
      miniLogPush("勧誘を開いた");
      break;

    case "gacha":
      drawImageOrFallback(images.shop, "ガチャ");
      openPanel("ガチャ", renderGachaPanel());
      miniLogPush("ガチャを開いた");
      break;

    case "tournament":
      drawImageOrFallback(images.map, "参戦中の大会");
      openPanel("参戦中の大会", renderTournamentPanel());
      miniLogPush("参戦中の大会を開いた");
      break;

    case "results":
      drawImageOrFallback(images.winner, "大会の結果");
      openPanel("大会の結果", renderResultsPanel());
      miniLogPush("大会の結果を開いた");
      break;

    case "schedule":
      drawImageOrFallback(images.map, "スケジュール");
      openPanel("スケジュール", renderSchedulePanel());
      miniLogPush("スケジュールを開いた");
      break;

    case "train":
      drawImageOrFallback(images.heal, "修行");
      openPanel("修行", renderTrainPanel());
      miniLogPush("修行を開いた");
      break;

    case "shop":
      drawImageOrFallback(images.shop, "ショップ");
      openPanel("ショップ", renderShopPanel());
      miniLogPush("ショップを開いた");
      break;

    case "save":
      drawImageOrFallback(images.main, "セーブ");
      doSave();
      miniLogPush("セーブした");
      break;

    default:
      openPanel("詳細", "<div>未実装</div>");
      break;
  }
}

/* =========================================================
   Panels (Prototype)
========================================================= */
function statTable(stats) {
  const rows = BASE_STATS_KEYS.map(
    (k) =>
      `<tr><td><b>${k}</b></td><td>${stats[k]}</td></tr>`
  ).join("");
  return `<table>${rows}</table>`;
}

function renderTeamPanel() {
  let html = "";
  html += `<div style="margin-bottom:10px;">
    <span class="chip ok">PLAYER TEAM</span>
    <span class="chip">3人</span>
  </div>`;

  for (const c of STATE.roster) {
    html += `<div style="margin:10px 0; padding:10px; border:1px solid rgba(255,255,255,.10); border-radius:12px; background: rgba(0,0,0,.12);">
      <div style="font-weight:900; font-size:14px;">${c.name} <span style="opacity:.65; font-weight:700; font-size:12px;">(${c.role})</span></div>
      <div style="margin-top:6px; color:rgba(255,255,255,.75); font-size:12px;">
        <div>Passive：${c.passive}</div>
        <div>Ability：${c.ability}</div>
        <div>Ult：${c.ult}</div>
      </div>
      <div style="margin-top:8px;">${statTable(c.stats)}</div>
    </div>`;
  }

  html += `<div style="margin-top:10px; color:rgba(255,255,255,.65); font-size:12px;">
    ※ここは後で「入れ替え・育成・装備」に拡張予定
  </div>`;
  return html;
}

function renderOfferPanel() {
  return `
    <div>
      <div style="margin-bottom:10px;">
        <span class="chip">企業ランク：${STATE.companyRank}</span>
        <span class="chip">所持G：${STATE.gold}</span>
      </div>
      <div style="color:rgba(255,255,255,.75); font-size:13px;">
        まだ簡易版のため、ここではオファーの演出だけ表示します。
      </div>
      <div style="margin-top:10px;">
        <button class="subBtn" id="btnOfferTry">勧誘してみる</button>
      </div>
    </div>
  `;
}

function renderGachaPanel() {
  return `
    <div>
      <div style="margin-bottom:10px;">
        <span class="chip">ガチャ（簡易）</span>
      </div>
      <div style="color:rgba(255,255,255,.75); font-size:13px;">
        防具 / アビリティ / ウルト / アイテム / コーチスキル（予定）
      </div>
      <div style="margin-top:10px;">
        <button class="subBtn" id="btnGachaOnce">1回引く</button>
      </div>
    </div>
  `;
}

function renderTournamentPanel() {
  return `
    <div>
      <div style="margin-bottom:10px;">
        <span class="chip ok">${STATE.nextTournament}</span>
      </div>
      <div style="color:rgba(255,255,255,.78); font-size:13px;">
        大会の進行は「試合開始」から実行します（簡易版）。
      </div>
      <div style="margin-top:12px;">
        <button class="subBtn" id="btnStartMatch">試合開始（簡易）</button>
      </div>
    </div>
  `;
}

function renderResultsPanel() {
  return `
    <div style="color:rgba(255,255,255,.78); font-size:13px;">
      まだ結果データがありません。<br/>
      「参戦中の大会」→「試合開始」で結果を作ります。
    </div>
  `;
}

function renderSchedulePanel() {
  return `
    <div>
      <div style="margin-bottom:10px;">
        <span class="chip">YEAR ${STATE.year}</span>
        <span class="chip">WEEK ${STATE.week}</span>
      </div>
      <div style="color:rgba(255,255,255,.78); font-size:13px;">
        週を進めると大会や修行が進みます（簡易版）。
      </div>
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="subBtn" id="btnNextWeek">次の週へ</button>
      </div>
    </div>
  `;
}

function renderTrainPanel() {
  return `
    <div>
      <div style="margin-bottom:10px;">
        <span class="chip">修行（簡易）</span>
      </div>
      <div style="color:rgba(255,255,255,.78); font-size:13px;">
        1回の修行で1週消費して、能力が少し上がります。
      </div>
      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="subBtn" id="btnTrain">修行する</button>
      </div>
    </div>
  `;
}

function renderShopPanel() {
  return `
    <div>
      <div style="margin-bottom:10px;">
        <span class="chip">ショップ（簡易）</span>
        <span class="chip">所持G：${STATE.gold}</span>
      </div>
      <div style="color:rgba(255,255,255,.78); font-size:13px;">
        アイテム購入などは後で実装します。
      </div>
    </div>
  `;
}

/* =========================================================
   Save / Load
========================================================= */
const SAVE_KEY = "mob_apex_sim_save_v1";

function doSave() {
  const payload = {
    VERSION,
    STATE,
    t: Date.now(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  showOverlay("セーブしました", 700);
  openModal("セーブ", "セーブしました。");
}

function tryLoad() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const obj = JSON.parse(raw);
    if (!obj || !obj.STATE) return false;
    // minimal merge
    Object.assign(STATE, obj.STATE);
    return true;
  } catch (e) {
    return false;
  }
}

/* =========================================================
   Simple simulation (placeholder)
========================================================= */
function simulateMatchSimple() {
  // returns ranking for 20 teams (placeholder)
  const teams = [];
  for (let i = 0; i < 20; i++) {
    teams.push({
      rank: i + 1,
      teamName: i === 0 ? STATE.teamName : `CPU TEAM ${i}`,
      kills: randi(10),
      point: 0,
    });
  }

  // randomize order
  teams.sort(() => Math.random() - 0.5);

  // assign ranks and points
  for (let i = 0; i < teams.length; i++) {
    teams[i].rank = i + 1;
    // simple scoring
    const placePoint = Math.max(0, 21 - teams[i].rank) * 2;
    const killPoint = teams[i].kills * 3;
    teams[i].point = placePoint + killPoint;
  }

  teams.sort((a, b) => a.rank - b.rank);
  return teams;
}

function renderMatchResultTable(list) {
  let html = `<div style="margin-bottom:10px;"><span class="chip ok">試合結果（簡易）</span></div>`;
  html += `<table>
    <tr><th>順位</th><th>チーム</th><th>キル</th><th>pt</th></tr>
  `;
  for (const t of list) {
    html += `<tr>
      <td><b>${t.rank}</b></td>
      <td>${t.teamName}</td>
      <td>${t.kills}</td>
      <td><b>${t.point}</b></td>
    </tr>`;
  }
  html += `</table>`;
  return html;
}

/* =========================================================
   Bind dynamic panel buttons
========================================================= */
function bindPanelButtons() {
  // Offer
  const btnOfferTry = document.getElementById("btnOfferTry");
  if (btnOfferTry) {
    btnOfferTry.onclick = () => {
      showOverlay("勧誘中…", 600);
      const ok = rand() < 0.65;
      if (ok) {
        openModal("勧誘", "勧誘に成功しました！（簡易演出）");
        miniLogPush("勧誘成功！");
      } else {
        openModal("勧誘", "勧誘に失敗しました…（簡易演出）");
        miniLogPush("勧誘失敗…");
      }
    };
  }

  // Gacha
  const btnGachaOnce = document.getElementById("btnGachaOnce");
  if (btnGachaOnce) {
    btnGachaOnce.onclick = () => {
      const pool = ["R", "R", "R", "SR", "SSR"];
      const rarity = pick(pool);
      openModal("ガチャ結果", `結果：<b>${rarity}</b>（簡易）`);
      miniLogPush(`ガチャ：${rarity}`);
    };
  }

  // Start Match
  const btnStartMatch = document.getElementById("btnStartMatch");
  if (btnStartMatch) {
    btnStartMatch.onclick = () => {
      showOverlay("試合開始！", 800);
      setTimeout(() => {
        drawImageOrFallback(images.battle, "試合中");
        const result = simulateMatchSimple();
        openPanel("試合結果", renderMatchResultTable(result));
        bindPanelButtons();
        miniLogPush("試合が終了した");
      }, 900);
    };
  }

  // Next Week
  const btnNextWeek = document.getElementById("btnNextWeek");
  if (btnNextWeek) {
    btnNextWeek.onclick = () => {
      // add weekly gold
      const rankObj = COMPANY_RANKS.find((x) => x.name === STATE.companyRank) || COMPANY_RANKS[0];
      STATE.gold += rankObj.weeklyGold;

      STATE.week += 1;
      if (STATE.week > 52) {
        STATE.week = 1;
        STATE.year += 1;
      }
      STATE.statusText = "進行中";
      renderAll();
      openPanel("スケジュール", renderSchedulePanel());
      bindPanelButtons();
      miniLogPush(`週が進んだ +${rankObj.weeklyGold}G`);
      showOverlay("1週間経過", 800);
    };
  }

  // Train
  const btnTrain = document.getElementById("btnTrain");
  if (btnTrain) {
    btnTrain.onclick = () => {
      // consume week
      STATE.week += 1;
      if (STATE.week > 52) {
        STATE.week = 1;
        STATE.year += 1;
      }

      // grow random stats slightly
      for (const c of STATE.roster) {
        const k1 = pick(BASE_STATS_KEYS);
        const k2 = pick(BASE_STATS_KEYS);
        c.stats[k1] += 1 + randi(2);
        c.stats[k2] += 1;
        c.stats.HP = clamp(c.stats.HP, 50, 300);
      }

      renderAll();
      openPanel("修行", renderTrainPanel());
      bindPanelButtons();
      miniLogPush("修行した（能力UP）");
      showOverlay("修行！", 800);
      openModal("修行結果", "能力が少し上がりました（簡易）。");
    };
  }
}

/* =========================================================
   Main
========================================================= */
async function main() {
  el.versionText.textContent = VERSION;
  tryLoad();
  renderAll();

  closePanel();
  drawFallback("MOB APEX SIM", "画像を assets に置くと表示が切り替わります");

  await loadAssets();
  // show main screen after load
  drawImageOrFallback(images.main, "MAIN");

  miniLogPush("起動しました");
  bindPanelButtons();

  // default active
  const first = cmdBtns[0];
  if (first) first.classList.add("is-active");
}

main();
