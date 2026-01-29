/* =========================================================
  assets.js (FULL)
  - 画像ロード + 未画像プレースホルダ生成
  - ルール：未画像はプレースホルダで表示
  - 使い方（想定）：
      MOB_ASSETS.preload().then(() => {
        const img = MOB_ASSETS.getImage("main");
      });
========================================================= */

(function () {
  "use strict";

  const FILES = {
    p1: "P1.png",
    main: "main.png",
    ido: "ido.png",
    map: "map.png",
    shop: "shop.png",
    heal: "heal.png",
    battle: "battle.png",
    winner: "winner.png",
  };

  const state = {
    loaded: false,
    images: {
      p1: null,
      main: null,
      ido: null,
      map: null,
      shop: null,
      heal: null,
      battle: null,
      winner: null,
    },
    // 失敗時に使うプレースホルダ（Imageに変換済み）
    placeholders: {},
  };

  // -------------------------------------------------------
  // Utils
  // -------------------------------------------------------
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function canvasToImage(canvas) {
    const img = new Image();
    img.src = canvas.toDataURL("image/png");
    return img;
  }

  function drawPlaceholderCanvas(title, sub, opt = {}) {
    const W = opt.w || 640;
    const H = opt.h || 640;
    const bg = opt.bg || "#0b0f18";
    const accent = opt.accent || "rgba(57,217,138,.85)";

    const c = makeCanvas(W, H);
    const ctx = c.getContext("2d");

    // bg
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // outer frame
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, W - 36, H - 36);

    // inner frame
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, W - 72, H - 72);

    // title
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(String(title || "NO IMAGE"), 54, 104);

    // sub
    ctx.fillStyle = "rgba(255,255,255,.68)";
    ctx.font = "16px sans-serif";
    const s = String(sub || "");
    if (s) ctx.fillText(s, 54, 136);

    // hint
    ctx.fillStyle = accent;
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("PLACEHOLDER", 54, H - 56);

    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "12px sans-serif";
    ctx.fillText("assets 未配置 / 読み込み失敗", 54, H - 34);

    return c;
  }

  function buildPlaceholders() {
    // 画面ごとに少し雰囲気を変える
    state.placeholders.p1 = canvasToImage(
      drawPlaceholderCanvas("P1", "PLAYER TEAM", { bg: "#0b0f18", accent: "rgba(42,168,255,.85)" })
    );
    state.placeholders.main = canvasToImage(
      drawPlaceholderCanvas("MAIN", "main.png", { bg: "#0b0f18", accent: "rgba(57,217,138,.85)" })
    );
    state.placeholders.ido = canvasToImage(
      drawPlaceholderCanvas("IDO", "ido.png", { bg: "#0b1020", accent: "rgba(255,200,64,.85)" })
    );
    state.placeholders.map = canvasToImage(
      drawPlaceholderCanvas("MAP", "map.png", { bg: "#08141a", accent: "rgba(120,220,255,.85)" })
    );
    state.placeholders.shop = canvasToImage(
      drawPlaceholderCanvas("SHOP", "shop.png", { bg: "#120b18", accent: "rgba(255,120,210,.85)" })
    );
    state.placeholders.heal = canvasToImage(
      drawPlaceholderCanvas("HEAL", "heal.png", { bg: "#07140f", accent: "rgba(90,255,170,.85)" })
    );
    state.placeholders.battle = canvasToImage(
      drawPlaceholderCanvas("BATTLE", "battle.png", { bg: "#1a0a0e", accent: "rgba(255,85,102,.85)" })
    );
    state.placeholders.winner = canvasToImage(
      drawPlaceholderCanvas("WINNER", "winner.png", { bg: "#171205", accent: "rgba(255,210,90,.85)" })
    );
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  // -------------------------------------------------------
  // Public: preload
  // -------------------------------------------------------
  async function preload() {
    if (!state.placeholders.main) buildPlaceholders();

    const keys = Object.keys(FILES);
    const tasks = keys.map(async (k) => {
      const file = FILES[k];
      const img = await loadImage(file);
      state.images[k] = img || null;
      return true;
    });

    await Promise.all(tasks);
    state.loaded = true;
    return true;
  }

  // -------------------------------------------------------
  // Public: getImage (fallback -> placeholder)
  // -------------------------------------------------------
  function getImage(key) {
    const k = String(key || "").toLowerCase();
    const img = state.images[k];
    if (img) return img;

    // placeholder fallback
    if (!state.placeholders.main) buildPlaceholders();
    return state.placeholders[k] || state.placeholders.main;
  }

  // -------------------------------------------------------
  // Public: compose (optional helper)
  //  - 背景の上に前面画像を載せた合成Imageを返す
  //  - 例：ido背景にP1を載せる等（サイズ自動フィット）
  // -------------------------------------------------------
  function compose(bgKey, frontKey, opt = {}) {
    const W = opt.w || 640;
    const H = opt.h || 640;

    const bg = getImage(bgKey);
    const fr = getImage(frontKey);

    const c = makeCanvas(W, H);
    const ctx = c.getContext("2d");

    ctx.imageSmoothingEnabled = false;

    // bg
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = "#0b0f18";
      ctx.fillRect(0, 0, W, H);
    }

    // front (fit)
    if (fr) {
      const pad = opt.pad == null ? 30 : opt.pad;
      const maxW = W - pad * 2;
      const maxH = H - pad * 2;

      // 画像の自然サイズが取れない時は「正方形扱い」で縮尺
      const iw = fr.naturalWidth || W;
      const ih = fr.naturalHeight || H;

      const s = Math.min(maxW / iw, maxH / ih, 1);
      const dw = Math.floor(iw * s);
      const dh = Math.floor(ih * s);

      const x = opt.x == null ? Math.floor((W - dw) / 2) : opt.x;
      const y = opt.y == null ? Math.floor((H - dh) / 2) : opt.y;

      ctx.drawImage(fr, x, y, dw, dh);
    }

    return canvasToImage(c);
  }

  // -------------------------------------------------------
  // Public: info
  // -------------------------------------------------------
  function isLoaded() {
    return !!state.loaded;
  }

  function listKeys() {
    return Object.keys(FILES);
  }

  // -------------------------------------------------------
  // Export
  // -------------------------------------------------------
  window.MOB_ASSETS = {
    FILES,
    preload,
    getImage,
    compose,
    isLoaded,
    listKeys,
  };
})();
