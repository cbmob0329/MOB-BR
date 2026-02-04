/* =========================================================
   MOB BR - data_rules.js (FULL)
   - 大会仕様
   - マップ仕様
   - アイテム / コーチスキル（定義）
   - 育成・定数まとめ（定義）
   ---------------------------------------------------------
   注意：
   ・ここは “定義データ置き場”
   ・内部数値（%/勝率等）はUIに出さない前提
   ・表示文言（台詞）はここに置けるが、最終表示は ui.js
========================================================= */

(function(){
  'use strict';

  const RULES = {};
  window.RULES = RULES;

  /* =========================
     GAME META
  ========================== */
  RULES.GAME = {
    title: 'MOB Battle Royale',
    teamSize: 3,
    lobbyTeams: 20,
    autoMs: 3000,
    saveVersion: 1,
  };

  /* =========================
     DATE / WEEK
     - 1989年開始（コンセプト準拠）
     - 1行動=1週
  ========================== */
  RULES.CALENDAR = {
    startYear: 1989,
    startMonth: 1,
    startWeek: 1,
    weeksPerMonth: 4,
  };

  /* =========================
     ECONOMY
     - 企業ランク等で毎週Gを得る想定（値は storage.js 側で決定してもOK）
  ========================== */
  RULES.ECONOMY = {
    weeklyGBase: 50,
    weeklyGRankBonus: {
      // 例：企業ランクが上がるほど増える（実際の算出は storage.js）
      D: 0,
      C: 30,
      B: 60,
      A: 120,
      S: 220,
    }
  };

  /* =========================
     TOURNAMENTS
     - ローカル / ナショナル / ワールド を想定
     - 週のトリガは storage.js が参照するだけの定義
  ========================== */
  RULES.TOURNAMENT = {
    tiers: ['LOCAL','NATIONAL','WORLD'],
    // 開催パターン（例：一定周期で発生）
    schedule: {
      LOCAL:    { everyWeeks: 4,  label: 'ローカル大会' },
      NATIONAL: { everyWeeks: 12, label: 'ナショナル大会' },
      WORLD:    { everyWeeks: 24, label: 'ワールドファイナル' },
    },
    startMessages: {
      LOCAL:    'ローカル大会 開幕！',
      NATIONAL: 'ナショナル大会 開幕！',
      WORLD:    'ワールドファイナル 開幕！',
    },
  };

  /* =========================
     MAP / AREA
     - Area1〜25（R6はArea25固定）
     - 画像ファイル名は assets/ 以下
  ========================== */
  RULES.MAP = {
    // ラウンドごとのエリア集合（確定）
    roundAreas: {
      R1: range(1,16),
      R2: range(1,16),
      R3: range(17,20),
      R4: range(21,22),
      R5: range(23,24),
      R6: [25],
    },

    // 背景画像（推奨）
    // ※プロジェクト側で area01.png 等が無い場合でも動くようフォールバックを入れる
    // ※最終は neonfinal.png 推奨
    areaBackground: (areaId) => {
      if(areaId === 25) return 'assets/neonfinal.png';
      // まず areaXX.png を探す前提の命名
      const id2 = String(areaId).padStart(2,'0');
      return `assets/area${id2}.png`;
    },

    // 画面演出に使う共通背景
    screens: {
      main:   'assets/main1.png',
      ido:    'assets/ido.png',
      map:    'assets/map.png',
      shop:   'assets/shop.png',
      battle: 'assets/battle.png',
      winner: 'assets/winner.png',
    },

    // エリア名（未確定があればここを後で差し替え）
    // ※ここは“表示名”で、内部判定は areaId を使う
    areaNames: {
      1:'Area 1',  2:'Area 2',  3:'Area 3',  4:'Area 4',
      5:'Area 5',  6:'Area 6',  7:'Area 7',  8:'Area 8',
      9:'Area 9', 10:'Area 10',11:'Area 11',12:'Area 12',
      13:'Area 13',14:'Area 14',15:'Area 15',16:'Area 16',
      17:'Area 17',18:'Area 18',19:'Area 19',20:'Area 20',
      21:'Area 21',22:'Area 22',23:'Area 23',24:'Area 24',
      25:'Final Area',
    }
  };

  /* =========================
     MATCH FLOW (重要定数)
     - “枠数ぶん必ず交戦が起きる” を前提に定義
  ========================== */
  RULES.MATCH = {
    rounds: [
      { r:1, fights:4, aliveTeamsAfter:16, playerFightRate: 1.00 },
      { r:2, fights:4, aliveTeamsAfter:12, playerFightRate: 0.70 },
      { r:3, fights:4, aliveTeamsAfter: 8, playerFightRate: 0.75 },
      { r:4, fights:4, aliveTeamsAfter: 4, playerFightRate: 0.80 },
      { r:5, fights:2, aliveTeamsAfter: 2, playerFightRate: 0.85 },
      { r:6, fights:1, aliveTeamsAfter: 1, playerFightRate: 1.00 },
    ],

    // リスポーン（確定）
    respawn: {
      // 通常ラウンド（R1〜R5）
      normal: {
        // deathBoxes=1 -> 100% で1人復活
        one: { revive: 1, prob: 1.0 },

        // deathBoxes=2 -> 70%で2人, 30%で1人
        two: [
          { revive: 2, prob: 0.70 },
          { revive: 1, prob: 0.30 },
        ],
      },

      // 最終（R6）: deathBoxes>=1 なら全員復活（揺れ排除）
      final: {
        reviveAllIfAny: true
      },

      logs: {
        revive2: 'デスボ回収成功！一気に2人復帰！',
        revive1: 'デスボ回収…1人しか戻せない！',
        none:    '復活対象なし。全員生存！',
        finalAll:'最終前に全員復帰！万全で行く！'
      }
    },

    // DB（勝者も削れる）
    deathBoxOnWin: [
      { down:0, prob:0.55 },
      { down:1, prob:0.35 },
      { down:2, prob:0.10 },
    ],

    // チーム戦闘力（内部）
    // 差→勝率：clamp(50 + 差*1.8, 22, 78)
    battle: {
      baseWin: 50,
      diffMul: 1.8,
      clampMin: 22,
      clampMax: 78,
      // alive=2 の時だけ +40%補正
      twoManBonus: 0.40,
    },

    // キル配分重み（確定）
    killRoleWeights: {
      ATTACKER: 50,
      IGL: 30,
      SUPPORT: 20,
    },

    // アシストは「1キルにつき最大1A」(Assist <= Kill を絶対保証)
    assistRule: {
      maxAssistPerKill: 1
    }
  };

  /* =========================
     EVENTS (確定)
     - 発生回数：R1=1 / R2-R5=2 / R6=基本なし
     - 重み抽選：数値は表示しない
  ========================== */
  RULES.EVENTS = {
    perRound: {
      1: 1,
      2: 2,
      3: 2,
      4: 2,
      5: 2,
      6: 0,
    },

    // 重複なし・全滅チーム除外は sim.js 側の責務
    list: [
      ev('STRATEGY', '作戦会議', '作戦会議！連携力がアップ！', 35, { aimMul:1.00, mentalMul:1.00, agilityMul:1.01 }),
      ev('CIRCLE',   '円陣',     '円陣を組んだ！ファイト力がアップ！', 35, { aimMul:1.01, mentalMul:1.00, agilityMul:1.00 }),
      ev('SCOUT',    '冷静な索敵','冷静に索敵！先手を取りやすくなる！', 35, { aimMul:1.00, mentalMul:1.01, agilityMul:1.00 }),

      ev('RARE',     'レア武器ゲット', 'レア武器を拾った！全員のエイムが大きくアップ！', 10, { aimMul:1.02 }),
      ev('MISS',     '判断ミス',       '向かう方向が分かれてタイムロス！敏捷性が下がった！', 15, { agilityMul:0.99 }),
      ev('FIGHT',    '喧嘩',           'コールが嚙み合わない！全員のメンタルが減少！', 10, { mentalMul:0.99 }),

      ev('ZONE',     'ゾーンに入る',   '全員がゾーンに入り覚醒！', 5, { aimMul:1.03, mentalMul:1.03 }),
      ev('TREASURE', 'お宝ゲット',     'お宝をゲットした！', 4, { treasure:+1 }),
      ev('FLAG',     'フラッグゲット', 'フラッグをゲットした！', 2, { flag:+1 }),
    ],

    // 表示テンポは必ず3段（ui.jsで step 3つにする想定）
    display: {
      line1: 'イベント発生！',
      // line2: (イベント名)
      // line3: (表示セリフ)
    }
  };

  /* =========================
     RESULT / POINTS (確定)
  ========================== */
  RULES.RESULT = {
    placementP: {
      1:12, 2:8, 3:5, 4:3, 5:2,
      // 6〜10 =1, 11〜20 =0 は関数で
    },
    bonus: {
      kp: 1,      // 1K = +1
      ap: 1,      // 1A = +1
      treasure: 1,// +1
      flag: 2     // 1Flag = +2
    },
    placementPointOf(place){
      if(this.placementP[place] != null) return this.placementP[place];
      if(place >= 6 && place <= 10) return 1;
      return 0;
    },
    totalOf({ place, kp, ap, treasure, flag }){
      const pp = this.placementPointOf(place);
      return pp + (kp||0) + (ap||0) + (treasure||0) + (flag||0)*this.bonus.flag;
    }
  };

  /* =========================
     ITEMS / COACH SKILLS
     - ここは “統合仕様”に沿って拡張していく前提
     - 今は枠と命名だけ固定（後で UI/Shop に接続）
  ========================== */
  RULES.ITEMS = {
    // 例：ショップで買う/拾うアイテム
    list: [
      item('HEAL_SMALL', '小回復',  50, '回復アイテム（小）'),
      item('HEAL_LARGE', '大回復', 120, '回復アイテム（大）'),
      item('ARMOR_UP',   'アーマー強化', 180, 'アーマーを強化する'),
      item('AIM_UP',     'エイム強化',   180, 'エイムを強化する'),
      item('AGI_UP',     '敏捷強化',     180, '敏捷を強化する'),
    ]
  };

  RULES.COACH = {
    // 例：試合ごとに1回指示できる（実装は app/sim 側）
    skills: [
      coachSkill('CALL_PUSH', '詰めろ！', '一気に詰める指示（交戦で強気になる）'),
      coachSkill('CALL_HOLD', '耐えろ！', '耐える指示（被害を抑える）'),
      coachSkill('CALL_ROTATE','回れ！',  '移動を優先する指示（遭遇の質を変える）'),
    ]
  };

  /* =========================
     TRAINING / GROWTH (育成)
     - “行動で少し上がる”思想だけ定義
     - 詳細ロジックは storage.js / app.js 側で拡張
  ========================== */
  RULES.TRAINING = {
    actions: [
      train('SANDBAG', 'サンドバッグ', ['aim','stamina']),
      train('SHADOW',  'シャドー',     ['agility','mental']),
      train('ROPE',    '縄跳び',       ['agility','stamina']),
      train('MUSCLE',  '筋トレ',       ['tech','stamina']),
      train('SPAR',    'スパー',       ['aim','mental']),
    ],
    // 1週で上がる最小/最大（内部）
    gainRange: { min: 1, max: 3 }
  };

  /* =========================
     UTIL FACTORIES
  ========================== */
  function ev(id, name, line, weight, effect){
    return { id, name, line, weight, effect: effect || {} };
  }
  function item(id, name, cost, desc){
    return { id, name, cost, desc };
  }
  function coachSkill(id, name, desc){
    return { id, name, desc };
  }
  function train(id, name, keys){
    return { id, name, keys: keys || [] };
  }
  function range(a,b){
    const out = [];
    for(let i=a;i<=b;i++) out.push(i);
    return out;
  }

})();
