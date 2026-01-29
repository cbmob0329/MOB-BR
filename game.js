/* game.js (FULL) MOB BR
   - Builds Main Screen DOM to match layout image
   - Supports double-tap selection for Team/Tournament buttons
   - Training carousel (scroll, center highlight)
   - Weekly income (rank-based) + toast
   - Optional loader for other js files (index.html loads only game.js)
*/

(() => {
  'use strict';

  const VERSION = 'v0.1-proto';

  // =========================
  // Assets (file names fixed)
  // =========================
  const IMG = {
    bgMain: 'haikeimain.png',
    logo: 'rogo.png',
    mainSquare: 'main1.png',
    teamImg: 'P1.png',

    btnTeam: 'team.png',
    btnTournament: 'taikai.png',

    // training icons
    train: [
      { key: 'sougou', label: '総合', src: 'sougou.png' },
      { key: 'kenq',   label: '研究', src: 'kenq.png' },
      { key: 'taki',   label: '滝',   src: 'taki.png' },
      { key: 'syageki',label: '射撃', src: 'syageki.png' },
      { key: 'dash',   label: 'ダッシュ', src: 'dash.png' },
      { key: 'paz',    label: 'パズル', src: 'paz.png' },
      { key: 'zitugi', label: '実戦', src: 'zitugi.png' },
    ],

    // shop bg (popup)
    shopBg: 'shop.png',
  };

  // =========================
  // Minimal State (proto)
  // =========================
  const state = {
    year: 1989,
    week: 1, // 1..52
    gold: 0,
    companyName: 'MOB COMPA',
    companyRank: 10,
    teamName: 'PLAYER TEAM',
    nextTournament: { name: 'SP1 ローカル大会', when: '2月第1週' },
    selectedTrainingKey: 'syageki',
  };

  // Income per rank (weekly)
  function weeklyIncomeByRank(rank){
    if (rank >= 1 && rank <= 5) return 500;
    if (rank >= 6 && rank <= 10) return 800;
    if (rank >= 11 && rank <= 20) return 1000;
    if (rank >= 21 && rank <= 30) return 2000;
    return 3000;
  }

  // =========================
  // Optional loader for other JS files
  // =========================
  const EXTRA_SCRIPTS = [
    'ui.js',
    'assets.js',
    'state.js',
    'data_const.js',
    'data_teams_local.js',
    'data_teams_national.js',
    'data_teams_world.js',
    'data_teams_index.js',
    'data_players.js',
    'data_items.js',
    'data_coachskills.js',
    'sim_battle.js',
    'sim_tournament_core.js',
    'sim_rules_sp1.js',
    'sim_rules_sp2.js',
    'sim_rules_champ.js',
  ];

  function loadScriptsSequentially(list){
    return new Promise((resolve) => {
      let i = 0;
      const next = () => {
        if (i >= list.length) return resolve(true);
        const src = list[i++];
        const s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = () => next();
        s.onerror = () => next(); // missing is allowed in proto
        document.head.appendChild(s);
      };
      next();
    });
  }

  // If external init exists, we call it after load; otherwise we run internal init.
  async function boot(){
    // Try to load other files (if present)
    await loadScriptsSequentially(EXTRA_SCRIPTS);

    // If user later defines a full init, prefer it
    if (typeof window.MOBBR_init === 'function'){
      window.MOBBR_init();
      return;
    }
    // Otherwise run proto UI
    initProtoMainUI();
  }

  // =========================
  // DOM helpers
  // =========================
  function el(tag, props = {}, children = []){
    const e = document.createElement(tag);
    for (const [k,v] of Object.entries(props)){
      if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const c of children){
      if (c == null) continue;
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    }
    return e;
  }

  function safeGet(id){
    return document.getElementById(id);
  }

  function ensureAppRoot(){
    let app = safeGet('app');
    if (!app){
      app = el('div', { id:'app' });
      document.body.appendChild(app);
    }
    let root = safeGet('gameRoot');
    if (!root){
      root = el('div', { id:'gameRoot', class:'noselect' });
      app.appendChild(root);
    }
    return root;
  }

  // Create an <img> that swaps to placeholder if file missing
  function imgWithFallback(src, altText, fallbackText){
    const im = new Image();
    im.src = src;
    im.alt = altText || '';
    im.loading = 'eager';
    im.decoding = 'async';
    im.onerror = () => {
      // Replace the image with a simple placeholder block (keeps layout)
      const ph = el('div', {
        style: {
          width: '100%',
          height: '100%',
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
          textAlign: 'center'
        }
      }, [fallbackText || src]);
      im.replaceWith(ph);
    };
    return im;
  }

  // =========================
  // Double-tap handler
  // =========================
  function attachDoubleTap(node, onDoubleTap, onSingleTap){
    let lastTap = 0;
    let singleTimer = null;

    node.addEventListener('click', (ev) => {
      const now = Date.now();
      const dt = now - lastTap;
      lastTap = now;

      if (dt < 320){
        if (singleTimer){ clearTimeout(singleTimer); singleTimer = null; }
        onDoubleTap?.(ev);
      } else {
        if (singleTimer) clearTimeout(singleTimer);
        singleTimer = setTimeout(() => {
          singleTimer = null;
          onSingleTap?.(ev);
        }, 260);
      }
    }, { passive:true });
  }

  // =========================
  // Toast / Modal
  // =========================
  function showIncomeToast(text){
    const t = safeGet('incomeToast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 1200);
  }

  function showCenterMsg(text, ms = 1200){
    const box = safeGet('centerMsg');
    if (!box) return;
    const msg = box.querySelector('.msg');
    if (msg) msg.textContent = text;
    box.classList.add('show');
    if (ms > 0){
      setTimeout(() => box.classList.remove('show'), ms);
    }
  }

  function openOverlay(title, htmlOrNode){
    const ov = safeGet('overlay');
    if (!ov) return;
    ov.innerHTML = '';
    ov.classList.add('show');

    const modal = el('div', { class:'modal' }, [
      el('h2', { text: title }),
      el('div', { class:'closeHint', text: '画面外タップで閉じます' }),
    ]);

    if (typeof htmlOrNode === 'string'){
      const content = el('div', { class:'section' });
      content.innerHTML = htmlOrNode;
      modal.appendChild(content);
    } else if (htmlOrNode instanceof Node){
      modal.appendChild(htmlOrNode);
    }

    ov.appendChild(modal);

    ov.addEventListener('click', (ev) => {
      if (ev.target === ov){
        ov.classList.remove('show');
      }
    }, { once:true });
  }

  // =========================
  // Training Carousel
  // =========================
  function buildTrainingCarousel(){
    const wrap = el('div', { id:'trainCarousel' });

    // Scroll container (horizontal)
    const scroller = el('div', {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '10px 6px',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none'
      }
    });
    scroller.addEventListener('scroll', () => {
      // hide scrollbar (Firefox already handled)
    }, { passive:true });
    scroller.style.msOverflowStyle = 'none';
    scroller.style.scrollbarWidth = 'none';
    scroller.classList.add('trainScroller');

    // Add padding items so first/last can center
    const padW = 90;
    scroller.appendChild(el('div', { style: { flex:`0 0 ${padW}px` } }));

    const items = [];
    for (const t of IMG.train){
      const item = el('div', { class:'trainItem', 'data-key': t.key, style: { scrollSnapAlign:'center' } });
      const im = imgWithFallback(t.src, t.label, t.label);
      item.appendChild(im);

      item.addEventListener('click', () => {
        // snap to this item and select
        item.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
        state.selectedTrainingKey = t.key;
        setTimeout(() => updateTrainingCenterHighlight(scroller, items), 180);
      });

      items.push(item);
      scroller.appendChild(item);
    }

    scroller.appendChild(el('div', { style: { flex:`0 0 ${padW}px` } }));

    // Center highlight detection
    const onScroll = () => updateTrainingCenterHighlight(scroller, items);
    scroller.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive:true });

    // Initial highlight
    setTimeout(() => {
      // try to center selected key
      const target = items.find(n => n.getAttribute('data-key') === state.selectedTrainingKey) || items[3];
      if (target) target.scrollIntoView({ behavior:'auto', inline:'center', block:'nearest' });
      updateTrainingCenterHighlight(scroller, items);
    }, 50);

    wrap.appendChild(scroller);
    return wrap;
  }

  function updateTrainingCenterHighlight(scroller, items){
    const rect = scroller.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;

    let best = null;
    let bestDist = Infinity;

    for (const it of items){
      const r = it.getBoundingClientRect();
      const icx = r.left + r.width / 2;
      const d = Math.abs(icx - cx);
      if (d < bestDist){
        bestDist = d;
        best = it;
      }
    }

    for (const it of items){
      it.classList.toggle('center', it === best);
    }

    if (best){
      state.selectedTrainingKey = best.getAttribute('data-key') || state.selectedTrainingKey;
    }
  }

  // =========================
  // Proto Main UI
  // =========================
  function initProtoMainUI(){
    const root = ensureAppRoot();
    root.innerHTML = '';

    // BG
    const bg = imgWithFallback(IMG.bgMain, 'bg', 'haikeimain.png');
    bg.id = 'bgMain';
    root.appendChild(bg);

    // Version
    root.appendChild(el('div', { id:'versionText', text: `VER ${VERSION}` }));

    // Top left info
    const topInfo = el('div', { id:'topInfo' }, [
      rowKV('企業名：', state.companyName),
      rowKV('企業ランク：', `RANK ${state.companyRank}`),
      rowKV('チーム名：', state.teamName),
    ]);
    root.appendChild(topInfo);

    // Logo
    const logoBox = el('div', { id:'logoBox' });
    const logo = imgWithFallback(IMG.logo, 'logo', 'rogo.png');
    logoBox.appendChild(logo);
    root.appendChild(logoBox);

    // Top band text (red area in layout; NOT red in real)
    const topBand = el('div', { id:'topBand' }, [
      el('div', { class:'bandText', id:'topBandText', text: makeTopBandText() })
    ]);
    root.appendChild(topBand);

    // Left big buttons
    const leftButtons = el('div', { id:'leftButtons' });

    const btnTeam = el('button', { class:'bigBtn', id:'btnTeam', type:'button' }, [
      imgWithFallback(IMG.btnTeam, 'team', 'team.png')
    ]);

    const btnTournament = el('button', { class:'bigBtn', id:'btnTournament', type:'button' }, [
      imgWithFallback(IMG.btnTournament, 'tournament', 'taikai.png')
    ]);

    // Single tap: small hint
    // Double tap: open menu
    attachDoubleTap(
      btnTeam,
      () => openTeamMenu(),
      () => showCenterMsg('【チーム】ダブルタップで選択', 900)
    );
    attachDoubleTap(
      btnTournament,
      () => openTournamentMenu(),
      () => showCenterMsg('【大会】ダブルタップで選択', 900)
    );

    leftButtons.appendChild(btnTeam);
    leftButtons.appendChild(btnTournament);
    root.appendChild(leftButtons);

    // Main Square (main1.png) + team image overlay
    const mainSquare = el('div', { id:'mainSquare' });
    const sqBg = imgWithFallback(IMG.mainSquare, 'mainSquare', 'main1.png');
    sqBg.className = 'squareBg';
    mainSquare.appendChild(sqBg);

    const teamImg = imgWithFallback(IMG.teamImg, 'team', 'P1.png');
    teamImg.className = 'teamImg';
    mainSquare.appendChild(teamImg);

    root.appendChild(mainSquare);

    // Training bar (carousel)
    const trainingBar = el('div', { id:'trainingBar' });
    trainingBar.appendChild(buildTrainingCarousel());
    root.appendChild(trainingBar);

    // Bottom bar (Shop + Training start + Gacha placeholder)
    const bottomBar = el('div', { id:'bottomBar' });

    const btnShop = el('button', { class:'smallBtn', type:'button', text:'ショップ' });
    btnShop.addEventListener('click', () => openShopPopup());

    const btnTraining = el('button', { class:'smallBtn', type:'button', text:'修行開始' });
    btnTraining.addEventListener('click', () => {
      showCenterMsg(`修行開始：${trainingLabelByKey(state.selectedTrainingKey)}（※派遣UIは次で実装）`, 1200);
      advanceWeek();
    });

    const btnGacha = el('button', { class:'smallBtn', type:'button', text:'ガチャ（後日）' });
    btnGacha.addEventListener('click', () => showCenterMsg('ガチャは後日実装', 900));

    bottomBar.appendChild(btnShop);
    bottomBar.appendChild(btnTraining);
    bottomBar.appendChild(btnGacha);
    root.appendChild(bottomBar);

    // Overlay + Center msg + Income toast
    root.appendChild(el('div', { id:'overlay' }));
    root.appendChild(el('div', { id:'centerMsg' }, [
      el('div', { class:'msg', text:'' })
    ]));
    root.appendChild(el('div', { id:'incomeToast', text:'' }));

    // Initial weekly income at start (optional)
    showIncomeToast(`開始：${state.gold}G`);
  }

  function rowKV(label, value){
    return el('div', { class:'row' }, [
      el('div', { class:'label', text: label }),
      el('div', { class:'value', text: value }),
    ]);
  }

  function makeTopBandText(){
    // Must show: year/week + next tournament name/date
    return `${state.year}年 第${state.week}週 / 次：${state.nextTournament.name}（${state.nextTournament.when}）`;
  }

  function refreshTopBand(){
    const t = safeGet('topBandText');
    if (t) t.textContent = makeTopBandText();
  }

  function trainingLabelByKey(key){
    const f = IMG.train.find(x => x.key === key);
    return f ? f.label : key;
  }

  // =========================
  // Week progress + income
  // =========================
  function advanceWeek(){
    // weekly income
    const inc = weeklyIncomeByRank(state.companyRank);
    state.gold += inc;
    showIncomeToast(`+${inc}G獲得！（所持：${state.gold}G）`);

    // advance week
    state.week += 1;
    if (state.week > 52){
      state.week = 1;
      state.year += 1;
      showCenterMsg(`${state.year}年になりました`, 1100);
    }
    refreshTopBand();
  }

  // =========================
  // Menus (proto placeholders)
  // =========================
  function openTeamMenu(){
    const menu = el('div', {}, [
      bigMenuBtn('現在のメンバー', () => openOverlay('現在のメンバー（プロト）', memberProtoTable())),
      bigMenuBtn('チーム編成', () => openOverlay('チーム編成（プロト）', 'A / B / C スロット編成は次で実装します。')),
      bigMenuBtn('戦績', () => openOverlay('戦績（プロト）', '大会結果の履歴表示は sim_rules 側と連動して次で実装します。')),
      bigMenuBtn('オファー', () => openOverlay('オファー（プロト）', 'オファー一覧 → 詳細 → はい/いいえ の流れを次で実装します。')),
      bigMenuBtn('セーブ', () => openOverlay('セーブ（プロト）', 'ローカル保存（LocalStorage）で保存/削除を次で実装します。')),
    ]);
    openOverlay('チーム', menu);
  }

  function openTournamentMenu(){
    const menu = el('div', {}, [
      bigMenuBtn('大会に出場', () => openOverlay('大会に出場（プロト）', '大会期間チェック＆出場確認は次で実装します。')),
      bigMenuBtn('参加中の大会', () => openOverlay('参加中の大会（プロト）', '総合順位/グループ順位の表示は次で実装します。')),
      bigMenuBtn('大会結果', () => openOverlay('大会結果（プロト）', '歴代大会結果・ランキング表示は次で実装します。')),
      bigMenuBtn('スケジュール', () => openOverlay('スケジュール（プロト）', scheduleProto())),
    ]);
    openOverlay('大会', menu);
  }

  function bigMenuBtn(text, fn){
    const b = el('button', { class:'kBtn', type:'button', text });
    b.addEventListener('click', fn);
    return el('div', { class:'kBtnRow' }, [b]);
  }

  function memberProtoTable(){
    // Placeholder table until data_players.js is wired
    const table = el('table', { class:'table' });
    table.innerHTML = `
      <thead>
        <tr>
          <th>名前</th><th>HP</th><th>Mental</th><th>Move</th><th>Aim</th><th>Agility</th><th>Tech</th><th>Support</th><th>Hunt</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>プレイヤー1</td><td>60</td><td>60</td><td>60</td><td>60</td><td>60</td><td>60</td><td>60</td><td>60</td>
        </tr>
        <tr>
          <td>プレイヤー2</td><td>58</td><td>62</td><td>59</td><td>61</td><td>60</td><td>58</td><td>62</td><td>57</td>
        </tr>
        <tr>
          <td>プレイヤー3</td><td>62</td><td>58</td><td>61</td><td>59</td><td>61</td><td>62</td><td>58</td><td>60</td>
        </tr>
      </tbody>
    `;
    const box = el('div', { class:'section' }, [
      el('div', { style:{ fontWeight:'900', marginBottom:'6px', opacity:'.9' }, text:'チーム総合連携（Synergy）：20（初期）' }),
      table,
      el('div', { style:{ marginTop:'8px', opacity:'.75', fontSize:'12px' }, text:'※パッシブ/アビリティ/ウルト詳細は次でデータ連動して表示します' })
    ]);
    return box;
  }

  function scheduleProto(){
    // Display without the "※" notes as requested (proto: only major items)
    const lines = [
      '2月第1週：SP1 ローカル大会',
      '3月第1週：SP1 ナショナル大会',
      '4月第1週：SP1 ワールドファイナル',
      '7月第1週：SP2 ローカル大会',
      '8月第1週：SP2 ナショナル大会',
      '9月第1週：SP2 ワールドファイナル',
      '11月第1週：チャンピオンシップ ローカル大会',
      '12月第1週：チャンピオンシップ ナショナル大会',
      '1月第2週：チャンピオンシップ ワールドファイナル',
    ];
    return `<div style="line-height:1.65;font-weight:800;opacity:.95;">${lines.map(x=>`・${x}`).join('<br>')}</div>`;
  }

  // =========================
  // Shop popup (proto)
  // =========================
  function openShopPopup(){
    const content = el('div', { class:'section' });

    const title = el('div', { style:{ fontWeight:'1000', marginBottom:'8px' }, text:'いらっしゃいませ！' });

    const list = el('div', { style:{ display:'grid', gap:'8px' } });

    const items = [
      ['エナジーグミ', 50],
      ['エナジーチョコ', 100],
      ['エナジーわたあめ', 300],
      ['バニラアイス', 50],
      ['2段アイス', 100],
      ['3段アイス', 300],
      ['たい焼きグレネード', 1000],
      ['アークラムネ', 1000],
      ['ぷくぷくランチャー', 1000],
      ['チュッパチャージ', 5000],
      ['リスポーンオカリナ', 500],
    ];

    items.forEach(([name, price]) => {
      const row = el('div', {
        style:{
          display:'flex',
          justifyContent:'space-between',
          alignItems:'center',
          gap:'10px',
          padding:'8px 10px',
          borderRadius:'12px',
          border:'1px solid rgba(255,255,255,.12)',
          background:'rgba(255,255,255,.06)'
        }
      }, [
        el('div', { style:{ fontWeight:'900' }, text: name }),
        el('button', {
          class:'kBtn',
          type:'button',
          text: `${price}G`
        })
      ]);

      const btn = row.querySelector('button');
      btn.addEventListener('click', () => {
        if (state.gold < price){
          showCenterMsg('Gが足りません', 900);
          return;
        }
        state.gold -= price;
        showCenterMsg(`${name}を購入した！`, 1100);
        showIncomeToast(`所持：${state.gold}G`);
      });

      list.appendChild(row);
    });

    content.appendChild(title);
    content.appendChild(list);

    openOverlay('ショップ', content);
  }

  // Start
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
