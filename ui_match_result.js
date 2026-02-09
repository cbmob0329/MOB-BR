/* =========================================================
   MOB BR - ui_match_result.js (FULL / v2)
   ---------------------------------------------------------
   役割：
   ・Apex風「1試合ごとのresult表示」
   ・20チーム / 40チーム 両対応
   ・お宝 / フラッグ / KP / AP / 順位pt / 合計pt を表示
   ・DOMが無ければ自動生成して必ず動く
   ・画像は基本 cpu/<teamId>.png（プレイヤーは payload.playerImg で上書き可）
   ---------------------------------------------------------
   使い方（例）：
     window.MOBBR.ui.matchResult.open({
       title: 'RESULT',
       subtitle: 'ローカル大会 第1試合',
       matchIndex: 1,
       matchTotal: 5,
       playerTeamId: 'player01',
       playerImg: 'P1.png',
       rows: [
         { place:1, teamId:'local07', name:'三色坊ちゃんズ', placementP:12, kp:3, ap:1, treasure:1, flag:0, total:17 },
         ...
       ],
       championName: '三色坊ちゃんズ'
     });
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  'use strict';

  const MatchResultUI = {};
  window.MOBBR.ui.matchResult = MatchResultUI;

  const CONF = {
    cpuImgBase: 'cpu/',       // 敵チーム画像
    playerImgBase: '',        // プレイヤー画像（直下なら ''）
    defaultCloseLabel: '閉じる'
  };

  if (window.RULES?.UI){
    if (typeof window.RULES.UI.cpuImgBase === 'string') CONF.cpuImgBase = window.RULES.UI.cpuImgBase;
    if (typeof window.RULES.UI.playerImgBase === 'string') CONF.playerImgBase = window.RULES.UI.playerImgBase;
  }

  const ID = {
    screen: 'matchResultScreen',
    title: 'matchResultTitle',
    subtitle: 'matchResultSubtitle',
    meta: 'matchResultMeta',
    list: 'matchResultList',
    close: 'btnCloseMatchResult'
  };

  const $ = (id)=>document.getElementById(id);

  const dom = {
    screen: null,
    title: null,
    subtitle: null,
    meta: null,
    list: null,
    btnClose: null
  };

  // ===== Public =====
  MatchResultUI.open = function(payload){
    ensureDOM();
    render(payload || {});
    dom.screen.classList.add('show');
    dom.screen.setAttribute('aria-hidden','false');
  };

  MatchResultUI.close = function(){
    ensureDOM();
    dom.screen.classList.remove('show');
    dom.screen.setAttribute('aria-hidden','true');
  };

  MatchResultUI.render = function(payload){
    ensureDOM();
    render(payload || {});
  };

  // ===== DOM build =====
  function ensureDOM(){
    if (dom.screen && dom.list) return;

    dom.screen = $(ID.screen);
    dom.title = $(ID.title);
    dom.subtitle = $(ID.subtitle);
    dom.meta = $(ID.meta);
    dom.list = $(ID.list);
    dom.btnClose = $(ID.close);

    if (!dom.screen){
      injectStyleOnce();

      const wrap = document.createElement('div');
      wrap.id = ID.screen;
      wrap.className = 'mobbrResultScreen';
      wrap.setAttribute('aria-hidden','true');

      const card = document.createElement('div');
      card.className = 'mobbrResultCard';

      const head = document.createElement('div');
      head.className = 'mobbrResultHead';

      const h1 = document.createElement('div');
      h1.id = ID.title;
      h1.className = 'mobbrResultTitle';
      h1.textContent = 'RESULT';

      const sub = document.createElement('div');
      sub.id = ID.subtitle;
      sub.className = 'mobbrResultSubtitle';
      sub.textContent = '';

      const meta = document.createElement('div');
      meta.id = ID.meta;
      meta.className = 'mobbrResultMeta';
      meta.textContent = '';

      const btn = document.createElement('button');
      btn.id = ID.close;
      btn.type = 'button';
      btn.className = 'mobbrResultClose';
      btn.textContent = CONF.defaultCloseLabel;

      head.appendChild(h1);
      head.appendChild(sub);
      head.appendChild(meta);
      head.appendChild(btn);

      const list = document.createElement('div');
      list.id = ID.list;
      list.className = 'mobbrResultList';

      card.appendChild(head);
      card.appendChild(list);
      wrap.appendChild(card);
      document.body.appendChild(wrap);

      dom.screen = wrap;
      dom.title = h1;
      dom.subtitle = sub;
      dom.meta = meta;
      dom.list = list;
      dom.btnClose = btn;
    }

    if (!dom.btnClose._mobbrBound){
      dom.btnClose._mobbrBound = true;
      dom.btnClose.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        MatchResultUI.close();
      });
    }

    if (!dom.screen._mobbrBound){
      dom.screen._mobbrBound = true;
      dom.screen.addEventListener('click', (e)=>{
        e.preventDefault();
      });
      const card = dom.screen.querySelector('.mobbrResultCard');
      if (card){
        card.addEventListener('click', (e)=>e.stopPropagation());
      }
    }
  }

  function injectStyleOnce(){
    if (document.getElementById('mobbrResultStyle')) return;
    const st = document.createElement('style');
    st.id = 'mobbrResultStyle';
    st.textContent = `
      .mobbrResultScreen{
        position: fixed; inset: 0;
        display: none;
        background: rgba(0,0,0,.58);
        z-index: 99999;
        padding: 10px;
        box-sizing: border-box;
        overscroll-behavior: contain;
      }
      .mobbrResultScreen.show{ display: flex; align-items: center; justify-content: center; }
      .mobbrResultCard{
        width: min(560px, 96vw);
        max-height: min(86vh, 860px);
        background: rgba(15,18,24,.96);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 18px 50px rgba(0,0,0,.55);
        display: flex;
        flex-direction: column;
      }
      .mobbrResultHead{
        padding: 12px 12px 10px;
        border-bottom: 1px solid rgba(255,255,255,.10);
        position: relative;
      }
      .mobbrResultTitle{
        font-weight: 900;
        letter-spacing: .08em;
        font-size: 16px;
        color: #fff;
      }
      .mobbrResultSubtitle{
        margin-top: 6px;
        font-size: 12px;
        color: rgba(255,255,255,.86);
        line-height: 1.25;
        white-space: pre-wrap;
      }
      .mobbrResultMeta{
        margin-top: 6px;
        font-size: 11px;
        color: rgba(255,255,255,.70);
      }
      .mobbrResultClose{
        position: absolute;
        right: 10px;
        top: 10px;
        padding: 8px 10px;
        font-size: 12px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(255,255,255,.06);
        color: #fff;
      }
      .mobbrResultList{
        padding: 10px 10px 12px;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
      }
      .mobbrResHeaderRow{
        display: grid;
        grid-template-columns: 34px 44px 1fr 52px;
        gap: 8px;
        align-items: center;
        padding: 8px 8px;
        margin-bottom: 6px;
        border-radius: 12px;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.10);
        color: rgba(255,255,255,.78);
        font-size: 11px;
      }
      .mobbrResRow{
        display: grid;
        grid-template-columns: 34px 44px 1fr 52px;
        gap: 8px;
        align-items: center;
        padding: 8px 8px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.03);
        margin-bottom: 8px;
      }
      .mobbrResRow.top1{ background: rgba(255,215,64,.14); border-color: rgba(255,215,64,.24); }
      .mobbrResRow.top2{ background: rgba(210,210,210,.12); border-color: rgba(210,210,210,.20); }
      .mobbrResRow.top3{ background: rgba(205,127,50,.12); border-color: rgba(205,127,50,.20); }
      .mobbrResRow.isPlayer{ background: rgba(0,200,255,.14); border-color: rgba(0,200,255,.24); }

      .mobbrResPlace{
        font-weight: 900;
        color: #fff;
        text-align: center;
        font-size: 13px;
      }
      .mobbrResIcon{
        width: 44px; height: 32px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(0,0,0,.25);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .mobbrResIcon img{
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .mobbrResName{
        font-weight: 800;
        color: #fff;
        font-size: 12px;
        line-height: 1.1;
      }
      .mobbrResSub{
        margin-top: 4px;
        font-size: 11px;
        color: rgba(255,255,255,.78);
        line-height: 1.2;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .mobbrResChip{
        padding: 3px 6px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.05);
      }
      .mobbrResTotal{
        font-weight: 900;
        color: #fff;
        text-align: right;
        font-size: 13px;
      }
      .mobbrResEmpty{
        padding: 16px;
        color: rgba(255,255,255,.78);
        font-size: 12px;
        text-align: center;
      }
    `;
    document.head.appendChild(st);
  }

  // ===== Render =====
  function render(payload){
    const title = String(payload.title || 'RESULT');
    const subtitle = String(payload.subtitle || '');

    const matchIndex = payload.matchIndex != null ? Number(payload.matchIndex) : null;
    const matchTotal = payload.matchTotal != null ? Number(payload.matchTotal) : null;

    const championName = String(payload.championName || payload.champion || '');
    const rows = Array.isArray(payload.rows) ? payload.rows.slice() : [];

    const playerTeamId = payload.playerTeamId != null ? String(payload.playerTeamId) : '';
    const playerImg = (payload.playerImg != null && payload.playerImg !== '') ? String(payload.playerImg) : '';

    dom.title.textContent = title;

    let sub = subtitle;
    if (championName){
      if (sub) sub += '\n';
      sub += `チャンピオン：${championName}`;
    }
    dom.subtitle.textContent = sub;

    dom.meta.textContent = (matchIndex && matchTotal)
      ? `現在：${matchIndex}/${matchTotal}`
      : '';

    dom.list.innerHTML = '';
    dom.list.appendChild(buildHeaderRow());

    if (rows.length === 0){
      const empty = document.createElement('div');
      empty.className = 'mobbrResEmpty';
      empty.textContent = 'resultデータがありません';
      dom.list.appendChild(empty);
      return;
    }

    rows.sort((a,b)=>(Number(a.place)||999)-(Number(b.place)||999));

    for (const r of rows){
      dom.list.appendChild(buildRow(r, playerTeamId, playerImg));
    }
  }

  function buildHeaderRow(){
    const row = document.createElement('div');
    row.className = 'mobbrResHeaderRow';

    const c1 = document.createElement('div');
    c1.textContent = '順位';
    c1.style.textAlign = 'center';

    const c2 = document.createElement('div');
    c2.textContent = '画像';

    const c3 = document.createElement('div');
    c3.textContent = 'チーム / 内訳';

    const c4 = document.createElement('div');
    c4.textContent = '合計';
    c4.style.textAlign = 'right';

    row.appendChild(c1);
    row.appendChild(c2);
    row.appendChild(c3);
    row.appendChild(c4);
    return row;
  }

  function buildRow(r, playerTeamId, playerImg){
    const place = Number(r.place) || 0;
    const teamId = String(r.teamId || '');
    const name = String(r.name || teamId || '---');

    const placementP = num(r.placementP);
    const kp = num(r.kp);
    const ap = num(r.ap);
    const treasure = num(r.treasure);
    const flag = num(r.flag);

    const total = (r.total != null)
      ? num(r.total)
      : (placementP + kp + ap + treasure + flag * 2);

    const row = document.createElement('div');
    row.className = 'mobbrResRow' +
      (place===1?' top1':place===2?' top2':place===3?' top3':'');

    if (playerTeamId && teamId && teamId === playerTeamId){
      row.classList.add('isPlayer');
    }

    const c1 = document.createElement('div');
    c1.className = 'mobbrResPlace';
    c1.textContent = place ? String(place) : '-';

    const c2 = document.createElement('div');
    c2.className = 'mobbrResIcon';

    const img = document.createElement('img');
    img.alt = teamId || name;
    img.loading = 'lazy';
    img.src = resolveTeamImage(teamId, r.image, playerTeamId, playerImg);
    img.onerror = ()=>{ img.style.display='none'; };
    c2.appendChild(img);

    const c3 = document.createElement('div');

    const nm = document.createElement('div');
    nm.className = 'mobbrResName';
    nm.textContent = name;

    const sub = document.createElement('div');
    sub.className = 'mobbrResSub';

    sub.appendChild(chip(`順位pt:${placementP}`));
    sub.appendChild(chip(`K:${kp}`));
    sub.appendChild(chip(`A:${ap}`));
    sub.appendChild(chip(`宝:${treasure}`));
    sub.appendChild(chip(`旗:${flag}`));

    c3.appendChild(nm);
    c3.appendChild(sub);

    const c4 = document.createElement('div');
    c4.className = 'mobbrResTotal';
    c4.textContent = String(total);

    row.appendChild(c1);
    row.appendChild(c2);
    row.appendChild(c3);
    row.appendChild(c4);

    return row;
  }

  function chip(txt){
    const d = document.createElement('div');
    d.className = 'mobbrResChip';
    d.textContent = txt;
    return d;
  }

  function resolveTeamImage(teamId, explicit, playerTeamId, playerImg){
    // 明示画像が来ている場合（そのまま優先）
    if (explicit && typeof explicit === 'string'){
      // assets/ を cpu/ に寄せたい場合だけ変換
      if (explicit.startsWith('assets/')){
        return CONF.cpuImgBase + explicit.slice('assets/'.length);
      }
      return explicit;
    }

    // プレイヤーチームは payload.playerImg を優先
    if (playerTeamId && teamId && teamId === playerTeamId && playerImg){
      if (playerImg.includes('/')) return playerImg;
      return CONF.playerImgBase + playerImg;
    }

    if (!teamId) return '';
    return CONF.cpuImgBase + teamId + '.png';
  }

  function num(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

})();
