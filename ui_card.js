'use strict';

/*
  MOB BR - ui_card.js v14（data_cards.js v14準拠）

  役割：
  - カードコレクション画面の制御
  - 所持カードを ID順で一覧表示（テキスト）
  - レア度 / カード名 / 重ね数（％は表示しない）
  - カードタップでカード画像を表示

  前提：
  - storage.js 読み込み済み
  - data_cards.js 読み込み済み（window.MOBBR.data.cards）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DC = window.MOBBR?.data?.cards;

  if (!S || !DC || typeof DC.getAll !== 'function'){
    console.warn('[ui_card] storage.js / data_cards.js not found or invalid');
    return;
  }

  // ===== storage key =====
  // 所持データ：{ "R1": 2, "SR3": 1, ... }
  const K_CARDS = 'mobbr_cards';

  // ===== DOM（HTMLに存在する前提）=====
  const dom = {
    btnCard: $('btnCard'),

    screen: $('cardScreen'),
    btnClose: $('btnCloseCard'),

    list: $('cardList'),

    preview: $('cardPreview'),
    previewImg: $('cardPreviewImg'),
    btnPreviewClose: $('btnCloseCardPreview')
  };

  // ===== utils =====
  function getOwned(){
    try{
      const o = JSON.parse(localStorage.getItem(K_CARDS)) || {};
      return (o && typeof o === 'object') ? o : {};
    }catch{
      return {};
    }
  }

  function clearList(){
    if (dom.list) dom.list.innerHTML = '';
  }

  function parseId(id){
    // "R38" / "SR12" / "SSR24" -> {prefix:'R'|'SR'|'SSR', num:38}
    const m = String(id).match(/^(SSR|SR|R)(\d+)$/);
    if (!m) return { prefix:'', num: 0 };
    return { prefix: m[1], num: Number(m[2]) || 0 };
  }

  function idOrderKey(id){
    const p = parseId(id);
    const order = { R: 1, SR: 2, SSR: 3 };
    return { g: order[p.prefix] || 99, n: p.num || 0 };
  }

  function sortById(a, b){
    const A = idOrderKey(a.id);
    const B = idOrderKey(b.id);
    if (A.g !== B.g) return A.g - B.g;
    return A.n - B.n;
  }

  function safeImagePath(card){
    // data_cards.js v14 は imagePath を付与済み
    if (card && card.imagePath) return card.imagePath;
    if (card && card.image) return `cards/${card.image}`;
    return '';
  }

  // ===== render =====
  function renderList(){
    if (!dom.list) return;

    clearList();

    const owned = getOwned();
    const all = DC.getAll(); // これが唯一の正

    const rows = [];
    for (const card of all){
      const cnt = Number(owned[card.id] || 0);
      if (!Number.isFinite(cnt) || cnt <= 0) continue;
      rows.push({ ...card, count: cnt });
    }

    if (rows.length === 0){
      const div = document.createElement('div');
      div.className = 'cardEmpty';
      div.textContent = 'まだカードを所持していません';
      dom.list.appendChild(div);
      return;
    }

    // 念のため ID順に揃える（data_cards側がソート済みでも安全策）
    rows.sort(sortById);

    rows.forEach(c=>{
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'cardRow';

      const left = document.createElement('div');
      left.className = 'cardRowLeft';
      left.textContent = `【${c.rarity}】${c.name}（${c.id}）`;

      const right = document.createElement('div');
      right.className = 'cardRowRight';
      right.textContent = `×${c.count}`;

      row.appendChild(left);
      row.appendChild(right);

      row.addEventListener('click', ()=>{
        showPreview(c);
      });

      dom.list.appendChild(row);
    });
  }

  // ===== preview =====
  function showPreview(card){
    if (!dom.preview || !dom.previewImg) return;

    const path = safeImagePath(card);
    if (!path){
      alert('画像パスが見つかりません');
      return;
    }

    dom.previewImg.src = path;
    dom.preview.style.display = 'block';
  }

  function closePreview(){
    if (dom.preview){
      dom.preview.style.display = 'none';
    }
  }

  // ===== open / close =====
  function open(){
    if (dom.screen){
      renderList();
      dom.screen.classList.add('show');
      dom.screen.setAttribute('aria-hidden', 'false');
    }else{
      // cardScreenが無い場合はログだけ
      if (S?.KEYS?.recent) S.setStr(S.KEYS.recent, 'カードコレクションを確認した');
      if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
    }
  }

  function close(){
    closePreview();
    if (dom.screen){
      dom.screen.classList.remove('show');
      dom.screen.setAttribute('aria-hidden', 'true');
    }
  }

  // ===== bind =====
  function bind(){
    if (dom.btnCard) dom.btnCard.addEventListener('click', open);
    if (dom.btnClose) dom.btnClose.addEventListener('click', close);
    if (dom.btnPreviewClose) dom.btnPreviewClose.addEventListener('click', closePreview);

    // 画面外タップでプレビュー閉じたい等があればCSS/HTML側で対応（ここでは触らない）
  }

  function initCardUI(){
    bind();
  }

  window.MOBBR.initCardUI = initCardUI;
  window.MOBBR.ui.card = { open, close, render: renderList };

  document.addEventListener('DOMContentLoaded', initCardUI);
})();
