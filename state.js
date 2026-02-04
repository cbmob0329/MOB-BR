/* =====================================================
   state.js
   - ゲーム状態（フェーズ／大会／試合／結果）
   - UI や sim_* から参照される唯一の状態
   - ここでは「破綻しない骨格」を固定し、
     大会進行の本実装は sim_tournament_core.js / sim_rules.js に委譲
   ===================================================== */

/* global DATA_CONST, DATA_PLAYERS, TEAMS_INDEX, SimTournament */

(() => {

  const DEFAULTS = {
    phase: 'main',
    equippedPlayerImage: 'P1.png',
    playerTeamName: 'あなたの部隊',

    // 大会（初期はローカル想定。詳細は sim_rules.js / sim_tournament_core.js で確定）
    tournament: {
      kind: 'local',         // 'local'|'national'|'world'|'championship' 等（sim_rulesで使用）
      title: 'ローカル大会',
      totalTeams: 20,        // ローカル=20 / ナショナル・ワールド=40
      matchesPlanned: 5,     // ローカル大会は5試合（確定）
      matchIndex: 0,
      finished: false,
    },

    // 試合
    match: {
      running: false,
      matchNo: 1,
      // SimBattle が内部で使うチーム配列やラウンド状態はここに保持していく
      sim: null,
      // 1試合result（表示用）
      lastResultTable: null,   // {title, columns, rows}
      // 大会累積（総合順位用・SimTournamentが使う想定）
      accum: null,
    },

    // 大会結果（表示用）
    tournamentResult: null,
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  const State = {
    s: deepClone(DEFAULTS),

    /* =====================================
       初期化
       ===================================== */
    init() {
      this.s = deepClone(DEFAULTS);

      // ここで将来セーブデータ等に繋げるが、現段階では固定
      // DATA_PLAYERS 等が存在すれば初期チーム名など反映（無くても破綻しない）
      try {
        if (window.DATA_CONST && DATA_CONST.PLAYER_TEAM_NAME) {
          this.s.playerTeamName = String(DATA_CONST.PLAYER_TEAM_NAME);
        }
      } catch (e) { /* noop */ }

      try {
        if (window.DATA_CONST && DATA_CONST.DEFAULT_PLAYER_IMAGE) {
          this.s.equippedPlayerImage = String(DATA_CONST.DEFAULT_PLAYER_IMAGE);
        }
      } catch (e) { /* noop */ }

      this.s.phase = 'main';
    },

    /* =====================================
       フェーズ
       ===================================== */
    getPhase() {
      return this.s.phase;
    },
    setPhase(p) {
      this.s.phase = String(p);
    },

    /* =====================================
       プレイヤー表示用
       ===================================== */
    getEquippedPlayerImageFile() {
      return this.s.equippedPlayerImage || 'P1.png';
    },
    getPlayerTeamName() {
      return this.s.playerTeamName || 'あなたの部隊';
    },

    /* =====================================
       大会開始
       ===================================== */
    startTournament() {
      // sim_rules / sim_tournament_core が存在すれば、そこに初期化を委譲
      // 無い場合も破綻しないように、最小の大会枠をここで作る
      this.s.tournament.matchIndex = 0;
      this.s.tournament.finished = false;

      // 大会累積の初期化
      this.s.match.accum = {
        // totalTeams: 20 or 40
        totalTeams: this.s.tournament.totalTeams,
        // teamId -> { teamId, teamName, points, placeP, kp, ap, treasure, flag }
        teamTotals: {},
        // 各試合のresultを保持（必要なら）
        matchResults: [],
      };

      // SimTournament があれば初期化して状態に保持（内部仕様は後で確定）
      try {
        if (window.SimTournament && typeof SimTournament.initTournament === 'function') {
          const ctx = SimTournament.initTournament(this);
          // ctxは任意。返ってきたら保持
          if (ctx) this.s.tournament.ctx = ctx;
        }
      } catch (e) {
        // ここでは握り潰す（UIが止まらないこと優先）
      }

      this.s.match.lastResultTable = null;
      this.s.tournamentResult = null;
    },

    /* =====================================
       試合開始
       ===================================== */
    startMatch() {
      this.s.match.running = true;
      this.s.match.matchNo = this.s.tournament.matchIndex + 1;

      // SimBattle が使う「試合コンテキスト」を作る
      // 本格的な配置/ラウンド制御は sim_battle.js で実装していく
      this.s.match.sim = {
        matchNo: this.s.match.matchNo,
        // 20チーム固定（ローカル）。ナショナル/ワールドは 40母数の総合だが
        // 1試合の母数は常に20（確定）なので、ここは常に20試合枠。
        maxTeamsInMatch: 20,
        // R1〜R6
        round: 0,
        // チーム状態（sim_battleが埋める）
        teams: null,
        // プレイヤー追跡用
        player: {
          alive: 3,
          deathBoxes: 0,
          eliminated: false,
          areaId: null,
          kills_total: 0,
          assists_total: 0,
          treasure: 0,
          flag: 0,
          members: [],
          eventBuffs: {},
        },
        // 表示・進行用
        stepQueue: [],
        done: false,
        // その試合の最終順位（1〜20）
        placement: null,
      };

      // sim_tournament_core があれば、試合の参加チーム割当などを委譲
      try {
        if (window.SimTournament && typeof SimTournament.prepareMatch === 'function') {
          SimTournament.prepareMatch(this);
        }
      } catch (e) {
        // noop
      }
    },

    /* =====================================
       試合終了後：結果テーブル（UI表示用）
       sim_battle.js が setMatchResult を呼ぶ想定
       ===================================== */
    setMatchResultTable(table) {
      // {title, columns, rows}
      this.s.match.lastResultTable = table || null;

      // 履歴として保存（累積用に SimTournament が参照できる）
      if (table) {
        this.s.match.accum.matchResults.push(table);
      }
    },

    getMatchSummary() {
      // UI.showResultTable に渡す形式
      if (this.s.match.lastResultTable) return this.s.match.lastResultTable;

      // フォールバック
      return {
        title: `試合 ${this.getMatchIndex() + 1} result`,
        columns: ['順位', 'チーム', 'Total'],
        rows: [],
      };
    },

    /* =====================================
       試合index / 大会進行
       ===================================== */
    getMatchIndex() {
      return this.s.tournament.matchIndex || 0;
    },

    advanceAfterMatch() {
      this.s.match.running = false;
      this.s.match.sim = null;

      // SimTournament があれば「累積加算」「進出判定」等を委譲
      try {
        if (window.SimTournament && typeof SimTournament.afterMatch === 'function') {
          SimTournament.afterMatch(this);
        }
      } catch (e) {
        // noop
      }

      this.s.tournament.matchIndex += 1;

      // ひとまずローカル大会は5試合で終了（確定）
      // ナショナル/ワールド等は sim_rules.js / sim_tournament_core.js で上書きしていく
      const planned = Number(this.s.tournament.matchesPlanned || 0);
      if (this.s.tournament.matchIndex >= planned) {
        this.s.tournament.finished = true;
      }
    },

    isTournamentFinished() {
      return !!this.s.tournament.finished;
    },

    /* =====================================
       大会結果
       - 現段階は「表示の箱」を用意。
         実際の順位表は sim_tournament_core.js で構築してここへ入れる
       ===================================== */
    setTournamentResult(res) {
      // {message, subMessage, title, columns, rows}
      this.s.tournamentResult = res || null;
    },

    getTournamentResult() {
      if (this.s.tournamentResult) return this.s.tournamentResult;

      // フォールバック：最低限の終了メッセージ
      return {
        message: '大会が終了しました！',
        subMessage: '結果はこれから実装されます。',
      };
    },

    /* =====================================
       メインへ戻す
       ===================================== */
    resetToMain() {
      // 大会関連をリセット（装備やプレイヤー設定は維持）
      const keepPlayerImage = this.s.equippedPlayerImage;
      const keepTeamName = this.s.playerTeamName;

      this.s = deepClone(DEFAULTS);
      this.s.equippedPlayerImage = keepPlayerImage;
      this.s.playerTeamName = keepTeamName;

      this.s.phase = 'main';
    },

    /* =====================================
       便利：累積データへのアクセス（SimTournament用）
       ===================================== */
    getAccum() {
      return this.s.match.accum;
    },
  };

  window.State = State;

})();
