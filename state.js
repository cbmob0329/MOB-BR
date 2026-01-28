// state.js
// アプリ全体の状態（どの画面か、進行状況、設定）だけを持つ。
// ロジックは持たない。更新は reducer 形式で統一。

export const SCREENS = {
  MAIN: 'main',
  MAP: 'map',
  MATCH: 'match',
  RESULT: 'result',
  TOTAL: 'total',
  LOADING: 'loading',
};

export const TOUR_STAGE = {
  SP1: 'SP1',
  SP2: 'SP2',
  CHAMP: 'CHAMPIONSHIP',
};

export const TOURNAMENT_KIND = {
  LOCAL: 'LOCAL',
  NATIONAL: 'NATIONAL',
  LAST_CHANCE: 'LAST_CHANCE',
  WF: 'WF', // World Final
};

export const DEFAULT_SETTINGS = {
  autoAdvance: false,     // オート進行（match画面）
  autoIntervalMs: 3000,   // 3秒（仕様）
  debugHotspots: false,   // 透明ボタンを可視化する
};

export function createInitialState() {
  return {
    version: 'v0.1',
    screen: SCREENS.LOADING,

    // HUD
    companyName: 'CB Memory', // 仮（後で変更可能）
    companyRank: 'C',
    teamName: 'PLAYER TEAM',
    week: 1,
    gold: 0,

    // 進行
    seasonStage: TOUR_STAGE.SP1,       // SP1 / SP2 / CHAMPIONSHIP
    tournamentKind: TOURNAMENT_KIND.LOCAL,
    matchIndex: 0,                     // 0-based
    matchCount: 5,                     // 基本5試合
    roundIndex: 0,                     // R1〜R6: 0-based
    roundCount: 6,

    // 表示用
    statusText: 'READY',

    // 現在の試合データ（uiが参照するための箱）
    currentMatch: null,                // simが詰める
    lastMatchResult: null,             // 1試合結果（20）
    totalStandings: null,              // 総合（20 or 40）
    mapDisplay: {
      title: '降下マップ',
      sub: '（クリック無し／表示のみ）',
    },

    // 設定
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen };

    case 'SET_STATUS':
      return { ...state, statusText: String(action.text ?? '') };

    case 'SET_HUD':
      return {
        ...state,
        companyName: action.companyName ?? state.companyName,
        companyRank: action.companyRank ?? state.companyRank,
        teamName: action.teamName ?? state.teamName,
        week: Number.isFinite(action.week) ? action.week : state.week,
        gold: Number.isFinite(action.gold) ? action.gold : state.gold,
      };

    case 'TOGGLE_AUTO':
      return {
        ...state,
        settings: {
          ...state.settings,
          autoAdvance: action.value != null ? !!action.value : !state.settings.autoAdvance,
        },
      };

    case 'SET_DEBUG_HOTSPOTS':
      return {
        ...state,
        settings: {
          ...state.settings,
          debugHotspots: !!action.value,
        },
      };

    case 'SET_STAGE':
      return {
        ...state,
        seasonStage: action.seasonStage ?? state.seasonStage,
        tournamentKind: action.tournamentKind ?? state.tournamentKind,
      };

    case 'SET_PROGRESS':
      return {
        ...state,
        matchIndex: Number.isFinite(action.matchIndex) ? action.matchIndex : state.matchIndex,
        matchCount: Number.isFinite(action.matchCount) ? action.matchCount : state.matchCount,
        roundIndex: Number.isFinite(action.roundIndex) ? action.roundIndex : state.roundIndex,
        roundCount: Number.isFinite(action.roundCount) ? action.roundCount : state.roundCount,
      };

    case 'SET_MATCH_DATA':
      return {
        ...state,
        currentMatch: action.currentMatch ?? state.currentMatch,
        lastMatchResult: action.lastMatchResult ?? state.lastMatchResult,
        totalStandings: action.totalStandings ?? state.totalStandings,
      };

    case 'SET_MAP_TEXT':
      return {
        ...state,
        mapDisplay: {
          title: action.title ?? state.mapDisplay.title,
          sub: action.sub ?? state.mapDisplay.sub,
        },
      };

    default:
      return state;
  }
}

/**
 * 小さなストア（subscribe/dispatch）
 */
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState() { return state; },
    dispatch(action) {
      state = reducer(state, action);
      for (const fn of listeners) fn(state, action);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
