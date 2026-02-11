'use strict';

/*
  MOB BR - ui_tournament.js v1
  大会画面フル構築版（戦闘未実装）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const $ = id => document.getElementById(id);

  const COACH_EQUIP_KEY = 'mobbr_coachSkillsEquipped';
  const COACH_OWNED_KEY = 'mobbr_coachSkillsOwned';

  const TOURNAMENT_BG = 'neonmain.png';
  const TENT_BG = 'tent.png';

  let state = 'intro';
  let selectedSkill = null;

  // ===== Root =====
  const root = document.createElement('div');
  root.id = 'tournamentScreen';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.display = 'none';
  root.style.background = '#000';
  root.style.zIndex = '9999';
  root.style.overflow = 'hidden';
  root.style.color = '#fff';
  root.style.fontFamily = 'sans-serif';

  document.body.appendChild(root);

  // ===== Background =====
  const bg = document.createElement('div');
  bg.style.position = 'absolute';
  bg.style.inset = '0';
  bg.style.backgroundSize = 'cover';
  bg.style.backgroundPosition = 'center';
  bg.style.opacity = '0';
  bg.style.transition = 'opacity 0.8s ease';
  root.appendChild(bg);

  // ===== Square Area =====
  const square = document.createElement('div');
  square.style.position = 'absolute';
  square.style.top = '50%';
  square.style.left = '50%';
  square.style.transform = 'translate(-50%,-50%)';
  square.style.width = '90vw';
  square.style.maxWidth = '480px';
  square.style.aspectRatio = '1/1';
  square.style.backgroundSize = 'cover';
  square.style.backgroundPosition = 'center';
  square.style.display = 'flex';
  square.style.flexDirection = 'column';
  square.style.justifyContent = 'space-between';
  square.style.padding = '20px';
  root.appendChild(square);

  // ===== Content =====
  const content = document.createElement('div');
  content.style.flex = '1';
  content.style.overflowY = 'auto';
  content.style.marginTop = '20px';
  square.appendChild(content);

  // ===== Log =====
  const logBox = document.createElement('div');
  logBox.style.minHeight = '60px';
  logBox.style.fontSize = '16px';
  logBox.style.fontWeight = 'bold';
  logBox.style.textAlign = 'center';
  logBox.style.marginBottom = '10px';
  square.appendChild(logBox);

  // ===== Button =====
  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'NEXT';
  nextBtn.style.padding = '10px';
  nextBtn.style.fontWeight = 'bold';
  nextBtn.style.border = 'none';
  nextBtn.style.borderRadius = '8px';
  nextBtn.style.background = '#ff3b30';
  nextBtn.style.color = '#fff';
  square.appendChild(nextBtn);

  // ===== Utilities =====

  function fadeInBG(img){
    bg.style.backgroundImage = `url(${img})`;
    setTimeout(()=> bg.style.opacity = '1', 50);
  }

  function showTent(){
    square.style.backgroundImage = `url(${TENT_BG})`;
  }

  function getEquipped(){
    try{
      return JSON.parse(localStorage.getItem(COACH_EQUIP_KEY)) || [];
    }catch{
      return [];
    }
  }

  function getOwned(){
    try{
      return JSON.parse(localStorage.getItem(COACH_OWNED_KEY)) || {};
    }catch{
      return {};
    }
  }

  function removeSkill(id){
    const owned = getOwned();
    if (owned[id] > 0){
      owned[id] -= 1;
    }
    localStorage.setItem(COACH_OWNED_KEY, JSON.stringify(owned));

    const eq = getEquipped().map(x=> x===id ? null : x);
    localStorage.setItem(COACH_EQUIP_KEY, JSON.stringify(eq));
  }

  // ===== Flow =====

  function showIntro(){
    state = 'intro';
    content.innerHTML = '';
    logBox.textContent = '本日の出場チームをご紹介！';
  }

  function showTeams(){
    state = 'teams';
    content.innerHTML = '';

    for (let i=1;i<=20;i++){
      const div = document.createElement('div');
      div.style.marginBottom = '8px';
      div.textContent = `Team ${i} - 総合戦闘力 ???%`;
      content.appendChild(div);
    }

    logBox.textContent = '出場チーム一覧';
  }

  function showSkillSelect(){
    state = 'skill';
    content.innerHTML = '';

    const eq = getEquipped();
    const owned = getOwned();

    logBox.textContent = '使用するコーチスキルを選択してください';

    eq.forEach(id=>{
      if (!id) return;
      if (!owned[id]) return;

      const btn = document.createElement('button');
      btn.textContent = id;
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.marginBottom = '8px';
      btn.onclick = ()=>{
        selectedSkill = id;
        showSkillConfirm();
      };
      content.appendChild(btn);
    });

    const noneBtn = document.createElement('button');
    noneBtn.textContent = '使わない';
    noneBtn.style.display = 'block';
    noneBtn.style.width = '100%';
    noneBtn.onclick = ()=>{
      selectedSkill = null;
      showR1Start();
    };
    content.appendChild(noneBtn);
  }

  function showSkillConfirm(){
    state = 'confirm';
    content.innerHTML = '';
    logBox.textContent = `コーチ：「発動するぞ！」`;

    const okBtn = document.createElement('button');
    okBtn.textContent = 'NEXT';
    okBtn.style.width = '100%';
    okBtn.onclick = ()=>{
      removeSkill(selectedSkill);
      showR1Start();
    };
    content.appendChild(okBtn);
  }

  function showR1Start(){
    state = 'r1';
    content.innerHTML = '';
    logBox.textContent = 'Round 1 開始！';
    nextBtn.style.display = 'none';
  }

  nextBtn.onclick = ()=>{
    if (state === 'intro') showTeams();
    else if (state === 'teams') showSkillSelect();
  };

  // ===== Public API =====
  function open(){
    root.style.display = 'block';
    bg.style.opacity = '0';
    fadeInBG(TOURNAMENT_BG);
    showTent();
    showIntro();
  }

  function close(){
    root.style.display = 'none';
  }

  window.MOBBR.ui.tournament = { open, close };

})();
