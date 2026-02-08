'use strict';

/*
  MOB BR - tournament_flow.js v1（フル）
  役割（STEP2）：
  - 大会の「状態遷移（NEXTでどう進むか）」だけを完全固定して実装する
  - UI描画や戦闘ロジック、順位計算そのものはここではやらない（hooksで委譲）
  - 20チーム大会 / 40チーム大会（同時2ロビー）対応
  - 「1試合ごとに result → (n/5)総合順位 → 次試合」を厳守
  - 裏ブロック（プレイヤー非所属グループ）は MatchDay 単位で即時集計（ログ/画像なし）を hooks に委譲

  注意：
  - A方式（プレイヤーブロックはNEXT進行 / 裏ブロックは即時集計）を前提
  - NATIONAL / WORLD は MatchDayごとに「2ロビー分のResultを出し、その後 Overall(1..40)」が基本
    ※Resultの見せ方（同一画面に2枚 or 2回NEXTで見せる）は hooks 側で調整可能

  依存：
  - なし（window.MOBBR にぶら下げるだけ）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.tournament = window.MOBBR.tournament || {};

(function(){
  // =========================
  // State（固定）
  // =========================
  const STATE = Object.freeze({
    IDLE: 'IDLE',
    WEEK_START_BANNER: 'WEEK_START_BANNER',
    ENTER_CONFIRM: 'ENTER_CONFIRM',
    ENTER_TRANSITION: 'ENTER_TRANSITION',
    VENUE_ANNOUNCE: 'VENUE_ANNOUNCE',

    MATCHDAY_START: 'MATCHDAY_START',
    MATCHDAY_RUN: 'MATCHDAY_RUN',
    MATCHDAY_RESULT: 'MATCHDAY_RESULT',
    OVERALL_UPDATE: 'OVERALL_UPDATE',

    PHASE_END_UI: 'PHASE_END_UI',
    RETURN_TO_MAIN: 'RETURN_TO_MAIN',
    TOURNAMENT_END: 'TOURNAMENT_END'
  });

  // =========================
  // Types（軽いガード）
  // =========================
  function isFn(v){ return typeof v === 'function'; }
  function clone(obj){ return JSON.parse(JSON.stringify(obj || {})); }

  // =========================
  // Plan（大会の流れ定義）
  // ここは「状態遷移」に必要な最低限だけ持つ
  // ※data_tournament.js は別で作る想定。今は flow固定のため内蔵。
  // =========================
  // lobbyKey: UIや裏処理で「どのロビーの結果か」を識別するキー（例：'AB' 'CD'）
  // phaseId : フェーズ識別（例：'local_main' 'national_early_abcd'）
  // matchDays: 5固定（ただしFINALは別）
  // lobbies: そのMatchDayに同時開催されるロビー配列（20大会なら長さ1、40大会なら長さ2）
  function makeMatchDays5(lobbiesArr){
    // lobbiesArr: 例）['LOCAL'] or ['AB','CD']
    const md = [];
    for (let i=1; i<=5; i++){
      md.push({
        index: i,
        total: 5,
        lobbies: lobbiesArr.map(k => ({ lobbyKey: k }))
      });
    }
    return md;
  }

  const PLAN = {
    // 20チーム / 5試合
    LOCAL: [
      {
        phaseId: 'local_main',
        title: 'ローカル大会',
        announceKey: 'LOCAL_OPEN',
        matchDays: makeMatchDays5(['LOCAL']),
        endKey: 'LOCAL_END',
        returnToMainAfterPhase: false
      }
    ],

    // 40チーム / 5試合セット × 複数フェーズ（途中でメインへ戻る）
    NATIONAL: [
      {
        phaseId: 'national_early_abcd',
        title: 'ナショナル大会（序盤）',
        announceKey: 'NATIONAL_EARLY',
        matchDays: makeMatchDays5(['AB','CD']),
        endKey: 'NATIONAL_EARLY_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'national_mid_ac',
        title: 'ナショナル大会（中盤）',
        announceKey: 'NATIONAL_MID',
        matchDays: makeMatchDays5(['AC','BD']), // ※中盤の裏側をどれにするかは裏処理側で解釈可能。ここは「同時2ロビー」枠として固定。
        endKey: 'NATIONAL_MID_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'national_late_bc',
        title: 'ナショナル大会（終盤1）',
        announceKey: 'NATIONAL_LATE',
        matchDays: makeMatchDays5(['BC','AD']),
        endKey: 'NATIONAL_LATE1_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'national_late_bd',
        title: 'ナショナル大会（終盤2）',
        announceKey: 'NATIONAL_LAST_CHANCE',
        matchDays: makeMatchDays5(['BD','AC']), // 同時2ロビー枠（最終総合の素材）
        endKey: 'NATIONAL_END',
        returnToMainAfterPhase: false
      }
    ],

    // 20チーム / 5試合（上位2）
    LAST_CHANCE: [
      {
        phaseId: 'lastchance_main',
        title: 'ラストチャンス',
        announceKey: 'LAST_CHANCE_OPEN',
        matchDays: makeMatchDays5(['LC']),
        endKey: 'LAST_CHANCE_END',
        returnToMainAfterPhase: false
      }
    ],

    // WORLD（予選3フェーズ + Winners/Losers/Losers2 + FINAL）
    // FINALは条件決着なので matchDays ではなく special として扱う
    WORLD_FINAL: [
      {
        phaseId: 'world_q1',
        title: 'ワールド大会（予選リーグ1）',
        announceKey: 'WORLD_Q1',
        matchDays: makeMatchDays5(['AB','CD']),
        endKey: 'WORLD_Q1_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'world_q2',
        title: 'ワールド大会（予選リーグ2）',
        announceKey: 'WORLD_Q2',
        matchDays: makeMatchDays5(['AC','BD']),
        endKey: 'WORLD_Q2_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'world_q3',
        title: 'ワールド大会（予選リーグ3）',
        announceKey: 'WORLD_Q3',
        matchDays: makeMatchDays5(['AD','BC']),
        endKey: 'WORLD_Q3_END',
        returnToMainAfterPhase: true,
        // 予選終了後「Winners/Losers振り分けUI」を出す必要がある
        // → phaseEndUIで endKey を見て hooks 側で出す
      },
      {
        phaseId: 'world_winners',
        title: 'Winners',
        announceKey: 'WORLD_WINNERS',
        matchDays: makeMatchDays5(['WIN']),
        endKey: 'WORLD_WINNERS_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'world_losers',
        title: 'Losers',
        announceKey: 'WORLD_LOSERS',
        matchDays: makeMatchDays5(['LOS']),
        endKey: 'WORLD_LOSERS_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'world_losers2',
        title: 'Losers2',
        announceKey: 'WORLD_LOSERS2',
        matchDays: makeMatchDays5(['LOS2']),
        endKey: 'WORLD_LOSERS2_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'world_final',
        title: 'FINAL',
        announceKey: 'WORLD_FINAL',
        // FINALは 5試合ではない（条件決着）
        special: { kind: 'FINAL_CONDITION' },
        endKey: 'WORLD_FINAL_END',
        returnToMainAfterPhase: false
      }
    ],

    // チャンピオンシップは「WORLD_FINAL と同じ構造」だが大会名が変わるだけ扱い
    CHAMPIONSHIP_WORLD_FINAL: [
      // ここは “ワールドと同構造” として流用するなら hooks側で tournamentType で文言切替OK
      // ひとまず world_final をそのまま使えるように同じ構造で定義
      {
        phaseId: 'cs_q1',
        title: 'チャンピオンシップ（予選リーグ1）',
        announceKey: 'CS_Q1',
        matchDays: makeMatchDays5(['AB','CD']),
        endKey: 'CS_Q1_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'cs_q2',
        title: 'チャンピオンシップ（予選リーグ2）',
        announceKey: 'CS_Q2',
        matchDays: makeMatchDays5(['AC','BD']),
        endKey: 'CS_Q2_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'cs_q3',
        title: 'チャンピオンシップ（予選リーグ3）',
        announceKey: 'CS_Q3',
        matchDays: makeMatchDays5(['AD','BC']),
        endKey: 'CS_Q3_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'cs_winners',
        title: 'Winners',
        announceKey: 'CS_WINNERS',
        matchDays: makeMatchDays5(['WIN']),
        endKey: 'CS_WINNERS_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'cs_losers',
        title: 'Losers',
        announceKey: 'CS_LOSERS',
        matchDays: makeMatchDays5(['LOS']),
        endKey: 'CS_LOSERS_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'cs_losers2',
        title: 'Losers2',
        announceKey: 'CS_LOSERS2',
        matchDays: makeMatchDays5(['LOS2']),
        endKey: 'CS_LOSERS2_END',
        returnToMainAfterPhase: true
      },
      {
        phaseId: 'cs_final',
        title: 'FINAL',
        announceKey: 'CS_FINAL',
        special: { kind: 'FINAL_CONDITION' },
        endKey: 'CS_FINAL_END',
        returnToMainAfterPhase: false
      }
    ]
  };

  // =========================
  // Default hooks（UI/戦闘/順位は外に出す）
  // =========================
  function defaultHooks(){
    return {
      // 表示系
      onWeekStartBanner: null,     // ({ tournamentType })
      onEnterConfirm: null,        // ({ tournamentType }) -> UIで「はい/いいえ」を取り、flow.chooseEnter(true/false) を呼ぶ
      onEnterTransition: null,     // ({ tournamentType, phase }) : neonmain/tent/P?.png 表示準備
      onVenueAnnounce: null,       // ({ tournamentType, phase, announceKey }) : テント台詞をNEXTで送るUI
      onMatchDayStart: null,       // ({ tournamentType, phase, matchDay }) : 「第n試合開始」など
      onRunMatchDay: null,         // async/または同期: ({ tournamentType, phase, matchDay }) -> { resultsByLobbyKey, updatedOverall } を返す（下の仕様参照）
      onShowMatchDayResult: null,  // ({ tournamentType, phase, matchDay, resultsByLobbyKey }) : Result表示（1〜20×ロビー数）
      onShowOverall: null,         // ({ tournamentType, phase, matchDay, overall, progressText }) : 総合順位（1〜20 or 1〜40）
      onPhaseEndUI: null,          // ({ tournamentType, phase, endKey, overall }) : 通過/敗退/Winners振り分けなど
      onReturnToMain: null,        // ({ tournamentType, phase }) : メインへ戻す
      onTournamentEnd: null,       // ({ tournamentType, overall }) : 報酬/企業ランク/ログ更新など（実処理は外）

      // デバッグ
      onStateChange: null          // ({ prev, next, ctx })
    };
  }

  // =========================
  // Engine
  // =========================
  function createFlow(opts){
    const tournamentType = String(opts?.tournamentType || '').toUpperCase();
    const hooks = Object.assign(defaultHooks(), opts?.hooks || {});
    const plan = PLAN[tournamentType];

    if (!plan){
      throw new Error(`[tournament_flow] unknown tournamentType: ${tournamentType}`);
    }

    // ctx：状態機械の最小内部状態
    const ctx = {
      tournamentType,
      state: STATE.IDLE,

      // フェーズ進捗
      phaseIndex: 0,
      matchDayIndex: 0,

      // 現在フェーズ/マッチデイのキャッシュ
      currentPhase: null,
      currentMatchDay: null,

      // 最新の集計
      lastResultsByLobbyKey: null,
      overall: null, // 1..20 or 1..40 の配列/オブジェ（中身は rank側に委譲）
      // FINAL進行用（hooksが管理して良いが、ここも最低限保持）
      finalStatus: null
    };

    // ===========
    // 内部 util
    // ===========
    function emitState(prev, next){
      if (isFn(hooks.onStateChange)){
        try{ hooks.onStateChange({ prev, next, ctx: snapshot() }); }catch(e){}
      }
    }
    function setState(next){
      const prev = ctx.state;
      ctx.state = next;
      emitState(prev, next);
    }

    function getPhase(){
      return plan[ctx.phaseIndex] || null;
    }
    function isFinalPhase(phase){
      return !!phase?.special && phase.special.kind === 'FINAL_CONDITION';
    }
    function getMatchDay(phase){
      if (!phase || !phase.matchDays) return null;
      return phase.matchDays[ctx.matchDayIndex] || null;
    }

    function snapshot(){
      return clone({
        tournamentType: ctx.tournamentType,
        state: ctx.state,
        phaseIndex: ctx.phaseIndex,
        matchDayIndex: ctx.matchDayIndex,
        currentPhase: ctx.currentPhase ? { phaseId: ctx.currentPhase.phaseId, title: ctx.currentPhase.title } : null,
        currentMatchDay: ctx.currentMatchDay ? { index: ctx.currentMatchDay.index, total: ctx.currentMatchDay.total, lobbies: ctx.currentMatchDay.lobbies } : null,
        hasOverall: !!ctx.overall
      });
    }

    // ===========
    // 外部API
    // ===========
    function startWeekBanner(){
      // 大会週突入時に呼ぶ（メイン中央の金文字）
      ctx.phaseIndex = 0;
      ctx.matchDayIndex = 0;
      ctx.currentPhase = null;
      ctx.currentMatchDay = null;
      ctx.lastResultsByLobbyKey = null;
      ctx.overall = null;
      ctx.finalStatus = null;

      setState(STATE.WEEK_START_BANNER);
      if (isFn(hooks.onWeekStartBanner)){
        hooks.onWeekStartBanner({ tournamentType: ctx.tournamentType });
      }
    }

    function openEnterConfirm(){
      // bbattle.png 押下で呼ぶ
      setState(STATE.ENTER_CONFIRM);
      if (isFn(hooks.onEnterConfirm)){
        hooks.onEnterConfirm({ tournamentType: ctx.tournamentType });
      }
    }

    function chooseEnter(isYes){
      // ENTER_CONFIRM の「はい/いいえ」結果
      if (ctx.state !== STATE.ENTER_CONFIRM) return;

      if (!isYes){
        // キャンセル：IDLEへ
        setState(STATE.IDLE);
        return;
      }

      // はい：ENTER_TRANSITIONへ
      setState(STATE.ENTER_TRANSITION);
      ctx.currentPhase = getPhase();

      if (isFn(hooks.onEnterTransition)){
        hooks.onEnterTransition({
          tournamentType: ctx.tournamentType,
          phase: clone(ctx.currentPhase)
        });
      }

      // 遷移後、最初はテントアナウンス（NEXTで進める）
      // ※ここでは即座に state を進める（UI側はこの state を見て next誘導するだけ）
      setState(STATE.VENUE_ANNOUNCE);

      if (isFn(hooks.onVenueAnnounce)){
        hooks.onVenueAnnounce({
          tournamentType: ctx.tournamentType,
          phase: clone(ctx.currentPhase),
          announceKey: ctx.currentPhase?.announceKey || null
        });
      }
    }

    async function next(){
      // NEXTボタンから呼ぶ想定
      // ※state により「1ステップだけ」進む
      switch (ctx.state){

        case STATE.VENUE_ANNOUNCE: {
          // アナウンス終了後のNEXTで試合へ
          setState(STATE.MATCHDAY_START);

          ctx.currentPhase = getPhase();
          ctx.matchDayIndex = 0;

          if (isFinalPhase(ctx.currentPhase)){
            // FINALは MATCHDAY ではない
            ctx.currentMatchDay = null;

            if (isFn(hooks.onMatchDayStart)){
              hooks.onMatchDayStart({
                tournamentType: ctx.tournamentType,
                phase: clone(ctx.currentPhase),
                matchDay: null
              });
            }

            // FINAL開始 → RUNへ
            setState(STATE.MATCHDAY_RUN);
            return runCurrent();
          }

          ctx.currentMatchDay = getMatchDay(ctx.currentPhase);

          if (isFn(hooks.onMatchDayStart)){
            hooks.onMatchDayStart({
              tournamentType: ctx.tournamentType,
              phase: clone(ctx.currentPhase),
              matchDay: clone(ctx.currentMatchDay)
            });
          }

          // 次NEXTでRUN…ではなく「A方式：NEXTは1ステップ」なので
          // MATCHDAY_START で止めた後、次の next() で RUN へ進む
          return;
        }

        case STATE.MATCHDAY_START: {
          // 試合を実行（表＋裏を確定）
          setState(STATE.MATCHDAY_RUN);
          return runCurrent();
        }

        case STATE.MATCHDAY_RUN: {
          // ここには通常来ない（runCurrentがRUN→RESULTへ遷移する）
          // 念のため RESULTへ回す
          setState(STATE.MATCHDAY_RESULT);
          return showResult();
        }

        case STATE.MATCHDAY_RESULT: {
          // Resultを見たNEXT → Overallへ
          setState(STATE.OVERALL_UPDATE);
          return showOverall();
        }

        case STATE.OVERALL_UPDATE: {
          // Overallを見たNEXT → 次のMatchDay or フェーズ終了UI
          return advanceAfterOverall();
        }

        case STATE.PHASE_END_UI: {
          // フェーズ終端UIのNEXT → メインへ戻る or 次フェーズへ
          return advanceAfterPhaseEnd();
        }

        case STATE.RETURN_TO_MAIN: {
          // メインへ戻った後のNEXTは基本不要（週進行側へ）
          setState(STATE.IDLE);
          return;
        }

        case STATE.TOURNAMENT_END: {
          setState(STATE.IDLE);
          return;
        }

        // 週バナーや確認はNEXTじゃない（UI操作）
        case STATE.WEEK_START_BANNER:
        case STATE.ENTER_CONFIRM:
        case STATE.ENTER_TRANSITION:
        case STATE.IDLE:
        default:
          return;
      }
    }

    async function runCurrent(){
      const phase = getPhase();
      ctx.currentPhase = phase;

      // FINAL（条件決着）は hooks 側で「進行→優勝確定→overall確定」までやって返す
      if (isFinalPhase(phase)){
        const out = await callRunHook({ finalMode: true });
        // out: { resultsByLobbyKey?, updatedOverall? }
        ctx.lastResultsByLobbyKey = out?.resultsByLobbyKey || null;
        if (out?.updatedOverall) ctx.overall = out.updatedOverall;

        // FINALは Result画面を挟むかどうかは hooks側の見せ方だが、
        // flowとしては「PHASE_END_UI → TOURNAMENT_END」へ向かう
        setState(STATE.PHASE_END_UI);
        if (isFn(hooks.onPhaseEndUI)){
          hooks.onPhaseEndUI({
            tournamentType: ctx.tournamentType,
            phase: clone(phase),
            endKey: phase.endKey,
            overall: ctx.overall
          });
        }
        return;
      }

      // 通常MatchDay
      const md = getMatchDay(phase);
      ctx.currentMatchDay = md;

      const out = await callRunHook({ finalMode: false });

      // out 仕様：
      // - resultsByLobbyKey: { [lobbyKey]: { result20: [...], meta?:... } } など何でもOK（ui/rankに委譲）
      // - updatedOverall: overall一覧（1..20 or 1..40）
      ctx.lastResultsByLobbyKey = out?.resultsByLobbyKey || {};
      if (out?.updatedOverall) ctx.overall = out.updatedOverall;

      // RUN完了 → Result表示へ
      setState(STATE.MATCHDAY_RESULT);
      return showResult();
    }

    async function callRunHook(extra){
      if (!isFn(hooks.onRunMatchDay)){
        // hooks未実装でも落とさない
        return { resultsByLobbyKey: {}, updatedOverall: ctx.overall };
      }
      try{
        return await hooks.onRunMatchDay({
          tournamentType: ctx.tournamentType,
          phase: clone(ctx.currentPhase),
          matchDay: ctx.currentMatchDay ? clone(ctx.currentMatchDay) : null,
          ...extra
        });
      }catch(e){
        // 失敗時も進行は止めない（UIでエラー表示したいなら hooks側で）
        return { resultsByLobbyKey: {}, updatedOverall: ctx.overall };
      }
    }

    function showResult(){
      if (isFn(hooks.onShowMatchDayResult)){
        hooks.onShowMatchDayResult({
          tournamentType: ctx.tournamentType,
          phase: clone(ctx.currentPhase),
          matchDay: ctx.currentMatchDay ? clone(ctx.currentMatchDay) : null,
          resultsByLobbyKey: clone(ctx.lastResultsByLobbyKey || {})
        });
      }
    }

    function showOverall(){
      const md = ctx.currentMatchDay;
      const progressText = md ? `(${md.index}/${md.total})` : '';

      if (isFn(hooks.onShowOverall)){
        hooks.onShowOverall({
          tournamentType: ctx.tournamentType,
          phase: clone(ctx.currentPhase),
          matchDay: md ? clone(md) : null,
          overall: ctx.overall,
          progressText
        });
      }
    }

    function advanceAfterOverall(){
      const phase = getPhase();
      if (!phase) return;

      // FINALはここに来ない想定（PHASE_END_UIへ飛ばしている）
      const md = getMatchDay(phase);

      // 次のMatchDayへ
      const hasNextMatchDay = !!phase.matchDays && (ctx.matchDayIndex + 1 < phase.matchDays.length);

      if (hasNextMatchDay){
        ctx.matchDayIndex += 1;
        ctx.currentMatchDay = getMatchDay(phase);

        // 次のMatchDay開始へ
        setState(STATE.MATCHDAY_START);
        if (isFn(hooks.onMatchDayStart)){
          hooks.onMatchDayStart({
            tournamentType: ctx.tournamentType,
            phase: clone(phase),
            matchDay: clone(ctx.currentMatchDay)
          });
        }
        return;
      }

      // フェーズの5試合が終わった → フェーズ終端UIへ
      setState(STATE.PHASE_END_UI);
      if (isFn(hooks.onPhaseEndUI)){
        hooks.onPhaseEndUI({
          tournamentType: ctx.tournamentType,
          phase: clone(phase),
          endKey: phase.endKey,
          overall: ctx.overall
        });
      }
    }

    function advanceAfterPhaseEnd(){
      const phase = getPhase();
      if (!phase) return;

      // 指定があればメインへ戻る
      if (phase.returnToMainAfterPhase){
        setState(STATE.RETURN_TO_MAIN);
        if (isFn(hooks.onReturnToMain)){
          hooks.onReturnToMain({ tournamentType: ctx.tournamentType, phase: clone(phase) });
        }
        // 次フェーズがあるなら、メインから再開させるのは ui_tournament 側の導線でOK
        // ただし flow は内部的に次フェーズへ進めておく
        ctx.phaseIndex += 1;
        ctx.matchDayIndex = 0;
        ctx.currentPhase = getPhase();
        ctx.currentMatchDay = null;

        // 次フェーズが無い＝大会終了
        if (!ctx.currentPhase){
          setState(STATE.TOURNAMENT_END);
          if (isFn(hooks.onTournamentEnd)){
            hooks.onTournamentEnd({ tournamentType: ctx.tournamentType, overall: ctx.overall });
          }
        }
        return;
      }

      // メインへ戻らない：次フェーズ or 大会終了
      const hasNextPhase = (ctx.phaseIndex + 1 < plan.length);
      if (!hasNextPhase){
        setState(STATE.TOURNAMENT_END);
        if (isFn(hooks.onTournamentEnd)){
          hooks.onTournamentEnd({ tournamentType: ctx.tournamentType, overall: ctx.overall });
        }
        return;
      }

      // 次フェーズへ進む → テントアナウンスへ
      ctx.phaseIndex += 1;
      ctx.matchDayIndex = 0;
      ctx.currentPhase = getPhase();
      ctx.currentMatchDay = null;

      setState(STATE.VENUE_ANNOUNCE);
      if (isFn(hooks.onVenueAnnounce)){
        hooks.onVenueAnnounce({
          tournamentType: ctx.tournamentType,
          phase: clone(ctx.currentPhase),
          announceKey: ctx.currentPhase?.announceKey || null
        });
      }
    }

    // ===========
    // 補助：外部から強制的に再開したい場合（メイン戻り後など）
    // ===========
    function resumePhaseAnnounce(){
      // メインから再開ボタン等で呼ぶ想定
      const phase = getPhase();
      if (!phase){
        setState(STATE.IDLE);
        return;
      }
      ctx.currentPhase = phase;
      ctx.matchDayIndex = 0;
      ctx.currentMatchDay = null;
      setState(STATE.VENUE_ANNOUNCE);
      if (isFn(hooks.onVenueAnnounce)){
        hooks.onVenueAnnounce({
          tournamentType: ctx.tournamentType,
          phase: clone(ctx.currentPhase),
          announceKey: ctx.currentPhase?.announceKey || null
        });
      }
    }

    // ===========
    // 公開
    // ===========
    return {
      STATE,
      getState: () => ctx.state,
      getSnapshot: snapshot,

      // 開始トリガー
      startWeekBanner,   // 週開始で呼ぶ
      openEnterConfirm,  // bbattle.png押下で呼ぶ
      chooseEnter,       // はい/いいえ

      // NEXT
      next,

      // 再開
      resumePhaseAnnounce
    };
  }

  // =========================
  // export
  // =========================
  window.MOBBR.tournament.flow = {
    VERSION: 'v1',
    STATE,
    PLAN: clone(PLAN),     // デバッグ用（必要なら消してOK）
    createFlow
  };
})();
