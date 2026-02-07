'use strict';

/*
  MOB BR - ui_card.js v15（SSR最高レア版 / 補正%表示 / ID順 / プレビュー小さめ）

  役割：
  - カードコレクション画面の制御
  - 所持カードを ID順で一覧表示（R→SR→SSR、番号昇順）
  - レア度 / カード名 / 重ね数 / 補正% を表示（←今回追加）
  - 行タップでカード画像プレビュー表示（←サイズ小さめ）

  前提：
  - storage.js 読み込み済み
  - data_cards.js 読み込み済み
  - index.html に cardScreen / cardList / cardPreview / cardPreviewImg などのDOMがある
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
  const K_CARDS = 'mobbr_cards'; // 所持カード {id: count}

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

  function fmtPercent(p){
    // 例: 0.27% -> "0.27%"
    // 小数点2桁目まで（必要なら変更可）
    const v = Number(p) || 0;
    return `${v.toFixed(2)}%`;
  }

  // ===== render =====
  function renderList(){
    if (!dom.list) return;

    clearList();

    const owned = getCards();
    const all = DC.getAll ? DC.getAll() : [];

    const rows = [];
    for (const card of all){
      const cnt = owned[card.id] || 0;
      if (cnt <= 0) continue;

      // 補正%（最大10枚まで有効）
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

    // data_cards.js側で ID順にソート済みの getAll を使っているので、
    // rows はその順になる想定だが、念のため id の並びを維持して再整列する。
    const orderIndex = {};
    all.forEach((c,i)=>{ orderIndex[c.id] = i; });
    rows.sort((a,b)=>(orderIndex[a.id] ?? 999999) - (orderIndex[b.id] ?? 999999));

    rows.forEach(c=>{
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'cardRow';

      // 左：レア度＋名前
      const left = document.createElement('div');
      left.className = 'cardRowLeft';
      left.textContent = `【${c.rarity}】${c.name}`;

      // 右：×枚数 ＋ 補正%
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

    // ★小さめ表示（JS側で直接指定して確実に効かせる）
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
      // 画面が無い場合でもrecentだけ残す
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
