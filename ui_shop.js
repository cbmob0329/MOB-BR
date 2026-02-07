'use strict';

/*
  MOB BR - ui_shop.js v15（フル）
  目的：
  1) 育成アイテム購入 ✅
     - 購入 → 確認 → メンバー選択 → 対象能力EXP +5 → 結果表示 → 自動で閉じる
  2) カードガチャ ✅
     - 既存UI（index.htmlのガチャDOM）をそのまま使用
     - G消費 / CDP加算 / SR確定（CDP100消費）/ 重複11枚目以降はG変換（中央ログへ）
  3) コーチスキル購入 ✅（装備はしない）
     - 購入のみ（所持管理：mobbr_coachSkillsOwned）
     - 装備・有効化はチーム画面側で後日実装
  4) 閉じる ✅

  前提：
  - storage.js, data_player.js, data_cards.js が app.js で先に読み込まれている
  - index.html に #shopScreen と以下IDがある：
    shopGold, shopCDP, btnCloseShop,
    btnGacha1, btnGacha10, btnGachaSR,
    shopResult, shopResultList, btnShopOk
  - modalBack は共通で #modalBack が存在（無い場合も落ちない）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage || null;
  const DP = window.MOBBR?.data?.player || null;
  const DC = window.MOBBR?.data?.cards  || null;

  // storage.js が無くても最低限動くように（ただし推奨は storage.js あり）
  const FALLBACK_KEYS = {
    gold: 'mobbr_gold',
    rank: 'mobbr_rank',
    recent: 'mobbr_recent',
    playerTeam: 'mobbr_playerTeam',
    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3'
  };

  const K = (S && S.KEYS) ? S.KEYS : FALLBACK_KEYS;

  function getNum(key, def){
    if (S?.getNum) return S.getNum(key, def);
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : def;
  }
  function getStr(key, def){
    if (S?.getStr) return S.getStr(key, def);
    const v = localStorage.getItem(key);
    return (v === null || v === undefined || v === '') ? def : v;
  }
  function setNum(key, val){
    if (S?.setNum) return S.setNum(key, val);
    localStorage.setItem(key, String(Number(val)));
  }
  function setStr(key, val){
    if (S?.setStr) return S.setStr(key, val);
    localStorage.setItem(key, String(val));
  }

  // ===== DOM =====
  const dom = {
    screen: $('shopScreen'),
    close: $('btnCloseShop'),

    // meta
    shopGold: $('shopGold'),
    shopCDP: $('shopCDP'),

    // gacha
    btnGacha1: $('btnGacha1'),
    btnGacha10: $('btnGacha10'),
    btnGachaSR: $('btnGachaSR'),

    // result area (existing)
    shopResult: $('shopResult'),
    shopResultList: $('shopResultList'),
    btnShopOk: $('btnShopOk'),

    // shared back
    modalBack: $('modalBack')
  };

  // ===== Shop main menu / sections (dynamic) =====
  let menuBuilt = false;
  let elMenuWrap = null;
  let elSectionWrap = null;

  // ===== Data / constants =====
  // ガチャ価格（要件に明記が無いので「安定運用できる固定値」に統一）
  // ※後で調整したければここだけ変えればOK
  const GACHA_COST_1  = 1000;
  const GACHA_COST_10 = 9000;

  // CDP（カードポイント）
  const KEY_CDP = 'mobbr_cdp'; // shopCDP 表示に対応

  // 所持カード
  const KEY_OWNED_CARDS = 'mobbr_cards'; // { "c001": 2, ... }

  // コーチスキル所持
  const KEY_COACH_SKILLS_OWNED = 'mobbr_coachSkillsOwned'; // { "tactics_note": 1, ... }

  // ===== 育成アイテム（EXP+5） =====
  const TRAINING_ITEMS = [
    { id:'hp',      stat:'hp',      name:'タフネス極意の巻物', price:20000, desc:'体力のEXP +5' },
    { id:'mental',  stat:'mental',  name:'感動的な絵本',       price:10000, desc:'メンタルのEXP +5' },
    { id:'aim',     stat:'aim',     name:'秘伝の目薬',         price:20000, desc:'エイムのEXP +5' },
    { id:'agi',     stat:'agi',     name:'カモシカのステーキ', price:10000, desc:'敏捷性のEXP +5' },
    { id:'tech',    stat:'tech',    name:'高級なそろばん',     price:10000, desc:'テクニックのEXP +5' },
    { id:'support', stat:'support', name:'サポートディスク',   price:10000, desc:'サポートのEXP +5' }
  ];

  // ===== コーチスキル（購入のみ、装備はしない） =====
  const COACH_SKILLS = [
    {
      id:'tactics_note',
      name:'戦術ノート',
      price:500,
      effectReal:'総合戦闘力に +1%',
      effectShow:'この試合、総合戦闘力が1%アップする',
      quote:'基本を徹底。丁寧に戦おう！'
    },
    {
      id:'mental_care',
      name:'メンタル整備',
      price:500,
      effectReal:'イベントのマイナス系（喧嘩／仲間割れ）発生率 -30%',
      effectShow:'この試合、チームの雰囲気が安定する',
      quote:'全員で勝つぞ！'
    },
    {
      id:'clutch_endgame',
      name:'終盤の底力',
      price:800,
      effectReal:'R5とR6の総合戦闘力に +3%（終盤だけ）',
      effectShow:'この試合、終盤の勝負で総合戦闘力が3%アップする',
      quote:'終盤一気に押すぞ！'
    },
    {
      id:'clearing',
      name:'クリアリング徹底',
      price:1000,
      effectReal:'勝者デスボックス抽選を軽減（0人寄り）',
      effectShow:'この試合、ファイトに勝った後に人数が残りやすい',
      quote:'周辺をしっかり見ろ！'
    },
    {
      id:'score_mind',
      name:'スコア意識',
      price:3000,
      effectReal:'お宝/フラッグイベントの発生率 +15%',
      effectShow:'この試合、お宝やフラッグを取りやすい',
      quote:'この試合はポイント勝負だ！'
    },
    {
      id:'igl_call',
      name:'IGL強化コール',
      price:5000,
      effectReal:'総合戦闘力に +4%',
      effectShow:'この試合、総合戦闘力が4%アップする',
      quote:'コールを信じろ！チャンピオン取るぞ！'
    },
    {
      id:'protagonist_move',
      name:'主人公ムーブ',
      price:50000,
      effectReal:'勝率補正 +6%／アシスト発生率 +15%',
      effectShow:'この試合、総合戦闘力が6%アップし、アシストも出やすくなる',
      quote:'チームの力を信じろ！'
    }
  ];

  // ===== util =====
  function showBack(){
    if (!dom.modalBack) return;
    dom.modalBack.style.display = 'block';
    dom.modalBack.style.pointerEvents = 'auto';
    dom.modalBack.setAttribute('aria-hidden', 'false');
  }
  function hideBack(){
    if (!dom.modalBack) return;
    dom.modalBack.style.display = 'none';
    dom.modalBack.style.pointerEvents = 'none';
    dom.modalBack.setAttribute('aria-hidden', 'true');
  }

  function setRecent(text){
    setStr(K.recent, text);
    // mainの表示更新
    if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
  }

  function fmtG(n){
    const v = Number(n) || 0;
    return String(v);
  }

  function readJSON(key, def){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    }catch{
      return def;
    }
  }
  function writeJSON(key, obj){
    localStorage.setItem(key, JSON.stringify(obj));
  }

  function getGold(){
    return getNum(K.gold, 0);
  }
  function setGold(v){
    setNum(K.gold, v);
    renderMeta();
    // mainの所持Gを更新
    if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
  }

  function getCDP(){
    return getNum(KEY_CDP, 0);
  }
  function setCDP(v){
    setNum(KEY_CDP, v);
    renderMeta();
  }

  function addGold(delta){
    setGold(getGold() + (Number(delta) || 0));
  }

  function spendGold(cost){
    const c = Number(cost) || 0;
    const g = getGold();
    if (g < c) return false;
    setGold(g - c);
    return true;
  }

  function ensureShopUIContainers(){
    if (!dom.screen) return;

    // shopScreen 内の panel を探す
    const panel = dom.screen.querySelector('.teamPanel');
    if (!panel) return;

    if (menuBuilt) return;

    // 既存の「カードガチャ」セクション（index.htmlのteamSection）を見つける
    // それを「ガチャセクション」として扱い、他セクションを追加する
    const sections = Array.from(panel.querySelectorAll('.teamSection'));
    const gachaSection = sections[0] || null; // index.htmlでは最初のteamSectionがガチャ

    // メニュー置き場（先頭に差し込む）
    elMenuWrap = document.createElement('div');
    elMenuWrap.className = 'teamSection';
    elMenuWrap.style.marginTop = '0px';

    const menuTitle = document.createElement('div');
    menuTitle.className = 'teamSectionTitle';
    menuTitle.textContent = 'メニュー';

    const menu = document.createElement('div');
    menu.id = 'shopMenu';

    elMenuWrap.appendChild(menuTitle);
    elMenuWrap.appendChild(menu);

    // セクション置き場（アイテム/コーチスキル用）
    elSectionWrap = document.createElement('div');
    elSectionWrap.className = 'teamSection';
    elSectionWrap.id = 'shopDynamicSection';
    elSectionWrap.style.display = 'none';

    const dynTitle = document.createElement('div');
    dynTitle.className = 'teamSectionTitle';
    dynTitle.id = 'shopDynamicTitle';
    dynTitle.textContent = 'ショップ';

    const dynBody = document.createElement('div');
    dynBody.id = 'shopDynamicBody';

    elSectionWrap.appendChild(dynTitle);
    elSectionWrap.appendChild(dynBody);

    // panelに差し込む：HEAD/META の後にメニュー → dynamic → 既存ガチャ
    // teamHead と teamMeta の直後に入れたい
    const head = panel.querySelector('.teamHead');
    const meta = panel.querySelector('.teamMeta');

    if (meta && meta.parentElement === panel){
      // metaの直後に menu/dynamic を入れる
      if (meta.nextSibling){
        panel.insertBefore(elMenuWrap, meta.nextSibling);
      }else{
        panel.appendChild(elMenuWrap);
      }
      panel.insertBefore(elSectionWrap, elMenuWrap.nextSibling);
    }else if (head && head.parentElement === panel){
      panel.insertBefore(elMenuWrap, head.nextSibling);
      panel.insertBefore(elSectionWrap, elMenuWrap.nextSibling);
    }else{
      panel.insertBefore(elMenuWrap, panel.firstChild);
      panel.insertBefore(elSectionWrap, elMenuWrap.nextSibling);
    }

    // メニューを作る
    buildMenuButtons(menu, gachaSection);

    menuBuilt = true;
  }

  function buildMenuButtons(menuEl, gachaSection){
    menuEl.innerHTML = '';

    const makeBtn = (title, sub, badge, onClick, extraClass='') => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `shopMenuBtn ${extraClass}`.trim();

      const t = document.createElement('div');
      t.className = 'shopMenuTitle';

      const left = document.createElement('span');
      left.textContent = title;

      t.appendChild(left);

      if (badge){
        const b = document.createElement('span');
        b.className = 'shopBadge';
        b.textContent = badge;
        t.appendChild(b);
      }

      const s = document.createElement('div');
      s.className = 'shopMenuSub';
      s.textContent = sub || '';

      btn.appendChild(t);
      if (sub) btn.appendChild(s);

      btn.addEventListener('click', onClick);
      menuEl.appendChild(btn);
    };

    makeBtn(
      '育成アイテム購入',
      '購入 → メンバー選択 → 能力EXP +5 → 結果 → 自動で閉じる',
      null,
      ()=> openItemShop()
    );

    makeBtn(
      'カードガチャ',
      `1回 ${GACHA_COST_1}G / 10連 ${GACHA_COST_10}G / SR以上確定（CDP100）`,
      null,
      ()=> {
        // dynamicを閉じてガチャを見せる
        hideDynamicSection();
        if (gachaSection) gachaSection.style.display = '';
        if (dom.shopResult) dom.shopResult.style.display = 'none';
        setRecent('ショップ：カードガチャを開いた');
      }
    );

    makeBtn(
      'コーチスキル購入',
      '購入のみ（装備は後日、チーム画面で実装）',
      null,
      ()=> openCoachShop()
    );

    makeBtn(
      '閉じる',
      '',
      null,
      ()=> close(),
      'isClose'
    );

    // 初期表示：ガチャを表示（index.htmlのまま）
    hideDynamicSection();
    if (gachaSection) gachaSection.style.display = '';
  }

  function hideDynamicSection(){
    if (elSectionWrap) elSectionWrap.style.display = 'none';
    const body = $('shopDynamicBody');
    if (body) body.innerHTML = '';
    const title = $('shopDynamicTitle');
    if (title) title.textContent = '';
  }

  function showDynamicSection(titleText){
    if (elSectionWrap) elSectionWrap.style.display = '';
    const title = $('shopDynamicTitle');
    if (title) title.textContent = titleText || 'ショップ';
  }

  // ===== Popups (confirm / member pick / result) =====
  let popConfirm = null;
  let popPick = null;
  let popResult = null;

  function ensurePopups(){
    // confirm
    if (!popConfirm){
      popConfirm = document.createElement('div');
      popConfirm.className = 'shopPop';
      popConfirm.id = 'shopConfirmPop';
      popConfirm.setAttribute('aria-hidden','true');

      const t = document.createElement('div');
      t.className = 'shopPopTitle';
      t.id = 'shopConfirmTitle';
      t.textContent = '確認';

      const tx = document.createElement('div');
      tx.className = 'shopPopText';
      tx.id = 'shopConfirmText';

      const act = document.createElement('div');
      act.className = 'shopPopActions';

      const yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'shopPopBtn shopPopBtnYes';
      yes.id = 'shopConfirmYes';
      yes.textContent = 'はい';

      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'shopPopBtn shopPopBtnNo';
      no.id = 'shopConfirmNo';
      no.textContent = 'いいえ';

      act.appendChild(yes);
      act.appendChild(no);

      popConfirm.appendChild(t);
      popConfirm.appendChild(tx);
      popConfirm.appendChild(act);

      document.body.appendChild(popConfirm);
    }

    // member pick
    if (!popPick){
      popPick = document.createElement('div');
      popPick.className = 'shopPop';
      popPick.id = 'shopMemberPickPop';
      popPick.setAttribute('aria-hidden','true');

      const t = document.createElement('div');
      t.className = 'shopPopTitle';
      t.textContent = '使用するメンバーを選んでください';

      const list = document.createElement('div');
      list.className = 'memberPickList';
      list.id = 'shopMemberPickList';

      popPick.appendChild(t);
      popPick.appendChild(list);

      document.body.appendChild(popPick);
    }

    // result
    if (!popResult){
      popResult = document.createElement('div');
      popResult.className = 'shopPop';
      popResult.id = 'shopResultPop';
      popResult.setAttribute('aria-hidden','true');

      const t = document.createElement('div');
      t.className = 'shopPopTitle';
      t.textContent = '結果';

      const big = document.createElement('div');
      big.className = 'shopResultBig';
      big.id = 'shopResultBig';

      const tiny = document.createElement('div');
      tiny.className = 'shopTiny';
      tiny.id = 'shopResultTiny';

      const ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'shopPopBtn shopPopBtnYes';
      ok.style.marginTop = '14px';
      ok.id = 'shopResultOk';
      ok.textContent = 'OK';

      popResult.appendChild(t);
      popResult.appendChild(big);
      popResult.appendChild(tiny);
      popResult.appendChild(ok);

      document.body.appendChild(popResult);
    }
  }

  function openPop(pop){
    if (!pop) return;
    showBack();
    pop.classList.add('show');
    pop.setAttribute('aria-hidden','false');
  }
  function closePop(pop){
    if (!pop) return;
    pop.classList.remove('show');
    pop.setAttribute('aria-hidden','true');
    hideBack();
  }

  function confirmPop(text, onYes){
    ensurePopups();
    const tx = $('shopConfirmText');
    if (tx) tx.textContent = text;

    const yes = $('shopConfirmYes');
    const no = $('shopConfirmNo');

    if (yes){
      yes.onclick = () => {
        closePop(popConfirm);
        if (typeof onYes === 'function') onYes();
      };
    }
    if (no){
      no.onclick = () => {
        closePop(popConfirm);
      };
    }

    openPop(popConfirm);
  }

  function resultPop(bigText, tinyText, onOk){
    ensurePopups();
    const b = $('shopResultBig');
    const t = $('shopResultTiny');
    if (b) b.textContent = bigText || '';
    if (t) t.textContent = tinyText || '';

    const ok = $('shopResultOk');
    if (ok){
      ok.onclick = () => {
        closePop(popResult);
        if (typeof onOk === 'function') onOk();
      };
    }
    openPop(popResult);
  }

  // ===== team read/write (EXP + Lv) =====
  function readPlayerTeam(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      const team = raw ? JSON.parse(raw) : null;
      if (team && Array.isArray(team.members)) return team;
    }catch(e){}
    if (DP?.buildDefaultTeam) return DP.buildDefaultTeam();
    // 最低限
    return { members:[
      { id:'A', slot:1, name:getStr(K.m1,'A'), exp:{}, lv:{} },
      { id:'B', slot:2, name:getStr(K.m2,'B'), exp:{}, lv:{} },
      { id:'C', slot:3, name:getStr(K.m3,'C'), exp:{}, lv:{} }
    ]};
  }

  function normalizeExp(exp){
    if (DP?.normalizeExp) return DP.normalizeExp(exp);
    const keys = ['hp','mental','aim','agi','tech','support','scan'];
    const out = {};
    keys.forEach(k=> out[k] = Number(exp?.[k]) || 0);
    return out;
  }
  function normalizeLv(lv){
    if (DP?.normalizeLv) return DP.normalizeLv(lv);
    const keys = ['hp','mental','aim','agi','tech','support','scan'];
    const out = {};
    keys.forEach(k=> out[k] = Math.max(1, Number(lv?.[k]) || 1));
    return out;
  }

  function statLabel(stat){
    return DP?.STAT_LABEL?.[stat] || ({
      hp:'体力', mental:'メンタル', aim:'エイム', agi:'敏捷性', tech:'テクニック', support:'サポート', scan:'索敵'
    }[stat] || stat);
  }

  function writePlayerTeam(team){
    localStorage.setItem(K.playerTeam, JSON.stringify(team));
  }

  function getMemberNames(){
    const A = getStr(K.m1,'A');
    const B = getStr(K.m2,'B');
    const C = getStr(K.m3,'C');
    return { A, B, C };
  }

  function applyExpPlus(team, memberId, stat, amount){
    const amt = Number(amount) || 0;
    const mem = (team.members || []).find(m => m.id === memberId);
    if (!mem) return { lvUp:false, beforeExp:0, afterExp:0, beforeLv:1, afterLv:1 };

    mem.exp = normalizeExp(mem.exp);
    mem.lv  = normalizeLv(mem.lv);

    const beforeExp = mem.exp[stat] || 0;
    const beforeLv  = mem.lv[stat]  || 1;

    mem.exp[stat] = (mem.exp[stat] || 0) + amt;

    let lvUp = false;
    while (mem.exp[stat] >= 20){
      mem.exp[stat] -= 20;
      mem.lv[stat] += 1;
      lvUp = true;
    }

    const afterExp = mem.exp[stat] || 0;
    const afterLv  = mem.lv[stat]  || 1;

    return { lvUp, beforeExp, afterExp, beforeLv, afterLv };
  }

  // ===== Item Shop =====
  function openItemShop(){
    // ガチャ結果は隠す
    if (dom.shopResult) dom.shopResult.style.display = 'none';

    // 既存のガチャセクション（index.html最初のteamSection）を隠す（メニューで戻せる）
    const panel = dom.screen?.querySelector('.teamPanel');
    const sections = panel ? Array.from(panel.querySelectorAll('.teamSection')) : [];
    const gachaSection = sections[sections.findIndex(s=> s.querySelector('#btnGacha1'))] || sections[0] || null;
    if (gachaSection) gachaSection.style.display = 'none';

    showDynamicSection('育成アイテム購入');
    const body = $('shopDynamicBody');
    if (!body) return;

    body.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'shopList';

    TRAINING_ITEMS.forEach(item=>{
      const row = document.createElement('div');
      row.className = 'shopItemRow';

      const left = document.createElement('div');
      left.className = 'shopItemLeft';

      const name = document.createElement('div');
      name.className = 'shopItemName';
      name.textContent = `${statLabel(item.stat)}：${item.name}`;

      const desc = document.createElement('div');
      desc.className = 'shopItemDesc';
      desc.textContent = item.desc;

      left.appendChild(name);
      left.appendChild(desc);

      const right = document.createElement('div');
      right.className = 'shopItemRight';

      const price = document.createElement('div');
      price.className = 'shopPrice';
      price.textContent = `${fmtG(item.price)}G`;

      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'shopBuyBtn';
      buy.textContent = '購入';
      buy.disabled = (getGold() < item.price);

      buy.addEventListener('click', ()=>{
        const cost = item.price;
        confirmPop(`${cost}Gです購入しますか？`, ()=>{
          if (!spendGold(cost)){
            resultPop('Gが足りません。', '所持Gを確認してください。', ()=>{});
            return;
          }

          // メンバー選択へ
          openMemberPick(item, (memberId)=>{
            const team = readPlayerTeam();
            const names = getMemberNames();
            const memName = names[memberId] || memberId;

            const r = applyExpPlus(team, memberId, item.stat, 5);
            writePlayerTeam(team);

            // 画面側も更新
            if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
            if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();

            // recent
            setRecent(`ショップ：${memName} が ${statLabel(item.stat)}EXP +5 を得た`);

            // 結果 → 自動で閉じる
            const lvText = r.lvUp ? `（LvUP! ${r.beforeLv}→${r.afterLv}）` : '';
            resultPop(
              `${memName} は ${statLabel(item.stat)}の能力経験値が5上がった！${lvText}`,
              `EXP ${r.beforeExp}/20 → ${r.afterExp}/20`,
              ()=>{
                // 自動でショップを閉じる（要件）
                close();
              }
            );
          });
        });
      });

      right.appendChild(price);
      right.appendChild(buy);

      row.appendChild(left);
      row.appendChild(right);

      list.appendChild(row);
    });

    body.appendChild(list);

    // footer note
    const note = document.createElement('div');
    note.className = 'shopTiny';
    note.textContent = '※購入後、使用するメンバーを選択します。選んだメンバーの対象能力EXPが+5されます。';
    body.appendChild(note);

    setRecent('ショップ：育成アイテム購入を開いた');
  }

  function openMemberPick(item, onPick){
    ensurePopups();
    const list = $('shopMemberPickList');
    if (!list) return;

    list.innerHTML = '';

    const names = getMemberNames();
    (['A','B','C']).forEach(id=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'memberPickBtn';
      btn.textContent = names[id] || id;
      btn.addEventListener('click', ()=>{
        closePop(popPick);
        if (typeof onPick === 'function') onPick(id);
      });
      list.appendChild(btn);
    });

    openPop(popPick);
  }

  // ===== Coach Skill Shop =====
  function readCoachOwned(){
    return readJSON(KEY_COACH_SKILLS_OWNED, {});
  }
  function writeCoachOwned(obj){
    writeJSON(KEY_COACH_SKILLS_OWNED, obj || {});
  }

  function openCoachShop(){
    // ガチャ結果は隠す
    if (dom.shopResult) dom.shopResult.style.display = 'none';

    // ガチャセクション隠す
    const panel = dom.screen?.querySelector('.teamPanel');
    const sections = panel ? Array.from(panel.querySelectorAll('.teamSection')) : [];
    const gachaSection = sections[sections.findIndex(s=> s.querySelector('#btnGacha1'))] || sections[0] || null;
    if (gachaSection) gachaSection.style.display = 'none';

    showDynamicSection('コーチスキル購入（購入のみ）');
    const body = $('shopDynamicBody');
    if (!body) return;

    body.innerHTML = '';

    const owned = readCoachOwned();

    const list = document.createElement('div');
    list.className = 'shopList';

    COACH_SKILLS.forEach(skill=>{
      const row = document.createElement('div');
      row.className = 'shopItemRow coachSkillRow';

      const left = document.createElement('div');
      left.className = 'shopItemLeft';

      const top = document.createElement('div');
      top.className = 'coachSkillTop';

      const name = document.createElement('div');
      name.className = 'coachSkillName';
      name.textContent = skill.name;

      const meta = document.createElement('div');
      meta.className = 'coachSkillMeta';
      const cnt = Number(owned[skill.id]) || 0;
      meta.textContent = `所持：${cnt}`;

      top.appendChild(name);
      top.appendChild(meta);

      const eff = document.createElement('div');
      eff.className = 'coachSkillEffects';
      eff.textContent = `表示効果：${skill.effectShow}\n実際の効果：${skill.effectReal}`;

      const quote = document.createElement('div');
      quote.className = 'coachSkillQuote';
      quote.textContent = `コーチのセリフ：「${skill.quote}」`;

      left.appendChild(top);
      left.appendChild(eff);
      left.appendChild(quote);

      const right = document.createElement('div');
      right.className = 'shopItemRight';

      const price = document.createElement('div');
      price.className = 'shopPrice';
      price.textContent = `${fmtG(skill.price)}G`;

      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'shopBuyBtn';
      buy.textContent = '購入';
      buy.disabled = (getGold() < skill.price);

      buy.addEventListener('click', ()=>{
        confirmPop(`${skill.price}Gです購入しますか？`, ()=>{
          if (!spendGold(skill.price)){
            resultPop('Gが足りません。', '所持Gを確認してください。', ()=>{});
            return;
          }
          const o = readCoachOwned();
          o[skill.id] = (Number(o[skill.id]) || 0) + 1;
          writeCoachOwned(o);

          setRecent(`ショップ：コーチスキル「${skill.name}」を購入した`);
          resultPop(
            `「${skill.name}」を購入しました！`,
            `所持：${o[skill.id]}`,
            ()=>{
              // ここは自動で閉じない（要件：購入のみ）
              openCoachShop();
            }
          );
        });
      });

      right.appendChild(price);
      right.appendChild(buy);

      row.appendChild(left);
      row.appendChild(right);

      list.appendChild(row);
    });

    body.appendChild(list);

    const note = document.createElement('div');
    note.className = 'shopTiny';
    note.textContent = '※装備・有効化は後日「チーム画面」で実装します（ここでは所持だけ増えます）。';
    body.appendChild(note);

    setRecent('ショップ：コーチスキル購入を開いた');
  }

  // ===== Cards (owned) / gacha =====
  function readOwnedCards(){
    return readJSON(KEY_OWNED_CARDS, {});
  }
  function writeOwnedCards(obj){
    writeJSON(KEY_OWNED_CARDS, obj || {});
  }

  function getCardById(id){
    if (DC?.getById) return DC.getById(id);
    return null;
  }

  function pickRandomCard(){
    // data_cards.js があるならそこから抽選
    // 期待：DC.all または DC.list / DC.getAll() など、環境差があるので広く対応
    let list = null;

    if (Array.isArray(DC?.ALL)) list = DC.ALL;
    else if (Array.isArray(DC?.all)) list = DC.all;
    else if (Array.isArray(DC?.LIST)) list = DC.LIST;
    else if (Array.isArray(DC?.list)) list = DC.list;
    else if (typeof DC?.getAll === 'function') list = DC.getAll();
    else if (typeof DC?.getList === 'function') list = DC.getList();

    if (!Array.isArray(list) || list.length === 0){
      // 最低限のダミー（落とさない）
      return { id:'dummy', name:'カード', rarity:'R', img:null };
    }

    // rarity重み（例）
    const weightByRarity = { N:70, R:22, SR:7, SSR:1 };

    // まず rarity を決める（存在しない場合は全部同率）
    const rarities = Object.keys(weightByRarity);
    let totalW = rarities.reduce((a,k)=>a+(weightByRarity[k]||0),0);

    let r = Math.random() * totalW;
    let pickR = 'R';
    for (const k of rarities){
      r -= (weightByRarity[k] || 0);
      if (r <= 0){ pickR = k; break; }
    }

    const pool = list.filter(c => (c.rarity || c.R || c.rare || c.rank) === pickR);
    const from = (pool.length ? pool : list);
    const c = from[Math.floor(Math.random() * from.length)];

    return {
      id: c.id || c.cardId || c.key || 'unknown',
      name: c.name || c.title || 'カード',
      rarity: c.rarity || c.R || c.rare || c.rank || 'R',
      img: c.img || c.image || c.src || null
    };
  }

  function convertDupToGold(rarity){
    // 11枚目以降の変換G（控えめ）
    const table = { N:50, R:100, SR:300, SSR:800 };
    return table[String(rarity || 'R')] ?? 100;
  }

  function addCardToOwned(card){
    const owned = readOwnedCards();
    const id = String(card.id);
    const cur = Number(owned[id]) || 0;
    const next = cur + 1;

    if (next <= 10){
      owned[id] = next;
      writeOwnedCards(owned);
      return { kept:true, count: next, convertedGold:0 };
    }

    // 11枚目以降：G変換（所持は10固定）
    owned[id] = 10;
    writeOwnedCards(owned);

    const g = convertDupToGold(card.rarity);
    addGold(g);
    return { kept:false, count: 10, convertedGold: g };
  }

  function renderMeta(){
    if (dom.shopGold) dom.shopGold.textContent = fmtG(getGold());
    if (dom.shopCDP) dom.shopCDP.textContent = fmtG(getCDP());
  }

  function showGachaResult(rows){
    // rows: { text, sub }
    if (!dom.shopResult || !dom.shopResultList) return;

    dom.shopResultList.innerHTML = '';
    rows.forEach(r=>{
      const row = document.createElement('div');
      row.className = 'recordRow';
      row.style.display = 'flex';
      row.style.flexDirection = 'column';
      row.style.gap = '4px';

      const t = document.createElement('div');
      t.style.fontWeight = '1000';
      t.textContent = r.text;

      const s = document.createElement('div');
      s.style.fontSize = '12px';
      s.style.opacity = '0.92';
      s.textContent = r.sub || '';

      row.appendChild(t);
      if (r.sub) row.appendChild(s);

      dom.shopResultList.appendChild(row);
    });

    dom.shopResult.style.display = '';
  }

  function doGacha(times, mode){
    // mode: 'normal' or 'sr'
    const t = Number(times) || 1;

    // costs
    if (mode === 'normal'){
      const cost = (t === 10) ? GACHA_COST_10 : GACHA_COST_1;
      if (!spendGold(cost)){
        resultPop('Gが足りません。', `必要：${cost}G`, ()=>{});
        return;
      }
      // CDP加算（通常：引くたび +1）
      setCDP(getCDP() + t);
    }else if (mode === 'sr'){
      // SR以上確定：CDP100消費
      const cdp = getCDP();
      if (cdp < 100){
        resultPop('CDPが足りません。', 'SR以上確定にはCDP100が必要です。', ()=>{});
        return;
      }
      setCDP(cdp - 100);
    }

    const rows = [];
    let convertedSum = 0;

    for (let i=0; i<t; i++){
      let card = pickRandomCard();

      // SR確定のときは、引き直して SR/SSR に寄せる（簡易）
      if (mode === 'sr'){
        let guard = 0;
        while (guard++ < 50){
          const rr = String(card.rarity || 'R');
          if (rr === 'SR' || rr === 'SSR') break;
          card = pickRandomCard();
        }
      }

      const add = addCardToOwned(card);
      convertedSum += add.convertedGold;

      const rarity = String(card.rarity || 'R');
      const name = String(card.name || 'カード');

      if (add.kept){
        rows.push({
          text: `[${rarity}] ${name}（所持 ${add.count}/10）`,
          sub: ''
        });
      }else{
        rows.push({
          text: `[${rarity}] ${name}（11枚目→G変換）`,
          sub: `+${add.convertedGold}G`
        });
      }
    }

    if (convertedSum > 0){
      setRecent(`ガチャ：重複をG変換（+${convertedSum}G）`);
    }else{
      setRecent(`ガチャ：${t}回引いた`);
    }

    showGachaResult(rows);
    renderMeta();
  }

  function bindGacha(){
    if (dom.btnGacha1){
      dom.btnGacha1.addEventListener('click', ()=>{
        doGacha(1, 'normal');
      });
    }
    if (dom.btnGacha10){
      dom.btnGacha10.addEventListener('click', ()=>{
        doGacha(10, 'normal');
      });
    }
    if (dom.btnGachaSR){
      dom.btnGachaSR.addEventListener('click', ()=>{
        doGacha(1, 'sr');
      });
    }

    if (dom.btnShopOk){
      dom.btnShopOk.addEventListener('click', ()=>{
        if (dom.shopResult) dom.shopResult.style.display = 'none';
      });
    }
  }

  // ===== open / close =====
  function open(){
    ensureShopUIContainers();
    renderMeta();

    if (dom.shopResult) dom.shopResult.style.display = 'none';
    hideDynamicSection();

    if (dom.screen){
      dom.screen.classList.add('show');
      dom.screen.setAttribute('aria-hidden', 'false');
    }

    setRecent('ショップを開いた');
  }

  function close(){
    // popupsを閉じる
    if (popConfirm) closePop(popConfirm);
    if (popPick) closePop(popPick);
    if (popResult) closePop(popResult);

    hideBack();

    // dynamicを閉じる
    hideDynamicSection();

    // 結果エリアを隠す
    if (dom.shopResult) dom.shopResult.style.display = 'none';

    if (dom.screen){
      dom.screen.classList.remove('show');
      dom.screen.setAttribute('aria-hidden', 'true');
    }

    setRecent('ショップを閉じた');
  }

  // ===== bind =====
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    // close
    if (dom.close) dom.close.addEventListener('click', close);

    // modalBack は押して閉じない（誤爆防止）
    if (dom.modalBack){
      dom.modalBack.addEventListener('click', (e)=> e.preventDefault(), { passive:false });
    }

    bindGacha();
  }

  function initShopUI(){
    bind();
    renderMeta();
  }

  // expose
  window.MOBBR.initShopUI = initShopUI;
  window.MOBBR.ui.shop = { open, close, render: renderMeta };

  // DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initShopUI);
})();
