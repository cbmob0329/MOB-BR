/* =====================================================
   data_teams_local.js  (FULL)
   MOB Tournament Simulation
   ローカル大会：20チーム（強豪7 / 中堅5 / 通常8）
   ===================================================== */

window.DATA_TEAMS_LOCAL = (function () {

  // passive.effects は sim 側で解釈して適用するための「機械可読」データ。
  // まだ sim が未完成でも、ログ表示・UI表示にそのまま使える。
  // 注意：Armorの上限100などの丸めは sim_battle 側で最終処理。

  const TEAMS = [

    /* =========================
       ローカル：強豪チーム（7）
       ========================= */

    {
      id: "L_STRONG_01",
      tier: "LOCAL",
      group: "LOCAL_STRONG",
      name: "ハンマーズ",
      powerPct: 79,
      style: "勢いのあるムーブ",
      members: ["キスケ", "ヅッチー", "ブラウン"],
      passive: {
        name: "勢い加速",
        desc: "戦闘開始時、味方全員のAim+2",
        effects: [
          { when: "battleStart", type: "addStatAll", stat: "Aim", value: 2 }
        ]
      }
    },
    {
      id: "L_STRONG_02",
      tier: "LOCAL",
      group: "LOCAL_STRONG",
      name: "マツヤマーズ",
      powerPct: 78,
      style: "着実なムーブ",
      members: ["トニトニ", "ロジャー", "マルティン"],
      passive: {
        name: "着実進行",
        desc: "毎ターン、味方全員のArmor+2（最大100）",
        effects: [
          { when: "eachTurn", type: "addArmorAll", value: 2, cap: 100 }
        ]
      }
    },
    {
      id: "L_STRONG_03",
      tier: "LOCAL",
      group: "LOCAL_STRONG",
      name: "ギャラクシー",
      powerPct: 73,
      style: "激しいムーブ",
      members: ["スターズ", "ロケッツ", "グルトン"],
      passive: {
        name: "銀河熱量",
        desc: "戦闘中、味方全員のAgility+2",
        effects: [
          { when: "battle", type: "addStatAll", stat: "Agility", value: 2 }
        ]
      }
    },
    {
      id: "L_STRONG_04",
      tier: "LOCAL",
      group: "LOCAL_STRONG",
      name: "ビーダマンズ",
      powerPct: 72,
      style: "エイムに自信あり",
      members: ["フェニックス", "ワイバーン", "スフィンクス"],
      passive: {
        name: "照準安定",
        desc: "味方全員の命中率+3%",
        effects: [
          { when: "battle", type: "addRateAll", rate: "hitRate", valuePct: 3 }
        ]
      }
    },
    {
      id: "L_STRONG_05",
      tier: "LOCAL",
      group: "LOCAL_STRONG",
      name: "マカイムラ",
      powerPct: 71,
      style: "メンタル高め",
      members: ["クサチー", "メタッツ", "グレムリン"],
      passive: {
        name: "鋼メンタル",
        desc: "戦闘中、味方全員のMental消費-10%",
        effects: [
          { when: "battle", type: "addRateAll", rate: "mentalCost", valuePct: -10 }
        ]
      }
    },
    {
      id: "L_STRONG_06",
      tier: "LOCAL",
      group: "LOCAL_STRONG",
      name: "温泉愛好会",
      powerPct: 69,
      style: "どうご系チーム",
      members: ["どうごすけ", "たかのこぞー", "ひめひこっち"],
      passive: {
        name: "湯けむり回復",
        desc: "戦闘開始時、味方全員HP+5",
        effects: [
          { when: "battleStart", type: "addStatAll", stat: "HP", value: 5 }
        ]
      }
    },
    {
      id: "L_STRONG_07",
      tier: "LOCAL",
      group: "LOCAL_STRONG",
      name: "三色坊ちゃんズ",
      powerPct: 68,
      style: "バランス",
      members: ["もちもち", "あまあま", "まんぷく"],
      passive: {
        name: "三色バランス",
        desc: "味方全員のAim+1＆Agility+1",
        effects: [
          { when: "battle", type: "addStatAll", stat: "Aim", value: 1 },
          { when: "battle", type: "addStatAll", stat: "Agility", value: 1 }
        ]
      }
    },

    /* =========================
       ローカル：中堅チーム（5）
       ========================= */

    {
      id: "L_MID_01",
      tier: "LOCAL",
      group: "LOCAL_MID",
      name: "ファイアファイターズ",
      powerPct: 68,
      style: "炎の如く攻撃",
      members: ["キャンプ", "マキっち", "トカゲイヌ"],
      passive: {
        name: "火力上等",
        desc: "味方全員の攻撃ダメージ+5%",
        effects: [
          { when: "battle", type: "addRateAll", rate: "damage", valuePct: 5 }
        ]
      }
    },
    {
      id: "L_MID_02",
      tier: "LOCAL",
      group: "LOCAL_MID",
      name: "ゴーストライダー",
      powerPct: 67,
      style: "お化け集団",
      members: ["ゴーストン", "ゴスクー", "おばけっち"],
      passive: {
        name: "ゴースト回避",
        desc: "味方全員の被弾率-3%",
        effects: [
          { when: "battle", type: "addRateAll", rate: "beHitRate", valuePct: -3 }
        ]
      }
    },
    {
      id: "L_MID_03",
      tier: "LOCAL",
      group: "LOCAL_MID",
      name: "ホイホイホイム",
      powerPct: 66,
      style: "回復チーム",
      members: ["ホイスケ", "ホイミー", "ホームン"],
      passive: {
        name: "回復の輪",
        desc: "戦闘中、味方全員の回復アイテム効果+10%",
        effects: [
          { when: "battle", type: "addRateAll", rate: "healItem", valuePct: 10 }
        ]
      }
    },
    {
      id: "L_MID_04",
      tier: "LOCAL",
      group: "LOCAL_MID",
      name: "タートルパンチ",
      powerPct: 66,
      style: "カメの如し",
      members: ["クリケット", "ジャックハンマー", "UFO"],
      passive: {
        name: "シェルガード",
        desc: "味方全員のArmorダメージ-5%",
        effects: [
          { when: "battle", type: "addRateAll", rate: "armorDamageTaken", valuePct: -5 }
        ]
      }
    },
    {
      id: "L_MID_05",
      tier: "LOCAL",
      group: "LOCAL_MID",
      name: "鋼鉄部隊",
      powerPct: 63,
      style: "固い守り",
      members: ["タフネス", "スタミン", "タウリン"],
      passive: {
        name: "鉄壁構え",
        desc: "戦闘開始時、味方全員Armor+10（最大100）",
        effects: [
          { when: "battleStart", type: "addArmorAll", value: 10, cap: 100 }
        ]
      }
    },

    /* =========================
       ローカル：通常チーム（8）
       ========================= */

    {
      id: "L_NORMAL_01",
      tier: "LOCAL",
      group: "LOCAL_NORMAL",
      name: "ヤミウチ",
      powerPct: 66,
      style: "奇襲",
      members: ["ヤンク", "ウラウラ", "ヤミール"],
      passive: {
        name: "闇討ち",
        desc: "戦闘1ターン目だけ味方全員のAim+4",
        effects: [
          { when: "turn1Only", type: "addStatAll", stat: "Aim", value: 4 }
        ]
      }
    },
    {
      id: "L_NORMAL_02",
      tier: "LOCAL",
      group: "LOCAL_NORMAL",
      name: "ドングリ隊",
      powerPct: 58,
      style: "転がり連携",
      members: ["ドンドン", "グリグリ", "コロコロ"],
      passive: {
        name: "転がり連携",
        desc: "味方全員のMove+1（戦闘中のみ）",
        // 「Move補正禁止」は“コーチスキル”のルール。パッシブはOKとしてデータ化。
        effects: [
          { when: "battle", type: "addStatAll", stat: "Move", value: 1 }
        ]
      }
    },
    {
      id: "L_NORMAL_03",
      tier: "LOCAL",
      group: "LOCAL_NORMAL",
      name: "カミナダシモナダ",
      powerPct: 58,
      style: "波風ムーブ",
      members: ["うみち", "かぜち", "なみち"],
      passive: {
        name: "波風ムーブ",
        desc: "戦闘中、味方全員のAgility+1＆被弾率-1%",
        effects: [
          { when: "battle", type: "addStatAll", stat: "Agility", value: 1 },
          { when: "battle", type: "addRateAll", rate: "beHitRate", valuePct: -1 }
        ]
      }
    },
    {
      id: "L_NORMAL_04",
      tier: "LOCAL",
      group: "LOCAL_NORMAL",
      name: "イチロク",
      powerPct: 58,
      style: "地味に強い",
      members: ["タルト", "ミカタル", "まっちゃ"],
      passive: {
        name: "地味に強い",
        desc: "HPが半分以下の時、味方全員のAim+2",
        effects: [
          { when: "hpHalfOrLess", type: "addStatAll", stat: "Aim", value: 2 }
        ]
      }
    },
    {
      id: "L_NORMAL_05",
      tier: "LOCAL",
      group: "LOCAL_NORMAL",
      name: "ヤマノコ",
      powerPct: 58,
      style: "山の勘",
      members: ["ハヤシ", "コヤ", "テンキ"],
      passive: {
        name: "山の勘",
        desc: "戦闘開始時、敵の弱ってるキャラを狙う確率+10%",
        effects: [
          { when: "battleStart", type: "addRateAll", rate: "focusWeakTarget", valuePct: 10 }
        ]
      }
    },
    {
      id: "L_NORMAL_06",
      tier: "LOCAL",
      group: "LOCAL_NORMAL",
      name: "キリノモリ",
      powerPct: 57,
      style: "霧の迷彩",
      members: ["だいふく", "まんじゅう", "こな"],
      passive: {
        name: "霧の迷彩",
        desc: "味方全員の被弾率-2%",
        effects: [
          { when: "battle", type: "addRateAll", rate: "beHitRate", valuePct: -2 }
        ]
      }
    },
    {
      id: "L_NORMAL_07",
      tier: "LOCAL",
      group: "LOCAL_NORMAL",
      name: "ポコポコペン",
      powerPct: 57,
      style: "調子",
      members: ["らむね", "さいだー", "コロッケ"],
      passive: {
        name: "ポコポコ調子",
        desc: "戦闘中、味方全員のCrit率+1%",
        effects: [
          { when: "battle", type: "addRateAll", rate: "critRate", valuePct: 1 }
        ]
      }
    },
    {
      id: "L_NORMAL_08",
      tier: "LOCAL",
      group: "LOCAL_NORMAL",
      name: "ポテサラ隊",
      powerPct: 57,
      style: "腹持ち",
      members: ["ポテト", "ハム", "きゅうり"],
      passive: {
        name: "腹持ち",
        desc: "戦闘開始時、味方全員HP+7",
        effects: [
          { when: "battleStart", type: "addStatAll", stat: "HP", value: 7 }
        ]
      }
    }
  ];

  function getAll() { return TEAMS.slice(); }
  function getById(id) { return TEAMS.find(t => t.id === id) || null; }

  return {
    teams: TEAMS,
    getAll,
    getById
  };

})();
