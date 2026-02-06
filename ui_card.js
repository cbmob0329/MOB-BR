'use strict';

/*
  MOB BR - ui_card.js v14

  役割：
  - カードコレクション画面の制御
  - 所持カードを ID順で一覧表示（テキスト）
  - レア度 / カード名 / 重ね数 / 効果表記（％は表示しない）
  - カードタップでカード画像を表示

  前提：
  - storage.js 読み込み済み
  - data_cards.js 読み込み済み
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DC = window.MOBBR?.data?.cards;

  if (!S || !DC){
    console.warn('[ui_card] storage.js / data_cards.js not found');
    return;
  }

  // ===== storage key =====
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
  function getCards(){
    try{
      return JSON.parse(localStorage.getItem(K_CARDS)) || {};
    }catch{
      return {};
    }
  }

  function clearList(){
    if (dom.list) dom.list.innerHTML = '';
  }

  function rarityOrder(r){
    return DC.RARITY_ORDER.indexOf(r);
  }

  // ===== render =====
  function renderList(){
    if (!dom.list) return;

    clearList();

    const owned = getCards();
    const rows = [];

    for (const card of DC.ALL){
      const cnt = owned[card.id] || 0;
      if (cnt <= 0) continue;

      rows.push({
        ...card,
        count: cnt
      });
    }

    rows.sort((a,b)=>{
      if (rarityOrder(a.rarity) !== rarityOrder(b.rarity)){
        return rarityOrder(a.rarity) - rarityOrder(b.rarity);
      }
      return a.id.localeCompare(b.id);
    });

    if (rows.length === 0){
      const div = document.createElement('div');
      div.className = 'cardEmpty';
      div.textContent = 'まだカードを所持していません';
      dom.list.appendChild(div);
      return;
    }

    rows.forEach(c=>{
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'cardRow';

      const left = document.createElement('div');
      left.className = 'cardRowLeft';
      left.textContent = `【${c.rarity}】${c.name}`;

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

    dom.previewImg.src = `cards/${card.image}`;
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
    }else{
      S.setStr(S.KEYS.recent, 'カードコレクションを確認した');
      if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
    }
  }

  function close(){
    if (dom.screen){
      dom.screen.classList.remove('show');
    }
  }

  // ===== bind =====
  function bind(){
    if (dom.btnCard) dom.btnCard.addEventListener('click', open);
    if (dom.btnClose) dom.btnClose.addEventListener('click', close);
    if (dom.btnPreviewClose) dom.btnPreviewClose.addEventListener('click', closePreview);
  }

  function initCardUI(){
    bind();
  }

  window.MOBBR.initCardUI = initCardUI;
  window.MOBBR.ui.card = { open, close };

  document.addEventListener('DOMContentLoaded', initCardUI);
})();
