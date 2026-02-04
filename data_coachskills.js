/* =====================================================
   data_coachskills.js
   - コーチスキル定義（恒久/試合内バフとして加算）
   - 重要：現時点で確定仕様（スキル一覧/数値/解放条件）が未提示のため創作しない
   - ただし、実装が破綻しないよう参照スキーマとAPIは確定しておく
   ===================================================== */

(() => {

  /* -------------------------------------
     コーチスキル 効果タイプ
     ------------------------------------- */
  const COACH_EFFECT_TYPE = {
    // 恒久強化（常時）
    PERMANENT: 'permanent',
    // 試合内のみ（戦闘総合力%へ加算等）
    MATCH_ONLY: 'match_only',
    // 大会中だけ
    TOURNAMENT_ONLY: 'tournament_only',
    // 特殊（条件付き、確率系など）
    SPECIAL: 'special',
  };

  /* -------------------------------------
     コーチスキル スキーマ（設計固定）
     -------------------------------------
     id: string（ユニーク）
     name: string
     description: string（表示文。数値を出す/出さないはUIルール側で統制）
     icon: string|null（任意）
     maxLevel: number（例：1〜5等。未確定なら後で確定）
     unlock: {
       // 企業ランクなど（未確定のため項目は柔軟に）
       companyRank?: number
       costG?: number
       other?: object
     }
     effectsByLevel: [
       {
         level: number,
         type: COACH_EFFECT_TYPE,
         effectKey: string,   // sim側で解釈するキー
         params: object       // 具体値。ここは仕様確定後に投入
       }
     ]
  ------------------------------------- */

  const LIST = [
    // 現時点では確定したコーチスキルが未提示のため空。
    // ここに仕様確定テキストに沿って追加していく。
  ];

  const byId = {};
  for (const s of LIST) byId[s.id] = s;

  const DATA_COACHSKILLS = {
    COACH_EFFECT_TYPE,
    LIST,
    byId,

    get(id) {
      const k = String(id || '');
      return byId[k] || null;
    },

    // 所持スキル状態（例：{ skillId: level }）から有効効果を列挙
    // ※数値表示の可否はUI側ルール。ここはデータ抽出のみ。
    resolveEffects(ownedMap) {
      const out = [];
      const map = ownedMap && typeof ownedMap === 'object' ? ownedMap : {};

      for (const [skillId, lvRaw] of Object.entries(map)) {
        const def = byId[String(skillId)];
        if (!def) continue;

        const lv = Math.max(0, Math.min(Number(def.maxLevel || 0), Number(lvRaw || 0)));
        if (lv <= 0) continue;

        const e = (def.effectsByLevel || []).find(x => Number(x.level) === lv);
        if (e) out.push({ skillId: def.id, skillName: def.name, ...e });
      }

      return out;
    },
  };

  window.DATA_COACHSKILLS = DATA_COACHSKILLS;

})();
