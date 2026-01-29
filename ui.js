/* ui.js (FULL) MOB BR
   UI helper library (non-breaking)
   - Toast / Center message
   - Overlay modal
   - Double-tap handler
   - Basic DOM helpers
   This file is optional; game.js can run alone.
*/
(() => {
  'use strict';

  // Namespace (safe)
  const NS = (window.MOBBR_UI = window.MOBBR_UI || {});

  // -------------------------
  // DOM helpers
  // -------------------------
  NS.el = function el(tag, props = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of children || []) {
      if (c == null) continue;
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    }
    return e;
  };

  NS.$ = function $(sel, root) {
    return (root || document).querySelector(sel);
  };

  NS.$$ = function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  };

  NS.byId = function byId(id) {
    return document.getElementById(id);
  };

  // -------------------------
  // Double-tap (single/double click)
  // -------------------------
  NS.attachDoubleTap = function attachDoubleTap(node, onDoubleTap, onSingleTap, opts = {}) {
    if (!node) return;
    const threshold = Number.isFinite(opts.threshold) ? opts.threshold : 320;
    const singleDelay = Number.isFinite(opts.singleDelay) ? opts.singleDelay : 260;

    let lastTap = 0;
    let singleTimer = null;

    node.addEventListener(
      'click',
      (ev) => {
        const now = Date.now();
        const dt = now - lastTap;
        lastTap = now;

        if (dt < threshold) {
          if (singleTimer) {
            clearTimeout(singleTimer);
            singleTimer = null;
          }
          if (typeof onDoubleTap === 'function') onDoubleTap(ev);
        } else {
          if (singleTimer) clearTimeout(singleTimer);
          singleTimer = setTimeout(() => {
            singleTimer = null;
            if (typeof onSingleTap === 'function') onSingleTap(ev);
          }, singleDelay);
        }
      },
      { passive: true }
    );
  };

  // -------------------------
  // Toast / Center message
  // (Requires #incomeToast, #centerMsg in DOM; if missing, noop)
  // -------------------------
  NS.showIncomeToast = function showIncomeToast(text, ms = 1200) {
    const t = document.getElementById('incomeToast');
    if (!t) return;
    t.textContent = String(text ?? '');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), ms);
  };

  NS.showCenterMsg = function showCenterMsg(text, ms = 1200) {
    const box = document.getElementById('centerMsg');
    if (!box) return;
    const msg = box.querySelector('.msg');
    if (msg) msg.textContent = String(text ?? '');
    box.classList.add('show');
    if (ms > 0) setTimeout(() => box.classList.remove('show'), ms);
  };

  // -------------------------
  // Overlay modal
  // (Requires #overlay in DOM; if missing, creates a minimal one)
  // -------------------------
  function ensureOverlay() {
    let ov = document.getElementById('overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'overlay';
      // minimal style fallback (style.cssが整うまでの保険)
      Object.assign(ov.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,.55)',
        display: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '9999',
        padding: '14px',
      });
      document.body.appendChild(ov);
    }
    return ov;
  }

  NS.openOverlay = function openOverlay(title, htmlOrNode) {
    const ov = ensureOverlay();
    ov.innerHTML = '';
    ov.classList.add('show');
    ov.style.display = 'flex';

    const modal = document.createElement('div');
    modal.className = 'modal';
    Object.assign(modal.style, {
      width: 'min(520px, 96vw)',
      maxHeight: '82vh',
      overflow: 'auto',
      background: 'rgba(20,20,20,.92)',
      border: '1px solid rgba(255,255,255,.16)',
      borderRadius: '16px',
      padding: '14px',
      color: '#fff',
      boxShadow: '0 10px 30px rgba(0,0,0,.4)',
    });

    const h2 = document.createElement('h2');
    h2.textContent = String(title ?? '');
    Object.assign(h2.style, { margin: '0 0 10px', fontSize: '18px', fontWeight: '900' });

    const hint = document.createElement('div');
    hint.className = 'closeHint';
    hint.textContent = '画面外タップで閉じます';
    Object.assign(hint.style, { opacity: '.7', fontSize: '12px', marginBottom: '10px' });

    const content = document.createElement('div');
    content.className = 'section';

    if (typeof htmlOrNode === 'string') {
      content.innerHTML = htmlOrNode;
    } else if (htmlOrNode instanceof Node) {
      content.appendChild(htmlOrNode);
    } else {
      content.textContent = '';
    }

    modal.appendChild(h2);
    modal.appendChild(hint);
    modal.appendChild(content);
    ov.appendChild(modal);

    // close on background tap
    const onClick = (ev) => {
      if (ev.target === ov) NS.closeOverlay();
    };
    ov.addEventListener('click', onClick, { once: true });
  };

  NS.closeOverlay = function closeOverlay() {
    const ov = document.getElementById('overlay');
    if (!ov) return;
    ov.classList.remove('show');
    ov.style.display = 'none';
    ov.innerHTML = '';
  };

  // -------------------------
  // Image with fallback placeholder
  // -------------------------
  NS.imgWithFallback = function imgWithFallback(src, altText, fallbackText, styleObj) {
    const im = new Image();
    im.src = src;
    im.alt = altText || '';
    im.loading = 'eager';
    im.decoding = 'async';
    if (styleObj && typeof styleObj === 'object') Object.assign(im.style, styleObj);

    im.onerror = () => {
      const ph = document.createElement('div');
      Object.assign(ph.style, {
        width: (im.style.width || '100%'),
        height: (im.style.height || '100%'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,.35)',
        border: '1px solid rgba(255,255,255,.18)',
        color: 'rgba(255,255,255,.92)',
        fontWeight: '900',
        fontSize: '12px',
        letterSpacing: '.3px',
        textShadow: '0 2px 6px rgba(0,0,0,.55)',
        padding: '6px',
        textAlign: 'center',
      });
      ph.textContent = fallbackText || src || 'missing';
      im.replaceWith(ph);
    };

    return im;
  };

  // -------------------------
  // Hook points (future)
  // -------------------------
  NS.hooks = NS.hooks || {};
  // Example:
  // NS.hooks.onWeekAdvanced = (newYear, newWeek) => {};
  // NS.hooks.onGoldChanged  = (gold) => {};

})();
