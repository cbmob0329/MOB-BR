/* =====================================================
   assets.js
   - 画像アセット管理（差し替えロード前提）
   - 未画像はプレースホルダ（透過風チェック柄は禁止 → 使わない）
   - 背景差し替えは「1枚をロードして差し替え」方式
   ===================================================== */

(() => {

  const BG_EL_ID = 'bg-layer';

  // 必須画像（存在していなくても破綻しない：未画像はプレースホルダ）
  const CORE_IMAGES = [
    'main.png',
    'ido.png',
    'map.png',
    'shop.png',
    'battle.png',
    'winner.png',
    'P1.png',
  ];

  function makePlaceholderDataURL(kind = 'generic') {
    // チェック柄は使わない。落ち着いたグラデ＋ノイズ風の簡易パターン。
    const w = 960, h = 540;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');

    // base gradient
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgb(12, 18, 30)');
    grad.addColorStop(1, 'rgb(5, 7, 12)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    // soft vignette
    const vg = g.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.6);
    vg.addColorStop(0, 'rgba(255,255,255,0.06)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);

    // subtle scanlines / dots (no text)
    g.globalAlpha = 0.12;
    for (let y = 0; y < h; y += 6) {
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, y, w, 1);
    }
    g.globalAlpha = 0.10;
    for (let i = 0; i < 900; i++) {
      const x = (Math.random() * w) | 0;
      const y = (Math.random() * h) | 0;
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(x, y, 1, 1);
    }
    g.globalAlpha = 1;

    // kind hint by subtle corner mark (shape only, no letters)
    g.globalAlpha = 0.18;
    g.fillStyle = 'rgba(0,180,255,0.8)';
    if (kind === 'bg') g.fillRect(18, 18, 10, 10);
    if (kind === 'player') g.fillRect(18, 18, 10, 10), g.fillRect(34, 18, 10, 10);
    if (kind === 'enemy') g.fillRect(18, 18, 10, 10), g.fillRect(18, 34, 10, 10);
    g.globalAlpha = 1;

    return c.toDataURL('image/png');
  }

  const PLACEHOLDER_BG = makePlaceholderDataURL('bg');
  const PLACEHOLDER_PLAYER = makePlaceholderDataURL('player');
  const PLACEHOLDER_ENEMY = makePlaceholderDataURL('enemy');

  const Assets = {
    cache: new Map(), // file -> { status:'ok'|'missing'|'loading', img:Image|null, promise:Promise|null }
    rootPath: './',   // 画像置き場（ファイル名変更禁止のためパスは固定運用）

    init() {
      // コア画像だけ先にロードを走らせる（存在しなくてもOK）
      for (const f of CORE_IMAGES) {
        this.ensure(f);
      }
    },

    getImageSrc(fileName) {
      const name = String(fileName || '').trim();
      if (!name) return PLACEHOLDER_BG;

      const rec = this.cache.get(name);
      if (rec && rec.status === 'missing') {
        // 種別推定（P?.png=player, teamId.png=enemy, その他=bg）
        if (/^P\d+\.png$/i.test(name)) return PLACEHOLDER_PLAYER;
        if (/^(local|national|world)\d+\.png$/i.test(name)) return PLACEHOLDER_ENEMY;
        return PLACEHOLDER_BG;
      }

      // まだ未ロードの場合はロード開始だけしておく
      if (!rec) this.ensure(name);

      return this.rootPath + name;
    },

    ensure(fileName) {
      const name = String(fileName || '').trim();
      if (!name) return Promise.resolve(false);

      const existing = this.cache.get(name);
      if (existing) {
        if (existing.status === 'ok') return Promise.resolve(true);
        if (existing.status === 'missing') return Promise.resolve(false);
        if (existing.status === 'loading' && existing.promise) return existing.promise;
      }

      const img = new Image();
      const p = new Promise((resolve) => {
        let settled = false;

        img.onload = () => {
          if (settled) return;
          settled = true;
          this.cache.set(name, { status: 'ok', img, promise: null });
          resolve(true);
        };

        img.onerror = () => {
          if (settled) return;
          settled = true;
          this.cache.set(name, { status: 'missing', img: null, promise: null });
          resolve(false);
        };

        img.src = this.rootPath + name;
      });

      this.cache.set(name, { status: 'loading', img: null, promise: p });
      return p;
    },

    /* =================================================
       背景差し替え（1枚ロードして差し替え）
       - bg-layer の background-image を切替
       - 画像が無い場合はプレースホルダ（チェック柄禁止）
       ================================================= */
    async setBackground(fileName, slide = 'left') {
      const el = document.getElementById(BG_EL_ID);
      if (!el) return;

      const name = String(fileName || '').trim();
      const ok = await this.ensure(name);

      // 既存アニメクラスを外す
      el.classList.remove('is-slide-left', 'is-slide-right');

      const src = ok ? (this.rootPath + name) : PLACEHOLDER_BG;
      el.style.backgroundImage = `url("${src}")`;

      // スライド感（紙芝居）
      if (slide === 'right') el.classList.add('is-slide-right');
      else el.classList.add('is-slide-left');
    },
  };

  window.Assets = Assets;

  // 初期化（DOM構築後でOK）
  window.addEventListener('DOMContentLoaded', () => {
    Assets.init();
  });

})();
