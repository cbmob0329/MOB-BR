'use strict';

/*
  sim_match_events.js v2（フル）
  ✅「試合最新版.txt」運用向け（大会側から呼ばれる “イベント抽選エンジン” ）
  - rollForTeam(team, round, ctx) を提供
  - eventBuffs（aim/mental/agi の%加算）を付与（試合中のみ）
  - Treasure / Flag を付与（ポイント計算に反映：tournament_result 側）
  - resetTeamMatchState(team) を提供（match_flow が戦闘後に呼ぶ）
  - 互換：rollForMatch も用意（もし旧コードが残っていても落ちない）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function ensureTeamShape(t){
    if (!t) return;
    if (!Number.isFinite(Number(t.power))) t.power = 55;
    if (!Number.isFinite(Number(t.alive))) t.alive = 3;
    if (t.eliminated !== true) t.eliminated = false;

    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      if (!Number.isFinite(Number(t.eventBuffs.aim))) t.eventBuffs.aim = 0;
      if (!Number.isFinite(Number(t.eventBuffs.mental))) t.eventBuffs.mental = 0;
      if (!Number.isFinite(Number(t.eventBuffs.agi))) t.eventBuffs.agi = 0;
    }

    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;
  }

  function isAlive(t){
    return t && !t.eliminated && (t.alive|0) > 0;
  }

  function addBuff(t, delta){
    ensureTeamShape(t);
    const aim = clamp((t.eventBuffs.aim|0) + (delta.aim|0), -99, 99);
    const mental = clamp((t.eventBuffs.mental|0) + (delta.mental|0), -99, 99);
    const agi = clamp((t.eventBuffs.agi|0) + (delta.agi|0), -99, 99);
    t.eventBuffs.aim = aim;
    t.eventBuffs.mental = mental;
    t.eventBuffs.agi = agi;
  }

  function addTreasure(t, n){
    ensureTeamShape(t);
    t.treasure = clamp((t.treasure|0) + (n|0), 0, 999);
  }

  function addFlag(t, n){
    ensureTeamShape(t);
    t.flag = clamp((t.flag|0) + (n|0), 0, 999);
  }

  function randInt(lo, hi){
    const a = Math.min(lo|0, hi|0);
    const b = Math.max(lo|0, hi|0);
    return a + ((Math.random() * (b - a + 1)) | 0);
  }

  function pickWeighted(items){
    // items: [{w:number, fn:()=>ev}]
    let sum = 0;
    for (const it of items) sum += Math.max(0, Number(it.w)||0);
    if (sum <= 0) return items[0]?.fn ? items[0].fn() : null;
    let r = Math.random() * sum;
    for (const it of items){
      r -= Math.max(0, Number(it.w)||0);
      if (r <= 0) return it.fn();
    }
    return items[items.length-1]?.fn ? items[items.length-1].fn() : null;
  }

  // ===== コーチフラグ（ctx.playerCoach）をイベント側で使うための簡易ルール =====
  function coachTreasureBonus(ctx){
    // score_mind を true にすると宝関連が少し伸びる想定
    return (ctx && ctx.playerCoach && ctx.playerCoach.score_mind) ? 1 : 0;
  }

  function coachEndgameMult(ctx, round){
    // endgame_power を true にすると終盤で少しだけバフ強化（控えめ）
    if (ctx && ctx.playerCoach && ctx.playerCoach.endgame_power && round >= 5) return 1.15;
    return 1.0;
  }

  // ===== Event factories =====
  function evAimUp(ctx, round){
    const m = coachEndgameMult(ctx, round);
    const v = Math.round(randInt(3, 7) * m);
    return { type:'buff', buff:{ aim:+v, mental:0, agi:0 }, icon:'', log1:'索敵が噛み合った！', log2:`エイム感覚が冴える（AIM +${v}%）`, log3:'' };
  }

  function evMentalUp(ctx, round){
    const m = coachEndgameMult(ctx, round);
    const v = Math.round(randInt(3, 7) * m);
    return { type:'buff', buff:{ aim:0, mental:+v, agi:0 }, icon:'', log1:'落ち着いて状況整理。', log2:`メンタルが安定（MENTAL +${v}%）`, log3:'' };
  }

  function evAgiUp(ctx, round){
    const m = coachEndgameMult(ctx, round);
    const v = Math.round(randInt(3, 7) * m);
    return { type:'buff', buff:{ aim:0, mental:0, agi:+v }, icon:'', log1:'移動が軽い！', log2:`足が動く（AGI +${v}%）`, log3:'' };
  }

  function evAimDown(ctx, round){
    const v = randInt(2, 6);
    return { type:'buff', buff:{ aim:-v, mental:0, agi:0 }, icon:'', log1:'視界が悪い…', log2:`エイムが乱れる（AIM -${v}%）`, log3:'' };
  }

  function evMentalDown(ctx, round){
    const v = randInt(2, 6);
    return { type:'buff', buff:{ aim:0, mental:-v, agi:0 }, icon:'', log1:'判断が遅れる…', log2:`メンタルが揺れる（MENTAL -${v}%）`, log3:'' };
  }

  function evAgiDown(ctx, round){
    const v = randInt(2, 6);
    return { type:'buff', buff:{ aim:0, mental:0, agi:-v }, icon:'', log1:'足場が悪い…', log2:`移動が重い（AGI -${v}%）`, log3:'' };
  }

  function evTreasure(ctx, round){
    const bonus = coachTreasureBonus(ctx);
    // 宝は“点”なので控えめに。終盤は取りに行けない想定でやや減る。
    const base = (round >= 5) ? 0 : 1;
    const n = clamp(base + bonus, 0, 3);
    if (n <= 0){
      return { type:'treasure', treasure:0, icon:'', log1:'物資を漁るが…', log2:'大きな収穫は無かった。', log3:'' };
    }
    return { type:'treasure', treasure:n, icon:'', log1:'物資で当たりを引いた！', log2:`お宝を確保（Treasure +${n}）`, log3:'' };
  }

  function evFlag(ctx, round){
    // フラッグは価値が高い（resultで*2）ので低頻度
    const n = 1;
    return { type:'flag', flag:n, icon:'', log1:'強ポジを確保！', log2:`フラッグ獲得（Flag +${n}）`, log3:'' };
  }

  function evNothing(ctx, round){
    return { type:'none', icon:'', log1:'周囲を警戒…', log2:'特に何も起こらなかった。', log3:'' };
  }

  // ===== Roundごとの出現テーブル（調整はここだけ）=====
  function buildTable(round){
    // 目安：
    // - R1 は“落ち着いた強化”多め
    // - R2-4 はバフ/デバフ混ぜる
    // - R5 は宝減・デバフ増
    // - R6 は基本イベント無し（tournament_logic が 0 なので通常呼ばれない）
    if (round <= 1){
      return [
        { w:24, fn:()=>evAimUp(null, round) },
        { w:24, fn:()=>evMentalUp(null, round) },
        { w:24, fn:()=>evAgiUp(null, round) },
        { w:18, fn:()=>evTreasure(null, round) },
        { w:10, fn:()=>evNothing(null, round) },
      ];
    }
    if (round <= 4){
      return [
        { w:18, fn:()=>evAimUp(null, round) },
        { w:18, fn:()=>evMentalUp(null, round) },
        { w:18, fn:()=>evAgiUp(null, round) },

        { w:12, fn:()=>evAimDown(null, round) },
        { w:12, fn:()=>evMentalDown(null, round) },
        { w:12, fn:()=>evAgiDown(null, round) },

        { w:10, fn:()=>evTreasure(null, round) },
        { w:2,  fn:()=>evFlag(null, round) },   // 低確率
        { w:6,  fn:()=>evNothing(null, round) },
      ];
    }
    // R5
    return [
      { w:16, fn:()=>evAimUp(null, round) },
      { w:16, fn:()=>evMentalUp(null, round) },
      { w:16, fn:()=>evAgiUp(null, round) },

      { w:16, fn:()=>evAimDown(null, round) },
      { w:16, fn:()=>evMentalDown(null, round) },
      { w:16, fn:()=>evAgiDown(null, round) },

      { w:3,  fn:()=>evTreasure(null, round) },
      { w:1,  fn:()=>evFlag(null, round) },
      { w:9,  fn:()=>evNothing(null, round) },
    ];
  }

  // ctx をテーブル関数へ注入するためのラッパ
  function rollFromTable(ctx, round){
    const table0 = buildTable(round);

    // table0内の evXxx(null,round) を ctx 付きで再生成
    const table = table0.map(it=>{
      const f = it.fn;
      return {
        w: it.w,
        fn: ()=>{
          // f が内部で null ctx を使っているので、ここで ctx を差し替えるために再分岐
          // （安全のため type を見て作り直すのではなく、直接 ctx 付き関数を呼ぶ）
          // → simplest: build a new roll each time based on round and ctx
          return null;
        }
      };
    });

    // ↑の“差し替え”は簡潔にするため、ここで round別に直接 pick し直す
    // （重みは buildTable と同じ配分）
    const r = clamp(round, 1, 6);
    if (r <= 1){
      return pickWeighted([
        { w:24, fn:()=>evAimUp(ctx, r) },
        { w:24, fn:()=>evMentalUp(ctx, r) },
        { w:24, fn:()=>evAgiUp(ctx, r) },
        { w:18, fn:()=>evTreasure(ctx, r) },
        { w:10, fn:()=>evNothing(ctx, r) },
      ]);
    }
    if (r <= 4){
      return pickWeighted([
        { w:18, fn:()=>evAimUp(ctx, r) },
        { w:18, fn:()=>evMentalUp(ctx, r) },
        { w:18, fn:()=>evAgiUp(ctx, r) },

        { w:12, fn:()=>evAimDown(ctx, r) },
        { w:12, fn:()=>evMentalDown(ctx, r) },
        { w:12, fn:()=>evAgiDown(ctx, r) },

        { w:10, fn:()=>evTreasure(ctx, r) },
        { w:2,  fn:()=>evFlag(ctx, r) },
        { w:6,  fn:()=>evNothing(ctx, r) },
      ]);
    }
    return pickWeighted([
      { w:16, fn:()=>evAimUp(ctx, r) },
      { w:16, fn:()=>evMentalUp(ctx, r) },
      { w:16, fn:()=>evAgiUp(ctx, r) },

      { w:16, fn:()=>evAimDown(ctx, r) },
      { w:16, fn:()=>evMentalDown(ctx, r) },
      { w:16, fn:()=>evAgiDown(ctx, r) },

      { w:3,  fn:()=>evTreasure(ctx, r) },
      { w:1,  fn:()=>evFlag(ctx, r) },
      { w:9,  fn:()=>evNothing(ctx, r) },
    ]);
  }

  // ===== Public API =====
  function rollForTeam(team, round, ctx){
    ensureTeamShape(team);
    const r = clamp(round, 1, 6);

    // 大会側で “生存してるプレイヤーだけ” 呼ぶ想定だが、保険
    if (!isAlive(team)){
      return { icon:'', log1:'……', log2:'（行動不能）', log3:'' };
    }

    const ev = rollFromTable(ctx || {}, r);
    if (!ev){
      return { icon:'', log1:'周囲を警戒…', log2:'特に何も起こらなかった。', log3:'' };
    }

    if (ev.type === 'buff' && ev.buff){
      addBuff(team, ev.buff);
    }else if (ev.type === 'treasure'){
      addTreasure(team, ev.treasure|0);
    }else if (ev.type === 'flag'){
      addFlag(team, ev.flag|0);
    }

    // UIに出すだけの3行ログ
    return {
      icon: String(ev.icon || ''),
      log1: String(ev.log1 || ''),
      log2: String(ev.log2 || ''),
      log3: String(ev.log3 || '')
    };
  }

  function resetTeamMatchState(team){
    // 「試合中のみ」の状態を戻す（match_flow が戦闘後に呼ぶ）
    ensureTeamShape(team);
    team.eventBuffs = { aim:0, mental:0, agi:0 };
  }

  // 互換（もし旧コードが残っても落とさない）
  function rollForMatch(state, round, ctx){
    const player = ctx && ctx.player ? ctx.player : null;
    if (!player) return null;
    return rollForTeam(player, round, ctx);
  }

  window.MOBBR.sim.matchEvents = {
    rollForTeam,
    resetTeamMatchState,
    rollForMatch
  };

})();
