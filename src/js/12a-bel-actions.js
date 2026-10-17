  // ================= Bel qui agit (TEST) : Bel PROPOSE, le patron CONFIRME =================
  // Bel écrit une ligne spéciale dans sa réponse ; l'appli la montre comme une carte avec « ✓ Confirmer ».
  // Rien n'est enregistré sans le clic du patron. Formats compris (une ligne chacun) :
  //   [[DEPENSE|montant|catégorie|note]]
  //   [[PAIEMENT|nom du client|montant|mode]]
  //   [[COMMANDE|nom du fournisseur|montant commandé|montant payé|note]]
  const BEL_DEP_CATS = ['Loyer', 'Électricité / Eau', 'Salaires', 'Transport', 'Réparations', 'Fournitures', 'Autre'];
  const BEL_MODES = ['Espèces', 'Mobile Money', 'Virement', 'Chèque'];
  const BEL_ACT_RE = /\[\[(DEPENSE|PAIEMENT|COMMANDE)\|([^\]]{1,600})\]\]/g;
  const BEL_ACT_MAX = 5;

  // Montant écrit par l'IA : « 5000 », « 5 000 », « 5000 FCFA », « 12,5 »
  function belAmount(s) {
    const t = String(s || '').replace(/[\s  ]/g, '').replace(/[^\d.,]/g, '');
    if (/^\d+([.,]\d{1,2})?$/.test(t)) return Math.round(Number(t.replace(',', '.')) * 100) / 100;
    return Number(t.replace(/[^\d]/g, '')) || 0;
  }
  const belNorm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  function belPick(list, val, def) { const k = belNorm(val); return list.find(x => belNorm(x) === k) || list.find(x => k && belNorm(x).startsWith(k.slice(0, 4))) || def; }
  // Retrouve un client / fournisseur par son nom (exact, sinon un seul nom qui ressemble)
  function belFind(list, nom) {
    const k = belNorm(nom); if (!k) return null;
    const exact = (list || []).filter(x => belNorm(x.nom) === k);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
    const near = (list || []).filter(x => belNorm(x.nom).includes(k) || (belNorm(x.nom) && k.includes(belNorm(x.nom))));
    return near.length === 1 ? near[0] : null;
  }
  // Factures du client encore à payer, la plus ancienne d'abord
  function belClientDue(clientId) {
    return (state.invoices || []).filter(i => i.clientId === clientId && !i.annulee)
      .map(i => ({ i, r: Math.round(((Number(i.total) || 0) - (Number(i.montantPaye) || 0)) * 100) / 100 }))
      .filter(o => o.r > 0)
      .sort((a, b) => (a.i.date || '').localeCompare(b.i.date || '') || (Number(a.i.num) || 0) - (Number(b.i.num) || 0));
  }

  // Transforme une ligne spéciale en action vérifiée (ok = peut être confirmée)
  function belParseAct(kind, raw) {
    const f = raw.split('|').map(x => x.trim());
    if (kind === 'DEPENSE') {
      const montant = belAmount(f[0]), categorie = belPick(BEL_DEP_CATS, f[1], 'Autre'), note = (f[2] || '').slice(0, 120);
      return { kind, montant, categorie, note, ok: montant > 0, why: montant > 0 ? '' : 'Montant manquant.' };
    }
    if (kind === 'PAIEMENT') {
      const c = belFind(state.clients, f[0]), montant = belAmount(f[1]), mode = belPick(BEL_MODES, f[2], 'Espèces');
      if (!c) return { kind, nom: f[0] || '?', montant, mode, ok: false, why: 'Client introuvable : vérifie le nom dans l\'onglet Clients.' };
      const due = belClientDue(c.id), reste = due.reduce((s, o) => s + o.r, 0);
      if (!(montant > 0)) return { kind, nom: c.nom, montant, mode, ok: false, why: 'Montant manquant.' };
      if (reste <= 0) return { kind, nom: c.nom, montant, mode, ok: false, why: 'Ce client ne doit rien.' };
      const paye = Math.min(montant, reste);
      return { kind, clientId: c.id, nom: c.nom, montant: paye, demande: montant, reste, mode, ok: true,
        why: montant > reste ? `Il ne doit que ${euros(reste)} : j'enregistre ${euros(paye)}.` : '' };
    }
    if (kind === 'COMMANDE') {
      const fo = belFind(state.fournisseurs, f[0]), commande = belAmount(f[1]), paye = belAmount(f[2]), note = (f[3] || '').slice(0, 160);
      if (!fo) return { kind, nom: f[0] || '?', commande, paye, note, ok: false, why: 'Fournisseur introuvable : ajoute-le d\'abord dans l\'onglet Fournisseurs.' };
      const ok = commande > 0 || paye > 0;
      return { kind, fournisseurId: fo.id, nom: fo.nom, commande, paye, note, ok, why: ok ? '' : 'Montant manquant.' };
    }
    return { kind, ok: false, why: '?' };
  }

  // Remplace les lignes spéciales par des repères, avant que le texte soit échappé
  function belExtractActs(txt) {
    const acts = [];
    const out = String(txt || '').replace(BEL_ACT_RE, (m, kind, raw) => {
      if (acts.length >= BEL_ACT_MAX) return '';
      acts.push(belParseAct(kind, raw));
      return '\u0000BELACT' + (acts.length - 1) + '\u0000';
    });
    return { out, acts };
  }
  function belActTitle(a) {
    if (a.kind === 'DEPENSE') return `💳 <b>${escapeHtml(tr('Dépense'))}</b> : <b>${euros(a.montant)}</b> · ${escapeHtml(a.categorie)}${a.note ? ' · ' + escapeHtml(a.note) : ''}`;
    if (a.kind === 'PAIEMENT') return `💸 <b>${escapeHtml(tr('Paiement reçu'))}</b> : <b>${escapeHtml(a.nom)}</b> ${escapeHtml(tr('a payé'))} <b>${euros(a.montant)}</b> · ${escapeHtml(a.mode)}`;
    return `🚚 <b>${escapeHtml(tr('Commande fournisseur'))}</b> : <b>${escapeHtml(a.nom)}</b>${a.commande > 0 ? ' · ' + escapeHtml(tr('commandé')) + ' <b>' + euros(a.commande) + '</b>' : ''}${a.paye > 0 ? ' · ' + escapeHtml(tr('payé')) + ' <b>' + euros(a.paye) + '</b>' : ''}${a.note ? ' · ' + escapeHtml(a.note) : ''}`;
  }
  // Carte « à confirmer » ; st = état gardé dans la conversation (done / no / busy / err)
  function belActCard(a, key, st) {
    let foot;
    if (st === 'done') foot = `<div class="bel-act-st ok">✅ ${escapeHtml(tr('Enregistré'))}</div>`;
    else if (st === 'no') foot = `<div class="bel-act-st">✗ ${escapeHtml(tr('Annulé'))}</div>`;
    else if (st === 'busy') foot = `<div class="bel-act-st">⏳ ${escapeHtml(tr('Enregistrement…'))}</div>`;
    else if (!a.ok) foot = `<div class="bel-act-st bad">⚠️ ${escapeHtml(tr(a.why))}</div>`;
    else foot = (a.why ? `<div class="bel-act-st warn">ℹ️ ${escapeHtml(a.why)}</div>` : '')
      + `<div class="bel-act-btns"><button type="button" class="primary" data-belok="${key}">✓ ${escapeHtml(tr('Confirmer'))}</button><button type="button" class="ghost" data-belno="${key}">✗ ${escapeHtml(tr('Annuler'))}</button></div>`;
    return `<div class="bel-act${st === 'done' ? ' done' : ''}"><div class="bel-act-t">${belActTitle(a)}</div>${foot}</div>`;
  }
  // Utilisé par aiFormat (12-bel.js) : le texte arrive déjà échappé, avec les repères
  function belInsertActs(html, acts, hi, h) {
    return html.replace(/(?:<br>)*\u0000BELACT(\d+)\u0000(?:<br>)*/g, (m, n) => {
      const a = acts[Number(n)]; if (!a) return '';
      return belActCard(a, hi + ':' + n, ((h && h.acts) || {})[n]);
    });
  }

  // Enregistrement, une fois confirmé (mêmes enregistrements que les formulaires de l'appli)
  async function belRunAct(a) {
    if (!state.db) throw new Error('Connexion non disponible.');
    const date = todayStr(), who = state.currentUser ? state.currentUser.nom : '';
    const id = (p) => p + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    if (a.kind === 'DEPENSE') {
      await state.db.doc('depenses/' + id('dp-')).set({ categorie: a.categorie, montant: a.montant, date, note: a.note || 'Noté par Bel', operateur: who, createdAt: Date.now() });
      return;
    }
    if (a.kind === 'PAIEMENT') {
      // On répartit sur les factures dues, la plus ancienne d'abord (recalculé au moment du clic)
      let left = a.montant;
      for (const o of belClientDue(a.clientId)) {
        if (left <= 0) break;
        const part = Math.min(left, o.r);
        await state.db.doc('paiements/' + id('pa-')).set({ factureId: o.i.id, clientId: a.clientId, montant: part, mode: a.mode, date, operateur: who, createdAt: Date.now() });
        await state.db.doc('factures/' + o.i.id).update({ montantPaye: Math.round(((Number(o.i.montantPaye) || 0) + part) * 100) / 100 });
        left = Math.round((left - part) * 100) / 100;
      }
      return;
    }
    if (a.kind === 'COMMANDE') {
      await state.db.doc('commandes_fournisseurs/' + id('co-')).set({ fournisseurId: a.fournisseurId, fournisseurNom: a.nom, date, montantCommande: a.commande, montantPaye: a.paye, note: a.note || 'Noté par Bel', createdAt: Date.now() });
    }
  }

  (function belActsInit() {
    const out = document.getElementById('aiAskAnswer'); if (!out) return;
    out.addEventListener('click', async (e) => {
      const ok = e.target.closest('[data-belok]'), no = e.target.closest('[data-belno]');
      const key = (ok && ok.dataset.belok) || (no && no.dataset.belno); if (!key) return;
      const [hi, n] = key.split(':').map(Number), h = aiHistory[hi]; if (!h || h.err) return;
      h.acts = h.acts || {};
      if (h.acts[n] === 'done' || h.acts[n] === 'busy') return;
      if (no) { h.acts[n] = 'no'; aiRender(); return; }
      const m = [...String(h.a).matchAll(BEL_ACT_RE)][n]; if (!m) return;
      const a = belParseAct(m[1], m[2]);   // revérifié au moment du clic (données à jour)
      if (!a.ok) { aiRender(); return; }
      h.acts[n] = 'busy'; aiRender();
      try { await belRunAct(a); h.acts[n] = 'done'; toast('✅ ' + tr('Enregistré par Bel.')); belMood('happy'); setTimeout(() => { if (!aiBusy) belMood('idle'); }, 2000); }
      catch (err) { delete h.acts[n]; console.error(err); toast('😕 ' + ((err && err.message) || 'Erreur')); }
      aiRender();
    });
  })();

  // ================= Bel prévient tout seul : le message du matin (TEST) =================
  // Calculé sur l'appareil (gratuit) : produits qui vont manquer, crédits en retard, ventes d'hier.
  // Affiché une fois par jour sur l'Accueil, jusqu'à ce que le patron appuie sur « Merci Bel ».
  const belMornKey = () => 'sf_bel_matin:' + (CURRENT_COMMERCE_ID || '') + ':' + todayStr();
  function belMorningData() {
    const today = todayStr(), y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const F = smartForecast();
    const manque = F.list.filter(o => o.stock <= 0 || (o.days !== null && o.days <= 3));
    const retard = {};
    (state.invoices || []).filter(i => !i.annulee && i.echeance && i.echeance < today).forEach(i => {
      const r = (Number(i.total) || 0) - (Number(i.montantPaye) || 0); if (r <= 0.5) return;
      const k = i.clientId || belNorm(i.client); const g = retard[k] || (retard[k] = { nom: i.client || '?', r: 0 }); g.r += r;
    });
    const ret = Object.values(retard).sort((a, b) => b.r - a.r);
    const hier = (state.invoices || []).filter(i => !i.annulee && i.date === y && (i.type || 'facture') === 'facture');
    return { manque, ret, hierN: hier.length, hierM: hier.reduce((s, i) => s + (Number(i.total) || 0), 0) };
  }
  function belMorningLines(D, forVoice) {
    const L = [], nom = (state.currentUser && state.currentUser.nom) || '';
    const list = (arr, f) => arr.slice(0, 3).map(f).join(', ') + (arr.length > 3 ? '…' : '');
    L.push((forVoice ? '' : '☀️ ') + `Bonjour${nom ? ' ' + nom : ''} !`);
    if (D.hierN) L.push((forVoice ? '' : '💰 ') + `Hier : ${D.hierN} vente${D.hierN > 1 ? 's' : ''}, ${euros(D.hierM)}.`);
    if (D.manque.length) L.push((forVoice ? '' : '🔥 ') + `${D.manque.length} produit${D.manque.length > 1 ? 's vont' : ' va'} manquer d'ici 3 jours : ${list(D.manque, o => o.p.nom)}.`);
    if (D.ret.length) L.push((forVoice ? '' : '💸 ') + `${D.ret.length} client${D.ret.length > 1 ? 's ont' : ' a'} dépassé l'échéance : ${list(D.ret, g => g.nom + ' ' + euros(g.r))}.`);
    if (!D.manque.length && !D.ret.length) L.push((forVoice ? '' : '✅ ') + 'Rien d\'urgent ce matin. Bonne journée !');
    return L;
  }
  function belMorningRender() {
    const card = document.getElementById('belMorning'); if (!card) return;
    let seen = false; try { seen = localStorage.getItem(belMornKey()) === '1'; } catch (e) {}
    if (!aiAskOk || seen || !(state.products || []).length) { card.style.display = 'none'; return; }
    const D = belMorningData();
    document.getElementById('belMorningFace').innerHTML = belAvatarSvg(46);
    document.getElementById('belMorningBody').innerHTML = belMorningLines(D, false).map(l => `<div>${escapeHtml(l)}</div>`).join('');
    document.getElementById('belMorningOrder').style.display = D.manque.length ? '' : 'none';
    document.getElementById('belMorningCredit').style.display = D.ret.length ? '' : 'none';
    card.style.display = '';
  }
  (function belMorningInit() {
    const card = document.getElementById('belMorning'); if (!card) return;
    document.getElementById('belMorningOk').addEventListener('click', () => { try { localStorage.setItem(belMornKey(), '1'); } catch (e) {} card.style.display = 'none'; });
    document.getElementById('belMorningOrder').addEventListener('click', () => { try { smartOrderGoto(); } catch (e) { console.error(e); } });
    document.getElementById('belMorningCredit').addEventListener('click', () => { const b = document.querySelector('nav.tabs button[data-tab="clients"]'); if (b) b.click(); });
    let audio = null;
    document.getElementById('belMorningListen').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (audio) { try { audio.pause(); } catch (x) {} audio = null; btn.textContent = '🔊 ' + tr('Écouter'); return; }
      if (!needOnline('la voix de Bel')) return;
      btn.disabled = true; btn.textContent = '⏳ ' + tr('Bel prépare sa voix…');
      try {
        const txt = belMorningLines(belMorningData(), true).join(' ').split(curSym()).join(DEVISES[curCode()].fr[1]);
        const { data, error } = await supabaseClient.functions.invoke('ask-ai', { body: { tts: txt, lang: 'fr' } });
        if (error || !data || !data.audio) throw new Error('Voix indisponible pour le moment');
        audio = new Audio(URL.createObjectURL(belPcmToWav(data.audio, data.mime)));
        audio.onended = () => { audio = null; btn.textContent = '🔊 ' + tr('Écouter'); };
        btn.textContent = '⏹ ' + tr('Arrêter'); await audio.play();
      } catch (x) { btn.textContent = '😕 ' + (x.message || 'Erreur'); setTimeout(() => { btn.textContent = '🔊 ' + tr('Écouter'); }, 4000); }
      finally { btn.disabled = false; }
    });
  })();
