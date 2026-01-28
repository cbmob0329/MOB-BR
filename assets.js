// assets.js
// 画像ロードと「無い画像のプレースホルダ」生成だけを担当する。
// - main.png / map.png / P1.png などが存在しない場合でもゲームが成立するようにする。

export const ASSET_PATHS = {
  main: './main.png',
  map:  './map.png',
  p1:   './P1.png',
};

export function createPlaceholderDataURL({
  w = 1024,
  h = 1024,
  bg = '#2b2b3a',
  fg = '#eaeaf5',
  text = 'MISSING',
  sub = '',
} = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');

  // bg
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // stripes
  g.globalAlpha = 0.18;
  g.fillStyle = '#000';
  for (let i = -h; i < w + h; i += Math.max(16, Math.floor(w / 40))) {
    g.save();
    g.translate(i, 0);
    g.rotate(Math.PI / 4);
    g.fillRect(0, 0, Math.max(w, h) * 2, Math.max(8, Math.floor(w / 140)));
    g.restore();
  }
  g.globalAlpha = 1;

  // border
  g.strokeStyle = 'rgba(255,255,255,.25)';
  g.lineWidth = Math.max(4, Math.floor(w / 220));
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);

  // text
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  const big = Math.max(22, Math.floor(w / 10));
  g.font = `900 ${big}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  g.fillText(text, w / 2, h / 2 - big * 0.2);

  if (sub) {
    const small = Math.max(12, Math.floor(w / 30));
    g.globalAlpha = 0.9;
    g.font = `700 ${small}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans JP", sans-serif`;
    g.fillText(sub, w / 2, h / 2 + big * 0.9);
    g.globalAlpha = 1;
  }

  return c.toDataURL('image/png');
}

export function loadImageOrPlaceholder(src, placeholderOptions = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = src;

    const fallback = () => {
      const ph = createPlaceholderDataURL({
        w: 1024,
        h: 1024,
        text: 'MISSING IMAGE',
        sub: src,
        ...placeholderOptions,
      });
      const p = new Image();
      p.decoding = 'async';
      p.loading = 'eager';
      p.src = ph;
      resolve({ img: p, ok: false, src });
    };

    img.onload = () => resolve({ img, ok: true, src });
    img.onerror = () => fallback();
  });
}

export async function preloadAssets() {
  const [main, map, p1] = await Promise.all([
    loadImageOrPlaceholder(ASSET_PATHS.main, { text: 'MAIN', bg: '#24304a' }),
    loadImageOrPlaceholder(ASSET_PATHS.map,  { text: 'MAP',  bg: '#2a3d2b' }),
    loadImageOrPlaceholder(ASSET_PATHS.p1,   { text: 'P1',   bg: '#3a2a2a' }),
  ]);

  return {
    main,
    map,
    p1,
  };
}

export function applyImgElementWithLoaded(el, loaded) {
  if (!el || !loaded?.img) return;
  el.src = loaded.img.src;
  // ok/NGをdata属性で残す（デバッグ用）
  el.dataset.ok = loaded.ok ? '1' : '0';
  el.dataset.src = loaded.src || '';
}
