'use strict';

/* =========================================================
   MOB BR - ui_team_training.js v19.1-viewonly（FULL）
   - ✅ チーム画面では「表示のみ」
   - ✅ トレーニング / パッシブ強化は一切行わない
   - ✅ 既存の #teamTrainingSection があれば削除（無限強化防止）
   - ✅ 戦績表示のみ追加
   - ✅ 互換APIは残す（attach / render / openPassivePopup）
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.uiTeamTraining = window.MOBBR.uiTeamTraining || {};

(function(){

  const HISTORY_KEY = 'mobbr_teamHistory_v1';
  let T = null;

  // ---------------------------------------------------------
  // 既存育成UI削除（安全措置）
  // ---------------------------------------------------------
  function removeOldTrainingUI(){
    const old = document.getElementById('teamTrainingSection');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const popup = document.getElementById('mobbrTrainingPopup');
    if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
  }

  // ---------------------------------------------------------
  // 戦績取得
  // ---------------------------------------------------------
  function getHistory(){
    try{
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      return [];
    }
  }

  // ---------------------------------------------------------
  // 戦績表示UI
  // ---------------------------------------------------------
  function ensureHistoryUI(){
    if (!T?.dom?.teamScreen) return null;

    let wrap = document.getElementById('teamHistorySection');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.id = 'teamHistorySection';
    wrap.style.marginTop = '14px';
    wrap.style.padding = '12px';
    wrap.style.borderRadius = '14px';
    wrap.style.border = '1px solid rgba(255,255,255,.14)';
    wrap.style.background = 'rgba(255,255,255,.08)';

    const title = document.createElement('div');
    title.style.fontWeight = '1000';
    title.style.fontSize = '14px';
    title.textContent = '戦績';
    wrap.appendChild(title);

    const list = document.createElement('div');
    list.id = 'teamHistoryList';
    list.style.marginTop = '10px';
    list.style.fontSize = '12px';
    list.style.lineHeight = '1.4';
    wrap.appendChild(list);

    const panel = T.dom.teamScreen.querySelector('.teamPanel') || T.dom.teamScreen;
    panel.appendChild(wrap);

    return wrap;
  }

  function renderHistory(){
    const wrap = ensureHistoryUI();
    if (!wrap) return;

    const list = wrap.querySelector('#teamHistoryList');
    if (!list) return;

    const history = getHistory();
    list.innerHTML = '';

    if (!history.length){
      list.textContent = 'まだ大会戦績はありません。';
      return;
    }

    history.slice(0, 50).forEach(entry=>{
      const line = document.createElement('div');
      line.textContent =
        `${entry.year || ''}年 ${entry.season || ''} ${entry.tournament || ''} ${entry.rank || ''}`;
      list.appendChild(line);
    });
  }

  // ---------------------------------------------------------
  // 互換 attach
  // ---------------------------------------------------------
  function attach(coreApi){
    T = coreApi || window.MOBBR._uiTeamCore || null;
    removeOldTrainingUI();
    renderHistory();
  }

  // ---------------------------------------------------------
  // 互換 render
  // ---------------------------------------------------------
  function render(){
    removeOldTrainingUI();
    renderHistory();
  }

  // ---------------------------------------------------------
  // openPassivePopup（チーム画面では実行しない）
  // → 育成画面へ移動のみ
  // ---------------------------------------------------------
  function openPassivePopup(){
    const u = window.MOBBR?.ui;
    if (u?.training?.open){
      u.training.open();
      return;
    }

    const el = document.getElementById('trainingScreen');
    if (el){
      el.classList.add('show');
      el.setAttribute('aria-hidden', 'false');
    }
  }

  // ---------------------------------------------------------
  // 公開API
  // ---------------------------------------------------------
  window.MOBBR.uiTeamTraining.attach = attach;
  window.MOBBR.uiTeamTraining.render = render;
  window.MOBBR.uiTeamTraining.openPassivePopup = openPassivePopup;

  window.MOBBR.ui = window.MOBBR.ui || {};
  window.MOBBR.ui._teamTraining = window.MOBBR.uiTeamTraining;

  // 初期化
  if (window.MOBBR._uiTeamCore){
    attach(window.MOBBR._uiTeamCore);
  }

})();
