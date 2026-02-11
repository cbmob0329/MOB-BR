'use strict';

/*
  MOB BR - ui_tournament.js v3（フル）
  ローカル大会：B（表示UI）
  - sim_tournament_flow.js の state を受け取って描画
  - 画像：
    * 降下：tent.png
    * 移動：ido.png
    * エリア：maps/<areaPng>（無ければ黒背景で継続）
    * プレイヤー絵：P1.png（現状固定。将来P?.pngへ）
    * CPUチーム絵：cpu/<teamId>.png
    * 戦闘：brbattle.png / brwin.png / brlose.png
    * お宝/フラッグ等：bup.png / bdeba.png / bgeta.png / bgetb.png
  - ログ：
    * 中央ログ枠（tuiLog）
    * 内部%は出さない
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const Flow = () => window.MOBBR?.sim?.tournamentFlow;

  const PLAYER_IMG = 'P1.png'; // 将来：装備中P?.pngへ
  const CPU_IMG_BASE = 'cpu/';

  // areaId -> 画像（最低限。必要なら増やせる）
  // ここは「maps/」配下にある想定（無ければ黒で動く）
  function areaPng(areaId){
    const n = Number(areaId)||0;
    // 例：Area25は neonfinal.png 推奨（仕様）
    if (n === 25) return 'neonfinal.png';
    // それ以外は area<n>.png 形式で探す（無ければ表示は黒のままでもOK）
    return `area${n}.png`;
  }

  const $ = (sel) => document.querySelector(sel);

  let state = null;
  let root = null;

  let autoTimer = null;
  let autoOn = false;

  let battleTalkTimer = null;
  let battleTalkIndex = 0;
  let battleTalkList = [];

  function ensureRoot(){
    if (root) return root;

    root = document.createElement('div');
    root.className = 'mobbrTui';
    root.setAttribute('aria-hidden','true');

    root.innerHTML = `
      <div class="tuiBg" aria-hidden="true"></div>
      <div class="tuiWrap">
        <div class="tuiTop">
          <div>
            <div class="tuiTitle" id="tuiTitle">大会</div>
            <div class="tuiMeta" id="tuiMeta">-</div>
          </div>
          <button class="tuiClose" id="tuiClose" type="button">閉じる</button>
        </div>

        <div class="tuiCenter">
          <div class="tuiSquare">
            <div class="tuiSquareBg" id="tuiSquareBg"></div>

            <div class="tuiSquareInner">
              <div class="tuiBanner">
                <div class="left" id="tuiBannerL">ローカル大会</div>
                <div class="right" id="tuiBannerR">-</div>
              </div>

              <div class="tuiScroll" id="tuiScroll"></div>

              <div class="tuiLog">
                <div class="tuiLogMain" id="tuiLogMain">-</div>
                <div class="tuiLogSub" id="tuiLogSub"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="tuiBottom">
          <button class="tuiBtn" id="tuiNext" type="button">NEXT</button>
          <button class="tuiBtn tuiBtnGhost" id="tuiAuto" type="button">AUTO：OFF</button>
        </div>
      </div>

      <!-- team image preview -->
      <div class="tuiImgModal" id="tuiImgModal" aria-hidden="true" style="display:none;">
        <div class="tuiImgCard">
          <div class="tuiImgTitle" id="tuiImgTitle">チーム</div>
          <img id="tuiImgEl" src="" alt="team" />
          <button class="tuiClose" id="tuiImgClose" type="button" style="margin-top:10px;width:100%;">閉じる</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // close
    const btnClose = $('#tuiClose');
    if (btnClose){
      btnClose.addEventListener('click', close);
    }

    // next
    const btnNext = $('#tuiNext');
    if (btnNext){
      btnNext.addEventListener('click', () => {
        stopBattleTalk();
        stepNext();
      });
    }

    // auto
    const btnAuto = $('#tuiAuto');
    if (btnAuto){
      btnAuto.addEventListener('click', () => {
        autoOn = !autoOn;
        renderAuto();
        if (autoOn) startAuto();
        else stopAuto();
      });
    }

    // img modal close
    const imgClose = $('#tuiImgClose');
    if (imgClose){
      imgClose.addEventListener('click', hideTeamImage);
    }
    const imgModal = $('#tuiImgModal');
    if (imgModal){
      imgModal.addEventListener('click', (e) => {
        if (e.target === imgModal) hideTeamImage();
      });
    }

    return root;
  }

  function open(st){
    ensureRoot();
    state = st;

    root.classList.add('isOpen');
    root.setAttribute('aria-hidden','false');

    // 初期画面
    setBg('tent.png');
    setTitle('ローカル大会');
    setMeta('20チーム');
    setBanner('ローカル大会', '降下開始');
    setLog('バトルスタート！', '降下開始…！');

    // スクロール：参加チーム一覧
    renderTeamList();

    autoOn = false;
    renderAuto();
    stopAuto();
    stopBattleTalk();

    // 初回は Flow.next が drop->round に進める
  }

  function close(){
    stopAuto();
    stopBattleTalk();

    if (!root) return;
    root.classList.remove('isOpen');
    root.setAttribute('aria-hidden','true');

    // 事故防止：pointerEvents切る
    root.style.pointerEvents = 'none';
    setTimeout(()=>{ if(root) root.style.pointerEvents='auto'; }, 30);
  }

  function render(st){
    state = st || state;
    if (!state) return;

    const snap = Flow()?.getStateSnapshot ? Flow().getStateSnapshot(state) : null;
    const r = snap?.round || state.round || 1;

    setTitle('ローカル大会');
    setMeta(`Round ${r} / 生存 ${snap?.aliveCount ?? '-'} チーム`);

    // phaseごとの表示
    if (state.phase === 'drop'){
      setBg('tent.png');
      setBanner('降下', `Round ${r}`);
      setLog('降下完了。周囲を確認…', '');
      renderTeamList(true); // 参加一覧
      return;
    }

    if (state.phase === 'round'){
      // Round中：基本はプレイヤーのエリア背景
      const player = (snap?.teams || []).find(t=>t.isPlayer);
      if (player){
        setBg(`maps/${areaPng(player.areaId)}`);
      }else{
        setBg('tent.png');
      }
      setBanner(`Round ${r}`, '交戦開始');
      renderTeamList(false);
      // lastBattleがプレイヤー戦なら戦闘演出を出す
      if (snap?.lastBattle?.isPlayerBattle && snap.lastBattle.winnerId){
        renderBattleView(snap);
      }else{
        // イベントが当たった時は Flow側で state._lastEvents に入る（show=trueのみ出す）
        renderEventIfAny();
      }
      return;
    }

    if (state.phase === 'move'){
      setBg('ido.png');
      setBanner('移動', `Round ${r} 終了`);
      setLog('安置が縮む…移動開始！', 'ルート変更。急げ！');
      renderTeamList(false);
      return;
    }

    if (state.phase === 'result'){
      const champ = snap?.champion;
      setBg('winner.png');
      setBanner('RESULT', '大会終了');
      if (champ){
        setLog(`チャンピオン：${champ.name}`, 'おつかれ！');
      }else{
        setLog('大会終了', '');
      }
      renderTeamList(false);
      return;
    }

    if (state.phase === 'done'){
      setBanner('完了', '');
      setLog('タイトルへ戻れます', '');
      renderTeamList(false);
      return;
    }
  }

  // ===== UI helpers =====
  function setTitle(t){ const el = $('#tuiTitle'); if (el) el.textContent = t; }
  function setMeta(t){ const el = $('#tuiMeta'); if (el) el.textContent = t; }
  function setBanner(l,r){ const elL=$('#tuiBannerL'); const elR=$('#tuiBannerR'); if(elL) elL.textContent=l; if(elR) elR.textContent=r; }
  function setLog(main, sub){
    const elM = $('#tuiLogMain');
    const elS = $('#tuiLogSub');
    if (elM) elM.textContent = String(main||'');
    if (elS) elS.textContent = String(sub||'');
  }
  function setBg(src){
    const bg = $('#tuiSquareBg');
    const back = $('.mobbrTui .tuiBg');
    const url = `url("${src}")`;
    if (bg) bg.style.backgroundImage = url;
    if (back) back.style.backgroundImage = url;
  }

  function renderAuto(){
    const btn = $('#tuiAuto');
    if (!btn) return;
    btn.textContent = autoOn ? 'AUTO：ON' : 'AUTO：OFF';
  }

  function startAuto(){
    stopAuto();
    autoTimer = setInterval(() => {
      // 戦闘トーク中は止める（NEXTで進める）
      if (battleTalkTimer) return;
      stepNext();
    }, 3000);
  }
  function stopAuto(){
    if (autoTimer){
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function stepNext(){
    if (!state) return;
    const f = Flow();
    if (!f || typeof f.next !== 'function'){
      setLog('大会：未実装', 'sim_tournament_flow.js を確認');
      return;
    }
    f.next(state);
    render(state);
  }

  // ===== team list =====
  function renderTeamList(showAll){
    const sc = $('#tuiScroll');
    if (!sc || !state) return;

    const snap = Flow()?.getStateSnapshot ? Flow().getStateSnapshot(state) : null;
    const teams = snap?.teams || [];

    const alive = teams.filter(t=>!t.eliminated);
    const list = showAll ? teams : alive;

    sc.innerHTML = '';

    const note = document.createElement('div');
    note.className = 'tuiNote';
    note.textContent = showAll
      ? '参加チーム（タップで画像）'
      : '生存チーム（タップで画像）';
    sc.appendChild(note);

    for (const t of list){
      const row = document.createElement('div');
      row.className = 'tuiRow';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tuiRowBtn';
      btn.style.touchAction = 'manipulation';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = t.isPlayer ? `★ ${t.name}` : t.name;

      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.textContent = t.eliminated ? '脱落' : `Area ${t.areaId}`;

      btn.appendChild(name);
      btn.appendChild(tag);

      // 画像プレビュー
      btn.addEventListener('click', () => {
        if (t.isPlayer){
          showTeamImage(t.name, PLAYER_IMG);
        }else{
          showTeamImage(t.name, `${CPU_IMG_BASE}${t.teamId}.png`);
        }
      });

      row.appendChild(btn);
      sc.appendChild(row);
    }
  }

  // ===== image modal =====
  function showTeamImage(title, src){
    const modal = $('#tuiImgModal');
    const t = $('#tuiImgTitle');
    const img = $('#tuiImgEl');
    if (!modal || !img) return;

    if (t) t.textContent = title || 'チーム';
    img.src = src;

    modal.style.display = 'grid';
    modal.setAttribute('aria-hidden','false');
  }

  function hideTeamImage(){
    const modal = $('#tuiImgModal');
    const img = $('#tuiImgEl');
    if (!modal) return;
    if (img) img.src = '';
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
  }

  // ===== event display (player only) =====
  function renderEventIfAny(){
    // Flow側の内部（state._lastEvents）を読む：show=true の時だけ表示
    const evs = state?._lastEvents;
    if (!Array.isArray(evs) || !evs.length) return;

    const hit = evs.find(x=>x && x.show);
    if (!hit) return;

    setLog('イベント発生！', hit.event?.name || '');
    // 画像差し替え（あれば）
    const icon = hit.event?.icon;
    if (icon){
      // 背景は維持しつつ、ログsubにセリフ（数値無し）
      const line = pickLine(hit.event?.lines);
      setLog('イベント発生！', line);
    }else{
      const line = pickLine(hit.event?.lines);
      setLog('イベント発生！', line);
    }
  }

  function pickLine(lines){
    if (!Array.isArray(lines) || !lines.length) return '';
    return lines[Math.floor(Math.random()*lines.length)];
  }

  // ===== battle view (player battle only) =====
  function renderBattleView(snap){
    const lb = snap.lastBattle;
    if (!lb) return;

    const a = snap.teams.find(t=>t.teamId===lb.aId);
    const b = snap.teams.find(t=>t.teamId===lb.bId);
    if (!a || !b) return;

    // battle bg: エリア背景（既にセット済み）
    // battle icon
    setLog('交戦！', '');

    // スクロール上部に「左右チーム＋アイコン」っぽい表示を簡易で入れる
    const sc = $('#tuiScroll');
    if (sc){
      sc.innerHTML = '';

      const head = document.createElement('div');
      head.className = 'tuiNote';
      head.textContent = '交戦中（チーム名タップで画像）';
      sc.appendChild(head);

      // 左：プレイヤー、右：敵（どちらがプレイヤーでも崩れない）
      const leftTeam = a.isPlayer ? a : b.isPlayer ? b : a;
      const rightTeam = a.isPlayer ? b : b.isPlayer ? a : b;

      const rowL = mkBattleTeamRow(leftTeam, true);
      const rowR = mkBattleTeamRow(rightTeam, false);

      sc.appendChild(rowL);
      sc.appendChild(rowR);

      const icon = document.createElement('div');
      icon.style.margin = '10px 0';
      icon.style.display = 'grid';
      icon.style.placeItems = 'center';

      const img = document.createElement('img');
      img.src = 'brbattle.png';
      img.alt = 'BATTLE';
      img.style.width = '180px';
      img.style.maxWidth = '60%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.draggable = false;

      icon.appendChild(img);
      sc.appendChild(icon);
    }

    // 戦闘セリフ 10個高速 → 結果表示 → NEXT
    startBattleTalk(() => {
      const winnerId = lb.winnerId;
      const playerWin = !!(winnerId && (a.isPlayer ? winnerId===a.teamId : winnerId===b.teamId));

      if (playerWin){
        // R6勝利→チャンピオン台詞
        if ((snap.round||0) === 6){
          setLog(pickLine(['チャンピオンだ―！！','みんなよくやった！！','獲ったぞー！！']), '');
        }else{
          setLog(pickLine(['よし！次に備えるぞ！','やったー！勝ったぞ！','ナイスー！']), '');
        }
      }else{
        setLog(pickLine(['やられた..','次だ次！','負けちまった..']), '');
      }

      // battle icon swap
      const sc2 = $('#tuiScroll');
      if (sc2){
        const imgs = sc2.querySelectorAll('img');
        // 直近の brbattle.png を brwin/brlose に差し替えたいが、
        // ここでは最後に入れた battle アイコンを探して差し替える
        for (const im of imgs){
          if (im && im.src && im.src.includes('brbattle.png')){
            im.src = playerWin ? 'brwin.png' : 'brlose.png';
            break;
          }
        }
      }
    });
  }

  function mkBattleTeamRow(team, isLeft){
    const row = document.createElement('div');
    row.className = 'tuiRow';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tuiRowBtn';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = team.isPlayer ? `★ ${team.name}` : team.name;

    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.textContent = team.isPlayer ? 'PLAYER' : team.teamId;

    btn.appendChild(name);
    btn.appendChild(tag);

    btn.addEventListener('click', () => {
      if (team.isPlayer) showTeamImage(team.name, PLAYER_IMG);
      else showTeamImage(team.name, `${CPU_IMG_BASE}${team.teamId}.png`);
    });

    row.appendChild(btn);
    return row;
  }

  function startBattleTalk(onDone){
    stopBattleTalk();
    battleTalkIndex = 0;
    battleTalkList = shuffleArray([
      'やってやんべ！','裏取るぞ！','展開する！','サポートするぞ！','うわあー！',
      'ミスった！','一気に行くぞ！','今のうちに回復だ！','絶対勝つぞ！','撃て―！',
      'なんて動きだ！','撃ちまくれ！','グレ使う！','グレ投げろ！','リロードする！',
      '被弾した！','カバー頼む！','大丈夫か!?','走れーー！','耐えるぞー！'
    ]).slice(0,10);

    battleTalkTimer = setInterval(() => {
      if (battleTalkIndex >= battleTalkList.length){
        stopBattleTalk();
        if (typeof onDone === 'function') onDone();
        return;
      }
      const line = battleTalkList[battleTalkIndex++];
      // ウルト固定ログ（今は発動判定を簡易にして、たまに混ぜる）
      if (Math.random() < 0.12){
        setLog('ウルト行くぞ！', '');
      }else{
        setLog(line, '');
      }
    }, 220);
  }

  function stopBattleTalk(){
    if (battleTalkTimer){
      clearInterval(battleTalkTimer);
      battleTalkTimer = null;
    }
  }

  function shuffleArray(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  // expose
  window.MOBBR.initTournamentUI = function(){
    ensureRoot();
  };

  window.MOBBR.ui.tournament = {
    open,
    close,
    render,
  };

})();
