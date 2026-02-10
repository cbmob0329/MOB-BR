'use strict';

/*
  MOB BR - ui_shop.core.js（フル）
  目的：
  - SHOP画面の open/close と「見切れ防止UI強化」を担当
  - shop.css を index.html で読んでなくても反映されるよう CSS 自動注入（保険）
  - ガチャ結果表示の「器」を用意（結果が分からない問題を解決）
  - 共有APIを window.MOBBR.ui.shop に公開（gacha/catalog が使う）

  重要：
  - index.html の shopScreen DOM（btnCloseShop / shopGold / shopCDP / btnGacha1 / btnGacha10 / btnGachaSR / shopResult / shopResultList / btnShopOk）
    に合わせています（あなたのHTMLそのままでOK）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};
window.MOBBR.ui.shop = window.MOBBR.ui.shop || {};

(function(){
  const VERSION = 'shop.core.v1';

  // ===== Storage Keys（既存と合わせる）=====
  const K = {
    gold: 'mobbr_gold',
    cdp: 'mobbr_cdp',
    recent: 'mobbr_recent'
  };

  const $ = (id) => document.getElementById(id);

  function getNum(key, def){
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : def;
  }
  function setNum(key, val){
    localStorage.setItem(key, String(Number(val)));
  }
  function setStr(key, val){
    localStorage.setItem(key, String(val));
  }

  function setRecent(text){
    try{ setStr(K.recent, text); }catch(e){}
    try{
      // ui_main が render するなら即反映
      if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
    }catch(e){}
  }

  // ===== CSS自動注入（shop.css をリンクしてなくても必ず効く）=====
  function ensureShopCssInjected(){
    const id = 'mobbr_shop_css_injected_v1';
    if (document.getElementById(id)) return;

    const css = `
:root{
  --shop-radius: 22px;
  --shop-pad: 16px;
  --shop-gap: 12px;
  --shop-bg: rgba(20, 24, 34, .72);
  --shop-border: rgba(255,255,255,.16);
  --shop-shadow: 0 18px 50px rgba(0,0,0,.55);
  --shop-text: rgba(255,255,255,.92);
  --shop-muted: rgba(255,255,255,.70);
  --shop-accent: rgba(255, 217, 107, .95);
  --shop-blue: rgba(119, 200, 255, .95);
}
#shopScreen .teamPanel{
  width: min(92vw, 520px);
  max-width: 92vw;
  max-height: calc(100dvh - 18px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  overflow: hidden;
  border-radius: var(--shop-radius);
  box-shadow: var(--shop-shadow);
  background: var(--shop-bg);
  border: 1px solid var(--shop-border);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
#shopScreen .shopScroll{
  max-height: inherit;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: var(--shop-pad);
}
#shopScreen .shopHeader{
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 10px 10px 12px;
  margin: -16px -16px 10px;
  background: linear-gradient(to bottom, rgba(20,24,34,.92), rgba(20,24,34,.60));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255,255,255,.10);
}
#shopScreen .shopHeaderRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
}
#shopScreen .shopTitleRow{
  display:flex;
  align-items:center;
  gap: 10px;
  min-width: 0;
}
#shopScreen .shopTitleIcon{
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: rgba(255,255,255,.10);
  display:flex;
  align-items:center;
  justify-content:center;
  flex: 0 0 auto;
  border: 1px solid rgba(255,255,255,.12);
}
#shopScreen .shopTitleText{
  font-weight: 900;
  letter-spacing: .02em;
  color: var(--shop-text);
  font-size: 18px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 56vw;
}
#shopScreen .shopCloseBtn{
  appearance: none;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color: #fff;
  border-radius: 14px;
  padding: 10px 14px;
  font-weight: 900;
  min-height: 40px;
  min-width: 98px;
}
#shopScreen .shopMetaGrid{
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--shop-gap);
  margin-top: 8px;
  margin-bottom: 10px;
}
#shopScreen .shopMetaCard{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.12);
}
#shopScreen .shopMetaLeft{
  display:flex;
  align-items:center;
  gap: 10px;
}
#shopScreen .shopBadge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding: 6px 10px;
  border-radius: 999px;
  font-weight: 900;
  font-size: 12px;
  border: 1px solid rgba(255,255,255,.16);
  background: rgba(255,255,255,.10);
}
#shopScreen .shopBadge.gold{ color: var(--shop-accent); }
#shopScreen .shopBadge.cdp{ color: var(--shop-blue); }
#shopScreen .shopMetaLabel{
  font-weight: 800;
  color: var(--shop-muted);
  font-size: 13px;
}
#shopScreen .shopMetaVal{
  font-weight: 1000;
  color: var(--shop-text);
  font-size: 18px;
  letter-spacing: .02em;
}
#shopScreen .shopDivider{
  height: 1px;
  background: rgba(255,255,255,.10);
  margin: 12px 0;
}
#shopScreen .shopNote{
  color: rgba(255,255,255,.72);
  font-size: 12px;
  line-height: 1.45;
  margin-top: 6px;
}
#shopScreen .shopActions{
  display:flex;
  flex-direction: column;
  gap: 10px;
}
#shopScreen .shopActionBtn{
  width: 100%;
  min-height: 48px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color: #fff;
  font-weight: 900;
  letter-spacing: .02em;
}
#shopScreen .shopActionBtn.primary{
  background: linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,.08));
  border-color: rgba(255,255,255,.18);
}
#shopScreen .shopActionBtn.sr{
  background: linear-gradient(135deg, rgba(255, 217, 107, .20), rgba(255,255,255,.06));
  border-color: rgba(255, 217, 107, .35);
}
#shopScreen .shopActionBtn:disabled{
  opacity: .45;
  filter: grayscale(.3);
}
#shopScreen .shopResultWrap{
  display:none;
  margin-top: 12px;
  padding: 12px 12px 10px;
  border-radius: 18px;
  background: rgba(0,0,0,.18);
  border: 1px solid rgba(255,255,255,.14);
}
#shopScreen .shopResultWrap.show{ display:block; }
#shopScreen .shopResultHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
  margin-bottom: 8px;
}
#shopScreen .shopResultTitle{
  font-weight: 1000;
  letter-spacing: .02em;
  font-size: 15px;
}
#shopScreen .shopResultMini{
  color: rgba(255,255,255,.70);
  font-size: 12px;
  white-space: nowrap;
}
#shopScreen .shopResultList{
  display:flex;
  flex-direction: column;
  gap: 8px;
  max-height: 36vh;
  overflow:auto;
  -webkit-overflow-scrolling: touch;
  padding-right: 2px;
}
#shopScreen .shopResultItem{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.10);
}
#shopScreen .shopResultLeft{ min-width: 0; }
#shopScreen .shopResultName{
  font-weight: 950;
  font-size: 13px;
  color: rgba(255,255,255,.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 56vw;
}
#shopScreen .shopResultSub{
  font-size: 12px;
  color: rgba(255,255,255,.70);
  margin-top: 2px;
}
#shopScreen .shopPill{
  display:inline-flex;
  align-items:center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  font-weight: 1000;
  font-size: 12px;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  flex: 0 0 auto;
}
#shopScreen .shopPill.r-sr{ border-color: rgba(255, 217, 107, .38); color: rgba(255, 217, 107, .98); }
#shopScreen .shopPill.r-ssr{ border-color: rgba(170, 255, 220, .36); color: rgba(170, 255, 220, .98); }
#shopScreen .shopPill.r-r{ border-color: rgba(170, 210, 255, .34); color: rgba(170, 210, 255, .98); }
#shopScreen .shopPill.r-n{ border-color: rgba(255,255,255,.18); color: rgba(255,255,255,.88); }
#shopScreen .shopOkRow{
  margin-top: 10px;
  display:flex;
  justify-content:flex-end;
}
#shopScreen .shopOkBtn{
  min-height: 42px;
  border-radius: 14px;
  padding: 10px 14px;
  font-weight: 1000;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.10);
  color: #fff;
}
`;

    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function pillClass(r){
    const rr = String(r || 'N').toUpperCase();
    if (rr === 'SSR') return 'r-ssr';
    if (rr === 'SR') return 'r-sr';
    if (rr === 'R') return 'r-r';
    return 'r-n';
  }

  // ===== DOM/state =====
  let dom = null;
  let enhanced = false;
  let boundCore = false;

  function collectDom(){
    dom = {
      screen: $('shopScreen'),
      panel: $('shopScreen')?.querySelector('.teamPanel') || null,

      btnCloseShop: $('btnCloseShop'),

      goldText: $('shopGold'),
      cdpText: $('shopCDP'),

      btnGacha1: $('btnGacha1'),
      btnGacha10: $('btnGacha10'),
      btnGachaSR: $('btnGachaSR'),

      // existing result nodes
      resultSection: $('shopResult'),
      resultList: $('shopResultList'),
      btnOk: $('btnShopOk')
    };
  }

  function enhanceDom(){
    if (enhanced) return;
    if (!dom) collectDom();
    if (!dom?.screen || !dom.panel) return;

    ensureShopCssInjected();

    // panel内をスクロールラッパで包む（見切れ防止の本体）
    if (!dom.panel.querySelector('.shopScroll')){
      const wrap = document.createElement('div');
      wrap.className = 'shopScroll';

      const children = Array.from(dom.panel.childNodes);
      for (const ch of children) wrap.appendChild(ch);
      dom.panel.appendChild(wrap);
    }

    const scroll = dom.panel.querySelector('.shopScroll');

    // stickyヘッダー（見た目＋閉じるを常に押せる）
    if (!scroll.querySelector('.shopHeader')){
      const head = document.createElement('div');
      head.className = 'shopHeader';
      head.innerHTML = `
        <div class="shopHeaderRow">
          <div class="shopTitleRow">
            <div class="shopTitleIcon" aria-hidden="true">🃏</div>
            <div class="shopTitleText">ショップ（カードガチャ）</div>
          </div>
          <button type="button" class="shopCloseBtn" id="__shopCloseSticky">閉じる</button>
        </div>
      `;
      scroll.insertBefore(head, scroll.firstChild);

      const b = head.querySelector('#__shopCloseSticky');
      if (b) b.addEventListener('click', () => api.close());
    }

    // メタ情報カード（G/CDP を上部で強調）
    if (!scroll.querySelector('.shopMetaGrid')){
      const meta = document.createElement('div');
      meta.className = 'shopMetaGrid';
      meta.innerHTML = `
        <div class="shopMetaCard">
          <div class="shopMetaLeft">
            <span class="shopBadge gold">G</span>
            <div class="shopMetaLabel">所持G</div>
          </div>
          <div class="shopMetaVal" id="__shopGoldBig">0</div>
        </div>
        <div class="shopMetaCard">
          <div class="shopMetaLeft">
            <span class="shopBadge cdp">CDP</span>
            <div class="shopMetaLabel">CDP</div>
          </div>
          <div class="shopMetaVal" id="__shopCdpBig">0</div>
        </div>
        <div class="shopNote">
          ※ここは「カードガチャのみ」<br />
          ※確率・％表示はしない（仕様）
        </div>
        <div class="shopDivider"></div>
      `;

      const anchor =
        scroll.querySelector('.teamMeta') ||
        scroll.querySelector('.teamSection') ||
        null;

      if (anchor) scroll.insertBefore(meta, anchor);
      else scroll.appendChild(meta);
    }

    // ガチャボタンの見栄えを揃える（既存ボタンを移動して二重表示を防ぐ）
    if (dom.btnGacha1) dom.btnGacha1.classList.add('shopActionBtn', 'primary');
    if (dom.btnGacha10) dom.btnGacha10.classList.add('shopActionBtn', 'primary');
    if (dom.btnGachaSR) dom.btnGachaSR.classList.add('shopActionBtn', 'sr');

    const firstSection = scroll.querySelector('.teamSection');
    if (firstSection && !firstSection.querySelector('.shopActions')){
      const actions = document.createElement('div');
      actions.className = 'shopActions';

      if (dom.btnGacha1) actions.appendChild(dom.btnGacha1);
      if (dom.btnGacha10) actions.appendChild(dom.btnGacha10);
      if (dom.btnGachaSR) actions.appendChild(dom.btnGachaSR);

      const saveRow = firstSection.querySelector('.saveRow');
      if (saveRow) saveRow.innerHTML = '';

      const title = firstSection.querySelector('.teamSectionTitle');
      if (title && title.nextSibling){
        firstSection.insertBefore(actions, title.nextSibling);
      }else{
        firstSection.appendChild(actions);
      }
    }

    // 結果パネルを「必ず見える器」にする
    if (dom.resultSection){
      dom.resultSection.classList.add('shopResultWrap');

      // 見出し強化（無ければ追加）
      if (!dom.resultSection.querySelector('.shopResultHead')){
        const head = document.createElement('div');
        head.className = 'shopResultHead';
        head.innerHTML = `
          <div class="shopResultTitle">結果</div>
          <div class="shopResultMini" id="__shopResultMini">-</div>
        `;
        dom.resultSection.insertBefore(head, dom.resultSection.firstChild);
      }

      if (dom.resultList) dom.resultList.classList.add('shopResultList');

      if (dom.btnOk){
        dom.btnOk.classList.add('shopOkBtn');
        if (!dom.resultSection.querySelector('.shopOkRow')){
          const row = document.createElement('div');
          row.className = 'shopOkRow';
          row.appendChild(dom.btnOk);
          dom.resultSection.appendChild(row);
        }
      }
    }

    enhanced = true;
  }

  function renderMeta(){
    if (!dom) collectDom();
    const g = getNum(K.gold, 0);
    const c = getNum(K.cdp, 0);

    if (dom.goldText) dom.goldText.textContent = String(g);
    if (dom.cdpText) dom.cdpText.textContent = String(c);

    const gb = document.getElementById('__shopGoldBig');
    const cb = document.getElementById('__shopCdpBig');
    if (gb) gb.textContent = String(g);
    if (cb) cb.textContent = String(c);

    if (dom.btnGachaSR) dom.btnGachaSR.disabled = c < 100;
  }

  function hideResult(){
    if (!dom) collectDom();
    if (dom.resultSection){
      dom.resultSection.classList.remove('show');
      dom.resultSection.style.display = 'none';
    }
    if (dom.resultList) dom.resultList.innerHTML = '';
    const mini = document.getElementById('__shopResultMini');
    if (mini) mini.textContent = '-';
  }

  function showResult(items, label){
    if (!dom) collectDom();
    if (!dom.resultSection || !dom.resultList) return;

    dom.resultList.innerHTML = '';

    for (const it of items){
      const rarity = String(it?.rarity || 'N').toUpperCase();
      const name = it?.name ?? 'カード';
      const sub = it?.sub ?? '';

      const row = document.createElement('div');
      row.className = 'shopResultItem';
      row.innerHTML = `
        <div class="shopResultLeft">
          <div class="shopResultName">${escapeHtml(name)}</div>
          <div class="shopResultSub">${escapeHtml(sub)}</div>
        </div>
        <div class="shopPill ${pillClass(rarity)}">${escapeHtml(rarity)}</div>
      `;
      dom.resultList.appendChild(row);
    }

    dom.resultSection.style.display = 'block';
    dom.resultSection.classList.add('show');

    const mini = document.getElementById('__shopResultMini');
    if (mini) mini.textContent = label || `${items.length}件`;

    // 結果を確実に見せる（見切れ防止：結果位置へスクロール）
    const scroll = dom.panel?.querySelector('.shopScroll');
    if (scroll){
      const top = dom.resultSection.offsetTop - 10;
      scroll.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function bindCore(){
    if (boundCore) return;
    boundCore = true;

    if (!dom) collectDom();
    if (!dom?.screen) return;

    // 既存の閉じる（ヘッダー以外）も生かす
    if (dom.btnCloseShop) dom.btnCloseShop.addEventListener('click', () => api.close());

    // 結果OK
    if (dom.btnOk) dom.btnOk.addEventListener('click', hideResult);

    // 初回は結果畳む
    hideResult();
  }

  // ===== 公開API =====
  function open(){
    if (!dom) collectDom();
    if (!dom?.screen) return;

    enhanceDom();
    bindCore();
    renderMeta();

    dom.screen.classList.add('show');
    dom.screen.setAttribute('aria-hidden', 'false');

    setRecent('ショップ：カードガチャを開いた');
  }

  function close(){
    if (!dom) collectDom();
    if (!dom?.screen) return;

    dom.screen.classList.remove('show');
    dom.screen.setAttribute('aria-hidden', 'true');
    hideResult();
  }

  function payGold(cost){
    const g = getNum(K.gold, 0);
    if (g < cost) return false;
    setNum(K.gold, g - cost);
    return true;
  }

  function addCdp(n){
    const c = getNum(K.cdp, 0);
    setNum(K.cdp, c + n);
  }

  function consumeCdp(n){
    const c = getNum(K.cdp, 0);
    if (c < n) return false;
    setNum(K.cdp, c - n);
    return true;
  }

  const api = window.MOBBR.ui.shop;
  api.version = VERSION;
  api.open = open;
  api.close = close;

  // shared helpers for gacha/catalog
  api.renderMeta = renderMeta;
  api.showResult = showResult;
  api.hideResult = hideResult;
  api.setRecent = setRecent;

  api.getGold = () => getNum(K.gold, 0);
  api.getCdp = () => getNum(K.cdp, 0);
  api.payGold = payGold;
  api.addCdp = addCdp;
  api.consumeCdp = consumeCdp;

  // ===== init =====
  function initShopUI(){
    collectDom();
    enhanceDom();
    bindCore();
    renderMeta();
  }

  window.MOBBR.initShopUI = window.MOBBR.initShopUI || initShopUI;

  // 動的ロードでも確実に
  initShopUI();
})();
