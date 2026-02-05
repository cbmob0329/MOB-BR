'use strict';

/*
  Phase1 Main Screen:
  - Prevent double-tap zoom (iOS) by blocking fast successive taps
  - Keep only minimal interactions (log text changes)
  - No heavy logic yet
*/

function $(id){ return document.getElementById(id); }

const logBox = $('logBox');

function setLog(text){
  if (!logBox) return;
  logBox.textContent = text;
}

/* ===== iOS double-tap zoom guard =====
   (Viewport meta + touch-action helps, but iOS Safari sometimes still zooms.
    So we cancel second tap within a short window.)
*/
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
})();

/* ===== Bind buttons ===== */
function bind(){
  const btnTeam = $('btnTeam');
  const btnTournament = $('btnTournament');
  const btnShop = $('btnShop');
  const btnTraining = $('btnTraining');
  const btnNext = $('btnNext');
  const btnAuto = $('btnAuto');

  if (btnTeam) btnTeam.addEventListener('click', () => setLog('チーム：次フェーズ'));
  if (btnTournament) btnTournament.addEventListener('click', () => setLog('大会：次フェーズ（大会画面へ）'));
  if (btnShop) btnShop.addEventListener('click', () => setLog('ショップ：次フェーズ'));
  if (btnTraining) btnTraining.addEventListener('click', () => setLog('修行：次フェーズ'));

  if (btnNext) btnNext.addEventListener('click', () => setLog('NEXT：次フェーズ（週進行など）'));
  if (btnAuto) btnAuto.addEventListener('click', () => setLog('AUTO：次フェーズ（自動進行）'));
}

document.addEventListener('DOMContentLoaded', () => {
  bind();
  setLog('ログ：未定');
});
