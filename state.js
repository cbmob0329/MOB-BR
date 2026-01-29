// state.js (FULL)
// 週/年/所持G/企業ランク/進行状況

const SAVE_KEY = 'mob_brs_demo_save_v1';

export function defaultState(){
  return {
    version: 1,

    // 時間
    year: 1989,
    week: 1, // 1〜4（1ヶ月4週）

    // 所持
    gold: 0,

    // 企業
    corpName: 'MOB COMPANY',
    corpRank: 'ローカル',

    // チーム
    teamName: 'PLAYER TEAM',

    // チームメンバー（初期3人）
    playerMembers: ['ウニチー','ネコクー','ドオー'],

    // 大会進行
    tournament: {
      inProgress: false,
      name: '',
      phase: '',
      group: 'A',
      matchIndex: 0,
      totalPoints: 0,
      history: [], // {year, tour, rank, points}
    },

    // ログ
    news: [], // 最近の出来事

    // 戦績
    career: {
      totalKillsByPlayer: {}, // {name:kills}
    },
  };
}

export function loadState(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return defaultState();
    const s = JSON.parse(raw);
    return mergeWithDefault(s);
  }catch(e){
    return defaultState();
  }
}

export function saveState(state){
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function deleteSave(){
  localStorage.removeItem(SAVE_KEY);
}

function mergeWithDefault(s){
  const d = defaultState();

  // 深いmergeは最小限に（DEMOなので簡易）
  return {
    ...d,
    ...s,
    tournament: {
      ...d.tournament,
      ...(s.tournament || {}),
    },
    career: {
      ...d.career,
      ...(s.career || {}),
    },
  };
}

export function addGold(state, amount){
  state.gold = Math.max(0, Math.floor(state.gold + amount));
}

export function nextWeek(state){
  state.week += 1;
  if(state.week > 4){
    state.week = 1;
    state.year += 1;
  }
}

export function formatYearWeek(state){
  return `${state.year}年 ${state.week}週`;
}
