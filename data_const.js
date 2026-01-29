/* =========================================================
   data_const.js (FULL)
   - ゲーム全体で共有する定数・パラメータ
   - ルールで「確定」とされた数値をここに集約
   - Move補正のコーチスキルは禁止（※const側にも禁止フラグ）
   ========================================================= */

(() => {
  'use strict';

  // ----------------------------
  // 基本ゲーム定数
  // ----------------------------
  const GAME = Object.freeze({
    TITLE: 'MOB BATTLE ROYALE SIM',
    VERSION: 'v0.1.0',
    TEAMS_PER_MATCH: 20,
    PARTY_SIZE: 3,

    // 週システム
    WEEKS_PER_MONTH: 4,

    // 1戦ログ/表示（UIの邪魔にならない程度）
    LOG_MAX: 200,
  });

  // ----------------------------
  // 戦闘：確定ルール（まとめ準拠）
  // ----------------------------
  const BATTLE = Object.freeze({
    // Armor固定（基本100）
    ARMOR_BASE: 100,

    // 乱戦最大
    MAX_TEAMS_IN_BRAWL: 3,

    // 行動速度：Agility + Move×2 + 乱数(0〜10)
    SPEED_RANDOM_MIN: 0,
    SPEED_RANDOM_MAX: 10,

    // 弱狙い率 = 25% + Technique×4%（最大80%）
    WEAK_TARGET_BASE: 0.25,
    WEAK_TARGET_PER_TECH: 0.04,
    WEAK_TARGET_CAP: 0.80,

    // 命中率：clamp( 50 + (Aim - Agility)×0.7 , 15 , 85 )
    // 最終キャップ：最大90% / 最低10%
    HIT_BASE: 50,
    HIT_AIM_MINUS_AGI_COEF: 0.7,
    HIT_PRE_MIN: 15,
    HIT_PRE_MAX: 85,
    HIT_FINAL_MIN: 10,
    HIT_FINAL_MAX: 90,

    // ダメージ
    // Damage = BaseDamage × (0.85 + Aim/200 + Technique/250) × Rand(0.9〜1.1)
    DMG_MULT_BASE: 0.85,
    DMG_AIM_DIV: 200,
    DMG_TECH_DIV: 250,
    DMG_RAND_MIN: 0.9,
    DMG_RAND_MAX: 1.1,

    // 1発の最大ダメージ：45（クリ込みでも超えない）
    DMG_CAP_PER_HIT: 45,

    // クリ：CritChance(%) = clamp( 2 + Technique×0.6 , 2 , 8 ), クリ時×1.4
    CRIT_BASE: 2,
    CRIT_PER_TECH: 0.6,
    CRIT_MIN: 2,
    CRIT_MAX: 8,
    CRIT_MULT: 1.4,

    // アイテム：1行動で1個まで（自分の行動の最初に判定）
    ITEM_MAX_PER_TURN: 1,

    // 無効化上限
    // 同じキャラ：同じ戦闘内で最大1回
    // チーム全体：最大2回
    NULLIFY_PER_CHARACTER_CAP: 1,
    NULLIFY_PER_TEAM_CAP: 2,

    // キル・アシスト
    KILL_POINTS: 2,
    ASSIST_POINTS: 1,

    // TechniqueReq不足ペナルティ
    TECH_REQ_HIT_PENALTY: 8, // -8%
  });

  // ----------------------------
  // バフ/デバフ キャップ（確定）
  // ----------------------------
  const CAPS = Object.freeze({
    AIM_BUFF_MAX: 15,     // アビ/ウルト/武器補正 合計で最大+15
    AGI_BUFF_MAX: 10,     // 最大+10
    ENEMY_AIM_DOWN_MAX: 12, // 敵Aimダウン 最大-12
  });

  // ----------------------------
  // 修行（育成）確定ルール
  // ----------------------------
  const TRAINING = Object.freeze({
    // 経験値が20で能力+1
    XP_PER_STAT_UP: 20,

    // どれを選んでも全能力XP+1（共通）
    COMMON_XP: 1,

    // 専門は対象能力XP+4追加
    SPECIAL_XP: 4,

    // 総合演習は全能力XP+2
    ALLROUND_XP: 2,

    // 修行メニュー
    MENUS: Object.freeze([
      {
        id: 'shoot',
        name: '射撃練習',
        icon: 'syageki.png',
        type: 'special',
        adds: { Aim: 4, Agility: 4 },
      },
      {
        id: 'dash',
        name: 'ダッシュ',
        icon: 'dash.png',
        type: 'special',
        adds: { Agility: 4, HP: 4 },
      },
      {
        id: 'puzzle',
        name: 'パズル',
        icon: 'paz.png',
        type: 'special',
        adds: { Technique: 4, Mental: 4 },
      },
      {
        id: 'practical',
        name: '実戦練習',
        icon: 'zitugi.png',
        type: 'special',
        adds: { Aim: 4, HP: 4 },
      },
      {
        id: 'waterfall',
        name: '滝修行',
        icon: 'taki.png',
        type: 'special',
        adds: { Mental: 4, HP: 4 },
      },
      {
        id: 'research',
        name: '研究',
        icon: 'kenq.png',
        type: 'special',
        adds: { Technique: 4, Support: 4 },
      },
      {
        id: 'all',
        name: '総合演習',
        icon: 'sougou.png',
        type: 'all',
        adds: { All: 2 },
      },
    ]),
  });

  // ----------------------------
  // Synergy（連携）ルール（確定）
  // A-B, A-C, B-C を足して3で割った値がチームSynergy
  // さらに 10 で割った %分、それぞれのキャラHPアップ
  // ----------------------------
  const SYNERGY = Object.freeze({
    INITIAL: 20,
    MAX_SOFT: 200,
    HP_BONUS_DIV: 10, // synergy/10 [%]
  });

  // ----------------------------
  // コーチスキルの禁止事項
  // ----------------------------
  const COACH_SKILL_RULES = Object.freeze({
    // Move補正のコーチスキルは禁止
    FORBID_MOVE_MOD: true,
  });

  // expose
  window.DATA_CONST = Object.freeze({
    GAME,
    BATTLE,
    CAPS,
    TRAINING,
    SYNERGY,
    COACH_SKILL_RULES,
  });
})();
