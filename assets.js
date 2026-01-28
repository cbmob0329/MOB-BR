// assets.js (ES Modules)
// Purpose:
// - Preload known images (main.png, map.png, P1.png)
// - Provide safe fallbacks when images are missing (color + text placeholder)
// - Never throw on missing assets (GitHub Pagesでも安定)
//
// Public API:
//   await loadAll();
//   getImage(key) -> HTMLImageElement (always returns something usable)
//   hasRealImage(key) -> boolean
//   createPlaceholderDataUrl({w,h,bg,fg,textLines}) -> string

const MANIFEST = {
  main: { src: "./main.png", label: "MAIN", w: 1347, h: 2048, bg: "#222" },
  map:  { src: "./map.png",  label: "MAP",  w: 1347, h: 2048, bg: "#123" },
  p1:   { src: "./P1.png",   label: "P1",   w: 512,  h: 512,  bg: "#331" },
};

const _images = new Map();     // key -> HTMLImageElement
const _isReal = new Map();     // key -> boolean (real loaded or placeholder)
let _loaded = false;

export async function loadAll() {
  if (_loaded) return;
  _loaded = true;

  const keys = Object.keys(MANIFEST);
  await Promise.all(keys.map(k => loadOne(k)));
}

export function getImage(key) {
  if (_images.has(key)) return _images.get(key);
  // unknown key -> generic placeholder
  const ph = makePlaceholderImage({
    w: 512,
    h: 512,
    bg: "#444",
    fg: "#fff",
    textLines: [`MISSING`, String(key || "asset")],
  });
  _images.set(key, ph);
  _isReal.set(key, false);
  return ph;
}

export function hasRealImage(key) {
  return _isReal.get(key) === true;
}

export function createPlaceholderDataUrl({ w = 512, h = 512, bg = "#333", fg = "#fff", textLines = [] } = {}) {
  const c = document.createElement("canvas");
  c.width = Math.max(8, Math.floor(w));
  c.height = Math.max(8, Math.floor(h));
  const ctx = c.getContext("2d");

  // background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);

  // subtle grid
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 1;
  const step = Math.max(24, Math.floor(Math.min(c.width, c.height) / 10));
  for (let x = 0; x < c.width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
  }
  for (let y = 0; y < c.height; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // border
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, c.width - 12, c.height - 12);

  // text
  const lines = Array.isArray(textLines) ? textLines : [String(textLines)];
  const pad = 18;
  const base = Math.max(18, Math.floor(Math.min(c.width, c.height) / 14));
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${base}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;

  const cx = c.width / 2;
  const cy = c.height / 2;
  const lineH = Math.floor(base * 1.35);
  const startY = cy - ((lines.length - 1) * lineH) / 2;

  for (let i = 0; i < lines.length; i++) {
    const t = String(lines[i] ?? "");
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillText(t, cx + 2, startY + i * lineH + 2);
    ctx.fillStyle = fg;
    ctx.fillText(t, cx, startY + i * lineH);
  }

  return c.toDataURL("image/png");
}

// -----------------------------
// Internals
// -----------------------------

async function loadOne(key) {
  const info = MANIFEST[key];
  if (!info) {
    // unknown key
    getImage(key);
    return;
  }

  const img = new Image();
  img.decoding = "async";
  img.loading = "eager";

  const p = new Promise((resolve) => {
    img.onload = () => {
      _images.set(key, img);
      _isReal.set(key, true);
      resolve();
    };
    img.onerror = () => {
      const ph = makePlaceholderImage({
        w: info.w,
        h: info.h,
        bg: info.bg || "#333",
        fg: "#fff",
        textLines: [`${info.label}`, "IMAGE NOT FOUND"],
      });
      _images.set(key, ph);
      _isReal.set(key, false);
      resolve();
    };
  });

  // start
  img.src = info.src;

  // timeout safety (never hang)
  const timeoutMs = 2500;
  await Promise.race([
    p,
    new Promise((resolve) => {
      setTimeout(() => {
        if (!_images.has(key)) {
          const ph = makePlaceholderImage({
            w: info.w,
            h: info.h,
            bg: info.bg || "#333",
            fg: "#fff",
            textLines: [`${info.label}`, "LOAD TIMEOUT"],
          });
          _images.set(key, ph);
          _isReal.set(key, false);
        }
        resolve();
      }, timeoutMs);
    }),
  ]);
}

function makePlaceholderImage({ w, h, bg, fg, textLines }) {
  const url = createPlaceholderDataUrl({ w, h, bg, fg, textLines });
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  return img;
}
