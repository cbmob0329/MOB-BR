/* =====================================================
   assets.js  (FULL)
   MOB Tournament Simulation
   画像管理 / プレースホルダ / 表示切替
   ===================================================== */

const Assets = {};
window.Assets = Assets;

/* =========================
   内部状態
   ========================= */

Assets.images = {};
Assets.currentMainImage = 'main1.png';

/* =========================
   初期化
   ========================= */

Assets.init = function () {
  // 主要画像を事前ロード（存在しなくても落ちない）
  const preload = [
    'haikeimain.png',
    'main1.png',
    'map.png',
    'shop.png',
    'heal.png',
    'battle.png',
    'winner.png',
    'ido.png',
    'P1.png'
  ];

  preload.forEach(src => Assets.loadImage(src));

  // 初期表示
  Assets.setMainImage(Assets.currentMainImage);
};

/* =========================
   Image Loader
   ========================= */

Assets.loadImage = function (src) {
  if (Assets.images[src]) return Assets.images[src];

  const img = new Image();
  img.src = src;

  img.onerror = () => {
    console.warn('[Assets] image not found:', src);
    Assets.images[src] = Assets.createPlaceholder(src);
  };

  Assets.images[src] = img;
  return img;
};

/* =========================
   Placeholder
   ========================= */

Assets.createPlaceholder = function (label) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 枠
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  // テキスト
  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const name = label.replace('.png', '');
  ctx.fillText('NO IMAGE', canvas.width / 2, canvas.height / 2 - 16);
  ctx.font = '16px sans-serif';
  ctx.fillText(name, canvas.width / 2, canvas.height / 2 + 18);

  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
};

/* =========================
   Main Image Control
   ========================= */

Assets.setMainImage = function (src) {
  Assets.currentMainImage = src;

  const dom = document.getElementById('main-image');
  if (!dom) return;

  const img = Assets.images[src] || Assets.loadImage(src);
  dom.src = img.src;
};

/* =========================
   Player Team Image Control
   ========================= */

Assets.setPlayerTeamImage = function (src) {
  const dom = document.getElementById('player-team-image');
  if (!dom) return;

  const img = Assets.images[src] || Assets.loadImage(src);
  dom.src = img.src;
};

/* =========================
   Utility
   ========================= */

Assets.get = function (src) {
  return Assets.images[src] || Assets.loadImage(src);
};

/* =========================
   Debug
   ========================= */

Assets.debugList = function () {
  console.table(Object.keys(Assets.images));
};
