'use strict';

/*
  MOB BR - data_player.js（FULL / split整合）
  - ui_team_core.js / ui_team_training.js が必ず参照するAPIを提供
    ✅ window.MOBBR.data.player.buildDefaultTeam()
    ✅ window.MOBBR.data.player.normalizeStats(stats)

  - 4ステ（hp/aim/tech/mental）を中核にしつつ、
    旧UI互換の表示項目（agi/support/scan/armor）も安全に補完
  - points / upgradeCount / skills の初期形も同時に保証できるように定義
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.data = window.MOBBR.data || {};

(function(){

  const P = {};

  // =========================
  // util
  // =========================
  function clamp(n, min, max){
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }
  function clamp0(n){ return Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0); }
  function clamp0to99(n){ return clamp(n, 0, 99); }
  function clamp0to30(n){ return clamp(n, 0, 30); }
  function clamp0to100(n){ return clamp(n, 0, 100); }
  function ensureObj(x){ return (x && typeof x === 'object') ? x : {}; }

  // =========================
  // normalizeStats
  // =========================
  /*
    - 4ステを必ず返す（hp/aim/tech/mental）
    - 表示互換：agi/support/scan/armor も返す
    - 数値でないものは 0（armorのみ100）へ
    - 範囲：hp/aim/tech/mental/agi/support/scan は 0..99、armor は 0..100
  */
  P.normalizeStats = function normalizeStats(stats){
    const s = ensureObj(stats);

    const out = {
      hp: clamp0to99(s.hp ?? 0),
      aim: clamp0to99(s.aim ?? 0),
      tech: clamp0to99(s.tech ?? 0),
      mental: clamp0to99(s.mental ?? 0),

      // 旧UI互換（表示用に残す）
      agi: clamp0to99(s.agi ?? 0),
      support: clamp0to99(s.support ?? 0),
      scan: clamp0to99(s.scan ?? 0),

      // armor は 100 が自然な既定値
      armor: clamp0to100(Number.isFinite(Number(s.armor)) ? s.armor : 100)
    };

    return out;
  };

  // =========================
  // Default Member Template
  // =========================
  function buildDefaultMember(id, role){
    // 4ステは 55 基準（あなたの要望：試合側の55固定回避・%反映の土台としても安定）
    const base = 55;

    return {
      id: String(id),
      role: String(role || ''),

      // name は ui_team 側が storage の m1/m2/m3 を表示するため、ここでは空でOK
      name: '',

      // ステータス（4ステ + 表示互換）
      stats: {
        hp: base,
        aim: base,
        tech: base,
        mental: base,

        // 旧UI互換（表示だけ想定：必要なら後で育成対象へ追加可能）
        agi: base,
        support: base,
        scan: base,
        armor: 100
      },

      // 表示枠（未定でOK）
      passive: '',
      ult: '',

      // ✅ポイント統一：points {muscle, tech, mental}
      points: { muscle: 0, tech: 0, mental: 0 },

      // ✅ステアップ累計（4ステのみ）
      upgradeCount: { hp: 0, aim: 0, tech: 0, mental: 0 },

      // ✅スキル（id -> {plus})
      skills: {}
    };
  }

  // =========================
  // buildDefaultTeam
  // =========================
  /*
    ui_team_core.js が localStorage(K.playerTeam) が無い/壊れた場合に呼びます。
    - members は必ず A/B/C を含む
    - teamPower は後で ui_team_core 側が計算して保存するが、初期値も入れておく
  */
  P.buildDefaultTeam = function buildDefaultTeam(){
    const team = {
      ver: 'team_v1',
      teamPower: 55,

      // メンバー3人
      members: [
        buildDefaultMember('A', 'IGL'),
        buildDefaultMember('B', 'アタッカー'),
        buildDefaultMember('C', 'サポーター')
      ]
    };

    // 念のため stats を正規化
    for (const m of team.members){
      m.stats = P.normalizeStats(m.stats);
    }

    return team;
  };

  // =========================
  // Optional helpers (将来用)
  // =========================

  /*
    ensureMemberMeta / ensureTeamMeta は ui_team_core 側にもありますが、
    他モジュールから data_player 側を参照する可能性があるため、
    “安全な補完関数”として置いておきます（機能は削りません）。
  */

  P.ensurePoints = function ensurePoints(mem){
    if (!mem || typeof mem !== 'object') return;

    if (!mem.points || typeof mem.points !== 'object'){
      mem.points = { muscle:0, tech:0, mental:0 };
    }
    mem.points.muscle = clamp0(mem.points.muscle);
    mem.points.tech   = clamp0(mem.points.tech);
    mem.points.mental = clamp0(mem.points.mental);
  };

  P.ensureMemberMeta = function ensureMemberMeta(mem){
    if (!mem || typeof mem !== 'object') return;

    // stats
    mem.stats = P.normalizeStats(mem.stats);

    // points
    P.ensurePoints(mem);

    // upgradeCount
    if (!mem.upgradeCount || typeof mem.upgradeCount !== 'object'){
      mem.upgradeCount = { hp:0, aim:0, tech:0, mental:0 };
    }
    for (const k of ['hp','aim','tech','mental']){
      mem.upgradeCount[k] = clamp(Number(mem.upgradeCount[k] ?? 0), 0, 999999);
    }

    // skills
    if (!mem.skills || typeof mem.skills !== 'object'){
      mem.skills = {};
    }
    for (const sid in mem.skills){
      const ent = mem.skills[sid];
      if (!ent || typeof ent !== 'object'){
        mem.skills[sid] = { plus:0 };
        continue;
      }
      ent.plus = clamp0to30(ent.plus);
    }

    // role/id 安全化
    mem.id = String(mem.id || '');
    mem.role = String(mem.role || '');
  };

  P.ensureTeamMeta = function ensureTeamMeta(team){
    if (!team || typeof team !== 'object') return;
    if (!Array.isArray(team.members)) team.members = [];
    team.members.forEach(P.ensureMemberMeta);
  };

  // =========================
  // export
  // =========================
  window.MOBBR.data.player = P;

})();
