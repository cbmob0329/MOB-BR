/* ui.js (FULL)  MOB BR
   Changes:
   - ログ枠を下に落とす（CSSが担当）＋文字色を白固定
   - プレイヤーのメンバー名を「チーム名→メンバー1→2→3」縦並びで表示
   - ゲーム画面全体の背景に haikeimain.png を強制適用（真っ黒対策）
   - 交戦時、右側に敵チーム(cpu画像)表示（既存仕様に沿って“見つかった要素だけ”更新）
*/

export const UI = (() => {

  // ===== DOM helpers =====
  const qsFirst = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const setImg = (imgEl, src) => {
    if (!imgEl) return;
    if (!src) {
      imgEl.style.display = "none";
      imgEl.removeAttribute("src");
      return;
    }
    imgEl.style.display = "";
    // キャッシュ対策：既に ?v= が付いているならそのまま。無ければ付与
    const hasQuery = src.includes("?");
    imgEl.src = hasQuery ? src : `${src}?v=${Date.now()}`;
  };

  const ensureLogInner = (logPanel) => {
    if (!logPanel) return null;
    let inner = logPanel.querySelector(".log-inner");
    if (!inner) {
      inner = document.createElement("div");
      inner.className = "log-inner";
      logPanel.appendChild(inner);
    }
    return inner;
  };

  // ===== Cached elements (複数候補対応) =====
  const E = {
    body: null,

    // stage root (画面内)
    stage: null,

    // player
    playerInfo: null,
    playerImage: null,

    // enemy
    enemySide: null,
    enemyInfo: null,
    enemyImage: null,

    // log
    logPanel: null,
    logInner: null,
    logText: null,
  };

  const cacheElements = () => {
    E.body = document.body;

    E.stage = qsFirst(["#stage", ".stage", "#scene", ".scene"]);

    // Player
    E.playerInfo  = qsFirst(["#playerInfo", ".player-info", "#playerText", ".team-info"]);
    E.playerImage = qsFirst(["#playerImage", ".player-image", "#playerPic", ".p1-image"]);

    // Enemy
    E.enemySide  = qsFirst(["#enemySide", ".enemy-side", "#enemyPanel", ".enemy-panel"]);
    E.enemyInfo  = qsFirst(["#enemyInfo", ".enemy-info"]);
    E.enemyImage = qsFirst(["#enemyImage", ".enemy-image", "#enemyPic"]);

    // Log
    E.logPanel = qsFirst(["#logPanel", ".log-panel", "#logBox", ".log-box", "#logArea"]);
    E.logInner = ensureLogInner(E.logPanel);

    // 既存で logText / logLine があるなら掴む。無ければpを作る
    E.logText = qsFirst(["#logText", ".log-text", "#logLine", ".log-line"]);
    if (!E.logText && E.logInner) {
      const p = document.createElement("p");
      p.className = "log-text";
      p.id = "logText";
      E.logInner.appendChild(p);
      E.logText = p;
    }
  };

  // ===== Global background fix =====
  const applyMainBackground = () => {
    // ✅ 真っ黒対策：body背景を強制指定（style.cssでも指定済みだが保険）
    if (!E.body) return;
    E.body.style.backgroundImage = `url("./haikeimain.png")`;
    E.body.style.backgroundSize = "cover";
    E.body.style.backgroundPosition = "center";
    E.body.style.backgroundRepeat = "no-repeat";
    E.body.style.backgroundAttachment = "fixed";
  };

  // ===== Player info render =====
  const renderPlayerInfo = (team) => {
    // team: { teamName, members: [name1,name2,name3] } などを想定
    if (!E.playerInfo) return;

    const teamName = team?.teamName ?? team?.name ?? "PLAYER TEAM";
    const members = team?.members ?? team?.memberNames ?? team?.players ?? [];

    // ✅ 指定順：チーム名→メンバー1→2→3（縦並び）
    const m1 = members[0]?.name ?? members[0] ?? "Member1";
    const m2 = members[1]?.name ?? members[1] ?? "Member2";
    const m3 = members[2]?.name ?? members[2] ?? "Member3";

    E.playerInfo.innerHTML = `
      <div class="team-name">${escapeHtml(teamName)}</div>
      <div class="member">${escapeHtml(m1)}</div>
      <div class="member">${escapeHtml(m2)}</div>
      <div class="member">${escapeHtml(m3)}</div>
    `;
  };

  // ===== Enemy display =====
  const showEnemy = (cpuTeam) => {
    // cpuTeam: { teamId, teamName } 等
    if (E.enemySide) E.enemySide.style.display = "block";

    if (E.enemyInfo) {
      const tn = cpuTeam?.teamName ?? cpuTeam?.name ?? cpuTeam?.teamId ?? "ENEMY";
      E.enemyInfo.innerHTML = `<div class="team-name">${escapeHtml(tn)}</div>`;
    }

    // 画像は cpu/<teamId>.png か、既存仕様に合わせて呼ぶ（ユーザーの現状に合わせ “cpu/” 想定）
    const id = cpuTeam?.teamId ?? cpuTeam?.id ?? cpuTeam?.key ?? null;
    if (id && E.enemyImage) {
      setImg(E.enemyImage, `./cpu/${id}.png`);
    } else if (E.enemyImage) {
      setImg(E.enemyImage, null);
    }
  };

  const hideEnemy = () => {
    if (E.enemySide) E.enemySide.style.display = "none";
    if (E.enemyImage) setImg(E.enemyImage, null);
    if (E.enemyInfo) E.enemyInfo.innerHTML = "";
  };

  // ===== Log =====
  const setLog = (text) => {
    if (!E.logText) return;
    // ✅ 文字色は白固定（CSS側でも白だが保険）
    E.logText.style.color = "#ffffff";
    E.logText.textContent = String(text ?? "");
  };

  // ===== Public API (既存app.jsから呼びやすい形) =====
  const init = () => {
    cacheElements();
    applyMainBackground();

    // 初期表示の保険：ログに何か入っていないと“空”に見える場合がある
    if (E.logText && !E.logText.textContent) {
      setLog("準備中...");
    }
  };

  // ===== Utilities =====
  const escapeHtml = (str) => {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  // app.js / sim-battle.js 等から呼べるように、用途別関数名も用意
  return {
    init,

    // player
    renderPlayerInfo,

    // enemy
    showEnemy,
    hideEnemy,

    // log
    setLog,
  };

})();

// DOMContentLoaded 自動初期化（既存app側でUI.init()していても二重にならないよう安全）
document.addEventListener("DOMContentLoaded", () => {
  try { UI.init(); } catch(e){ /* noop */ }
});
