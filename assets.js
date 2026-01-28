// assets.js (ES Modules)
// - Image loading helper
// - Fallback placeholder generator (no image required)
// - Safe attach to DOM on load

export const ASSETS = {
  images: {
    main: null,
    map: null,
    p1: null,
  },
  flags: {
    mainOk: false,
    mapOk: false,
    p1Ok: false,
  }
};

function $(id){ return document.getElementById(id); }

/**
 * Load an image with timeout & safe error handling.
 */
export function loadImage(src, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;

    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve({ ok, img });
    };

    const t = setTimeout(() => finish(false), timeoutMs);

    img.onload = () => {
      clearTimeout(t);
      finish(true);
    };
    img.onerror = () => {
      clearTimeout(t);
      finish(false);
    };

    // Cache-bust for GitHub Pages / edge reflection delays
    const bust = `cb=${Date.now()}_${Math.floor(Math.random()*9999)}`;
    img.src = src.includes("?") ? `${src}&${bust}` : `${src}?${bust}`;
  });
}

/**
 * Build a placeholder PNG dataURL using canvas.
 * - user requested: "色と文字で表示"
 */
export function makePlaceholderDataURL({
  w = 360,
  h = 360,
  bg = "#1b1f34",
  border = "#ffcc33",
  title = "MISSING IMAGE",
  sub = "placeholder",
  mono = true,
} = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");

  // background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // subtle pattern
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = "#000";
  for(let y=0;y<h;y+=16){
    for(let x=0;x<w;x+=16){
      if(((x+y)/16)%2===0){
        ctx.fillRect(x, y, 16, 16);
      }
    }
  }
  ctx.globalAlpha = 1;

  // border
  ctx.strokeStyle = border;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, w-12, h-12);

  // title
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 20px ${mono ? "monospace" : "sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, w/2, h/2 - 18);

  // sub
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.font = `700 13px ${mono ? "monospace" : "sans-serif"}`;
  ctx.fillText(sub, w/2, h/2 + 16);

  // hint
  ctx.fillStyle = "rgba(255,255,255,.60)";
  ctx.font = `600 11px ${mono ? "monospace" : "sans-serif"}`;
  ctx.fillText("This is a placeholder (ok)", w/2, h/2 + 40);

  return c.toDataURL("image/png");
}

/**
 * Apply placeholder if real file is missing.
 * This keeps the UI stable even when images are not present.
 */
function applyImageOrFallback({
