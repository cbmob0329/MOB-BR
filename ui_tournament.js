/* ui_tournament.js v3（フル）
   - チーム紹介は大会開始前（match1のintro）だけ表示 → 試合が始まったら消す
   - 画像ロード待ち：
      ・接敵→VS演出の間に左右チーム画像をプリロード
      ・移動は ido.png → 次エリア背景をプリロード → 到着演出
   - ログは「流し切ってから」勝敗演出を出す
   - 勝敗演出は2秒固定表示→NEXTを表示
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

      const displayPower = (t.isPlayer ? t.power : t.power);
      name.textContent = (t.isPlayer?'★ ':'') + (t.name || t.id);
      tag.textContent = `総合戦闘力 ${displayPower}`;

      row.appendChild(name);
      row.appendChild(tag);
      sc.appendChild(row);
    }
  }

  // ===== 演出：接敵→VS =====
  async function contactAndPreload(playerTeamName, enemyTeamName, playerImg, enemyImg){
    // 先にプリロード開始
    const p1 = preloadImage(playerImg);
    const p2 = preloadImage(enemyImg);

    showBattleBanner('接敵!!');
    await sleep(600);

    showBattleBanner(`${playerTeamName}  VS  ${enemyTeamName}!!`);
    // この間にロード完了させる
    await Promise.all([p1,p2]);
    await sleep(700);

    showBattleBanner(''); // 消す
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
    // ランダムで10個、表示→消えるを繰り返し
    const pick = [];
    const src = BATTLE_LINES.slice();
    for(let i=0;i<10;i++){
      const j = (Math.random()*src.length)|0;
      pick.push(src.splice(j,1)[0]);
    }

    for(const line of pick){
      setCenter3('', '', line);
      await sleep(140);
      setCenter3('', '', '');
      await sleep(90);
    }
  }

  // ===== 移動：ido→次エリア画像ロード→到着 =====
  async function moveSequence(flow, player){
    setBg('maps/neonmain.png','ido.png');
    setCenter3('','', '安置が縮む…移動開始！');
    await sleep(700);

    const info = flow.getAreaInfo(player.areaId);
    // 次エリア背景のロード待ち
    await preloadImage(info.img);

    // 到着：squareBgを次エリアへ
    setBg('maps/neonmain.png', info.img);
    setCenter3('', '', `${info.name} へ到着！`);
    await sleep(650);
  }

  // ===== NEXT処理（状態機械はここ）=====
  async function onNext(){
    if (busy) return;
    const flow = window.MOBBR?.sim?.tournamentFlow;
    if (!flow) return;

    const st = flow.getState();
    if (!st) return;

    busy = true;
    try{
      // intro：チーム紹介（match1だけ）
      if (st.phase === 'intro'){
        // 背景：大会背景→tent
        setBg('maps/neonmain.png', 'tent.png');
        setBanner(`ローカル大会（試合 ${st.matchIndex}/5）`, '本日の出場チーム');
        setMeta('');
        setCenter3('本日の出場チームをご紹介！','','');
        renderTeamIntroList(st);

        st.phase = 'coach';
        render();
        return;
      }

      // coach：使用するコーチスキルを選択（超簡易：今は「使わない」or装備先頭だけ）
      if (st.phase === 'coach'){
        clearTeamList();

        const equipped = flow.getEquippedCoachList();
        // まずは「使わない」優先（現状UI未実装のため）
        flow.setCoachSkill(''); // 使わない
        setCenter3('それでは試合を開始します！','使用するコーチスキルを選択してください！','（現状：使わない）');
        await sleep(700);

        if (equipped.length){
          // 装備があるなら先頭を「選んだことにする」でも良いが、誤動作を避けて今は使わない固定
        }

        st.phase = 'drop';
        render();
        return;
      }

      // drop：降下開始→エリア表示
      if (st.phase === 'drop'){
        flow.initMatchDrop();
        const p = st.teams.find(t=>t.isPlayer);
        const info = flow.getAreaInfo(p.areaId);

        setBg('maps/neonmain.png','tent.png');
        setCenter3('バトルスタート！','降下開始…！','');
        await sleep(850);

        // 降下先へ
        await preloadImage(info.img);
        setBg('maps/neonmain.png', info.img);

        const contested = st.playerContestedAtDrop;
        setCenter3(`${info.name} に降下完了。周囲を確認…`, contested ? '被った…敵影がいる！' : '静かだ…', 'IGLがコール！戦闘準備！');
        await sleep(900);

        st.phase = 'round';
        st.round = 1;
        render();
        return;
      }

      // round：R1〜R6
      if (st.phase === 'round'){
        const r = st.round;

        // R6：背景を最終へ固定
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

        // イベント（プレイヤーだけ表示。回数は仕様通り）
        const player = st.teams.find(t=>t.isPlayer);
        const eCount = (r===1)?1:((r>=2&&r<=5)?2:0);

        for(let i=0;i<eCount;i++){
          if (player && !player.eliminated){
            const ev = flow.applyEventForTeam(player);
            if (ev){
              // 3段固定＋アイコン演出は今はテキストのみ（画像はcss側で拡張可）
              setCenter3(ev.log1, ev.log2, ev.log3);
              await sleep(850);
            }
          }
        }

        // 交戦（処理→表示）
        const sim = flow.simulateCurrentRound();
        const results = sim.results || [];

        // プレイヤーが絡む交戦だけ表示（CPU同士は裏処理）
        // ※ resolveBattle のwinner/loserを results から拾う（順序は matches 順）
        const matches = (flow.getState().teams||[]); // 最新参照
        const pNow = st.teams.find(t=>t.isPlayer);

        // 簡易：このラウンドでプレイヤー戦が起きたら「最後のres」で判定（1回想定）
        let playerRes = null;
        if (results.length){
          // どれがプレイヤー戦か：winnerId/loserId が PLAYER を含むもの
          playerRes = results.find(x=>x.winnerId==='PLAYER' || x.loserId==='PLAYER') || null;
        }

        if (pNow && !pNow.eliminated && playerRes){
          // 敵チームIDを特定
          const enemyId = (playerRes.winnerId === 'PLAYER') ? playerRes.loserId : playerRes.winnerId;
          const enemy = st.teams.find(t=>t.id===enemyId);

          // 左右画像セット（ロード前の演出）
          const pImg = flow.getPlayerSkin();
          const eImg = `${enemyId}.png`; // 仕様：teamIdと同名png（ルートはプロジェクト直下想定）
          // ※ cpuフォルダ配下なら `${DataCPU.getAssetBase()}/${enemyId}.png` へ変更してください（今は仕様に合わせて直下）

          await contactAndPreload(pNow.name, enemy.name, pImg, eImg);

          setChars(pImg, eImg);
          setNameBoxes(pNow.name,'', enemy.name,'');

          // バトル背景：プレイヤーの現在Area
          const info = flow.getAreaInfo(pNow.areaId);
          await preloadImage(info.img);
          setBg('maps/neonmain.png', info.img);

          // battle開始バナー
          showBattleBanner('BATTLE!!');
          await sleep(350);
          showBattleBanner('');

          // ログを流し切る
          await runBattleLog();

          // 勝敗演出（2秒固定表示→NEXT）
          const win = (playerRes.winnerId === 'PLAYER');
          showBattleBanner(win ? 'WIN!!' : 'LOSE..');
          setCenter3('', '', win ? 'よし！次に備えるぞ！' : 'やられた..');
          await sleep(2000);
          showBattleBanner('');

          // プレイヤーが全滅してたら：高速処理→resultへ
          const pAfter = st.teams.find(t=>t.isPlayer);
          if (pAfter && pAfter.eliminated){
            flow.fastForwardMatchEnd();
            st.phase = 'result';
            render();
            return;
          }
        }

        // Round終了：移動（R1-5）
        if (r <= 5){
          const p = st.teams.find(t=>t.isPlayer);
          if (p && !p.eliminated){
            await moveSequence(flow, p);
          }
        }

        // 次ラウンドへ
        flow.advanceRoundCounter();
        st.round += 1;

        // R6が終わったらresult
        if (st.round >= 7){
          flow.finishMatchAndBuildResult();
          st.phase = 'result';
        }

        render();
        return;
      }

      // result：1試合リザルト（テーブル表示）
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

        // 次の試合へ or 大会終了
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

      // nextMatch：次の試合へ
      if (st.phase === 'nextMatch'){
        flow.startNextMatch();
        st.phase = 'drop'; // チーム紹介は最初だけなのでskip
        setBg('maps/neonmain.png','tent.png');
        setCenter3(`試合 ${st.matchIndex}/5 を開始します！`,'','');
        await sleep(650);
        render();
        return;
      }

      // tournamentEnd：終了→メインへ
      if (st.phase === 'tournamentEnd'){
        close();
        window.dispatchEvent(new Event('mobbr:goTitle'));
        return;
      }

    } finally{
      busy = false;
    }
  }

  function render(){
    const flow = window.MOBBR?.sim?.tournamentFlow;
    if (!flow) return;

    const st = flow.getState();
    if (!st) return;

    ensureRoot();

    // meta
    setMeta(`試合 ${st.matchIndex}/5  /  R${st.round||1}  /  ${st.phase||''}`);

    // bg
    setBg('maps/neonmain.png', st.ui?.squareBg || 'tent.png');

    // banner
    setBanner(st.bannerLeft||'ローカル大会', st.bannerRight||'');

    // chars
    const pSkin = flow.getPlayerSkin();
    setChars(pSkin, st.ui?.rightImg || '');

    // 初期：名前箱は消しておく（戦闘時だけ入る）
    if (st.phase !== 'round'){
      setNameBoxes('','','','');
      setChars(pSkin,'');
      showBattleBanner('');
    }

    // introのときだけ一覧を描画（それ以外はUI側で消す）
    if (st.phase === 'intro'){
      renderTeamIntroList(st);
    }else if (st.phase !== 'result'){
      clearTeamList();
    }

    // center3は状況により onNext が上書きするので、空なら最低限
    if (!root.querySelector('.tuiLogL1').textContent &&
        !root.querySelector('.tuiLogL2').textContent &&
        !root.querySelector('.tuiLogL3').textContent){
      setCenter3('','','');
    }

    // nextボタン（常時表示だがbusy中は無効）
    const btn = root.querySelector('.tuiBtn');
    btn.disabled = !!busy;
  }

  window.MOBBR.ui.tournament = { open, close, render };

  // app.js が呼ぶ初期化口
  window.MOBBR.initTournamentUI = function(){
    ensureRoot();
    close();
  };

})();
