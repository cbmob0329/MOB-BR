'use strict';

/*
  MOB BR - match_events.js v1（フル）
  役割：
  - R1〜R5 の「イベント抽選（重み）＋重複なし＋全滅除外」を確定仕様で実行
  - イベント効果（Aim/Mental/Agility % / Treasure / Flag）をチーム状態へ反映
  - UIが「3段固定」で表示できるログ素材（数値なし）を返す

  ※注意（仕様順守）：
  - 内部%や確率はログに出さない（返すログは文章のみ）
  - eliminated=true のチームは抽選対象から除外（以後参加しない）
  - 同ラウンドで同じイベントは2回出さない（重複なし）
  - R6 は基本イベントなし（count=0）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.match = window.MOBBR.match || {};

(function(){
  const VERSION = 'v1';

  // =========================
  // Event Definitions（確定）
  // =========================
  // 重みは「確率%」ではなく「重み」として扱う（合計が100を超えてもOK）
  const EVENT_DEFS = [
    {
      key: 'meeting',
      weight: 35,
      title: '作戦会議',
      say: '作戦会議！連携力がアップ！',
      apply(team){
        ensureTeamEventState(team);
        team.eventBuffs.agilityP += 1; // +1%
      }
    },
    {
      key: 'huddle',
      weight: 35,
      title: '円陣',
      say: '円陣を組んだ！ファイト力がアップ！',
      apply(team){
        ensureTeamEventState(team);
        team.eventBuffs.aimP += 1; // +1%
      }
    },
    {
      key: 'scan',
      weight: 35,
      title: '冷静な索敵',
      say: '冷静に索敵！先手を取りやすくなる！',
      apply(team){
        ensureTeamEventState(team);
        team.eventBuffs.mentalP += 1; // +1%
      }
    },
    {
      key: 'rare_weapon',
      weight: 10,
      title: 'レア武器ゲット',
      say: 'レア武器を拾った！全員のエイムが大きくアップ！',
      apply(team){
        ensureTeamEventState(team);
        team.eventBuffs.aimP += 2; // +2%
      }
    },
    {
      key: 'misjudge',
      weight: 15,
      title: '判断ミス',
      say: '向かう方向が分かれてタイムロス！敏捷性が下がった！',
      apply(team){
        ensureTeamEventState(team);
        team.eventBuffs.agilityP -= 1; // -1%
      }
    },
    {
      key: 'fight',
      weight: 10,
      title: '喧嘩',
      say: 'コールが嚙み合わない！全員のメンタルが減少！',
      apply(team){
        ensureTeamEventState(team);
        team.eventBuffs.mentalP -= 1; // -1%
      }
    },
    {
      key: 'zone',
      weight: 5,
      title: 'ゾーンに入る',
      say: '全員がゾーンに入り覚醒！',
      apply(team){
        ensureTeamEventState(team);
        team.eventBuffs.aimP += 3;    // +3%
        team.eventBuffs.mentalP += 3; // +3%
      }
    },
    {
      key: 'treasure',
      weight: 4,
      title: 'お宝ゲット',
      say: 'お宝をゲットした！',
      apply(team){
        ensureTeamEventState(team);
        team.treasure = (Number(team.treasure) || 0) + 1; // +1（大会ポイント用）
      }
    },
    {
      key: 'flag',
      weight: 2,
      title: 'フラッグゲット',
      say: 'フラッグをゲットした！',
      apply(team){
        ensureTeamEventState(team);
        team.flag = (Number(team.flag) || 0) + 1; // +1（大会ポイント用）
      }
    }
  ];

  // =========================
  // Round counts（確定）
  // =========================
  function getEventCountForRound(round){
    const r = Number(round) || 0;
    if (r === 1) return 1;
    if (r >= 2 && r <= 5) return 2;
    return 0; // R6 基本なし
  }

  // =========================
  // State utilities
  // =========================
  function getTeamsFromState(state){
    // 柔軟対応：state.teams / state.teamStates / state.allTeams
    if (!state) return [];
    if (Array.isArray(state.teams)) return state.teams;
    if (Array.isArray(state.teamStates)) return state.teamStates;
    if (Array.isArray(state.allTeams)) return state.allTeams;
    return [];
  }

  function isEliminated(team){
    return !!team?.eliminated || (Number(team?.alive) || 0) <= 0 && team?.eliminated === true;
  }

  function ensureTeamEventState(team){
    if (!team) return;

    // eventBuffs（その試合中のみ）
    if (!team.eventBuffs || typeof team.eventBuffs !== 'object'){
      team.eventBuffs = { aimP:0, mentalP:0, agilityP:0 };
    }else{
      // 欠けていても補完
      if (!Number.isFinite(Number(team.eventBuffs.aimP))) team.eventBuffs.aimP = 0;
      if (!Number.isFinite(Number(team.eventBuffs.mentalP))) team.eventBuffs.mentalP = 0;
      if (!Number.isFinite(Number(team.eventBuffs.agilityP))) team.eventBuffs.agilityP = 0;
    }

    // treasure / flag（result用カウント）
    if (!Number.isFinite(Number(team.treasure))) team.treasure = 0;
    if (!Number.isFinite(Number(team.flag))) team.flag = 0;
  }

  // 試合開始時の安全初期化（eventBuffsは試合ごとにリセット必須）
  function resetMatchEventBuffs(state){
    const teams = getTeamsFromState(state);
    teams.forEach(t=>{
      if (!t) return;
      ensureTeamEventState(t);
      t.eventBuffs.aimP = 0;
      t.eventBuffs.mentalP = 0;
      t.eventBuffs.agilityP = 0;
      // treasure/flag は「試合中のカウント」扱いならここで0にする想定。
      // もし「大会を跨いで保持」したいなら reset は match_result 側で管理する。
      // ここは “試合開始時の安全初期化” として 0 に戻す。
      t.treasure = 0;
      t.flag = 0;
    });
  }

  // =========================
  // Weighted pick without replacement（重複なし）
  // =========================
  function pickWeightedOne(items){
    // items: [{weight,...}]
    let sum = 0;
    for (const it of items){
      sum += Math.max(0, Number(it.weight) || 0);
    }
    if (sum <= 0) return null;

    let r = Math.random() * sum;
    for (const it of items){
      r -= Math.max(0, Number(it.weight) || 0);
      if (r <= 0) return it;
    }
    return items[items.length - 1] || null;
  }

  function pickWeightedNoDup(defs, count){
    const pool = defs.slice();
    const picked = [];
    const n = Math.max(0, Math.min(pool.length, Number(count) || 0));
    for (let i=0; i<n; i++){
      const one = pickWeightedOne(pool);
      if (!one) break;
      picked.push(one);
      // remove by key（同イベント重複禁止）
      const idx = pool.findIndex(d => d.key === one.key);
      if (idx >= 0) pool.splice(idx, 1);
    }
    return picked;
  }

  // =========================
  // Team choose（イベント対象チーム）
  // =========================
  function pickTeamForEvent(teams){
    // eliminated=false のみ
    const aliveTeams = (teams || []).filter(t => t && !isEliminated(t));
    if (!aliveTeams.length) return null;
    return aliveTeams[Math.floor(Math.random() * aliveTeams.length)];
  }

  // =========================
  // Public: rollRoundEvents
  // =========================
  /*
    state:
      - teams[] に各チーム状態が入っている想定（teamId, alive, eliminated, eventBuffs, treasure, flag など）
    round: 1..6

    return:
      {
        round,
        events: [
          {
            eventKey, eventTitle,
            teamId,
            lines: ["イベント発生！","（イベント名）","表示セリフ（数値なし）"]
          }, ...
        ]
      }
  */
  function rollRoundEvents(state, round){
    const r = Number(round) || 0;
    const count = getEventCountForRound(r);

    const teams = getTeamsFromState(state);
    // 初期化は呼ぶ側がやってもいいが、安全のためチーム構造だけは整える
    teams.forEach(t => ensureTeamEventState(t));

    const pack = { round: r, events: [] };
    if (count <= 0) return pack;

    // ラウンド内イベント抽選（重複なし）
    const defs = pickWeightedNoDup(EVENT_DEFS, count);

    for (const def of defs){
      const team = pickTeamForEvent(teams);
      if (!team) break;

      // 適用
      try{
        def.apply(team);
      }catch(e){
        console.warn('[match_events] apply failed:', def?.key, e);
      }

      // ログ素材（数値なし／3段固定）
      const teamId = String(team.teamId ?? team.id ?? team.key ?? 'unknown');
      pack.events.push({
        eventKey: def.key,
        eventTitle: def.title,
        teamId,
        lines: [
          'イベント発生！',
          `（${def.title}）`,
          String(def.say || '')
        ]
      });
    }

    return pack;
  }

  // =========================
  // Helper: getEventBuffMultipliers（内部計算用の補助）
  // =========================
  // ※表示しない。battle側が必要なら使える。
  function getEventBuffMultipliers(team){
    ensureTeamEventState(team);
    const b = team.eventBuffs;
    const aimM     = 1 + (Number(b.aimP) || 0) / 100;
    const mentalM  = 1 + (Number(b.mentalP) || 0) / 100;
    const agilityM = 1 + (Number(b.agilityP) || 0) / 100;
    return { aimM, mentalM, agilityM };
  }

  // =========================
  // Expose
  // =========================
  window.MOBBR.match.events = {
    VERSION,
    EVENT_DEFS, // デバッグ用（UIに表示しない）
    getEventCountForRound,
    resetMatchEventBuffs,
    rollRoundEvents,
    getEventBuffMultipliers
  };
})();
