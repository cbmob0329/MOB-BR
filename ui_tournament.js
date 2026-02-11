/* ui_tournament.js v3.1（フル）
   ✅修正点：
   - 「本日の出場チームをご紹介！」を “introStep” で2段階に分離
     1) テキストだけ
     2) チーム一覧スクロール表示
   - その後に coach -> drop へ進む
   - 既存の接敵→VS→プリロード、ログ完走→勝敗2秒→NEXT、ido移動→画像ロード→到着 は維持
*/

'use strict';

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const $ = (id)=>document.getElementById(id);

  function el(tag, cls){
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    return d;
  }

  function sleep(ms){
    return new Promise(r=>setTimeout(r, ms));
  }

  function preloadImage(src){
    return new Promise((resolve)=>{
      if (!src) return resolve(false);
      const img = new Image();
      img.onload = ()=>resolve(true);
      img.onerror = ()=>resolve(false);
      img.src = src;
    });
  }

  // ===== Root =====
  let root = null;
  let busy = false;

  function ensureRoot(){
    if (root) return root;

    root = el('div','mobbrTui');
    root.setAttribute('aria-hidden','true');

    root.innerHTML = `
      <div class="tuiBg"></div>

      <div class="tuiWrap">
        <div class="tuiTop">
          <div class="tuiTitle">ローカル大会</div>
          <div class="tuiMeta"></div>
          <button class="tuiClose" type="button">閉じる</button>
        </div>

        <div class="tuiCenter">
          <div class="tuiSquare">
            <div class="tuiSquareBg"></div>

            <div class="tuiBattleLayer">
              <div class="tuiNameBox left"><div class="team"></div><div class="member"></div></div>
              <div class="tuiNameBox right"><div class="team"></div><div class="member"></div></div>

              <div class="tuiChars">
                <img class="char left" alt="player" draggable="false" />
                <img class="char right" alt="enemy" draggable="false" />
              </div>

              <div class="tuiBattleBanner" aria-hidden="true"></div>
            </div>

            <div class="tuiSquareInner">
              <div class="tuiBanner">
                <div class="left"></div>
                <div class="right"></div>
              </div>

              <div class="tuiScroll"></div>

              <div class="tuiLog">
                <div class="tuiLogL1"></div>
                <div class="tuiLogL2"></div>
                <div class="tuiLogL3"></div>
              </div>
            </div>

          </div>
        </div>

        <div class="tuiBottom">
          <button class="tuiBtn" type="button">次へ</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    root.querySelector('.tuiClose').addEventListener('click', close);
    root.querySelector('.tuiBtn').addEventListener('click', onNext);

    return root;
  }

  function open(){
    const r = ensureRoot();
    r.classList.add('isOpen');
    r.style.display = 'block';
    r.style.pointerEvents = 'auto';
    r.setAttribute('aria-hidden','false');
    render();
  }

  function close(){
    if (!root) return;
    root.classList.remove('isOpen');
    root.style.display = 'none';
    root.style.pointerEvents = 'none';
    root.setAttribute('aria-hidden','true');
  }

  function setCenter3(l1,l2,l3){
    if (!root) return;
    root.querySelector('.tuiLogL1').textContent = String(l1||'');
    root.querySelector('.tuiLogL2').textContent = String(l2||'');
    root.querySelector('.tuiLogL3').textContent = String(l3||'');
  }

  function setBanner(left,right){
    if (!root) return;
    root.querySelector('.tuiBanner .left').textContent = String(left||'');
    root.querySelector('.tuiBanner .right').textContent = String(right||'');
  }

  function setMeta(txt){
    if (!root) return;
    root.querySelector('.tuiMeta').textContent = String(txt||'');
  }

  function setBg(fullBg, squareBg){
    if (!root) return;
    const bg = root.querySelector('.tuiBg');
    const sq = root.querySelector('.tuiSquareBg');
    if (bg) bg.style.backgroundImage = fullBg ? `url("${fullBg}")` : 'none';
    if (sq) sq.style.backgroundImage = squareBg ? `url("${squareBg}")` : 'none';
  }

  function setChars(leftSrc, rightSrc){
    if (!root) return;
    const L = root.querySelector('img.char.left');
    const R = root.querySelector('img.char.right');
    if (L) L.src = leftSrc || '';
    if (R) R.src = rightSrc || '';
  }

  function showBattleBanner(text){
    if (!root) return;
    const b = root.querySelector('.tuiBattleBanner');
    b.textContent = String(text||'');
    b.setAttribute('aria-hidden', text ? 'false' : 'true');
    b.classList.toggle('show', !!text);
  }

  function setNameBoxes(leftTeam,leftMember,rightTeam,rightMember){
    if (!root) return;
    const L = root.querySelector('.tuiNameBox.left');
    const R = root.querySelector('.tuiNameBox.right');
    L.querySelector('.team').textContent = String(leftTeam||'');
    L.querySelector('.member').textContent = String(leftMember||'');
    R.querySelector('.team').textContent = String(rightTeam||'');
    R.querySelector('.member').textContent = String(rightMember||'');
  }

  function clearTeamList(){
    if (!root) return;
    const sc = root.querySelector('.tuiScroll');
    if (sc) sc.innerHTML = '';
  }

  function renderTeamIntroList(st){
    const sc = root.querySelector('.tuiScroll');
    sc.innerHTML = '';

    const teams = (st.teams||[]).slice();
    teams.sort((a,b)=>{
      if (!!b.isPlayer !== !!a.isPlayer) return b.isPlayer?1:-1;
      return String(a.name||'').localeCompare(String(b.name||''),'ja');
    });

    for(const t of teams){
      const row = el('div','tuiRow');
      const name = el('div','name');
      const tag = el('div','tag');

      const displayPower = Number.isFinite(Number(t.power)) ? t.power : '';
      name.textContent = (t.isPlayer?'★ ':'') + (t.name || t.id);
      tag.textContent = `総合戦闘力 ${displayPower}`;

      row.appendChild(name);
      row.appendChild(tag);
      sc.appendChild(row);
    }
  }

  // ===== 演出：接敵→VS（ロード待ち） =====
  async function contactAndPreload(playerTeamName, enemyTeamName, playerImg, enemyImg){
    const p1 = preloadImage(playerImg);
    const p2 = preloadImage(enemyImg);

    showBattleBanner('接敵!!');
    await sleep(600);

    showBattleBanner(`${playerTeamName}  VS  ${enemyTeamName}!!`);
    await Promise.all([p1,p2]);
    await sleep(700);

    showBattleBanner('');
  }

  // ===== 戦闘ログ（高速切替） =====
  const BATTLE_LINES = [
    'やってやんべ！','裏取るぞ！','展開する！','サポートするぞ！','うわあー！',
    'ミスった！','一気に行くぞ！','今のうちに回復だ！','絶対勝つぞ！','撃て―！',
    'なんて動きだ！','撃ちまくれ！','グレ使う！','グレ投げろ！','リロードする！',
    '被弾した！','カバー頼む！','大丈夫か!?','走れーー！','耐えるぞー！',
    'ウルト行くぞ！'
  ];

  async function runBattleLog(){
    const pick = [];
    const src = BATTLE_LINES.slice();
    for(let i=0;i<10;i++){
      const j = (Math.random()*src.length)|0;
      pick.push(src.splice(j,1)[0]);
    }

    for(const line of pick){
      setCenter3('','', line);
      await sleep(140);
      setCenter3('','', '');
      await sleep(90);
    }
  }

  // ===== 移動：ido→次エリア画像ロード→到着 =====
  async function moveSequence(flow, player){
    setBg('maps/neonmain.png','ido.png');
    setCenter3('','', '安置が縮む…移動開始！');
    await sleep(700);

    const info = flow.getAreaInfo(player.areaId);
    await preloadImage(info.img);

    setBg('maps/neonmain.png', info.img);
    setCenter3('','', `${info.name} へ到着！`);
    await sleep(650);
  }

  // ===== NEXT処理 =====
  async function onNext(){
    if (busy) return;
    const flow = window.MOBBR?.sim?.tournamentFlow;
    if (!flow) return;

    const st = flow.getState();
    if (!st) return;

    busy = true;
    try{
      // ===== intro：2段階 =====
      if (st.phase === 'intro'){
        if (!Number.isFinite(st.introStep)) st.introStep = 0;

        // step0：テキストだけ
        if (st.introStep === 0){
          clearTeamList();
          setBg('maps/neonmain.png', 'tent.png');
          setBanner(`ローカル大会（試合 ${st.matchIndex}/5）`, '本日の出場チーム');
          setCenter3('本日の出場チームをご紹介！','','');
          st.introStep = 1;     // 次で一覧
          render();
          return;
        }

        // step1：一覧スクロールを出す（ここで止める）
        if (st.introStep === 1){
          setBg('maps/neonmain.png', 'tent.png');
          setBanner(`ローカル大会（試合 ${st.matchIndex}/5）`, '出場チーム一覧');
          setCenter3('','スクロールで確認してね','NEXTで進行');
          renderTeamIntroList(st);
          st.introStep = 2;     // 次で coachへ
          render();
          return;
        }

        // step2：一覧を消して coachへ
        clearTeamList();
        st.phase = 'coach';
        render();
        return;
      }

      // ===== coach =====
      if (st.phase === 'coach'){
        clearTeamList();

        flow.setCoachSkill(''); // 現状は「使わない」（誤動作防止）
        setCenter3('それでは試合を開始します！','使用するコーチスキルを選択してください！','（現状：使わない）');
        await sleep(700);

        st.phase = 'drop';
        render();
        return;
      }

      // ===== drop =====
      if (st.phase === 'drop'){
        flow.initMatchDrop();
        const p = st.teams.find(t=>t.isPlayer);
        const info = flow.getAreaInfo(p.areaId);

        setBg('maps/neonmain.png','tent.png');
        setCenter3('バトルスタート！','降下開始…！','');
        await sleep(850);

        await preloadImage(info.img);
        setBg('maps/neonmain.png', info.img);

        const contested = !!st.playerContestedAtDrop;
        setCenter3(`${info.name} に降下完了。周囲を確認…`, contested ? '被った…敵影がいる！' : '静かだ…', 'IGLがコール！戦闘準備！');
        await sleep(900);

        st.phase = 'round';
        st.round = 1;
        render();
        return;
      }

      // ===== round =====
      if (st.phase === 'round'){
        const r = st.round;

        if (r === 6){
          const p = st.teams.find(t=>t.isPlayer);
          p.areaId = 25;
          const info = flow.getAreaInfo(25);
          await preloadImage(info.img);
          setBg('maps/neonmain.png', info.img);
          setCenter3('Round 6 開始！最終局面！','','');
          await sleep(700);
        }else{
          setCenter3(`Round ${r} 開始！`,'','');
          await sleep(500);
        }

        // イベント（プレイヤーだけ表示）
        const player = st.teams.find(t=>t.isPlayer);
        const eCount = (r===1)?1:((r>=2&&r<=5)?2:0);

        for(let i=0;i<eCount;i++){
          if (player && !player.eliminated){
            const ev = flow.applyEventForTeam(player);
            if (ev){
              setCenter3(ev.log1, ev.log2, ev.log3);
              await sleep(850);
            }
          }
        }

        // 交戦（処理）
        const sim = flow.simulateCurrentRound();
        const results = sim.results || [];

        // プレイヤー戦のみ表示
        const pNow = st.teams.find(t=>t.isPlayer);
        let playerRes = null;
        if (results.length){
          playerRes = results.find(x=>x.winnerId==='PLAYER' || x.loserId==='PLAYER') || null;
        }

        if (pNow && !pNow.eliminated && playerRes){
          const enemyId = (playerRes.winnerId === 'PLAYER') ? playerRes.loserId : playerRes.winnerId;
          const enemy = st.teams.find(t=>t.id===enemyId);

          const pImg = flow.getPlayerSkin();
          const eImg = `${enemyId}.png`; // ここが違う場合は cpu/${enemyId}.png に変更

          await contactAndPreload(pNow.name, enemy.name, pImg, eImg);

          setChars(pImg, eImg);
          setNameBoxes(pNow.name,'', enemy.name,'');

          const info = flow.getAreaInfo(pNow.areaId);
          await preloadImage(info.img);
          setBg('maps/neonmain.png', info.img);

          showBattleBanner('BATTLE!!');
          await sleep(350);
          showBattleBanner('');

          await runBattleLog();

          const win = (playerRes.winnerId === 'PLAYER');
          showBattleBanner(win ? 'WIN!!' : 'LOSE..');
          setCenter3('', '', win ? 'よし！次に備えるぞ！' : 'やられた..');
          await sleep(2000);
          showBattleBanner('');

          const pAfter = st.teams.find(t=>t.isPlayer);
          if (pAfter && pAfter.eliminated){
            flow.fastForwardMatchEnd();
            st.phase = 'result';
            render();
            return;
          }
        }

        // 移動（R1-5）
        if (r <= 5){
          const p = st.teams.find(t=>t.isPlayer);
          if (p && !p.eliminated){
            await moveSequence(flow, p);
          }
        }

        flow.advanceRoundCounter();
        st.round += 1;

        if (st.round >= 7){
          flow.finishMatchAndBuildResult();
          st.phase = 'result';
        }

        render();
        return;
      }

      // ===== result =====
      if (st.phase === 'result'){
        clearTeamList();

        setBg('maps/neonmain.png','battle.png');
        setBanner(`試合 ${st.matchIndex}/5 RESULT`, '');
        setCenter3('試合終了！','resultを表示します','');

        const sc = root.querySelector('.tuiScroll');
        const rows = (st.lastMatchResultRows||[]).slice().sort((a,b)=>a.placement-b.placement);

        for(const r of rows){
          const row = el('div','tuiRow');
          const name = el('div','name');
          const tag = el('div','tag');

          name.textContent = `${r.placement}位  ${r.squad}`;
          tag.textContent  = `KP${r.KP} / AP${r.AP} / Treasure${r.Treasure} / Flag${r.Flag} / Total${r.Total} / PlacementP${r.PlacementP}`;

          if (r.id === 'PLAYER'){
            row.style.border = '1px solid rgba(255,59,48,.55)';
            row.style.background = 'rgba(255,59,48,.10)';
          }

          row.appendChild(name);
          row.appendChild(tag);
          sc.appendChild(row);
        }

        if (st.matchIndex < st.matchCount){
          st.phase = 'nextMatch';
          setCenter3('NEXTで次の試合へ','','');
        }else{
          st.phase = 'tournamentEnd';
          setCenter3('大会終了','NEXTでメインへ戻ります','');
        }

        render();
        return;
      }

      // ===== nextMatch =====
      if (st.phase === 'nextMatch'){
        flow.startNextMatch();
        st.phase = 'drop'; // チーム紹介は最初だけ
        st.introStep = 99; // 念のため固定
        setBg('maps/neonmain.png','tent.png');
        setCenter3(`試合 ${st.matchIndex}/5 を開始します！`,'','');
        await sleep(650);
        render();
        return;
      }

      // ===== tournamentEnd =====
      if (st.phase === 'tournamentEnd'){
        close();
        window.dispatchEvent(new Event('mobbr:goTitle'));
        return;
      }

    } finally{
      busy = false;
      if (root){
        const btn = root.querySelector('.tuiBtn');
        if (btn) btn.disabled = false;
      }
    }
  }

  function render(){
    const flow = window.MOBBR?.sim?.tournamentFlow;
    if (!flow) return;

    const st = flow.getState();
    if (!st) return;

    ensureRoot();

    setMeta(`試合 ${st.matchIndex}/5  /  R${st.round||1}  /  ${st.phase||''}`);

    setBg('maps/neonmain.png', st.ui?.squareBg || 'tent.png');

    setBanner(st.bannerLeft||'ローカル大会', st.bannerRight||'');

    const pSkin = flow.getPlayerSkin();
    setChars(pSkin, st.ui?.rightImg || '');

    // intro中は一覧を renderTeamIntroList するのでここでは触らない
    // それ以外は基本一覧を消す（result除く）
    if (st.phase !== 'intro' && st.phase !== 'result'){
      clearTeamList();
    }

    if (st.phase !== 'round'){
      setNameBoxes('','','','');
      setChars(pSkin,'');
      showBattleBanner('');
    }

    const btn = root.querySelector('.tuiBtn');
    btn.disabled = !!busy;
  }

  window.MOBBR.ui.tournament = { open, close, render };

  window.MOBBR.initTournamentUI = function(){
    ensureRoot();
    close();
  };

})();
