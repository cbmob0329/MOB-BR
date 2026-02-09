/* =========================================================
   MOB BR - sim_tournament_national.js (FULL / SPEC-READY)
   ---------------------------------------------------------
   役割：
   ・ナショナル大会（40チーム / A,B,C,D 各10）を進行する
   ・NEXT進行：1試合 → result(20) → 現在総合(40/該当ブロック) → 次の試合
   ・裏ブロックは即時集計（UIなし）
   ・週またぎ（第1週・第2週）と「一度メインに戻る」ポイントを返す
   ---------------------------------------------------------
   依存（推奨）：
   ・window.SimResult.finalizeTournament(teams20) -> {champion, rows[20]}
     - rows[*].total/kp/ap/treasure/flag/teamId/name が入る想定
   ・window.MOBBR.ui.showMatchResult(result, opt)
   ・window.MOBBR.ui.showOverall(standings, opt)
   ・DataTournament（無くても動く：賞金等はここでは扱わない）
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  'use strict';

  const National = {};
  window.MOBBR.sim.tournamentNational = National;

  // ===== blocks (固定) =====
  // 1週目：序盤(A&B 5) + 裏(C&D 5) → メインへ
  // 1週目：中盤      (A&C 5)
  // 2週目：終盤      (B&C 5) + 裏(A&D 5) + (B&D 5)
  const BLOCKS = [
    { id:'N1_AB', week:1, label:'序盤 A & B', g1:'A', g2:'B', matches:5, visible:true,  afterReturnMain:false },
    { id:'N1_CD', week:1, label:'序盤 C & D', g1:'C', g2:'D', matches:5, visible:false, afterReturnMain:true  }, // 表のNEXTでは見せないが、ここで「一度メインへ戻る」契機
    { id:'N1_AC', week:1, label:'中盤 A & C', g1:'A', g2:'C', matches:5, visible:true,  afterReturnMain:false },

    { id:'N2_BC', week:2, label:'終盤 B & C', g1:'B', g2:'C', matches:5, visible:true,  afterReturnMain:false },
    { id:'N2_AD', week:2, label:'終盤 A & D', g1:'A', g2:'D', matches:5, visible:false, afterReturnMain:false },
    { id:'N2_BD', week:2, label:'終盤 B & D', g1:'B', g2:'D', matches:5, visible:true,  afterReturnMain:false },
  ];

  // ===== public =====
  National.create = function(opts){
    const src = Array.isArray(opts?.teams) ? opts.teams : [];
    if (src.length !== 40){
      console.warn('[sim_tournament_national] teams must be 40. got:', src.length);
    }

    const teams = src.map(clone);
    const groups = makeGroups(teams);

    const state = {
      phase: 'national',
      week: 1,

      // 進行カーソル
      blockIndex: 0,     // BLOCKS index
      inBlockMatch: 0,   // 0..matches-1
      matchNoGlobal: 0,  // 0..29

      groups,
      standings: initStandings(teams),

      // 最後の表示用
      lastMatch: null,        // {result, meta}
      lastOverallSlice: null, // standings slice shown

      // 進行フラグ
      finished: false,
      needReturnMain: false, // trueなら「一度メインへ戻る」を促す
    };

    // 裏ブロックを“事前に即時集計”したい場合はここでやれるが、
    // 仕様上「NEXTなしで裏で即時集計」は“進行の途中で”起きるので、
    // playNext() 内で必要になったタイミングで処理する。
    return state;
  };

  National.isFinished = function(state){
    return !!state?.finished;
  };

  // 次の1手（NEXT相当）
  // 戻り値：{ state, event }
  // event:
  // - { type:'match', visible:true/false, meta, result, overallTop }
  // - { type:'returnMain', week, reason }
  // - { type:'finished', finalOverall }
  National.playNext = function(state, uiOpt){
    if (!state || state.finished) return { state, event: { type:'finished', finalOverall: National.getFinalOverall(state) } };

    // 「メインへ戻る」待ち状態なら、NEXTでは進めない（flow側でメインに戻す）
    if (state.needReturnMain){
      return { state, event: { type:'returnMain', week: state.week, reason:'phase-break' } };
    }

    // 現在ブロック
    const blk = BLOCKS[state.blockIndex];
    if (!blk){
      state.finished = true;
      return { state, event: { type:'finished', finalOverall: National.getFinalOverall(state) } };
    }

    // 週更新
    state.week = blk.week;

    // 裏ブロック（visible=false）の場合：
    // そのブロック5試合を“即時で全部”集計してから、次の表ブロックへ進める
    if (!blk.visible){
      runHiddenBlockAll(state, blk);
      // ここが「序盤(C&D)→メインへ」に該当
      if (blk.afterReturnMain){
        state.needReturnMain = true;
      }
      // 裏ブロック終了：次ブロックへ
      state.blockIndex++;
      state.inBlockMatch = 0;
      // eventとしては「裏で進んだ」通知だけ返す（UI出さない）
      return {
        state,
        event: {
          type:'match',
          visible:false,
          meta: makeMeta(state, blk, null, true),
          result: null,
          overallTop: getOverallSorted(state.standings)
        }
      };
    }

    // 表ブロック（visible=true）：1試合だけ進める
    const teams20 = getTeams20(state.groups, blk.g1, blk.g2);
    const result = simulateMatch(teams20);
    applyMatchToStandings(state, result);

    state.lastMatch = { result, meta: makeMeta(state, blk, result, false) };

    // 表示用：現在総合（40）を毎回更新
    const overallSorted = getOverallSorted(state.standings);

    // 次へ
    state.inBlockMatch++;
    state.matchNoGlobal++;

    // ブロック終端なら次ブロックへ
    if (state.inBlockMatch >= blk.matches){
      state.blockIndex++;
      state.inBlockMatch = 0;

      // 次が裏ブロックなら、次NEXTで即時集計される
      // （ここでは止めない）
    }

    // 全ブロック完了
    if (state.matchNoGlobal >= 30){
      state.finished = true;
      return {
        state,
        event: {
          type:'finished',
          finalOverall: overallSorted
        }
      };
    }

    // UI呼び出し（存在する場合のみ）
    if (blk.visible){
      if (window.MOBBR?.ui?.showMatchResult){
        window.MOBBR.ui.showMatchResult(result, uiOpt || {});
      }
      if (window.MOBBR?.ui?.showOverall){
        window.MOBBR.ui.showOverall(overallSorted, uiOpt || {});
      }
    }

    return {
      state,
      event: {
        type:'match',
        visible:true,
        meta: state.lastMatch.meta,
        result,
        overallTop: overallSorted
      }
    };
  };

  // flow側で「メインへ戻る」を消化した後に呼ぶ
  National.resumeAfterReturnMain = function(state){
    if (!state) return;
    state.needReturnMain = false;
  };

  National.getFinalOverall = function(state){
    if (!state) return [];
    return getOverallSorted(state.standings);
  };

  /* =========================
     INTERNAL
  ========================== */

  function makeGroups(teams){
    // 40チームをそのまま A/B/C/D に10ずつ割り当て（flow側で振り分け済み想定）
    // ※「プレイヤーはA固定」は flow/seed側で保証する（ここは並びに従う）
    const g = {
      A: teams.slice(0,10),
      B: teams.slice(10,20),
      C: teams.slice(20,30),
      D: teams.slice(30,40)
    };
    return g;
  }

  function getTeams20(groups, a, b){
    const ga = groups[a] || [];
    const gb = groups[b] || [];
    return ga.concat(gb);
  }

  function initStandings(teams){
    return teams.map(t=>({
      teamId: t.teamId,
      name: t.name,
      // 総合（ナショナル期間の累積ポイント）
      total: 0,
      kp: 0,
      ap: 0,
      treasure: 0,
      flag: 0,
      // 参照用
      group: t.group || null
    }));
  }

  function applyMatchToStandings(state, result){
    // result.rows は20行
    for (const row of (result?.rows || [])){
      const s = state.standings.find(x => x.teamId === row.teamId);
      if (!s) continue;
      s.total += (row.total || 0);
      s.kp += (row.kp || 0);
      s.ap += (row.ap || 0);
      s.treasure += (row.treasure || 0);
      s.flag += (row.flag || 0);
    }
  }

  function getOverallSorted(standings){
    // 総合ポイント → 総合キル → 平均順位 → 総合アシスト → ランダム
    // ※平均順位は「試合ロジック側で別に持つ」必要があるので、ここでは
    //    total/kp/ap までで安定ソート＋ランダム(同値)にする。
    const arr = standings.slice();
    arr.sort((a,b)=>{
      if (b.total !== a.total) return b.total - a.total;
      if (b.kp !== a.kp) return b.kp - a.kp;
      if (b.ap !== a.ap) return b.ap - a.ap;
      return Math.random() < 0.5 ? -1 : 1;
    });
    // rank 付与
    arr.forEach((x,i)=>{ x.rank = i+1; });
    return arr;
  }

  function runHiddenBlockAll(state, blk){
    // 5試合を一気に処理（UI無し）
    for (let i=0; i<blk.matches; i++){
      const teams20 = getTeams20(state.groups, blk.g1, blk.g2);
      const result = simulateMatch(teams20);
      applyMatchToStandings(state, result);

      state.inBlockMatch++;
      state.matchNoGlobal++;
      state.lastMatch = null;

      if (state.matchNoGlobal >= 30){
        state.finished = true;
        break;
      }
    }
    // 裏ブロックはここで完了しているので、inBlockMatch は 0 に戻す（次ブロックへ）
    state.inBlockMatch = 0;
  }

  function simulateMatch(teams20){
    // ここは「本物の試合ロジック」ができたら差し替えポイント
    // 現状は SimResult に丸投げして “20位までのresult” を作れる前提
    if (window.SimResult?.finalizeTournament){
      // teams20 は参照破壊されうるので cloneして渡す
      const copy = teams20.map(clone);
      return window.SimResult.finalizeTournament(copy);
    }

    // フォールバック（最低限）
    const copy = teams20.map(clone);
    shuffleInPlace(copy);
    const rows = copy.map((t, idx)=>({
      place: idx+1,
      teamId: t.teamId,
      name: t.name,
      kp: 0, ap: 0, treasure:0, flag:0,
      total: 0
    }));
    return { champion: rows[0]?.name || '', rows };
  }

  function makeMeta(state, blk, result, hidden){
    const matchInBlock = hidden ? null : (state.inBlockMatch + 1); // playNext内ではinBlockMatch加算前
    const title = blk.label;
    const groups = `${blk.g1}&${blk.g2}`;
    return {
      phase: 'national',
      week: blk.week,
      blockId: blk.id,
      title,
      groups,
      matchInBlock: hidden ? null : matchInBlock,
      matchCountInBlock: blk.matches,
      matchNoGlobal: hidden ? null : (state.matchNoGlobal + 1),
      hidden: !!hidden,
      champion: result?.champion || ''
    };
  }

  function clone(v){
    return JSON.parse(JSON.stringify(v));
  }

  function shuffleInPlace(a){
    for (let i=a.length-1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
      const t = a[i]; a[i]=a[j]; a[j]=t;
    }
  }

})();
