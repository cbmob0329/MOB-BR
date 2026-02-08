'use strict';

/*
  MOB BR - data_tournament.js v1（フル）
  役割：
  - 「大会の進行ルール＋大会UI表示」を“唯一の正”として完全定義する（データのみ）
  - 試合中の戦闘ロジック／勝敗計算／内部数値処理は含まない
  - UI/進行ロジック側は、このデータを読んで「表示＆遷移」を組み立てる

  重要（仕様の核）
  - プレイヤーは常にAグループ固定
  - 大会ごとに他チームをランダム振り分け（総合%上位10チームは必ず登場）
  - NEXT進行：1試合ごとに「結果(20)→総合順位(進捗)→次の試合」形式
  - 40チーム大会は「同時に2試合（20×2）＝同一マッチDay」として扱い、
    マッチDay終了ごとに総合順位(1〜40)を更新する
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.data = window.MOBBR.data || {};

(function(){
  const VERSION = 'v1';

  // =========================================================
  // 1) 共通：順位pt / キルpt / アシストpt / お宝 / フラッグ
  // =========================================================
  const POINTS = {
    placement: {
      1:12, 2:8, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1, 9:1, 10:1
      // 11〜20は0
    },
    kill: 1,     // 1キル = 1pt
    assist: 1,   // 1アシスト = 1pt（上限なし）
    treasure: 1, // お宝 +1pt
    flag: 2      // フラッグ +2pt
  };

  // =========================================================
  // 2) 同点時優先順位（総合順位）
  // =========================================================
  const TIEBREAKERS = [
    'totalPoints',
    'totalKills',
    'avgPlacement',
    'totalAssists',
    'random'
  ];

  // =========================================================
  // 3) 賞金＆企業ランクUP（大会別）
  // =========================================================
  // rankRange: [min,max]（両端含む）
  const PRIZES = {
    LOCAL: [
      { rankRange:[1,1], gold:  50000, rankUp: 3 },
      { rankRange:[2,2], gold:  30000, rankUp: 2 },
      { rankRange:[3,3], gold:  10000, rankUp: 1 },
      { rankRange:[4,6], gold:   3000, rankUp: 0 }
    ],
    NATIONAL: [
      { rankRange:[1,1], gold: 300000, rankUp: 5 },
      { rankRange:[2,2], gold: 150000, rankUp: 3 },
      { rankRange:[3,3], gold:  50000, rankUp: 2 },
      { rankRange:[4,6], gold:  10000, rankUp: 1 }
    ],
    WORLD_FINAL: [
      { rankRange:[1,1], gold:1000000, rankUp: 30 },
      { rankRange:[2,2], gold: 500000, rankUp: 15 },
      { rankRange:[3,3], gold: 300000, rankUp: 10 },
      { rankRange:[4,6], gold: 100000, rankUp: 3 }
    ],
    CHAMPIONSHIP_WORLD_FINAL: [
      { rankRange:[1,1], gold:3000000, rankUp: 50 },
      { rankRange:[2,2], gold:1000000, rankUp: 30 },
      { rankRange:[3,3], gold: 500000, rankUp: 15 },
      { rankRange:[4,6], gold: 250000, rankUp: 5 }
    ]
  };

  // =========================================================
  // 4) 大会開始UI（週開始時・メッセージ）
  // =========================================================
  const START_WEEK_MESSAGES = {
    LOCAL: [
      'いよいよ大会が始まるね！',
      'ファイナル目指して頑張ろう！'
    ],
    NATIONAL: [
      'いよいよナショナル大会だね！',
      '世界大会進出への大事な大会！落ち着いていこう！'
    ],
    WORLD_FINAL: [
      'いよいよ世界大会だね！',
      '世界一目指して頑張ろう！'
    ],
    CHAMPIONSHIP_WORLD_FINAL: [
      'いよいよ世界大会だね！',
      '世界一目指して頑張ろう！'
    ]
  };

  // =========================================================
  // 5) 大会会場UI（tent→アナウンス→NEXT→試合）
  //    ※ここは「表示文の辞書」。実装はUI側。
  // =========================================================
  const VENUE_FLOW = {
    background: 'neonmain.png',
    tentBg: 'tent.png',
    // メインで「bbattle.png」を押したらこの確認が出る想定
    enterConfirmText: '大会へ向かいますか？',
    nextButton: {
      label: 'NEXT',
      floatAnim: true,     // 少し上下にふわふわ
      smallButVisible: true
    },
    announceByPhaseId: {
      LOCAL_CALL: [
        '全ての始まり、ローカル大会を行います！',
        '上位10チームがナショナルチームへ進出します！'
      ],

      NATIONAL_OPEN: [
        'ナショナル代表として世界への挑戦権をかけた戦いが始まります！'
      ],
      NATIONAL_MID: [
        'ナショナル大会中盤戦！さあどこが勝つ！'
      ],
      NATIONAL_END: [
        'ナショナル大会、試合数も残り僅か！さあ覚悟を決めて戦場へ！'
      ],
      NATIONAL_LAST_CHANCE_CALL: [
        '世界への最後のチャンス！夢を掴むのは2チームのみ！'
      ],

      WORLD_LEAGUE_1: [
        '世界大会開幕！ファイナルへの道はどのチームが掴む!?'
      ],
      WORLD_LEAGUE_2: [
        'まだまだ始まったばかり！さあ仲間と戦場へ！'
      ],
      WORLD_LEAGUE_3: [
        'これでWinners、Losersが決定！予選ラストスパートだ！'
      ],
      WORLD_WINNERS: [
        '予選を勝ち上がった猛者たちによるファイナルをかけた大一番！'
      ],
      WORLD_LOSERS: [
        'ファイナルへの道はまだ残されている！反撃開始だ！'
      ],
      WORLD_LOSERS2: [
        'これが本当のラストチャンス！全力で挑むんだ！'
      ],
      WORLD_FINAL: [
        'いよいよ世界一が決まる!!歴史に名を刻むのはどのチームだ！'
      ]
    }
  };

  // =========================================================
  // 6) 大会“共通ルール”のデータ化
  // =========================================================
  const COMMON_RULES = {
    playerGroupFixed: 'A',
    nonPlayerGroupsAutoProcess: true,
    topOverallPercentTeamsMustAppear: 10,
    tournamentWeekTrainingDisabled: true,
    // 大会の出番が無い週は修行可能（例：第1週大会、第3週出番 → 第2週は修行可）
    ifNoMatchThisWeekThenTrainingAllowed: true,
    // 大会中ログは切替方式（流れない）
    tournamentLogsArePaged: true,
    // 基本：出番が終わったら一度メインへ戻る（フェーズ境界で使用）
    returnToMainAfterBlock: true
  };

  // =========================================================
  // 7) 進行データ：Local / National / LastChance / WorldFinal
  //    ※ここが “A & B” を正しく表す中心データ
  // =========================================================
  //
  // 用語
  // - group: A/B/C/D （各10チーム）※40チーム大会のみ
  // - lobby: 1試合（最大20チーム）。例：A&B=20チームで1試合
  // - matchDay: 同一タイミングの試合セット
  //   - 40大会では通常 lobbies が2つ（A&B と C&D）
  //   - matchDay 終了ごとに総合順位(1〜40)を更新し表示する
  //
  // 表示ルール（あなたの確定）
  // - 1 matchDay ごとに：
  //   ① 各 lobby のresult（1〜20）
  //   ② 現在の総合順位（20または40）と進捗（例 1/5）
  //   ③ NEXTで次の matchDay
  //
  const TOURNAMENTS = {
    LOCAL: {
      key: 'LOCAL',
      displayName: 'ローカル大会',
      teamCount: 20,
      groups: null, // 20チーム単独なのでグループ分割は無し
      playerGroupFixed: 'A', // “固定”ルールとして保持（意味的には参加枠側で処理）
      matchesPerLobbyResult: 20,
      overallStandingCount: 20,
      rounds: 5,
      phaseOrder: ['LOCAL_CALL','LOCAL_MAIN','LOCAL_END'],
      phases: {
        LOCAL_CALL: {
          phaseId: 'LOCAL_CALL',
          venueAnnounce: true,
          venueAnnounceKey: 'LOCAL_CALL',
          description: 'テントでの大会名コール → NEXTで第1試合へ'
        },
        LOCAL_MAIN: {
          phaseId: 'LOCAL_MAIN',
          description: '5試合（20チーム）を1試合ずつ進行。毎試合result→総合順位(1/5..5/5)。',
          matchDays: [
            { day:1, progressText:'(1/5)', lobbies:[ { lobbyId:'LOCAL', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 },
            { day:2, progressText:'(2/5)', lobbies:[ { lobbyId:'LOCAL', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 },
            { day:3, progressText:'(3/5)', lobbies:[ { lobbyId:'LOCAL', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 },
            { day:4, progressText:'(4/5)', lobbies:[ { lobbyId:'LOCAL', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 },
            { day:5, progressText:'(5/5)', lobbies:[ { lobbyId:'LOCAL', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 }
          ],
          returnToMainAfterPhase: true
        },
        LOCAL_END: {
          phaseId: 'LOCAL_END',
          description: '最終総合順位(1〜20)確定→上位10通過/敗退UI',
          endUi: {
            passTopN: 10,
            passText: '〇位通過でナショナル大会へ！頑張ろうね！',
            failText: '総合〇位となり敗退…次に向けて頑張ろう！'
          }
        }
      }
    },

    NATIONAL: {
      key: 'NATIONAL',
      displayName: 'ナショナル大会',
      teamCount: 40,
      groups: ['A','B','C','D'], // 各10
      groupSize: 10,
      playerGroupFixed: 'A',
      overallStandingCount: 40,
      // ナショナルは複数週に跨る
      phaseOrder: [
        'NATIONAL_OPEN',
        'NATIONAL_EARLY',
        'NATIONAL_MID',
        'NATIONAL_LATE'
      ],
      phases: {
        NATIONAL_OPEN: {
          phaseId: 'NATIONAL_OPEN',
          venueAnnounce: true,
          venueAnnounceKey: 'NATIONAL_OPEN',
          description: 'テントでの大会コール → NEXTで序盤へ'
        },

        // 序盤：A&B(5) + C&D(5) → メインへ
        NATIONAL_EARLY: {
          phaseId: 'NATIONAL_EARLY',
          description:
            '序盤：同一matchDayで2試合（A&B と C&D）を行う。matchDayごとに result(20×2)→総合順位(1〜40)更新。',
          weekBlock: 1,
          matchDays: [
            { day:1, progressText:'序盤 (1/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:2, progressText:'序盤 (2/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:3, progressText:'序盤 (3/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:4, progressText:'序盤 (4/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:5, progressText:'序盤 (5/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 }
          ],
          returnToMainAfterPhase: true
        },

        // 中盤：A&C（5）※単一ロビー（20）
        // ただし大会全体の総合順位は40で更新する（他グループは裏で同時進行として集計される扱い）
        NATIONAL_MID: {
          phaseId: 'NATIONAL_MID',
          venueAnnounce: true,
          venueAnnounceKey: 'NATIONAL_MID',
          description:
            '中盤：プレイヤー出番はA&C（20）で進める。裏で他グループも即時計算（ログ無し）し、総合順位(1〜40)は毎試合更新。',
          weekBlock: 1,
          matchDays: [
            { day:1, progressText:'中盤 (1/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
            { day:2, progressText:'中盤 (2/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
            { day:3, progressText:'中盤 (3/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
            { day:4, progressText:'中盤 (4/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
            { day:5, progressText:'中盤 (5/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 }
          ],
          returnToMainAfterPhase: true
        },

        // 終盤（第2週）：B&C(5) / A&D(5) / B&D(5)
        // あなたの原文にある通り “終盤は複数ブロック” なので、ここはブロック単位でphaseを分割する形にする
        NATIONAL_LATE: {
          phaseId: 'NATIONAL_LATE',
          venueAnnounce: true,
          venueAnnounceKey: 'NATIONAL_END',
          description:
            '終盤：複数ブロックを順に進行。各matchDayごとにresult→総合順位(1〜40)更新。',
          weekBlock: 2,
          blocks: [
            {
              blockId: 'BC',
              title: '終盤：B & C',
              matchDays: [
                { day:1, progressText:'終盤BC (1/5)', lobbies:[ {lobbyId:'BC', groups:['B','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:2, progressText:'終盤BC (2/5)', lobbies:[ {lobbyId:'BC', groups:['B','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:3, progressText:'終盤BC (3/5)', lobbies:[ {lobbyId:'BC', groups:['B','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:4, progressText:'終盤BC (4/5)', lobbies:[ {lobbyId:'BC', groups:['B','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:5, progressText:'終盤BC (5/5)', lobbies:[ {lobbyId:'BC', groups:['B','C'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 }
              ],
              returnToMainAfterBlock: true
            },
            {
              blockId: 'AD',
              title: '終盤：A & D',
              matchDays: [
                { day:1, progressText:'終盤AD (1/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:2, progressText:'終盤AD (2/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:3, progressText:'終盤AD (3/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:4, progressText:'終盤AD (4/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:5, progressText:'終盤AD (5/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 }
              ],
              returnToMainAfterBlock: true
            },
            {
              blockId: 'BD',
              title: '終盤：B & D',
              matchDays: [
                { day:1, progressText:'終盤BD (1/5)', lobbies:[ {lobbyId:'BD', groups:['B','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:2, progressText:'終盤BD (2/5)', lobbies:[ {lobbyId:'BD', groups:['B','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:3, progressText:'終盤BD (3/5)', lobbies:[ {lobbyId:'BD', groups:['B','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:4, progressText:'終盤BD (4/5)', lobbies:[ {lobbyId:'BD', groups:['B','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 },
                { day:5, progressText:'終盤BD (5/5)', lobbies:[ {lobbyId:'BD', groups:['B','D'], teamCount:20} ], shadowAutoProcess:true, showResult:true, showOverall:true, overallTeams:40 }
              ],
              returnToMainAfterBlock: true
            }
          ],
          endUi: {
            showOverallStanding: true,
            overallStandingCount: 40,
            // ナショナル終了UI
            tierText: {
              top8: '〇位でワールドファイナル確定！',
              mid:  '〇位でラストチャンスへ進出！',
              fail: '〇位で敗退…次に向けて頑張ろう！'
            },
            tiers: [
              { name:'WORLD_FINAL', rankRange:[1,8] },
              { name:'LAST_CHANCE', rankRange:[9,28] },
              { name:'ELIMINATED',  rankRange:[29,40] }
            ],
            // 出場権なし週の文言
            noEntryText: [
              '今日はナショナル大会！',
              '出場はできないけど結果をチェックしよう！'
            ]
          }
        }
      }
    },

    LAST_CHANCE: {
      key: 'LAST_CHANCE',
      displayName: 'ラストチャンス',
      teamCount: 20, // 9〜28位=20チーム
      groups: null,
      playerGroupFixed: 'A',
      overallStandingCount: 20,
      phaseOrder: ['NATIONAL_LAST_CHANCE_CALL','LAST_CHANCE_MAIN','LAST_CHANCE_END'],
      phases: {
        NATIONAL_LAST_CHANCE_CALL: {
          phaseId: 'NATIONAL_LAST_CHANCE_CALL',
          venueAnnounce: true,
          venueAnnounceKey: 'NATIONAL_LAST_CHANCE_CALL',
          description: 'ラストチャンス開始コール → NEXT'
        },
        LAST_CHANCE_MAIN: {
          phaseId: 'LAST_CHANCE_MAIN',
          description: '5試合（20チーム）を1試合ずつ進行。毎試合result→総合順位(1/5..5/5)。',
          matchDays: [
            { day:1, progressText:'(1/5)', lobbies:[ { lobbyId:'LC', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 },
            { day:2, progressText:'(2/5)', lobbies:[ { lobbyId:'LC', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 },
            { day:3, progressText:'(3/5)', lobbies:[ { lobbyId:'LC', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 },
            { day:4, progressText:'(4/5)', lobbies:[ { lobbyId:'LC', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 },
            { day:5, progressText:'(5/5)', lobbies:[ { lobbyId:'LC', groups:['ALL'], teamCount:20 } ], showResult:true, showOverall:true, overallTeams:20 }
          ],
          returnToMainAfterPhase: true
        },
        LAST_CHANCE_END: {
          phaseId: 'LAST_CHANCE_END',
          description: '最終総合順位(1〜20)確定→上位2がワールドファイナル進出',
          endUi: {
            passTopN: 2,
            passText: 'ワールドファイナル進出！',
            failText: '敗退…次に向けて頑張ろう！'
          }
        }
      }
    },

    WORLD_FINAL: {
      key: 'WORLD_FINAL',
      displayName: 'ワールドファイナル',
      teamCount: 40,
      groups: ['A','B','C','D'],
      groupSize: 10,
      playerGroupFixed: 'A',
      overallStandingCount: 40,
      phaseOrder: [
        'WORLD_LEAGUE_1',
        'WORLD_QUAL_1',
        'WORLD_LEAGUE_2',
        'WORLD_QUAL_2',
        'WORLD_LEAGUE_3',
        'WORLD_QUAL_3',
        'WORLD_WINNERS',
        'WORLD_WINNERS_BLOCK',
        'WORLD_LOSERS',
        'WORLD_LOSERS_BLOCK',
        'WORLD_LOSERS2',
        'WORLD_LOSERS2_BLOCK',
        'WORLD_FINAL',
        'WORLD_FINAL_CONDITION',
        'WORLD_END'
      ],
      phases: {
        WORLD_LEAGUE_1: { phaseId:'WORLD_LEAGUE_1', venueAnnounce:true, venueAnnounceKey:'WORLD_LEAGUE_1', description:'予選リーグ1コール → NEXT' },
        WORLD_QUAL_1: {
          phaseId: 'WORLD_QUAL_1',
          description: '予選リーグ1：A&B(5) + C&D(5) 同時2試合。matchDayごとに総合順位(1〜40)更新。',
          matchDays: [
            { day:1, progressText:'予選1 (1/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:2, progressText:'予選1 (2/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:3, progressText:'予選1 (3/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:4, progressText:'予選1 (4/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:5, progressText:'予選1 (5/5)', lobbies:[ {lobbyId:'AB', groups:['A','B'], teamCount:20}, {lobbyId:'CD', groups:['C','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 }
          ],
          returnToMainAfterPhase: true
        },

        WORLD_LEAGUE_2: { phaseId:'WORLD_LEAGUE_2', venueAnnounce:true, venueAnnounceKey:'WORLD_LEAGUE_2', description:'予選リーグ2コール → NEXT' },
        WORLD_QUAL_2: {
          phaseId: 'WORLD_QUAL_2',
          description: '予選リーグ2：A&C(5) + B&D(5)。matchDayごとに総合順位(1〜40)更新。',
          matchDays: [
            { day:1, progressText:'予選2 (1/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20}, {lobbyId:'BD', groups:['B','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:2, progressText:'予選2 (2/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20}, {lobbyId:'BD', groups:['B','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:3, progressText:'予選2 (3/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20}, {lobbyId:'BD', groups:['B','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:4, progressText:'予選2 (4/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20}, {lobbyId:'BD', groups:['B','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:5, progressText:'予選2 (5/5)', lobbies:[ {lobbyId:'AC', groups:['A','C'], teamCount:20}, {lobbyId:'BD', groups:['B','D'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 }
          ],
          returnToMainAfterPhase: true
        },

        WORLD_LEAGUE_3: { phaseId:'WORLD_LEAGUE_3', venueAnnounce:true, venueAnnounceKey:'WORLD_LEAGUE_3', description:'予選リーグ3コール → NEXT' },
        WORLD_QUAL_3: {
          phaseId: 'WORLD_QUAL_3',
          description: '予選リーグ3：A&D(5) + B&C(5)。終了後にWinners/Losers振り分けUI。',
          matchDays: [
            { day:1, progressText:'予選3 (1/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20}, {lobbyId:'BC', groups:['B','C'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:2, progressText:'予選3 (2/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20}, {lobbyId:'BC', groups:['B','C'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:3, progressText:'予選3 (3/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20}, {lobbyId:'BC', groups:['B','C'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:4, progressText:'予選3 (4/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20}, {lobbyId:'BC', groups:['B','C'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 },
            { day:5, progressText:'予選3 (5/5)', lobbies:[ {lobbyId:'AD', groups:['A','D'], teamCount:20}, {lobbyId:'BC', groups:['B','C'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:40 }
          ],
          afterPhaseUi: {
            split: [
              { name:'WINNERS', rankRange:[1,20], text:'Winners進出！' },
              { name:'LOSERS',  rankRange:[21,40], text:'Losersへ！まだまだここから！' }
            ]
          },
          returnToMainAfterPhase: true
        },

        WORLD_WINNERS: { phaseId:'WORLD_WINNERS', venueAnnounce:true, venueAnnounceKey:'WORLD_WINNERS', description:'Winnersコール → NEXT' },
        WORLD_WINNERS_BLOCK: {
          phaseId: 'WORLD_WINNERS_BLOCK',
          description: 'Winners：5試合→上位10がFINAL確定、下位10はLosers2へ',
          matchDays: [
            { day:1, progressText:'Winners (1/5)', lobbies:[ {lobbyId:'WIN', groups:['WINNERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:2, progressText:'Winners (2/5)', lobbies:[ {lobbyId:'WIN', groups:['WINNERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:3, progressText:'Winners (3/5)', lobbies:[ {lobbyId:'WIN', groups:['WINNERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:4, progressText:'Winners (4/5)', lobbies:[ {lobbyId:'WIN', groups:['WINNERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:5, progressText:'Winners (5/5)', lobbies:[ {lobbyId:'WIN', groups:['WINNERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 }
          ],
          afterPhaseUi: {
            textTop: 'FINAL進出！やったね！',
            textBottom: 'Losers2へ！まだまだここから！',
            tiers: [
              { name:'FINAL',   rankRange:[1,10] },
              { name:'LOSERS2', rankRange:[11,20] }
            ]
          },
          returnToMainAfterPhase: true
        },

        WORLD_LOSERS: { phaseId:'WORLD_LOSERS', venueAnnounce:true, venueAnnounceKey:'WORLD_LOSERS', description:'Losersコール → NEXT' },
        WORLD_LOSERS_BLOCK: {
          phaseId: 'WORLD_LOSERS_BLOCK',
          description: 'Losers：5試合→上位10がLosers2、下位10が敗退',
          matchDays: [
            { day:1, progressText:'Losers (1/5)', lobbies:[ {lobbyId:'LOS', groups:['LOSERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:2, progressText:'Losers (2/5)', lobbies:[ {lobbyId:'LOS', groups:['LOSERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:3, progressText:'Losers (3/5)', lobbies:[ {lobbyId:'LOS', groups:['LOSERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:4, progressText:'Losers (4/5)', lobbies:[ {lobbyId:'LOS', groups:['LOSERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:5, progressText:'Losers (5/5)', lobbies:[ {lobbyId:'LOS', groups:['LOSERS'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 }
          ],
          afterPhaseUi: {
            textTop: 'Losers2進出！最後のチャンスだよ！',
            textBottom: '敗退…次に向けて頑張ろう！',
            tiers: [
              { name:'LOSERS2',   rankRange:[1,10] },
              { name:'ELIMINATED',rankRange:[11,20] }
            ]
          },
          returnToMainAfterPhase: true
        },

        WORLD_LOSERS2: { phaseId:'WORLD_LOSERS2', venueAnnounce:true, venueAnnounceKey:'WORLD_LOSERS2', description:'Losers2コール → NEXT' },
        WORLD_LOSERS2_BLOCK: {
          phaseId: 'WORLD_LOSERS2_BLOCK',
          description: 'Losers2：5試合→上位10がFINAL、下位10が敗退',
          matchDays: [
            { day:1, progressText:'Losers2 (1/5)', lobbies:[ {lobbyId:'L2', groups:['LOSERS2'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:2, progressText:'Losers2 (2/5)', lobbies:[ {lobbyId:'L2', groups:['LOSERS2'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:3, progressText:'Losers2 (3/5)', lobbies:[ {lobbyId:'L2', groups:['LOSERS2'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:4, progressText:'Losers2 (4/5)', lobbies:[ {lobbyId:'L2', groups:['LOSERS2'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 },
            { day:5, progressText:'Losers2 (5/5)', lobbies:[ {lobbyId:'L2', groups:['LOSERS2'], teamCount:20} ], showResult:true, showOverall:true, overallTeams:20 }
          ],
          afterPhaseUi: {
            textTop: 'FINAL進出！やったね！',
            textBottom: '敗退…次に向けて頑張ろう！',
            tiers: [
              { name:'FINAL',     rankRange:[1,10] },
              { name:'ELIMINATED',rankRange:[11,20] }
            ]
          },
          returnToMainAfterPhase: true
        },

        WORLD_FINAL: { phaseId:'WORLD_FINAL', venueAnnounce:true, venueAnnounceKey:'WORLD_FINAL', description:'FINALコール → NEXT' },
        WORLD_FINAL_CONDITION: {
          phaseId: 'WORLD_FINAL_CONDITION',
          description: 'FINAL：条件決着（80pt点灯→80以上でチャンピオン獲得したら優勝確定）',
          conditionWin: {
            lampAtPoints: 80,
            winWhenChampionWithPointsAtLeast: 80,
            note: '80到達時点では優勝しない'
          }
        },
        WORLD_END: {
          phaseId: 'WORLD_END',
          description: '終了UI（優勝/非優勝）',
          endUi: {
            winText: [
              '優勝おめでとう!!',
              '最高の結果だね！○○G獲得したよ！次も頑張ってね！'
            ],
            loseText: [
              '優勝チームは○○！',
              '私たちは○位！よく頑張ったね！'
            ]
          }
        }
      }
    },

    CHAMPIONSHIP_WORLD_FINAL: {
      // 実体はWORLD_FINALと同じ構造だが、賞金＆企業ランクが別
      key: 'CHAMPIONSHIP_WORLD_FINAL',
      displayName: 'チャンピオンシップ ワールドファイナル',
      baseTournament: 'WORLD_FINAL',
      prizeTableKey: 'CHAMPIONSHIP_WORLD_FINAL',
      note: '進行はWORLD_FINALと同一。報酬だけ別テーブル。'
    }
  };

  // =========================================================
  // 8) 年間スケジュール（完全版）
  //    month: 1..12 / week: 1..4（第何週）
  // =========================================================
  const SCHEDULE = [
    // ===== Split 1 =====
    { split:'SPLIT1', month:2, week:1, tournamentKey:'LOCAL' },
    { split:'SPLIT1', month:3, week:1, tournamentKey:'NATIONAL', phaseHint:'NATIONAL_EARLY' },
    { split:'SPLIT1', month:3, week:2, tournamentKey:'NATIONAL', phaseHint:'NATIONAL_LATE' },
    { split:'SPLIT1', month:3, week:3, tournamentKey:'LAST_CHANCE' },
    { split:'SPLIT1', month:4, week:1, tournamentKey:'WORLD_FINAL' },

    // ===== Split 2 =====
    { split:'SPLIT2', month:7, week:1, tournamentKey:'LOCAL' },
    { split:'SPLIT2', month:8, week:1, tournamentKey:'NATIONAL', phaseHint:'NATIONAL_EARLY' },
    { split:'SPLIT2', month:8, week:2, tournamentKey:'NATIONAL', phaseHint:'NATIONAL_LATE' },
    { split:'SPLIT2', month:8, week:3, tournamentKey:'LAST_CHANCE' },
    { split:'SPLIT2', month:9, week:1, tournamentKey:'WORLD_FINAL' },

    // ===== Championship League =====
    { split:'CHAMPIONSHIP', month:11, week:1, tournamentKey:'LOCAL' },
    { split:'CHAMPIONSHIP', month:12, week:1, tournamentKey:'NATIONAL', phaseHint:'NATIONAL_EARLY' },
    { split:'CHAMPIONSHIP', month:12, week:2, tournamentKey:'NATIONAL', phaseHint:'NATIONAL_LATE' },
    { split:'CHAMPIONSHIP', month:12, week:3, tournamentKey:'LAST_CHANCE' },
    { split:'CHAMPIONSHIP', month:1, week:2, tournamentKey:'CHAMPIONSHIP_WORLD_FINAL' }
  ];

  // =========================================================
  // 9) 小さなヘルパー（UI/進行側が読むための“参照”）
  //    ※内部処理や勝敗計算はしない（データ参照のみ）
  // =========================================================
  function getTournament(key){
    return TOURNAMENTS[String(key || '').toUpperCase()] || null;
  }

  function getPrizeTableForTournamentKey(key){
    const t = getTournament(key);
    if (!t) return null;
    const k = t.prizeTableKey || t.key;
    return PRIZES[k] || null;
  }

  function getStartWeekMessageLines(tournamentKey){
    const t = getTournament(tournamentKey);
    if (!t) return [];
    const k = (t.baseTournament && START_WEEK_MESSAGES[t.baseTournament])
      ? t.baseTournament
      : t.key;
    return START_WEEK_MESSAGES[k] || [];
  }

  function listScheduleForMonth(month){
    const m = Number(month) || 0;
    return SCHEDULE.filter(x => Number(x.month) === m);
  }

  function getScheduleEntry(month, week){
    const m = Number(month) || 0;
    const w = Number(week) || 0;
    return SCHEDULE.find(x => Number(x.month) === m && Number(x.week) === w) || null;
  }

  // =========================================================
  // expose
  // =========================================================
  window.MOBBR.data.tournament = {
    VERSION,

    COMMON_RULES,

    POINTS,
    TIEBREAKERS,
    PRIZES,

    START_WEEK_MESSAGES,
    VENUE_FLOW,

    TOURNAMENTS,
    SCHEDULE,

    // helpers
    getTournament,
    getPrizeTableForTournamentKey,
    getStartWeekMessageLines,
    listScheduleForMonth,
    getScheduleEntry
  };
})();
