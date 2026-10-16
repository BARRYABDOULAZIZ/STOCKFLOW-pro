  // ================= Devise du commerce (Sénégal, Guinée, Gambie, Mauritanie…) =================
  const DEVISES = {
    XOF: { sym: 'FCFA', label: "Franc CFA (FCFA) — Sénégal, Mali, Côte d'Ivoire…", fr: ['franc CFA', 'francs CFA'], en: ['CFA franc', 'CFA francs'], ar: 'فرنك سيفا' },
    GNF: { sym: 'GNF', label: 'Franc guinéen (GNF) — Guinée', fr: ['franc guinéen', 'francs guinéens'], en: ['Guinean franc', 'Guinean francs'], ar: 'فرنك غيني' },
    GMD: { sym: 'GMD', label: 'Dalasi (GMD) — Gambie', fr: ['dalasi', 'dalasis'], en: ['dalasi', 'dalasis'], ar: 'دلاسي' },
    MRU: { sym: 'MRU', label: 'Ouguiya (MRU) — Mauritanie', fr: ['ouguiya', 'ouguiyas'], en: ['ouguiya', 'ouguiyas'], ar: 'أوقية' },
  };
  const INV_LANGS = { fr: 'Français', en: 'English (anglais)', ar: 'العربية (arabe)' };
  // Réglage lu en base (colonnes devise / langue_facture) ; à défaut, gardé sur cet appareil
  function commerceSetting(key, lsKey, ok, def) {
    const c = typeof state !== 'undefined' && state.commerce;
    if (c && ok(c[key])) return c[key];
    try { const v = localStorage.getItem(lsKey + ':' + (c && c.id || '')); if (ok(v)) return v; } catch (e) {}
    return def;
  }
  function curCode() { return commerceSetting('devise', 'sf_devise', (v) => !!DEVISES[v], 'XOF'); }
  function curSym() { return DEVISES[curCode()].sym; }
  function invLang() { return commerceSetting('langueFacture', 'sf_langue', (v) => !!INV_LANGS[v], 'fr'); }
  function applyCurrencyUi() {
    const s = curSym();
    document.querySelectorAll('.cur-sym').forEach(el => { el.textContent = s; });
    const o = document.querySelector('#f-remise-unit option[value="fcfa"]'); if (o) o.textContent = s;
  }
  const euros = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' ' + curSym();

