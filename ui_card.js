'use strict';

/*
  MOB BR - ui_card.js v15（SSR最高レア版 / 補正%表示 / ID順 / プレビュー小さめ）

  修正（今回）：
  - ガチャ側とキー統一：mobbr_cards を正として扱う
  - 旧キー mobbr_cardsOwned しか残っていない人を救済（自動で mobbr_cards に移行）
  - 補正%表示が 0.05% になっていたので、実際の仕様（0.05=5%）として×100して表示
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
  const K_CARDS = 'mobbr_cards';       // 正：所持カード {id: count}
  const K_OLD   = 'mobbr_cardsOwned';  // 旧：ガチャ側が使っていたキー（救済用）

  // ===== DOM =====
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
  function readJSON(key){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch{
      return null;
    }
  }
  function writeJSON(key, obj){
    localStorage.setItem(key, JSON.stringify(obj || {}));
  }

  function migrateIfNeeded(){
    const cur = readJSON(K_CARDS) || {};
    const hasCur = Object.keys(cur).length > 0;

    if (hasCur) return;

    const old = readJSON(K_OLD) || {};
    const hasOld = Object.keys(old).length > 0;

    if (!hasOld) return;

    // 旧→新へ移行
    writeJSON(K_CARDS, old);
    // 旧キーは残しても害はないけど、混乱防止で消したい場合は下を有効化
    // localStorage.removeItem(K_OLD);
  }

  function getCards(){
    migrateIfNeeded();
    return readJSON(K_CARDS) || {};
  }

  function clearList(){
    if (dom.list) dom.list.innerHTML = '';
  }

  function fmtPercent(p){
    // data_cards.js は 0.05 = 5% のような「小数」で持っている
    const v = Number(p) || 0;
    return `${(v * 100).toFixed(2)}%`;
  }

  // ===== render =====
  function renderList(){
    if (!dom.list) return;

    clearList();

    const owned = getCards();
    const all = DC.getAll ? DC.getAll() : [];

    const rows = [];
    for (const card of all){
      const cnt = Number(owned[card.id] || 0);
      if (cnt <= 0) continue;

      const bonusP = DC.calcSingleCardPercent
        ? DC.calcSingleCardPercent(card.rarity, cnt)
        : 0;

      rows.push({
        id: card.id,
        name: card.name,
        rarity: card.rarity,
        imagePath: card.imagePath,
        count: cnt,
        bonusP
      });
    }

    if (rows.length === 0){
      const div = document.createElement('div');
      div.className = 'cardEmpty';
      div.textContent = 'まだカードを所持していません';
      dom.list.appendChild(div);
      return;
    }

    const orderIndex = {};
    all.forEach((c,i)=>{ orderIndex[c.id] = i; });
    rows.sort((a,b)=>(orderIndex[a.id] ?? 999999) - (orderIndex[b.id] ?? 999999));

    rows.forEach(c=>{
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'cardRow';

      const left = document.createElement('div');
      left.className = 'cardRowLeft';
      left.textContent = `【${c.rarity}】${c.name}`;

      const right = document.createElement('div');
      right.className = 'cardRowRight';

      const cnt = document.createElement('div');
      cnt.className = 'cardRowCount';
      cnt.textContent = `×${c.count}`;

      const bonus = document.createElement('div');
      bonus.className = 'cardRowBonus';
      bonus.textContent = `+${fmtPercent(c.bonusP)}`;

      right.appendChild(cnt);
      right.appendChild(bonus);

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

    dom.previewImg.src = card.imagePath || '';
    dom.previewImg.alt = card.name || 'カード';

    dom.previewImg.style.width = 'min(320px, 72vw)';
    dom.previewImg.style.height = 'auto';
    dom.previewImg.style.display = 'block';
    dom.previewImg.style.margin = '10px auto 0';
    dom.previewImg.style.borderRadius = '12px';

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
      S.setStr(S.KEYS.recent, 'カードコレクションを確認した');
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
  }

  function initCardUI(){
    bind();
  }

  window.MOBBR.initCardUI = initCardUI;
  window.MOBBR.ui.card = { open, close, render: renderList };

  document.addEventListener('DOMContentLoaded', initCardUI);
})();
