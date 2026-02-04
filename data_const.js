/* =====================================================
   data_const.js
   - ゲーム全体の固定定数（UI/STATE/SIM で参照）
   - 仕様の“数値固定”をここに集約（参照のみ）
   ===================================================== */

(() => {

  const DATA_CONST = {
    /* -------------------------------------
       表示／基本
       ------------------------------------- */
    GAME_TITLE: 'MOB Battle Royale Simulator',

    // プレイヤー表示（装備中のP?.png で差し替える）
    DEFAULT_PLAYER_IMAGE: 'P1.png',
    PLAYER_TEAM_NAME: 'あなたの部隊',

    // 背景（固定ファイル名）
    BG_MAIN: 'main.png',
    BG_IDO: 'ido.png',
    BG_MAP: 'map.png',
    BG_SHOP: 'shop.png',
    BG_BATTLE: 'battle.png',
    BG_WINNER: 'winner.png',

    /* -------------------------------------
       チーム／試合の大枠
       ------------------------------------- */
    PARTY_SIZE: 3,
    TEAMS_PER_MATCH: 20,

    // 1試合のラウンド構成（確定）
    ROUNDS: [1, 2, 3, 4, 5, 6],

    // マップ（確定）
    // R1-R2: Area1-16 / R3: 17-20 / R4: 21-22 / R5: 23-24 / R6: 25固定
    AREA_BY_ROUND: {
      1: { min: 1, max: 16 },
      2: { min: 1, max: 16 },
      3: { min: 17, max: 20 },
      4: { min: 21, max: 22 },
      5: { min: 23, max: 24 },
      6: { min: 25, max: 25 },
    },

    FINAL_AREA_ID: 25,

    // ラウンド終了時点の生存チーム数（確定）
    // R1:20→16 / R2:16→12 / R3:12→8 / R4:8→4 / R5:4→2 / R6:2→1
    ALIVE_TEAMS_AFTER_ROUND: {
      1: 16,
      2: 12,
      3: 8,
      4: 4,
      5: 2,
      6: 1,
    },

    /* -------------------------------------
       交戦枠（確定）
       ------------------------------------- */
    FIGHTS_PER_ROUND: {
      1: 4,
      2: 4,
      3: 4,
      4: 4,
      5: 2,
      6: 1,
    },

    // プレイヤーが交戦に巻き込まれる確率（確定）
    PLAYER_FIGHT_CHANCE: {
      1: 1.00, // 被りなら100%（開始配置で処理）
      2: 0.70,
      3: 0.75,
      4: 0.80,
      5: 0.85,
      6: 1.00,
    },

    /* -------------------------------------
       リスポーン（確定）
       ------------------------------------- */
    RESPAWN: {
      // R1-R5
      NORMAL: {
        // deathBoxes=1 → 100%で1人復活
        DB1_REVIVE_COUNT: 1,
        // deathBoxes=2 → 70%で2人復活 / 30%で1人復活
        DB2_REVIVE_2_RATE: 0.70,
        DB2_REVIVE_1_RATE: 0.30,
      },
      // R6開始時：deathBoxes>=1なら全員復帰（alive=3, deathBoxes=0）
      FINAL_FORCE_FULL_REVIVE: true,
    },

    /* -------------------------------------
       イベント（確定：重み抽選）
       - R1=1個 / R2-R5=2個（同ラウンド重複なし） / R6基本なし
       ------------------------------------- */
    EVENTS: {
      COUNT_BY_ROUND: { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 0 },
      LIST: [
        {
          id: 'meeting',
          weight: 35,
          name: '作戦会議',
          line: '作戦会議！連携力がアップ！',
          effect: { type: 'buff', aimPct: 0, mentalPct: 0, agilityPct: 1, treasure: 0, flag: 0 },
        },
        {
          id: 'huddle',
          weight: 35,
          name: '円陣',
          line: '円陣を組んだ！ファイト力がアップ！',
          effect: { type: 'buff', aimPct: 1, mentalPct: 0, agilityPct: 0, treasure: 0, flag: 0 },
        },
        {
          id: 'scan',
          weight: 35,
          name: '冷静な索敵',
          line: '冷静に索敵！先手を取りやすくなる！',
          effect: { type: 'buff', aimPct: 0, mentalPct: 1, agilityPct: 0, treasure: 0, flag: 0 },
        },
        {
          id: 'rare_weapon',
          weight: 10,
          name: 'レア武器ゲット',
          line: 'レア武器を拾った！全員のエイムが大きくアップ！',
          effect: { type: 'buff', aimPct: 2, mentalPct: 0, agilityPct: 0, treasure: 0, flag: 0 },
        },
        {
          id: 'mistake',
          weight: 15,
          name: '判断ミス',
          line: '向かう方向が分かれてタイムロス！敏捷性が下がった！',
          effect: { type: 'buff', aimPct: 0, mentalPct: 0, agilityPct: -1, treasure: 0, flag: 0 },
        },
        {
          id: 'fight',
          weight: 10,
          name: '喧嘩',
          line: 'コールが嚙み合わない！全員のメンタルが減少！',
          effect: { type: 'buff', aimPct: 0, mentalPct: -1, agilityPct: 0, treasure: 0, flag: 0 },
        },
        {
          id: 'zone',
          weight: 5,
          name: 'ゾーンに入る',
          line: '全員がゾーンに入り覚醒！',
          effect: { type: 'buff', aimPct: 3, mentalPct: 3, agilityPct: 0, treasure: 0, flag: 0 },
        },
        {
          id: 'treasure',
          weight: 4,
          name: 'お宝ゲット',
          line: 'お宝をゲットした！',
          effect: { type: 'count', aimPct: 0, mentalPct: 0, agilityPct: 0, treasure: 1, flag: 0 },
        },
        {
          id: 'flag',
          weight: 2,
          name: 'フラッグゲット',
          line: 'フラッグをゲットした！',
          effect: { type: 'count', aimPct: 0, mentalPct: 0, agilityPct: 0, treasure: 0, flag: 1 },
        },
      ],
    },

    /* -------------------------------------
       勝率計算（確定）
       ------------------------------------- */
    WINRATE: {
      // A勝率 = clamp(50 + (A-B)*1.8, 22, 78)
      SCALE: 1.8,
      MIN: 22,
      MAX: 78,
    },

    // 人数補正（確定）
    // alive=2 の時だけ「総合力 +40%補正」
    ALIVE2_POWER_BONUS_PCT: 40,

    /* -------------------------------------
       戦闘結果（勝者側も削れる：DB抽選固定）
       ------------------------------------- */
    WINNER_DB_LOSS: {
      // 0人:55% / 1人:35% / 2人:10%
      LOSS0: 0.55,
      LOSS1: 0.35,
      LOSS2: 0.10,
    },

    /* -------------------------------------
       result（確定）
       ------------------------------------- */
    PLACEMENT_POINTS: {
      1: 12,
      2: 8,
      3: 5,
      4: 3,
      5: 2,
      // 6〜10は1、11〜20は0（sim側で処理しやすいよう関数化してもOKだがここは定数のみ）
      6: 1,
      7: 1,
      8: 1,
      9: 1,
      10: 1,
    },

    // ボーナス
    BONUS: {
      KP_PER_1: 1,
      AP_PER_1: 1,
      TREASURE_PER_1: 1,
      FLAG_PER_1: 2, // Flagは×2
    },

    /* -------------------------------------
       キル／アシスト（確定ルール）
       ------------------------------------- */
    ASSIST_RULE: {
      // 1キルにつき最大1アシスト（Assist ≤ Kill を絶対保証）
      MAX_ASSIST_PER_KILL: 1,
    },

    // 個人配分重み（確定）
    ROLE_KILL_WEIGHT: {
      attacker: 50,
      igl: 30,
      support: 20,
    },
  };

  window.DATA_CONST = DATA_CONST;

})();
