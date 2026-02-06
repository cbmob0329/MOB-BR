'use strict';

/*
  MOB BR - ui_training.js v14（フル）

  目的（今回の修正点）：
  1) 「修行開始ボタンが2個」問題に耐性（ID重複があっても1つだけ有効化）
  2) 3人分選択 → 「開始しますか？（1週消費）」or「選び直す」
  3) 開始後は training画面を強制的に閉じ、別ポップアップで結果表示（NEXTのみ）
  4) 結果NEXTで確定（EXP/Lv保存）→ 週進行 → 企業ランクに応じたG獲得ポップ → 反映
  5) 育成画面内に「あと○でLvアップ」+ EXPゲージ（数値＋バー）を表示

  前提：
  - storage.js / data_player.js が読み込まれている
  - #trainingScreen が存在する（存在しない場合は落とさず recent へログのみ）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;

  if (!S || !DP){
    console.warn('[ui_training] storage.js / data_player.js not found');
    return;
  }

  const K = S.KEYS;

  /* =========================
     修行メニュー（確定仕様）
     - 共通：全能力EXP +1
     - 専門修行：対象能力EXP +4（＝共通+1込みで +4 になるように内部調整）
     - 総合演習：全能力EXP +2（＝共通+1込みで +2 になるように内部調整）
  ========================= */
  const TRAININGS = [
    { id:'shoot',  name:'射撃練習',  ups:['aim','agi'] },
    { id:'dash',   name:'ダッシュ',  ups:['agi','hp'] },
    { id:'puzzle', name:'パズル',    ups:['tech','mental'] },
    { id:'battle', name:'実戦練習',  ups:['aim','hp'] },
    { id:'water',  name:'滝修行',    ups:['mental','hp'] },
    { id:'lab',    name:'研究',      ups:['tech','support'] },
    { id:'all',    name:'総合演習',  ups:'all' }
  ];

  /* =========================
     内部状態（保存しない）
  ========================= */
  let selected = { A:null, B:null, C:null }; // {id,name,ups}
  let bound = false;

  /* =========================
     DOM（存在しない場合は作る）
  ========================= */
  const dom = {
    // screen
    screen: $('trainingScreen'),
    closeBtn: $('btnCloseTraining'),

    // date
    trY: $('trY'),
    trM: $('trM'),
    trW: $('trW'),

    // containers
    cards: $('trainingCards'),
    startBtn: $('btnTrainingStart'),

    // result section (旧DOMがあれば使うが、今回結果は別ポップで出す)
    resultSec: $('trainingResultSection'),

    // shared modal back / week pop（あれば利用）
    modalBack: $('modalBack'),
    weekPop: $('weekPop'),
    popTitle: $('popTitle'),
    popSub: $('popSub'),
    btnPopNext: $('btnPopNext'),

    // menu button
    btnTraining: $('btnTraining')
  };

  /* =========================
     企業ランク → 週G（ui_main.jsと同等）
  ========================= */
  function weeklyGoldByRank(rank){
    if (rank >= 1 && rank <= 5) return 500;
    if (rank >= 6 && rank <= 10) return 800;
    if (rank >= 11 && rank <= 20) return 1000;
    if (rank >= 21 && rank <= 30) return 2000;
    return 3000;
  }

  /* =========================
     utils
  ========================= */
  function safeShow(el){ if (el) el.style.display = 'block'; }
  function safeHide(el){ if (el) el.style.display = 'none'; }

  function getDate(){
    return {
      y: S.getNum(K.year, 1989),
      m: S.getNum(K.month, 1),
      w: S.getNum(K.week, 1)
    };
  }

  function setRecent(text){
    S.setStr(K.recent, String(text));
    if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
  }

  function allSelected(){
    return !!(selected.A && selected.B && selected.C);
  }

  function getStoredTeam(){
    let team;
    try{
      const raw = localStorage.getItem(K.playerTeam);
      team = raw ? JSON.parse(raw) : null;
    }catch(e){
      team = null;
    }
    if (!team) team = DP.buildDefaultTeam();
    // 正規化（exp/lvが欠けても壊さない）
    if (Array.isArray(team.members)){
      team.members.forEach(m=>{
        m.exp = DP.normalizeExp(m.exp);
        m.lv  = DP.normalizeLv(m.lv);
        m.stats = DP.normalizeStats(m.stats);
      });
    }
    return team;
  }

  function saveTeam(team){
    try{
      localStorage.setItem(K.playerTeam, JSON.stringify(team));
    }catch(e){
      console.warn('[ui_training] failed to save team', e);
    }
  }

  function advanceWeekAndGold(){
    let { y,m,w } = getDate();

    // 週進行
    w += 1;
    if (w >= 5){
      w = 1;
      m += 1;
      if (m >= 13){
        m = 1;
        y += 1;
      }
    }

    // 週G
    const rank = S.getNum(K.rank, 10);
    const gain = weeklyGoldByRank(rank);
    const gold = S.getNum(K.gold, 0);
    S.setNum(K.gold, gold + gain);

    // date保存
    S.setNum(K.year, y);
    S.setNum(K.month, m);
    S.setNum(K.week, w);

    return { y,m,w, rank, gain };
  }

  /* =========================
     「ボタンが2個」耐性
     - #btnTrainingStart が複数あれば最初の1つだけ生かす
  ========================= */
  function normalizeStartButton(){
    const nodes = document.querySelectorAll('#btnTrainingStart');
    if (!nodes || nodes.length === 0) return null;

    const first = nodes[0];
    // 2個目以降は無効＆視覚的に消す（押しても反応しない問題を根本解決）
    for (let i=1;i<nodes.length;i++){
      const b = nodes[i];
      b.disabled = true;
      b.style.pointerEvents = 'none';
      b.style.opacity = '0';
      b.style.height = '0';
      b.style.margin = '0';
      b.style.padding = '0';
      b.style.border = '0';
    }
    return first;
  }

  /* =========================
     training DOMが無い時は最低限作る
     ※あなたの「既存DOMをそのまま使用」前提だが、壊れにくさ優先で保険
  ========================= */
  function ensureTrainingDom(){
    if (!dom.screen) return;

    // cards container
    if (!dom.cards){
      const holder = dom.screen.querySelector('#trainingCards');
      dom.cards = holder || null;
    }

    // start button
    dom.startBtn = normalizeStartButton() || dom.startBtn;

    // 日付表示
    dom.trY = dom.trY || dom.screen.querySelector('#trY');
    dom.trM = dom.trM || dom.screen.querySelector('#trM');
    dom.trW = dom.trW || dom.screen.querySelector('#trW');

    // close
    dom.closeBtn = dom.closeBtn || dom.screen.querySelector('#btnCloseTraining');

    // もし最低限が欠けていたら、screen内に簡易UIを作る
    if (!dom.cards || !dom.startBtn){
      const panel = dom.screen.querySelector('.trainingPanel') || dom.screen;
      if (!dom.cards){
        const div = document.createElement('div');
        div.id = 'trainingCards';
        panel.appendChild(div);
        dom.cards = div;
      }
      if (!dom.startBtn){
        const btn = document.createElement('button');
        btn.id = 'btnTrainingStart';
        btn.type = 'button';
        btn.textContent = '修行開始（1週消費）';
        btn.disabled = true;
        panel.appendChild(btn);
        dom.startBtn = btn;
      }
      // もう一回正規化
      dom.startBtn = normalizeStartButton() || dom.startBtn;
    }

    // 旧結果セクションは今回使わないので、もしあれば隠す
    if (dom.resultSec) safeHide(dom.resultSec);
  }

  /* =========================
     ポップアップ（結果 / 確認）を動的生成
     - modalBack が既にあるならそれを使う
     - 無ければ自前で背面を作る
  ========================= */
  let backEl = null;
  let confirmPop = null;
  let resultPop = null;

  function ensureBack(){
    backEl = dom.modalBack || backEl;
    if (!backEl){
      backEl = document.createElement('div');
      backEl.className = 'modalBack';
      backEl.id = 'trainingBackAuto';
      document.body.appendChild(backEl);
    }
    // 誤爆で閉じない
    backEl.onclick = (e)=>{ e.preventDefault(); };
  }

  function ensureConfirmPop(){
    if (confirmPop) return;

    confirmPop = document.createElement('div');
    confirmPop.className = 'modalCard';
    confirmPop.id = 'trainingConfirmPop';
    confirmPop.style.display = 'none';

    confirmPop.innerHTML = `
      <div class="modalTitle">修行を開始しますか？</div>
      <div style="font-weight:900; font-size:14px; opacity:.95; line-height:1.35; margin-bottom:12px;">
        ※1週消費します<br>
        ※開始後は取り消せません
      </div>
      <button class="saveBtn" id="btnTrConfirmStart" type="button">開始する（1週消費）</button>
      <button class="dangerBtn" id="btnTrConfirmRedo" type="button" style="margin-top:10px;">選び直す</button>
    `;
    document.body.appendChild(confirmPop);
  }

  function ensureResultPop(){
    if (resultPop) return;

    resultPop = document.createElement('div');
    resultPop.className = 'modalCard';
    resultPop.id = 'trainingResultPop';
    resultPop.style.display = 'none';

    resultPop.innerHTML = `
      <div class="modalTitle" id="trResTitle">結果</div>
      <div id="trResBody" style="font-weight:900; font-size:14px; line-height:1.45; opacity:.98;"></div>
      <button class="closeBtn" id="btnTrResNext" type="button" style="margin-top:14px;">NEXT</button>
    `;
    document.body.appendChild(resultPop);
  }

  function showPop(pop){
    ensureBack();
    safeShow(backEl);
    safeShow(pop);
  }
  function hidePop(pop){
    safeHide(pop);
    // 背面は他で使っている可能性があるので「trainingの自前back」だけ閉じる
    if (backEl && backEl.id === 'trainingBackAuto') safeHide(backEl);
    // 既存modalBackの場合は閉じない（他UIと競合防止）
    if (backEl && backEl.id !== 'trainingBackAuto'){
      // 既存modalBackを使う時は、ここでは消さない（他画面が使う）
    }
  }

  /* =========================
     日付UI
  ========================= */
  function updateDateUI(){
    const d = getDate();
    if (dom.trY) dom.trY.textContent = String(d.y);
    if (dom.trM) dom.trM.textContent = String(d.m);
    if (dom.trW) dom.trW.textContent = String(d.w);
  }

  /* =========================
     EXPゲージUI（メンバーごと）
     - 各能力：Lv / EXP / あと○ / ゲージ
  ========================= */
  function makeGaugeRow(label, lv, exp){
    const need = Math.max(0, 20 - (exp % 20));
    const pct = Math.max(0, Math.min(100, Math.round((exp % 20) / 20 * 100)));

    const row = document.createElement('div');
    row.className = 'trGaugeRow';

    row.innerHTML = `
      <div class="trGaugeTop">
        <div class="trGaugeKey">${label}</div>
        <div class="trGaugeVal">Lv ${lv} / EXP ${exp % 20}（あと ${need}）</div>
      </div>
      <div class="trGaugeBar">
        <div class="trGaugeFill" style="width:${pct}%"></div>
      </div>
    `;
    return row;
  }

  function renderMemberStatusBox(mem){
    const box = document.createElement('div');
    box.className = 'trainingMemberBox';

    const name = document.createElement('div');
    name.className = 'trainingMember';
    name.textContent = mem.name || mem.id;

    const gauges = document.createElement('div');
    gauges.className = 'trGaugeList';

    // exp/lv 正規化済み前提
    DP.STAT_KEYS.forEach(k=>{
      const label = DP.STAT_LABEL?.[k] || k;
      gauges.appendChild(makeGaugeRow(label, mem.lv?.[k] ?? 1, mem.exp?.[k] ?? 0));
    });

    box.appendChild(name);
    box.appendChild(gauges);
    return box;
  }

  /* =========================
     修行メニューUI（メンバーごとに選択）
  ========================= */
  function renderCards(){
    if (!dom.cards) return;

    dom.cards.innerHTML = '';

    const team = getStoredTeam();
    const members = [...(team.members || [])].sort((a,b)=> (a.slot||0)-(b.slot||0));

    members.forEach(mem=>{
      const wrap = document.createElement('div');
      wrap.className = 'trainingCard';

      // 上：名前＋EXP状況（ゲージ）
      wrap.appendChild(renderMemberStatusBox(mem));

      // 下：メニュー
      const menu = document.createElement('div');
      menu.className = 'trainingMenuList';

      TRAININGS.forEach(tr=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'trainingMenuBtn';
        btn.textContent = tr.name;

        if (selected[mem.id]?.id === tr.id) btn.classList.add('selected');

        btn.addEventListener('click', ()=>{
          selected[mem.id] = tr;

          // 再描画（selected反映）
          renderCards();

          // 全員決定したら開始ボタン有効
          if (dom.startBtn) dom.startBtn.disabled = !allSelected();

          // 3人目が決まった瞬間に確認を出す（ユーザー希望）
          if (allSelected()){
            openConfirm();
          }
        });

        menu.appendChild(btn);
      });

      wrap.appendChild(menu);
      dom.cards.appendChild(wrap);
    });

    if (dom.startBtn) dom.startBtn.disabled = !allSelected();
  }

  /* =========================
     EXP加算テーブルを作る（まだ確定しない）
  ========================= */
  function buildExpAddForTraining(tr){
    const add = {};
    DP.STAT_KEYS.forEach(k => add[k] = 1); // 共通+1

    if (tr.ups === 'all'){
      // 全能力 +2（共通+1 とは別で +1 追加）
      DP.STAT_KEYS.forEach(k => add[k] += 1);
    }else{
      // 専門：対象能力 +4（共通+1に加えて +3 追加）
      tr.ups.forEach(k => add[k] += 3);
    }
    return add;
  }

  function calcPreviewResult(){
    const team = getStoredTeam();
    const members = [...(team.members || [])].sort((a,b)=> (a.slot||0)-(b.slot||0));
    const out = [];

    members.forEach(mem=>{
      const tr = selected[mem.id];
      out.push({
        id: mem.id,
        name: mem.name || mem.id,
        trainingName: tr?.name || '未選択',
        expAdd: tr ? buildExpAddForTraining(tr) : null
      });
    });

    return out;
  }

  /* =========================
     確定処理（結果NEXTで実行）
     - exp/lv 保存
     - 週進行
     - G付与
  ========================= */
  function commit(result){
    // 1) team取得
    const team = getStoredTeam();

    // 2) exp/lv反映
    (team.members || []).forEach(mem=>{
      const r = result.find(x=>x.id === mem.id);
      if (!r || !r.expAdd) return;

      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      DP.STAT_KEYS.forEach(k=>{
        mem.exp[k] += r.expAdd[k];

        // EXP20ごとにLv+1（余り繰り越し）
        while (mem.exp[k] >= 20){
          mem.exp[k] -= 20;
          mem.lv[k] += 1;
        }
      });
    });

    saveTeam(team);

    // 3) 週進行 + G
    const info = advanceWeekAndGold();

    // 4) recent（文章演出のみ）
    S.setStr(K.recent, '修行完了！チーム全体の地力が少し上がった');

    // 5) 画面反映
    if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
    if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();

    // 6) 週＆G獲得ポップ（既存weekPopがあればそれを使う）
    showWeekGainPop(info);
  }

  function showWeekGainPop(info){
    const title = `${info.y}年${info.m}月 第${info.w}週`;
    const sub = `企業ランク${info.rank}なので ${info.gain}G 手に入れた！`;

    // 既存weekPopが無ければ結果ポップ内で簡易表示して終える
    if (!dom.weekPop || !dom.popTitle || !dom.popSub || !dom.btnPopNext){
      setRecent(sub);
      return;
    }

    // 表示
    if (dom.popTitle) dom.popTitle.textContent = title;
    if (dom.popSub) dom.popSub.textContent = sub;

    // weekPop は pointer-events:none の想定があるので、ボタンは押せるようになっている前提（あなたのCSS/HTMLに合わせる）
    if (dom.modalBack){
      dom.modalBack.style.display = 'block';
      dom.modalBack.setAttribute('aria-hidden', 'false');
    }
    dom.weekPop.style.display = 'block';

    dom.btnPopNext.onclick = ()=>{
      dom.weekPop.style.display = 'none';
      if (dom.modalBack){
        dom.modalBack.style.display = 'none';
        dom.modalBack.setAttribute('aria-hidden', 'true');
      }
      // 週表示更新（trainingを開き直した時に新週を見せたいので）
      updateDateUI();
    };
  }

  /* =========================
     確認ポップ（開始 / 選び直す）
  ========================= */
  function openConfirm(){
    ensureConfirmPop();
    showPop(confirmPop);

    const btnStart = $('btnTrConfirmStart');
    const btnRedo  = $('btnTrConfirmRedo');

    if (btnRedo){
      btnRedo.onclick = ()=>{
        hidePop(confirmPop);
        // 選び直し：何もしない（選択状態は残すが、ユーザーが直せる）
      };
    }

    if (btnStart){
      btnStart.onclick = ()=>{
        hidePop(confirmPop);
        // 開始：training画面は強制的に閉じる
        close();

        // 結果ポップへ
        const res = calcPreviewResult();
        openResult(res);
      };
    }
  }

  /* =========================
     結果ポップ（NEXTのみ）
  ========================= */
  function openResult(result){
    ensureResultPop();

    const titleEl = $('trResTitle');
    const bodyEl  = $('trResBody');
    const nextBtn = $('btnTrResNext');

    if (titleEl) titleEl.textContent = '修行結果';
    if (bodyEl){
      bodyEl.innerHTML = '';

      // ログ仕様：文章演出のみ（%等は出さない）
      const p0 = document.createElement('div');
      p0.textContent = '修行完了！全能力に共通ボーナス +1 EXP';
      bodyEl.appendChild(p0);

      bodyEl.appendChild(document.createElement('div')).style.height = '10px';

      result.forEach(r=>{
        const line = document.createElement('div');
        line.style.marginBottom = '8px';
        line.textContent = `${r.name}は${r.trainingName}に集中した！`;
        bodyEl.appendChild(line);

        // 成長した能力（文章のみ）
        if (r.expAdd){
          if (selected[r.id]?.ups === 'all'){
            const l2 = document.createElement('div');
            l2.style.opacity = '.95';
            l2.textContent = '総合演習で、全能力が少し伸びた！';
            bodyEl.appendChild(l2);
          }else{
            const ups = selected[r.id]?.ups || [];
            ups.forEach(k=>{
              const l2 = document.createElement('div');
              l2.style.opacity = '.95';
              l2.textContent = `${DP.STAT_LABEL?.[k] || k}が成長した！`;
              bodyEl.appendChild(l2);
            });
          }
        }
      });

      bodyEl.appendChild(document.createElement('div')).style.height = '10px';

      const pLast = document.createElement('div');
      pLast.textContent = 'チーム全体の地力が少し上がった';
      bodyEl.appendChild(pLast);
    }

    showPop(resultPop);

    // NEXTのみ：ここで確定（保存＋週進行＋G）
    if (nextBtn){
      nextBtn.onclick = ()=>{
        hidePop(resultPop);
        commit(result);
      };
    }
  }

  /* =========================
     open / close
  ========================= */
  function open(){
    // trainingScreen が無いなら壊さない
    if (!dom.screen){
      setRecent('育成：未実装（trainingScreenが見つかりません）');
      return;
    }

    // 初期化
    selected = { A:null, B:null, C:null };

    ensureTrainingDom();
    updateDateUI();

    // 表示
    dom.screen.classList.add('show');
    dom.screen.setAttribute('aria-hidden', 'false');

    // 旧結果セクションは使わないので隠す
    if (dom.resultSec) safeHide(dom.resultSec);

    renderCards();
  }

  function close(){
    if (!dom.screen) return;
    dom.screen.classList.remove('show');
    dom.screen.setAttribute('aria-hidden', 'true');
  }

  /* =========================
     bind
  ========================= */
  function bind(){
    if (bound) return;
    bound = true;

    // メニューの「育成」ボタンから開けるようにする（ui_main側が壊れてても開ける保険）
    if (dom.btnTraining){
      dom.btnTraining.addEventListener('click', ()=>{
        open();
      });
    }

    if (dom.closeBtn){
      dom.closeBtn.addEventListener('click', ()=>{
        // 選択途中は破棄扱い（保存無し）＝安全
        close();
      });
    }

    // 修行開始ボタン（全員選択後に押す場合も想定）
    ensureTrainingDom();
    if (dom.startBtn){
      dom.startBtn.addEventListener('click', ()=>{
        if (!allSelected()) return;
        openConfirm();
      });
    }
  }

  function initTrainingUI(){
    // DOM参照更新（タイトル→NEXTの動的ロード対策）
    dom.screen = $('trainingScreen');
    dom.closeBtn = $('btnCloseTraining');
    dom.trY = $('trY'); dom.trM = $('trM'); dom.trW = $('trW');
    dom.cards = $('trainingCards');
    dom.startBtn = $('btnTrainingStart');
    dom.resultSec = $('trainingResultSection');
    dom.modalBack = $('modalBack');
    dom.weekPop = $('weekPop');
    dom.popTitle = $('popTitle');
    dom.popSub = $('popSub');
    dom.btnPopNext = $('btnPopNext');
    dom.btnTraining = $('btnTraining');

    bind();
  }

  // expose
  window.MOBBR.initTrainingUI = initTrainingUI;
  window.MOBBR.ui.training = { open, close };

  // 動的ロードでも確実に初期化
  initTrainingUI();
})();
