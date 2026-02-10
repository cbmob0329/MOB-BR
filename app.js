'use strict';

/*
  MOB BR - app.js（FULL / B案最終）
  役割：
  - タイトル → メイン遷移の安定化
  - tournament_runtime の唯一の起動点
  - テスト用「ローカル大会（テスト）」ボタン実装
*/

window.MOBBR = window.MOBBR || {};

(function(){

  let booted = false;
  let titleLocked = false;

  const $ = (id) => document.getElementById(id);

  /* =========================
     安全な初期化
  ========================= */
  function safeInit(){
    if (booted) return;
    booted = true;

    // メインUI初期化（存在すれば）
    if (window.MOBBR?.initMainUI){
      try{
        window.MOBBR.initMainUI();
      }catch(e){
        console.error('[app] initMainUI error', e);
      }
    }
  }

  /* =========================
     画面制御
  ========================= */
  function showTitle(){
    const t = $('titleScreen');
    const a = $('app');
    if (t) t.style.display = 'block';
    if (a) a.style.display = 'none';
  }

  function showMain(){
    const t = $('titleScreen');
    const a = $('app');
    if (t) t.style.display = 'none';
    if (a) a.style.display = 'grid';
  }

  /* =========================
     タイトル NEXT（安定版）
  ========================= */
  function bindTitleNext(){
    const btn = $('btnTitleNext');
    if (!btn) return;

    btn.addEventListener('click', async ()=>{
      if (titleLocked) return;
      titleLocked = true;

      btn.disabled = true;

      try{
        // DOM & UI 初期化を必ず先に完了させる
        await Promise.resolve();
        safeInit();
        showMain();
      }catch(e){
        console.error('[app] title next failed', e);
        showTitle();
      }finally{
        // メインに行けたら二度と押させない
        const title = $('titleScreen');
        if (title && title.style.display !== 'none'){
          titleLocked = false;
          btn.disabled = false;
        }
      }
    });
  }

  /* =========================
     テスト用：ローカル大会直行ボタン
  ========================= */
  function injectTestTournamentButton(){
    const title = $('titleScreen');
    if (!title) return;

    const wrap = document.createElement('div');
    wrap.style.marginTop = '18px';
    wrap.style.textAlign = 'center';

    const btn = document.createElement('button');
    btn.textContent = 'ローカル大会（テスト）';
    btn.style.padding = '12px 18px';
    btn.style.fontWeight = '900';
    btn.style.borderRadius = '14px';
    btn.style.border = '1px solid rgba(255,255,255,.25)';
    btn.style.background = 'rgba(0,0,0,.55)';
    btn.style.color = '#fff';

    btn.addEventListener('click', ()=>{
      btn.disabled = true;

      try{
        safeInit();

        const rt = window.MOBBR?.tournament?.runtime;
        if (!rt){
          alert('tournament_runtime が見つかりません');
          return;
        }

        // タイトルは閉じて大会UIに完全委譲
        showMain();
        rt.start('LOCAL');

      }catch(e){
        console.error('[app] test tournament start failed', e);
      }
    });

    wrap.appendChild(btn);
    title.querySelector('.titleInner')?.appendChild(wrap);
  }

  /* =========================
     boot
  ========================= */
  document.addEventListener('DOMContentLoaded', ()=>{
    showTitle();
    bindTitleNext();
    injectTestTournamentButton();
  });

})();
