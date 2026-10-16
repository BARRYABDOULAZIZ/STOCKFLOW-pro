  // ================= Langue de l'interface (français / anglais / arabe) =================
  // Détectée depuis la langue du téléphone ou de l'ordinateur ; modifiable avec le bouton drapeau (gardé sur l'appareil).
  // Les textes de l'appli restent écrits en français dans le code : ils sont traduits à l'affichage grâce au dictionnaire ci-dessous.
  const UI_LANGS = { fr: { flag: '🇫🇷', name: 'Français', code: 'FR' }, en: { flag: '🇬🇧', name: 'English', code: 'EN' }, ar: { flag: '🇲🇷', name: 'العربية', code: 'AR' } };
  function detectUiLang() {
    try { const s = localStorage.getItem('sf_ui_lang'); if (UI_LANGS[s]) return s; } catch (e) {}
    const list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'fr'];
    for (const l of list) { const k = String(l || '').slice(0, 2).toLowerCase(); if (UI_LANGS[k]) return k; }
    return 'fr';
  }
  let UI_LANG = detectUiLang();
  const I18N = new Map();
