/* =========================================================
   assets.js (FULL)
   - 画像アセット管理（ロード/参照/プレースホルダ）
   - 「無い画像は assets.js のプレースホルダで表示」ルール厳守
   - game.js / sim 側は ASSETS.get(name) / ASSETS.isReady() を使う想定
   ========================================================= */

(() => {
  'use strict';

  // ----------------------------
  // Utils
  // ----------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // プレースホルダ描画（画像が無い/ロード失敗）
  function drawPlaceholder(label, w, h, theme = 'dark') {
    w = Math.max(64, w | 0);
    h = Math.max(64, h | 0);

    const c = makeCanvas(w, h);
    const g = c.getContext('2d');

    // 背景
    if (theme === 'light') {
      g.fillStyle = '#e9e9e9';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#d2d2d2';
    } else {
      g.fillStyle = '#1a1a1a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2a2a2a';
    }

    // 斜線パターン
    g.save();
    g.globalAlpha = 0.35;
    for (let x = -h; x < w + h; x += 18) {
      g.fillRect(x, 0, 8, h);
      g.translate(18, 0);
    }
    g.restore();

    // 枠
    g.strokeStyle = theme === 'light' ? '#777' : 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);

    // ラベル（文字）
    const text = String(label ?? 'MISSING');
    g.fillStyle = theme === 'light' ? '#333' : 'rgba(255,255,255,0.85)';
    g.font = `bold ${clamp(Math.floor(Math.min(w, h) / 10), 10, 18)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    // 2行に分ける
    const maxLen = 16;
    const line1 = text.length > maxLen ? text.slice(0, maxLen) : text;
    const line2 = text.length > maxLen ? text.slice(maxLen, maxLen * 2) : '';

    g.fillText(line1, w / 2, h / 2 - (line2 ? 10 : 0));
    if (line2) g.fillText(line2, w / 2, h / 2 + 10);

    // 小さく “PLACEHOLDER”
    g.globalAlpha = 0.8;
    g.font = `900 ${clamp(Math.floor(Math.min(w, h) / 16), 9, 12)}px system-ui, sans-serif`;
    g.fillStyle = theme === 'light' ? '#555' : 'rgba(255,255,255,0.55)';
    g.fillText('PLACEHOLDER', w / 2, h - 14);

    return c;
  }

  // 画像ロード（失敗時は placeholder）
  function loadImage(src, fallbackLabel, fallbackW = 512, fallbackH = 512) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, img, src });
      img.onerror = () => resolve({ ok: false, img: drawPlaceholder(fallbackLabel, fallbackW, fallbackH), src });
      img.src = src;
    });
  }

  // ----------------------------
  // ASSET TABLE
  // - “ファイル名は変更禁止”なので、ここは参照専用
  // - 実ファイルが無い場合でもゲームが動くように placeholder を返す
  // ----------------------------
  const MANIFEST = {
    // ----- 必須UI背景（ユーザー指定） -----
    P1: { src: 'P1.png', w: 420, h: 560, label: 'P1.png' },
    main: { src: 'main.png', w: 420, h: 560, label: 'main.png' },
    ido: { src: 'ido.png', w: 420, h: 560, label: 'ido.png' },
    map: { src: 'map.png', w: 420, h: 560, label: 'map.png' },
    shop: { src: 'shop.png', w: 420, h: 560, label: 'shop.png' },
    heal: { src: 'heal.png', w: 420, h: 560, label: 'heal.png' },
    battle: { src: 'battle.png', w: 420, h: 560, label: 'battle.png' },
    winner: { src: 'winner.png', w: 420, h: 560, label: 'winner.png' },

    // ----- 修行アイコン（ユーザー指定） -----
    tr_syageki: { src: 'syageki.png', w: 128, h: 128, label: 'syageki.png' },
    tr_dash: { src: 'dash.png', w: 128, h: 128, label: 'dash.png' },
    tr_paz: { src: 'paz.png', w: 128, h: 128, label: 'paz.png' },
    tr_zitugi: { src: 'zitugi.png', w: 128, h: 128, label: 'zitugi.png' },
    tr_taki: { src: 'taki.png', w: 128, h: 128, label: 'taki.png' },
    tr_kenq: { src: 'kenq.png', w: 128, h: 128, label: 'kenq.png' },
    tr_sougou: { src: 'sougou.png', w: 128, h: 128, label: 'sougou.png' },

    // ----- マップエリア画像（ユーザー指定ファイル名） -----
    // ネオン街
    neonhun: { src: 'neonhun.png', w: 256, h: 256, label: 'neonhun.png' },
    neongym: { src: 'neongym.png', w: 256, h: 256, label: 'neongym.png' },
    neonstreet: { src: 'neonstreet.png', w: 256, h: 256, label: 'neonstreet.png' },
    neonmain: { src: 'neonmain.png', w: 256, h: 256, label: 'neonmain.png' },
    neonbrige: { src: 'neonbrige.png', w: 256, h: 256, label: 'neonbrige.png' },
    neonfact: { src: 'neonfact.png', w: 256, h: 256, label: 'neonfact.png' },

    // 海の見える町
    seast: { src: 'seast.png', w: 256, h: 256, label: 'seast.png' },
    seasc: { src: 'seasc.png', w: 256, h: 256, label: 'seasc.png' },
    seasou: { src: 'seasou.png', w: 256, h: 256, label: 'seasou.png' },
    seausi: { src: 'seausi.png', w: 256, h: 256, label: 'seausi.png' },

    // ミュージックマウンテン
    mtent: { src: 'mtent.png', w: 256, h: 256, label: 'mtent.png' },
    mhunsui: { src: 'mhunsui.png', w: 256, h: 256, label: 'mhunsui.png' },
    ma: { src: 'ma.png', w: 256, h: 256, label: 'ma.png' },
    mb: { src: 'mb.png', w: 256, h: 256, label: 'mb.png' },
    mhasi: { src: 'mhasi.png', w: 256, h: 256, label: 'mhasi.png' },
    mkanban: { src: 'mkanban.png', w: 256, h: 256, label: 'mkanban.png' },

    // 高層ビルの街
    kosomain: { src: 'kosomain.png', w: 256, h: 256, label: 'kosomain.png' },
    kosoring: { src: 'kosoring.png', w: 256, h: 256, label: 'kosoring.png' },
    kosoheri: { src: 'kosoheri.png', w: 256, h: 256, label: 'kosoheri.png' },
    kososakit: { src: 'kososakit.png', w: 256, h: 256, label: 'kososakit.png' },

    // 飛行場
    hikouri: { src: 'hikouri.png', w: 256, h: 256, label: 'hikouri.png' },
    hikoroad: { src: 'hikoroad.png', w: 256, h: 256, label: 'hikoroad.png' },

    // パン工場
    panuri: { src: 'panuri.png', w: 256, h: 256, label: 'panuri.png' },
    pankou: { src: 'pankou.png', w: 256, h: 256, label: 'pankou.png' },

    // ライブイベント
    stagemain: { src: 'stagemain.png', w: 256, h: 256, label: 'stagemain.png' },
    stagesub: { src: 'stagesub.png', w: 256, h: 256, label: 'stagesub.png' },
    stage3: { src: 'stage3.png', w: 256, h: 256, label: 'stage3.png' },
    stagetrack: { src: 'stagetrack.png', w: 256, h: 256, label: 'stagetrack.png' },

    // ラストモブ（降下不可）
    lastroad: { src: 'lastroad.png', w: 256, h: 256, label: 'lastroad.png' },
    lastking: { src: 'lastking.png', w: 256, h: 256, label: 'lastking.png' },
    lastmomu: { src: 'lastmomu.png', w: 256, h: 256, label: 'lastmomu.png' },
    lastring: { src: 'lastring.png', w: 256, h: 256, label: 'lastring.png' },
  };

  // ----------------------------
  // ASSETS singleton
  // ----------------------------
  const ASSETS = {
    _loaded: false,
    _loading: false,
    _map: new Map(),     // key -> (HTMLImageElement or Canvas)
    _ok: new Map(),      // key -> boolean
    _progress: { total: 0, done: 0 },

    // 初期化（ロード開始）
    async init() {
      if (this._loaded || this._loading) return;
      this._loading = true;

      const keys = Object.keys(MANIFEST);
      this._progress.total = keys.length;
      this._progress.done = 0;

      // 先に全部 placeholder を入れて “参照先が必ず存在する” 状態にする
      for (const k of keys) {
        const m = MANIFEST[k];
        this._map.set(k, drawPlaceholder(m.label || k, m.w || 256, m.h || 256));
        this._ok.set(k, false);
      }

      // 実ロード
      for (const k of keys) {
        const m = MANIFEST[k];
        const res = await loadImage(m.src, m.label || k, m.w || 256, m.h || 256);
        this._map.set(k, res.img);
        this._ok.set(k, !!res.ok);
        this._progress.done++;
      }

      this._loaded = true;
      this._loading = false;
    },

    isReady() {
      return this._loaded;
    },

    isLoading() {
      return this._loading;
    },

    progress() {
      return { ...this._progress };
    },

    // 取得（必ず何か返る）
    get(key) {
      if (!this._map.has(key)) {
        // 未定義キーでも落とさない
        return drawPlaceholder(String(key), 256, 256);
      }
      return this._map.get(key);
    },

    // ロード成功したか（無くても動くが、デバッグ用）
    ok(key) {
      return !!this._ok.get(key);
    },

    // 任意のキーで placeholder を生成（sim側で用途別の図を出したい時に使える）
    makePlaceholder(label, w, h, theme) {
      return drawPlaceholder(label, w, h, theme);
    },

    // 画像を描画する時の “適正フィット”（縦横比維持）
    // ctx.drawImage の前に使う想定
    fitRect(srcW, srcH, dstX, dstY, dstW, dstH, mode = 'contain') {
      srcW = Math.max(1, srcW);
      srcH = Math.max(1, srcH);
      dstW = Math.max(1, dstW);
      dstH = Math.max(1, dstH);

      const srcAR = srcW / srcH;
      const dstAR = dstW / dstH;

      let w, h, x, y;
      if (mode === 'cover') {
        // 画面を埋める（切り抜き発生）
        if (srcAR > dstAR) {
          h = dstH;
          w = dstH * srcAR;
        } else {
          w = dstW;
          h = dstW / srcAR;
        }
      } else {
        // contain（全体が入る）
        if (srcAR > dstAR) {
          w = dstW;
          h = dstW / srcAR;
        } else {
          h = dstH;
          w = dstH * srcAR;
        }
      }
      x = dstX + (dstW - w) / 2;
      y = dstY + (dstH - h) / 2;
      return { x, y, w, h };
    },

    // 画像のサイズ取り（CanvasもImageも対応）
    size(img) {
      if (!img) return { w: 0, h: 0 };
      if (img instanceof HTMLImageElement) return { w: img.naturalWidth || img.width || 0, h: img.naturalHeight || img.height || 0 };
      if (img instanceof HTMLCanvasElement) return { w: img.width || 0, h: img.height || 0 };
      return { w: img.width || 0, h: img.height || 0 };
    },
  };

  // expose
  window.ASSETS = ASSETS;
})();
