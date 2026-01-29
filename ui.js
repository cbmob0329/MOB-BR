/* =========================================================
  ui.js (FULL)
  - UI描画／右パネル／モーダル／ミニログ／オーバーレイ
  - game.js から呼び出して使う想定（index.html は game.js 1本だけ）
========================================================= */

(function () {
  "use strict";

  // -------------------------------------------------------
  // DOM cache
  // -------------------------------------------------------
  const UI = {
    el: null,
    ctx: null,
    W: 640,
    H: 640,

    _miniLogLines: [],
    _miniLogMax: 6,

    _activeCmd: null,
    _assets: null, // assets.js で差し替え想定
    _state: null,  // state.js で差し替え想定
  };

  function q(id) {
    return document.getElementById(id);
  }

  // -------------------------------------------------------
  // Init
  // -------------------------------------------------------
  function init(opts = {}) {
    UI.el = {
      companyName: q("companyName"),
      companyRank: q("companyRank"),
      teamName: q("teamName"),
      weekInfo: q("weekInfo"),

      goldValue: q("goldValue"),
      nextTournamentValue: q("nextTournamentValue"),
      statusValue: q("statusValue"),
      hintText: q("hintText"),
      versionText: q("versionText"),

      canvas: q("screen"),
      overlayMessage: q("overlayMessage"),
      miniLog: q("miniLog"),

      panelTitle: q("panelTitle"),
      panelBody: q("panelBody"),
      panelFooter: q("panelFooter"),
      panelClose: q("panelClose"),

      modal: q("modal"),
      modalTitle: q("modalTitle"),
      modalBody: q("modalBody"),
      modalOk: q("modalOk"),
    };

    if (!UI.el.canvas) throw new Error("canvas(#screen) not found");

    UI.ctx = UI.el.canvas.getContext("2d");

    UI.W = UI.el.canvas.width || 640;
    UI.H = UI.el.canvas.height || 640;

    bindBaseEvents();
    setPanel("詳細", "<div>左のコマンドから選んでください。</div>", false);

    if (opts && typeof opts.version === "string") {
      setVersion(opts.version);
    }

    return UI;
  }

  function bindBaseEvents() {
    // Right panel close
    if (UI.el.panelClose) UI.el.panelClose.addEventListener("click", () => {
      setPanel("詳細", "<div>左のコマンドから選んでください。</div>", false);
    });

    // Modal OK
    if (UI.el.modalOk) UI.el.modalOk.addEventListener("click", closeModal);

    // Left menu buttons
    const cmdBtns = Array.from(document.querySelectorAll(".cmd"));
    cmdBtns.forEach((b) => {
      b.addEventListener("click", () => {
        cmdBtns.forEach((x) => x.classList.remove("is-active"));
        b.classList.add("is-active");
        UI._activeCmd = b.dataset.cmd || null;
        // game.js 側で onCommand を受け取る想定
        if (typeof UI.onCommand === "function") UI.onCommand(UI._activeCmd);
      });
    });
    // default active
    if (cmdBtns[0]) cmdBtns[0].classList.add("is-active");
    UI._activeCmd = cmdBtns[0] ? (cmdBtns[0].dataset.cmd || null) : null;
  }

  // -------------------------------------------------------
  // State / Assets wiring (optional)
  // -------------------------------------------------------
  function setStateRef(stateObj) {
    UI._state = stateObj || null;
  }

  function setAssetsRef(assetsObj) {
    UI._assets = assetsObj || null;
  }

  // -------------------------------------------------------
  // Header / Bottom
  // -------------------------------------------------------
  function setHeader({ companyName, companyRank, teamName, weekText } = {}) {
    if (UI.el.companyName && companyName != null) UI.el.companyName.textContent = `企業名：${companyName}`;
    if (UI.el.companyRank && companyRank != null) UI.el.companyRank.textContent = `企業ランク：${companyRank}`;
    if (UI.el.teamName && teamName != null) UI.el.teamName.textContent = `チーム名：${teamName}`;
    if (UI.el.weekInfo && weekText != null) UI.el.weekInfo.textContent = weekText;
  }

  function setBottom({ gold, nextTournament, statusText, hint, version } = {}) {
    if (UI.el.goldValue && gold != null) UI.el.goldValue.textContent = String(gold);
    if (UI.el.nextTournamentValue && nextTournament != null) UI.el.nextTournamentValue.textContent = String(nextTournament);
    if (UI.el.statusValue && statusText != null) UI.el.statusValue.textContent = String(statusText);
    if (UI.el.hintText && hint != null) UI.el.hintText.textContent = String(hint);
    if (version != null) setVersion(version);
  }

  function setVersion(ver) {
    if (UI.el.versionText) UI.el.versionText.textContent = ver;
  }

  // -------------------------------------------------------
  // Panel / Modal
  // -------------------------------------------------------
  function setPanel(title, html, closable = true) {
    if (UI.el.panelTitle) UI.el.panelTitle.textContent = title || "詳細";
    if (UI.el.panelBody) UI.el.panelBody.innerHTML = html || "";
    if (UI.el.panelFooter) {
      if (closable) UI.el.panelFooter.classList.remove("hidden");
      else UI.el.panelFooter.classList.add("hidden");
    }
  }

  function openModal(title, html) {
    if (UI.el.modalTitle) UI.el.modalTitle.textContent = title || "INFO";
    if (UI.el.modalBody) UI.el.modalBody.innerHTML = html || "";
    if (UI.el.modal) UI.el.modal.classList.remove("hidden");
  }

  function closeModal() {
    if (UI.el.modal) UI.el.modal.classList.add("hidden");
  }

  // -------------------------------------------------------
  // Overlay Message
  // -------------------------------------------------------
  function showOverlay(msg, ms = 800) {
    if (!UI.el.overlayMessage) return;
    UI.el.overlayMessage.textContent = msg || "";
    UI.el.overlayMessage.classList.remove("hidden");
    if (ms > 0) {
      setTimeout(() => {
        if (UI.el.overlayMessage) UI.el.overlayMessage.classList.add("hidden");
      }, ms);
    }
  }

  function hideOverlay() {
    if (!UI.el.overlayMessage) return;
    UI.el.overlayMessage.classList.add("hidden");
  }

  // -------------------------------------------------------
  // Mini Log
  // -------------------------------------------------------
  function pushMiniLog(text) {
    UI._miniLogLines.push({ t: Date.now(), text: String(text || "") });
    if (UI._miniLogLines.length > UI._miniLogMax) UI._miniLogLines.shift();
    renderMiniLog();
  }

  function clearMiniLog() {
    UI._miniLogLines.length = 0;
    renderMiniLog();
  }

  function renderMiniLog() {
    if (!UI.el.miniLog) return;
    UI.el.miniLog.innerHTML = "";
    for (const l of UI._miniLogLines) {
      const div = document.createElement("div");
      div.className = "line";
      div.textContent = l.text;
      UI.el.miniLog.appendChild(div);
    }
  }

  // -------------------------------------------------------
  // Canvas Drawing
  // - assets.js が未実装でも見た目が成立する「プレースホルダ」を提供
  // -------------------------------------------------------
  function drawPlaceholder(title, sub) {
    const ctx = UI.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, UI.W, UI.H);

    // background
    ctx.fillStyle = "#0b0f18";
    ctx.fillRect(0, 0, UI.W, UI.H);

    // frame
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, UI.W - 36, UI.H - 36);

    // big title
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(String(title || "SCREEN"), 42, 92);

    // sub
    ctx.fillStyle = "rgba(255,255,255,.68)";
    ctx.font = "16px sans-serif";
    ctx.fillText(String(sub || ""), 42, 124);

    // hint
    ctx.fillStyle = "rgba(57,217,138,.85)";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("※画像が無い場合はプレースホルダ表示", 42, UI.H - 42);
  }

  function drawImage(img, titleIfMissing) {
    const ctx = UI.ctx;
    if (!ctx) return;

    if (!img) {
      drawPlaceholder(titleIfMissing || "NO IMAGE", "assets未配置 / 未ロード");
      return;
    }
    ctx.clearRect(0, 0, UI.W, UI.H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, UI.W, UI.H);
  }

  // 画面キーで描画（assets.js があれば画像、なければプレースホルダ）
  function drawScreen(key) {
    const k = String(key || "").toLowerCase();
    // assets.js 側の想定: assets.images[keyUpper] など
    const A = UI._assets;

    // 期待キー
    const titleMap = {
      main: "MAIN",
      ido: "移動フェーズ",
      map: "MAP",
      shop: "SHOP",
      heal: "回復フェーズ",
      battle: "BATTLE",
      winner: "WINNER",
      p1: "PLAYER TEAM",
    };

    const title = titleMap[k] || "SCREEN";
    const img = A && A.getImage ? A.getImage(k) : null;

    if (img) drawImage(img, title);
    else drawPlaceholder(title, "（画像が無い/未ロード）");
  }

  // -------------------------------------------------------
  // UI builders (small helpers)
  // -------------------------------------------------------
  function chip(text, kind) {
    const cls = kind ? `chip ${kind}` : "chip";
    return `<span class="${cls}">${escapeHtml(String(text || ""))}</span>`;
  }

  function table(rows /* array of [k,v] */) {
    const html = (rows || []).map(([k, v]) =>
      `<tr><td><b>${escapeHtml(String(k))}</b></td><td>${escapeHtml(String(v))}</td></tr>`
    ).join("");
    return `<table>${html}</table>`;
  }

  function escapeHtml(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // -------------------------------------------------------
  // Public API (window.MOB_UI)
  // -------------------------------------------------------
  window.MOB_UI = {
    init,
    setStateRef,
    setAssetsRef,

    setHeader,
    setBottom,
    setVersion,

    setPanel,
    openModal,
    closeModal,

    showOverlay,
    hideOverlay,

    pushMiniLog,
    clearMiniLog,

    drawPlaceholder,
    drawImage,
    drawScreen,

    chip,
    table,

    // game.js が登録するコールバック
    onCommand: null,
  };
})();
