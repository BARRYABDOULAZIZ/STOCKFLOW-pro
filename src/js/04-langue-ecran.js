  // Traduit un texte écrit en français (rend le texte d'origine s'il n'est pas dans le dictionnaire)
  function tr(fr) { if (UI_LANG === 'fr') return fr; const t = I18N.get(String(fr).replace(/\s+/g, ' ').trim()); return (t && t[UI_LANG]) || fr; }
  const i18nText = new WeakMap(), i18nAttr = new WeakMap();
  const I18N_ATTRS = ['placeholder', 'title', 'aria-label'];
  const I18N_SKIP = 'script,style,#printArea,#printTicket,#printInvSheet,[data-noi18n],#legalOverlay .legal-body';
  function i18nSkip(el) { return !el || (el.closest && el.closest(I18N_SKIP)); }
  function i18nTextNode(n) {
    if (i18nSkip(n.parentElement)) return;
    let rec = i18nText.get(n);
    if (!rec || n.nodeValue !== rec.shown) { rec = { orig: n.nodeValue, shown: n.nodeValue }; i18nText.set(n, rec); }
    const key = rec.orig.replace(/\s+/g, ' ').trim();
    if (!key) return;
    let out = rec.orig;
    if (UI_LANG !== 'fr') { const t = I18N.get(key); if (t && t[UI_LANG] != null) out = rec.orig.replace(/\S[\s\S]*\S|\S/, t[UI_LANG]); }
    if (n.nodeValue !== out) { n.nodeValue = out; }
    rec.shown = out;
  }
  function i18nEl(el) {
    if (i18nSkip(el)) return;
    let recs = i18nAttr.get(el);
    I18N_ATTRS.forEach(a => {
      if (!el.hasAttribute(a)) return;
      const cur = el.getAttribute(a);
      if (!recs) { recs = {}; i18nAttr.set(el, recs); }
      let r = recs[a];
      if (!r || cur !== r.shown) r = recs[a] = { orig: cur, shown: cur };
      let out = r.orig;
      if (UI_LANG !== 'fr') { const t = I18N.get(r.orig.replace(/\s+/g, ' ').trim()); if (t && t[UI_LANG] != null) out = t[UI_LANG]; }
      if (cur !== out) el.setAttribute(a, out);
      r.shown = out;
    });
  }
  function i18nTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { i18nTextNode(root); return; }
    if (root.nodeType !== 1 || i18nSkip(root)) return;
    i18nEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) i18nTextNode(n); else i18nEl(n); }
  }
  let i18nObs = null;
  function i18nStart() {
    if (i18nObs || UI_LANG === 'fr') return;
    i18nObs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(i18nTree);
        else if (m.type === 'characterData') i18nTextNode(m.target);
        else if (m.type === 'attributes') i18nEl(m.target);
      }
    });
    i18nObs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
  }
  function renderLangPickers() {
    const L = UI_LANGS[UI_LANG];
    const f = document.getElementById('langBtnFlag'), c = document.getElementById('langBtnCode');
    if (f) f.textContent = L.flag; if (c) c.textContent = L.code;
    const opts = Object.entries(UI_LANGS).map(([k, v]) => `<button type="button" class="lang-opt${k === UI_LANG ? ' on' : ''}" data-uilang="${k}" role="menuitem" lang="${k}"><span class="f">${v.flag}</span><span>${v.name}</span></button>`).join('');
    const m = document.getElementById('langMenu'); if (m) m.innerHTML = opts;
    const r = document.getElementById('loginLangRow'); if (r) r.innerHTML = opts;
  }
  function setUiLang(lang, save) {
    if (!UI_LANGS[lang]) return;
    UI_LANG = lang;
    if (save) { try { localStorage.setItem('sf_ui_lang', lang); } catch (e) {} }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    i18nStart();
    i18nTree(document.body);
    renderLangPickers();
  }
  document.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-uilang]');
    const menu = document.getElementById('langMenu'), btn = document.getElementById('langBtn');
    if (opt) { setUiLang(opt.dataset.uilang, true); if (menu) menu.style.display = 'none'; if (btn) btn.setAttribute('aria-expanded', 'false'); return; }
    if (btn && e.target.closest('#langBtn')) { const open = menu.style.display === 'none'; menu.style.display = open ? '' : 'none'; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); return; }
    if (menu && menu.style.display !== 'none' && !e.target.closest('#langMenu')) { menu.style.display = 'none'; if (btn) btn.setAttribute('aria-expanded', 'false'); }
  });
  setUiLang(UI_LANG, false);
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const todayStr = () => new Date().toISOString().slice(0, 10);

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    const isWarn = /hors catalogue|inchangé|insuffisant|erreur|⚠|impossible|refus/i.test(msg || '');
    t.classList.toggle('warn', isWarn);
    t.classList.add('show');
    clearTimeout(toast._h);
    const duration = (msg && msg.length > 60) || isWarn ? 9000 : 2800;
    toast._h = setTimeout(() => t.classList.remove('show'), duration);
  }
  // Actions qui ont absolument besoin d'internet (équipe, annulation de facture, réglages…)
  function needOnline(what) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast('📵 Pas d\'internet : ' + (what || 'cette action') + ' demande une connexion. Réessaie quand le réseau revient. Les ventes, elles, marchent hors connexion.');
      return false;
    }
    return true;
  }
  // Bannière d'état : visible seulement quand il y a un souci de réseau ou des opérations en attente
  function netBarUpdate() {
    const bar = document.getElementById('netBar'); if (!bar) return;
    const db = state.db; const st = db && db.status ? db.status() : { pend: 0, failed: 0, fails: 0, paused: null, flushing: false };
    const off = navigator.onLine === false || st.fails >= 2;
    const lbl = document.getElementById('syncLabel');
    const txt = st.pendTxt || (st.pend + ' opération(s)');
    let cls = '', html = '';
    if (st.paused === 'auth') { cls = 'warn'; html = '🔒 Session expirée — reconnecte-toi pour envoyer ' + txt + ' en attente <button id="netBarBtn">Se reconnecter</button>'; }
    else if (st.failed) { cls = 'bad'; html = '⚠ ' + st.failed + ' opération(s) refusée(s) par le serveur <button id="netBarBtn">Voir</button>'; }
    else if (off && st.pend) { cls = 'off'; html = '📵 Pas d\'internet — <b>' + txt + ' gardé(es) sur l\'appareil</b>, envoi automatique au retour du réseau'; }
    else if (off) { cls = 'off'; html = '📵 Pas d\'internet — tu peux continuer à vendre, tout sera envoyé ensuite'; }
    else if (st.pend) { cls = 'sync'; html = '⏳ Envoi de ' + txt + '… <button id="netBarBtn">Réessayer</button>'; }
    // Hors connexion : la bannière orange s'affiche quelques secondes puis disparaît
    // (l'indicateur en haut de l'écran garde l'information). Les erreurs restent affichées.
    if (cls === 'off') {
      if (netBarUpdate._last !== html) {
        netBarUpdate._last = html; netBarUpdate._hidden = false;
        clearTimeout(netBarUpdate._t);
        netBarUpdate._t = setTimeout(() => { netBarUpdate._hidden = true; const b = document.getElementById('netBar'); if (b && b.classList.contains('off')) b.className = ''; }, 5000);
      }
      if (netBarUpdate._hidden) cls = '';
    } else { netBarUpdate._last = ''; clearTimeout(netBarUpdate._t); }
    bar.className = cls ? ('show ' + cls) : '';
    bar.innerHTML = cls ? html : '';
    if (lbl && state.syncStarted) {
      const sy = document.getElementById('syncStatus');
      if (off) { lbl.textContent = st.pend ? ('hors connexion · ' + txt) : 'hors connexion'; sy.classList.add('off'); }
      else if (st.pend) { lbl.textContent = txt + ' en attente d\'envoi'; sy.classList.remove('off'); }
      else if (lbl.textContent.indexOf('hors connexion') === 0 || /en attente d/.test(lbl.textContent)) { lbl.textContent = 'synchronisé'; sy.classList.remove('off'); }
    }
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest && ev.target.closest('#netBarBtn'); if (!b) return;
    const st = state.db && state.db.status ? state.db.status() : {};
    if (st.paused === 'auth') { sessionExpiredUI(state.currentUser && state.currentUser.email); return; }
    if (st.failed) {
      const list = state.db.failedList();
      alert('Ces opérations n\'ont pas pu être enregistrées :\n\n' + list.map(f => '• ' + f.label + ' — ' + f.msg).join('\n') + '\n\nRefais-les si besoin.');
      state.db.clearFailed(); return;
    }
    state.db.retryNow();
  });
  window.addEventListener('online', () => { try { netBarUpdate(); } catch (e) {} });
  window.addEventListener('offline', () => { try { netBarUpdate(); } catch (e) {} });
  const sfTimings = {};
  function showTimings() { const el = document.getElementById('syncStatus'); if (el) el.title = 'Temps de chargement : ' + Object.entries(sfTimings).map(([k, v]) => k + ' ' + v + ' ms').join(' · '); }
  function setSync(ok, label) {
    document.getElementById('syncLabel').textContent = label;
    document.getElementById('syncStatus').classList.toggle('off', !ok);
  }

