// assets.js (FULL) MOB BR
// 画像管理＆未画像プレースホルダ描画
// ルール：未画像はここで「色＋文字」で表示する（勝手に別処理しない）

(() => {
  'use strict';

  const AS = (window.MOBBR_ASSETS = window.MOBBR_ASSETS || {});

  // =========================
  // 1) 画像パス定義（固定）
  // =========================
  AS.PATHS = {
    // メイン周り
    haikeimain: 'haikeimain.png',
    rogo: 'rogo.png',
    main1: 'main1.png',

    // プレイヤーチーム（衣装で増える想定）
    P1: 'P1.png',
    P2: 'P2.png',
    P3: 'P3.png',

    // 試合演出
    map: 'map.png',
    ido: 'ido.png',
    shop: 'shop.png',
    heal: 'heal.png',
    battle: 'battle.png',
    winner: 'winner.png',

    // ボタン画像
    teamBtn: 'team.png',
    taikaiBtn: 'taikai.png',

    // 修行アイコン
    syageki: 'syageki.png',
    dash: 'dash.png',
    paz: 'paz.png',
    zitugi: 'zitugi.png',
    taki: 'taki.png',
    kenq: 'kenq.png',
    sougou: 'sougou.png',
  };

  // =========================
  // 2) マップエリア画像
  // =========================
  AS.MAP_AREAS = {
    1: { name: 'ネオン噴水', file: 'neonhun.png' },
    2: { name: 'ネオンジム', file: 'neongym.png' },
    3: { name: 'ネオンストリート', file: 'neonstreet.png' },
    4: { name: 'ネオン中心街', file: 'neonmain.png' },
    5: { name: 'ネオン大橋', file: 'neonbrige.png' },
    6: { name: 'ネオン工場', file: 'neonfact.png' },

    7: { name: '海辺の駅', file: 'seast.png' },
    8: { name: '海辺の学校', file: 'seasc.png' },
    9: { name: '海辺の草原', file: 'seasou.png' },
    10:{ name: '海辺の牧場', file: 'seausi.png' },

    11:{ name: 'テント', file: 'mtent.png' },
    12:{ name: '噴水', file: 'mhunsui.png' },
    13:{ name: 'バトルフロアA', file: 'ma.png' },
    14:{ name: 'バトルフロアB', file: 'mb.png' },
    15:{ name: '音大橋', file: 'mhasi.png' },
    16:{ name: '看板地点', file: 'mkanban.png' },

    17:{ name: '高層ビル中心街', file: 'kosomain.png' },
    18:{ name: '高層ビルファイトリング', file: 'kosoring.png' },
    19:{ name: '高層ビルヘリポート', file: 'kosoheri.png' },
    20:{ name: '高層ビルサーキット', file: 'kososakit.png' },

    21:{ name: 'お土産売り場', file: 'hikouri.png' },
    22:{ name: '飛行場通路', file: 'hikoroad.png' },

    23:{ name: 'パン売り場', file: 'panuri.png' },
    24:{ name: 'パン製造工場', file: 'pankou.png' },

    25:{ name: 'メインステージ', file: 'stagemain.png' },
    26:{ name: 'サブステージ', file: 'stagesub.png' },
    27:{ name: 'サードステージ', file: 'stage3.png' },
    28:{ name: '巨大トラック', file: 'stagetrack.png' },

    29:{ name: 'ラストロード', file: 'lastroad.png' },
    30:{ name: 'ラストキング', file: 'lastking.png' },
    31:{ name: 'ラストモーム', file: 'lastmomu.png' },
    32:{ name: 'ラストリング', file: 'lastring.png' },
  };

  // 初動降下禁止（確定）
  AS.DROP_FORBIDDEN = new Set([5, 9, 12, 20, 28, 29, 30, 31, 32]);

  // =========================
  // 3) Image Cache
  // =========================
  AS.cache = AS.cache || new Map();

  AS.loadImage = function loadImage(src) {
    if (!src) return Promise.reject(new Error('src is empty'));
    if (AS.cache.has(src)) return AS.cache.get(src);

    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, img, src });
      img.onerror = () => resolve({ ok: false, img: null, src });
      img.src = src;
    });

    AS.cache.set(src, p);
    return p;
  };

  AS.preloadCore = async function preloadCore() {
    const list = [
      AS.PATHS.haikeimain,
      AS.PATHS.rogo,
      AS.PATHS.main1,
      AS.PATHS.P1,
      AS.PATHS.map,
      AS.PATHS.ido,
      AS.PATHS.shop,
      AS.PATHS.heal,
      AS.PATHS.battle,
      AS.PATHS.winner,
      AS.PATHS.teamBtn,
      AS.PATHS.taikaiBtn,
      AS.PATHS.syageki,
      AS.PATHS.dash,
      AS.PATHS.paz,
      AS.PATHS.zitugi,
      AS.PATHS.taki,
      AS.PATHS.kenq,
      AS.PATHS.sougou,
    ].filter(Boolean);

    const results = await Promise.all(list.map((s) => AS.loadImage(s)));
    return results;
  };

  // =========================
  // 4) Placeholder Drawing
  // =========================
  function hashCode(str) {
    str = String(str || '');
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return h >>> 0;
  }

  function pickColor(key) {
    const h = hashCode(key);
    const hue = h % 360;
    return `hsl(${hue}, 70%, 45%)`;
  }

  AS.drawPlaceholder = function drawPlaceholder(ctx, x, y, w, h, label, subLabel) {
    if (!ctx) return;
    ctx.save();

    const bg = pickColor(label || 'missing');
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    // border
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    // overlay
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + h * 0.55, w, h * 0.45);

    // text
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || 'NO IMAGE', x + w / 2, y + h * 0.72);

    if (subLabel) {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(subLabel, x + w / 2, y + h * 0.86);
    }

    ctx.restore();
  };

  // =========================
  // 5) Draw Image or Placeholder
  // =========================
  AS.drawImageOrPlaceholder = async function drawImageOrPlaceholder(
    ctx,
    src,
    x,
    y,
    w,
    h,
    labelIfMissing
  ) {
    if (!ctx) return false;

    const res = await AS.loadImage(src).catch(() => ({ ok: false }));
    if (res && res.ok && res.img) {
      ctx.drawImage(res.img, x, y, w, h);
      return true;
    } else {
      AS.drawPlaceholder(ctx, x, y, w, h, labelIfMissing || 'MISSING', src || '');
      return false;
    }
  };

  // =========================
  // 6) Player Outfit pick
  // =========================
  AS.getPlayerImagePath = function getPlayerImagePath(playerOutfitIndex) {
    // 0=P1, 1=P2, 2=P3...
    const n = Number(playerOutfitIndex || 0);
    if (n <= 0) return AS.PATHS.P1;
    if (n === 1) return AS.PATHS.P2 || AS.PATHS.P1;
    if (n === 2) return AS.PATHS.P3 || AS.PATHS.P1;
    return AS.PATHS.P1;
  };

  // =========================
  // 7) Export safe
  // =========================
  window.ASSETS = AS; // legacy alias (optional)

})();
