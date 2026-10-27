  // ================= IA (TEST) : « Pose une question à ta boutique » =================
  // Visible seulement si le serveur dit que ce compte est autorisé (comptes de test, propriétaire/admin).
  // L'IA lit un RÉSUMÉ des chiffres préparé ici ; elle ne modifie jamais rien.
  let aiAskReady = false, aiAskOk = false, aiAskFor = null;
  // Fonctions « intelligentes » calculées sur l'appareil (À commander, anti-erreur caisse, 3 actions du jour,
  // point du patron) : gratuites, aucune donnée envoyée, ouvertes à tous les patrons (propriétaire / admin).
  // L'IA (Bel, stock par photo, voix) reste réservée aux comptes de test (aiAskOk, vérifié par le serveur).
  let smartOk = false;
  function smartInit() {
    smartOk = isOwnerOrAdmin();
    const bsc = document.getElementById('bossCard');
    if (bsc) { bsc.style.display = smartOk ? '' : 'none'; if (smartOk) { try { bossRender(); } catch (e) { console.error(e); } } }
    const bl = document.getElementById('bossListen'); if (bl) bl.style.display = aiAskOk ? '' : 'none';
    try { smartActionsRender(); smartOrderRender(); saleGuardRender(); } catch (e) { console.error(e); }
  }
  // Page spéciale de Bel : on y déplace la discussion (même contenu, rien n'est dupliqué)
  let belHome = null;
  function belOpenPage() {
    const box = document.getElementById('aiAsk'), page = document.getElementById('belPage'), slot = document.getElementById('belPageSlot');
    if (!box || !page || box.style.display === 'none') return;
    if (!belHome) belHome = { parent: box.parentNode, next: box.nextSibling };
    slot.appendChild(box); box.style.borderTop = 'none'; box.style.marginTop = '0';
    page.style.display = 'block'; document.body.style.overflow = 'hidden';
    if (ANDROID_APP) { try { history.pushState({ ...(history.state || {}), sfBel: 1 }, ''); } catch (e) {} }   // « retour » Android ferme Bel
    const out = document.getElementById('aiAskAnswer'); if (out) out.style.maxHeight = 'none';
    belMood('happy'); setTimeout(() => { if (!aiBusy) belMood('idle'); }, 1500);
  }
  function belClosePage() {
    const box = document.getElementById('aiAsk'), page = document.getElementById('belPage');
    if (page) page.style.display = 'none'; document.body.style.overflow = '';
    if (box && belHome) { belHome.parent.insertBefore(box, belHome.next); box.style.borderTop = ''; box.style.marginTop = ''; const out = document.getElementById('aiAskAnswer'); if (out) out.style.maxHeight = ''; belHome = null; }
  }
  document.getElementById('belHeadBtn').addEventListener('click', belOpenPage);
  document.getElementById('belPageClose').addEventListener('click', () => { if (ANDROID_APP && history.state && history.state.sfBel) history.back(); else belClosePage(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('belPage').style.display === 'block') belClosePage(); });
  async function aiAskInit() {
    const box = document.getElementById('aiAsk'); if (!box) return;
    const hbtn = document.getElementById('belHeadBtn');
    smartInit();
    if (!isOwnerOrAdmin() || !supabaseClient) { box.style.display = 'none'; if (hbtn) hbtn.style.display = 'none'; const c0 = document.getElementById('photoFillCard'); if (c0) c0.style.display = 'none'; const v0 = document.getElementById('voiceSale'); if (v0) v0.style.display = 'none'; aiAskOk = false; const bl0 = document.getElementById('bossListen'); if (bl0) bl0.style.display = 'none'; const bm0 = document.getElementById('belMorning'); if (bm0) bm0.style.display = 'none'; try { smartActionsRender(); smartOrderRender(); saleGuardRender(); } catch (e) {} belClosePage(); return; }
    const pfc = document.getElementById('photoFillCard');
    if (aiAskFor !== CURRENT_USER_ID) { aiAskFor = CURRENT_USER_ID; aiAskOk = false; box.style.display = 'none'; if (hbtn) hbtn.style.display = 'none'; if (pfc) pfc.style.display = 'none'; const vs0 = document.getElementById('voiceSale'); if (vs0) vs0.style.display = 'none'; const bl1 = document.getElementById('bossListen'); if (bl1) bl1.style.display = 'none'; const bm1 = document.getElementById('belMorning'); if (bm1) bm1.style.display = 'none'; try { smartActionsRender(); smartOrderRender(); saleGuardRender(); } catch (e) {} belClosePage(); }
    if (aiAskOk || navigator.onLine === false) return;   // déjà vérifié pour ce compte : pas de nouvelle vérification (évite que le cadre clignote)
    try {
      const { data, error } = await supabaseClient.functions.invoke('ask-ai', { body: { ping: true } });
      if (error || !data || !data.actif) return;
      aiAskOk = true;
      try { renderLangPickers(); } catch (e) {}
      box.style.display = '';
      if (pfc) pfc.style.display = '';
      const blb = document.getElementById('bossListen'); if (blb) blb.style.display = '';
      try { smartActionsRender(); smartOrderRender(); saleGuardRender(); } catch (e) { console.error(e); }
      try { aboRender(); } catch (e) { console.error(e); }
      try { belMorningRender(); } catch (e) { console.error(e); }
      try { fstyleRender(); } catch (e) { console.error(e); }
      // Vente à la voix : prête mais mise en pause (à rallumer : remettre display = '')
      const vsc = document.getElementById('voiceSale'); if (vsc) vsc.style.display = 'none';
      const face = document.getElementById('belFace'); if (face && !face.innerHTML) face.innerHTML = belAvatarSvg(56);
      const hb = document.getElementById('belHeadBtn'); if (hb) { if (!hb.innerHTML) hb.innerHTML = belAvatarSvg(42); hb.style.display = 'inline-block'; }
      if (aiAskReady) return; aiAskReady = true;
      // Grandes images-boutons : compréhensibles sans savoir lire
      const tiles = [
        { e: '💰', l: 'Mes ventes', q: "💰 Comment vont mes ventes aujourd'hui et cette semaine ?" },
        { e: '💸', l: 'Qui me doit ?', q: "💸 Qui me doit de l'argent ? Prépare les relances WhatsApp." },
        { e: '📦', l: 'Quoi racheter ?', q: "📦 Quels produits je dois racheter maintenant ? Prépare la commande au fournisseur." },
        { e: '🧾', l: 'Ma caisse', q: "🧾 Combien j'ai encaissé aujourd'hui, en espèces et en Mobile Money ?" },
        { e: '💵', l: 'Mon bénéfice', q: "💵 Quel est mon vrai bénéfice ce mois-ci ?" },
        { e: '🏆', l: 'Top produits', q: "🏆 Quels sont mes produits stars et ceux qui ne se vendent pas ?" },
        { e: '📊', l: 'Bilan du mois', q: "📊 Fais-moi le bilan complet du mois." },
        { e: '⚠️', l: 'Problèmes', q: "⚠️ Qu'est-ce qui me fait perdre de l'argent ?" },
        { e: '📅', l: 'Bons jours', q: "📅 Quels sont mes meilleurs jours et heures de vente ?" },
        { e: '📸', l: 'Stock par photo', go: 'photo' },
      ];
      const cBox = document.getElementById('aiAskChips');
      cBox.innerHTML = tiles.map((t, i) => `<button type="button" class="bel-tile" data-belt="${i}" aria-label="${escapeHtml(t.l)}"><span class="e">${t.e}</span><span>${escapeHtml(t.l)}</span></button>`).join('');
      cBox.querySelectorAll('[data-belt]').forEach(b => b.addEventListener('click', () => { const t = tiles[Number(b.dataset.belt)]; if (t.go === 'photo') { belClosePage(); const tb = document.querySelector('[data-tab="produits"]'); if (tb) tb.click(); setTimeout(() => { const c = document.getElementById('photoFillCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150); return; } document.getElementById('aiAskInput').value = tr(t.q); aiAsk(); }));
      document.getElementById('aiAskBtn').addEventListener('click', aiAsk);
      document.getElementById('aiAskReset').addEventListener('click', () => { belStop(); belAudioCache.forEach(u => URL.revokeObjectURL(u)); belAudioCache.clear(); aiHistory = []; aiRender(); belMood('idle'); });
      document.getElementById('aiAskAnswer').addEventListener('click', (e) => {
        const v = e.target.closest('[data-belvoice]'); if (v) { belSpeak(Number(v.dataset.belvoice)); return; }
        const b = e.target.closest('[data-aiwa]'); if (!b) return;
        const a = aiWaActions[Number(b.dataset.aiwa)]; if (!a) return;
        aiOpenWa(aiPhoneOf(a.nom), a.msg, a.nom);
      });
      belMicInit();
      document.getElementById('aiAskInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') aiAsk(); });
    } catch (e) { /* IA indisponible : on n'affiche rien */ }
  }
  // Toutes les données utiles de la boutique, en texte compact (l'IA ne voit que ce résumé, rien d'autre)
  function aiContexte() {
    const c = state.commerce || {};
    const n0 = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
    const today = todayStr();
    const dayMs = 86400000, since = (d) => new Date(Date.now() - d * dayMs).toISOString().slice(0, 10);
    const d90 = since(90), d30 = since(30), d7 = since(7);
    const sum = (arr) => arr.reduce((t, x) => t + (Number(x) || 0), 0);
    const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const allInv = state.invoices || [];
    const invs = allInv.filter(i => !i.annulee);
    const L = [];
    L.push('Boutique : ' + (c.nom || '?') + (c.adresse ? ' — ' + c.adresse : '') + ' — date du jour : ' + today + ' (' + JOURS[new Date().getDay()] + ')');
    L.push('Utilisateur : ' + (state.currentUser ? state.currentUser.nom + ' (' + state.currentUser.role + ')' : '?'));
    if (UI_LANG !== 'fr') L.push('LANGUE DE RÉPONSE OBLIGATOIRE : ' + (UI_LANG === 'en' ? 'ANGLAIS (English). Réponds entièrement en anglais simple, y compris les messages WhatsApp.' : 'ARABE (العربية). Réponds entièrement en arabe simple, y compris les messages WhatsApp. Garde les chiffres en 0-9.'));
    L.push('DEVISE DE LA BOUTIQUE : ' + DEVISES[curCode()].fr[1] + ' (' + curSym() + '). Écris tous les montants dans cette devise, avec « ' + curSym() + ' » (et non FCFA si la devise est différente).');
    // ---- Produits (avec prix d'achat si connu → marges)
    const prods = state.products || [];
    const cost = {}; prods.forEach(p => { if (Number(p.prixAchat) > 0) cost[p.nom] = Number(p.prixAchat); });
    L.push('\n## PRODUITS (' + prods.length + ') — nom | réf | catégorie | stock | seuil alerte | prix vente | prix achat | fournisseur');
    prods.slice(0, 1500).forEach(p => L.push('- ' + p.nom + ' | ' + (p.ref || '-') + ' | ' + (p.categorie || '-') + ' | ' + (Number(p.stock) || 0) + (p.unite ? ' ' + p.unite : '') + ' | ' + (p.seuil != null && p.seuil !== '' ? p.seuil : '-') + ' | ' + n0(p.prixVente) + ' | ' + (Number(p.prixAchat) > 0 ? n0(p.prixAchat) : '?') + ' | ' + (p.fournisseur || '-')));
    const valStock = sum(prods.map(p => (Number(p.stock) || 0) * (Number(p.prixAchat) || 0)));
    if (valStock) L.push('Valeur du stock au prix d\'achat : ' + n0(valStock) + ' ' + curSym() + '');
    // ---- Ventes : agrégats 90 jours
    const recent = invs.filter(i => (i.date || '') >= d90);
    const perDay = {}, perProd = {}, perWd = {}, perHour = {}, perSeller = {}, perClient = {};
    recent.forEach(i => {
      const t = Number(i.total) || 0;
      perDay[i.date] = (perDay[i.date] || 0) + t;
      const dt = i.createdAt ? new Date(i.createdAt) : new Date(i.date);
      const wd = JOURS[dt.getDay()]; perWd[wd] = perWd[wd] || { n: 0, m: 0 }; perWd[wd].n++; perWd[wd].m += t;
      if (i.createdAt) { const h = dt.getHours() + 'h'; perHour[h] = perHour[h] || { n: 0, m: 0 }; perHour[h].n++; perHour[h].m += t; }
      const sl = (i.operateur || '?').replace(/\s*\(.*\)$/, ''); perSeller[sl] = perSeller[sl] || { n: 0, m: 0 }; perSeller[sl].n++; perSeller[sl].m += t;
      const cl = i.client || 'Client de passage'; perClient[cl] = perClient[cl] || { n: 0, m: 0, last: '' }; perClient[cl].n++; perClient[cl].m += t; if ((i.date || '') > perClient[cl].last) perClient[cl].last = i.date;
      (i.lignes || []).forEach(l => {
        const k = l.nom || '?'; const o = perProd[k] || (perProd[k] = { q: 0, m: 0, marge: 0, margeConnue: true, last: '' });
        const q = Number(l.qte) || 0, pr = Number(l.prix) || 0;
        o.q += q; o.m += q * pr; if (cost[k] != null) o.marge += q * (pr - cost[k]); else o.margeConnue = false; if ((i.date || '') > o.last) o.last = i.date;
      });
    });
    const per = (d) => sum(Object.entries(perDay).filter(([k]) => k >= d).map(([, v]) => v));
    L.push('\n## VENTES (factures non annulées) — 7 j : ' + n0(per(d7)) + ' ' + curSym() + ' ; 30 j : ' + n0(per(d30)) + ' ' + curSym() + ' ; 90 j : ' + n0(per(d90)) + ' ' + curSym() + ' (' + recent.length + ' factures sur 90 j)');
    L.push('Factures annulées sur 90 j : ' + allInv.filter(i => i.annulee && (i.date || '') >= d90).length);
    L.push('Chiffre par jour (90 j) : ' + Object.keys(perDay).sort().map(d => d.split('-').reverse().slice(0, 2).join('/') + '=' + n0(perDay[d])).join(', '));
    L.push('Par jour de la semaine (90 j) : ' + Object.entries(perWd).map(([k, o]) => k + ' ' + o.n + ' ventes / ' + n0(o.m)).join(' ; '));
    if (Object.keys(perHour).length) L.push('Par heure (90 j) : ' + Object.keys(perHour).sort((a, b) => parseInt(a) - parseInt(b)).map(k => k + ' ' + perHour[k].n + ' ventes / ' + n0(perHour[k].m)).join(' ; '));
    L.push('Par vendeur (90 j) : ' + Object.entries(perSeller).map(([k, o]) => k + ' ' + o.n + ' ventes / ' + n0(o.m)).join(' ; '));
    L.push('\n## PRODUITS VENDUS (90 j) — nom | quantité | chiffre | marge brute (si prix d\'achat connu) | dernière vente');
    Object.entries(perProd).sort((a, b) => b[1].m - a[1].m).slice(0, 400).forEach(([k, o]) => L.push('- ' + k + ' | ' + o.q + ' | ' + n0(o.m) + ' | ' + (o.margeConnue ? n0(o.marge) : '?') + ' | ' + o.last));
    const unsold = prods.filter(p => !perProd[p.nom]).map(p => p.nom + ' (stock ' + (Number(p.stock) || 0) + ')');
    if (unsold.length) L.push('Produits du catalogue NON vendus depuis 90 j (' + unsold.length + ') : ' + unsold.slice(0, 300).join(', '));
    // ---- Détail des factures récentes
    L.push('\n## DÉTAIL DES FACTURES (90 j, les plus récentes d\'abord) — date | n° | client | total | payé | type | articles');
    recent.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 400).forEach(i => {
      const art = (i.lignes || []).map(l => (l.nom || '?') + '×' + (Number(l.qte) || 0) + '@' + n0(l.prix)).join('; ');
      L.push('- ' + i.date + ' | FAC-' + String(i.num).padStart(4, '0') + ' | ' + (i.client || 'passage') + ' | ' + n0(i.total) + ' | ' + n0(i.montantPaye) + ' | ' + ((Number(i.montantPaye) || 0) < (Number(i.total) || 0) ? 'crédit' : 'comptant') + ' | ' + art);
    });
    // ---- Paiements
    const pays = (state.paiements || []).filter(p => (p.date || '') >= d90);
    const perMode = {}; pays.forEach(p => { const m = p.mode || '?'; perMode[m] = (perMode[m] || 0) + (Number(p.montant) || 0); });
    L.push('\n## ENCAISSEMENTS (90 j) par mode : ' + Object.entries(perMode).map(([k, v]) => k + ' ' + n0(v)).join(' ; '));
    // ---- Crédits clients
    const clients = state.clients || [];
    const phoneOf = (nom) => { const cl = clients.find(x => (x.nom || '').trim().toLowerCase() === String(nom || '').trim().toLowerCase()); return cl && cl.telephone ? cl.telephone : ''; };
    const dettes = {};
    invs.forEach(i => { const r = (Number(i.total) || 0) - (Number(i.montantPaye) || 0); if (r > 0.5) { const k = i.client || 'Client sans nom'; const o = dettes[k] || (dettes[k] = { r: 0, n: 0, plusAncienne: i.date, ech: '', fac: [] }); o.r += r; o.n++; o.fac.push('FAC-' + String(i.num).padStart(4, '0')); if ((i.date || '') < (o.plusAncienne || '9')) o.plusAncienne = i.date; if (i.echeance && (!o.ech || i.echeance < o.ech)) o.ech = i.echeance; } });
    const dl = Object.entries(dettes).sort((a, b) => b[1].r - a[1].r);
    L.push('\n## CRÉDITS : CLIENTS QUI DOIVENT DE L\'ARGENT — total ' + n0(sum(dl.map(([, o]) => o.r))) + ' ' + curSym() + ' — client | reste dû | factures | plus ancienne | échéance | téléphone');
    dl.slice(0, 200).forEach(([k, o]) => L.push('- ' + k + ' | ' + n0(o.r) + ' | ' + o.fac.join(',') + ' | ' + (o.plusAncienne || '-') + ' | ' + (o.ech || '-') + ' | ' + (phoneOf(k) ? 'oui' : 'non')));
    // ---- Clients
    L.push('\n## CLIENTS (' + clients.length + ') — nom | achats 90 j | nb factures | dernière visite');
    Object.entries(perClient).sort((a, b) => b[1].m - a[1].m).slice(0, 200).forEach(([k, o]) => L.push('- ' + k + ' | ' + n0(o.m) + ' | ' + o.n + ' | ' + o.last));
    // ---- Fournisseurs
    const fours = state.fournisseurs || [];
    if (fours.length) {
      L.push('\n## FOURNISSEURS — nom | téléphone connu | produits liés');
      fours.forEach(f => L.push('- ' + f.nom + ' | ' + (f.telephone ? 'oui' : 'non') + ' | ' + prods.filter(p => (p.fournisseur || '').trim().toLowerCase() === (f.nom || '').trim().toLowerCase()).map(p => p.nom).slice(0, 30).join(', ')));
    }
    const cmds = (state.commandes || []).filter(x => (x.date || '') >= d90);
    if (cmds.length) L.push('Commandes fournisseurs (90 j) : ' + cmds.map(x => x.date + ' ' + (x.fournisseurNom || '?') + ' ' + n0(x.montantCommande) + ' (payé ' + n0(x.montantPaye) + ')').join(' ; '));
    // ---- Dépenses
    const dep = (state.depenses || []).filter(d => (d.date || '') >= d90);
    if (dep.length) {
      const pc = {}; dep.forEach(d => { const k = d.categorie || 'Autre'; pc[k] = (pc[k] || 0) + (Number(d.montant) || 0); });
      L.push('\n## DÉPENSES (90 j) — total ' + n0(sum(dep.map(d => d.montant))) + ' ' + curSym() + ' ; 30 j : ' + n0(sum(dep.filter(d => d.date >= d30).map(d => d.montant))) + ' ' + curSym() + '');
      L.push('Par catégorie : ' + Object.entries(pc).map(([k, v]) => k + ' ' + n0(v)).join(' ; '));
      dep.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 150).forEach(d => L.push('- ' + d.date + ' | ' + (d.categorie || '-') + ' | ' + n0(d.montant) + (d.note ? ' | ' + d.note : '')));
    }
    // ---- Pertes / casse / inventaires
    const mv = (state.movements || []).filter(m => (m.date || '') >= d90 && (m.source === 'perte' || m.source === 'inventaire'));
    if (mv.length) {
      L.push('\n## PERTES ET AJUSTEMENTS D\'INVENTAIRE (90 j)');
      mv.slice(0, 150).forEach(m => L.push('- ' + m.date + ' | ' + m.source + ' | ' + (m.nom || '?') + ' | ' + (m.quantite) + (m.unite ? ' ' + m.unite : '') + (m.raison ? ' | ' + m.raison : '')));
    }
    return L.join('\n').slice(0, 150000);
  }
  // Conversation (gardée seulement dans cette page) + messages WhatsApp proposés par l'IA
  let aiHistory = [], aiWaActions = [], aiBusy = false;
  // ----- Bel : avatar animé -----
  function belAvatarSvg(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
      <defs><radialGradient id="belG" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#ffd166"/><stop offset=".65" stop-color="#f59e0b"/><stop offset="1" stop-color="#d97706"/></radialGradient></defs>
      <g class="bel-body">
        <line x1="50" y1="16" x2="50" y2="6" stroke="#0f766e" stroke-width="3" stroke-linecap="round"/>
        <circle class="bel-bulb" cx="50" cy="6" r="5" fill="#34d399"/>
        <circle cx="50" cy="54" r="38" fill="url(#belG)"/>
        <path d="M18 44 Q50 10 82 44 Q66 30 50 30 Q34 30 18 44Z" fill="#0f766e"/>
        <circle cx="30" cy="62" r="6" fill="#fb7185" opacity=".55"/><circle cx="70" cy="62" r="6" fill="#fb7185" opacity=".55"/>
        <ellipse cx="38" cy="50" rx="8" ry="9.5" fill="#fff"/><ellipse cx="62" cy="50" rx="8" ry="9.5" fill="#fff"/>
        <g class="bel-pupils"><circle cx="39.5" cy="51.5" r="4.6" fill="#1f2937"/><circle cx="63.5" cy="51.5" r="4.6" fill="#1f2937"/><circle cx="41" cy="49.5" r="1.6" fill="#fff"/><circle cx="65" cy="49.5" r="1.6" fill="#fff"/></g>
        <g class="bel-lids"><ellipse cx="38" cy="50" rx="8.6" ry="10" fill="#f59e0b"/><ellipse cx="62" cy="50" rx="8.6" ry="10" fill="#f59e0b"/></g>
        <path class="smile" d="M38 68 Q50 77 62 68" stroke="#7c2d12" stroke-width="3.2" fill="none" stroke-linecap="round"/>
        <path class="smile-big" d="M36 66 Q50 84 64 66 Z" fill="#7c2d12"/>
        <ellipse class="mouth-o" cx="50" cy="70" rx="4" ry="4.5" fill="#7c2d12"/>
      </g></svg>`;
  }
  function belMood(m) { const f = document.getElementById('belFace'); if (f) f.dataset.mood = m; const hb = document.getElementById('belHeadBtn'); if (hb) hb.dataset.mood = m; document.querySelectorAll('#aiAskAnswer .bel-av.live').forEach(a => a.dataset.mood = m); }
  // ----- Bel : micro (dicter sa question), pour les commerçants qui ne lisent pas -----
  // ----- Bel : voix naturelle (voix IA de Google, via la fonction ask-ai) -----
  let belAudio = null, belAudioIdx = -1, belAudioLoading = -1;
  const belAudioCache = new Map();
  function belPlain(txt) {
    return String(txt || '')
      .replace(/\[\[WHATSAPP\|([^|\]]{1,80})\|[^\]]*\]\]/g, (m, nom) => ({ fr: 'Je t\'ai préparé un message WhatsApp pour ', en: 'I prepared a WhatsApp message for ', ar: 'جهّزت لك رسالة واتساب إلى ' })[UI_LANG] + nom.trim() + '.')
      .replace(BEL_ACT_RE, () => ({ fr: 'Je t\'ai préparé une opération à confirmer.', en: 'I prepared an entry for you to confirm.', ar: 'جهّزت لك عملية لتأكيدها.' })[UI_LANG])
      .replace(/\*\*/g, '').replace(/^#{1,4}\s*/gm, '').replace(/^\s*[-*•] /gm, '')
      .replace(/\p{Extended_Pictographic}/gu, '').replace(/[‍️⃣]/g, '')
      .split(curSym()).join(UI_LANG === 'ar' ? DEVISES[curCode()].ar : DEVISES[curCode()][UI_LANG === 'en' ? 'en' : 'fr'][1]).replace(/[ \t]+/g, ' ').replace(/^ +| +$/gm, '').replace(/\n\s*\n+/g, '\n').trim();
  }
  function belPcmToWav(b64, mime) {
    const bin = atob(b64), n = bin.length, pcm = new Uint8Array(n);
    for (let i = 0; i < n; i++) pcm[i] = bin.charCodeAt(i);
    if (/wav|mpeg|mp3|ogg|webm/i.test(mime || '')) return new Blob([pcm], { type: mime });
    const rate = Number((/rate=(\d+)/.exec(mime || '') || [])[1]) || 24000;
    const buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n, true);
    new Uint8Array(buf, 44).set(pcm);
    return new Blob([buf], { type: 'audio/wav' });
  }
  function belVoiceLabel(i) {
    if (belAudioLoading === i) return '⏳ Bel prépare sa voix…';
    if (belAudioIdx === i) return '⏹ Arrêter';
    return '🔊 Écouter';
  }
  function belVoiceUi() {
    document.querySelectorAll('#aiAskAnswer [data-belvoice]').forEach(b => {
      const i = Number(b.dataset.belvoice); b.textContent = belVoiceLabel(i);
      b.classList.toggle('primary', belAudioIdx === i);
    });
  }
  function belStop() {
    if (belAudio) { try { belAudio.pause(); } catch (e) {} belAudio = null; }
    belAudioIdx = -1; belAudioLoading = -1; belVoiceUi();
  }
  async function belSpeak(i) {
    const h = aiHistory[i]; if (!h || h.err) return;
    if (belAudioIdx === i || belAudioLoading === i) { belStop(); return; }
    belStop();
    const txt = belPlain(h.a); if (!txt) return;
    let url = belAudioCache.get(txt);
    if (!url) {
      if (!needOnline('la voix de Bel')) return;
      belAudioLoading = i; belVoiceUi(); belMood('think');
      try {
        const { data, error } = await supabaseClient.functions.invoke('ask-ai', { body: { tts: txt, lang: UI_LANG } });
        if (error || !data || !data.audio) {
          let msg = 'Voix indisponible pour le moment';
          try { const j = error && await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
          throw new Error(msg);
        }
        url = URL.createObjectURL(belPcmToWav(data.audio, data.mime));
        belAudioCache.set(txt, url);
      } catch (e) {
        if (belAudioLoading !== i) return; // arrêté entre-temps
        belAudioLoading = -1; belVoiceUi(); belMood('sad');
        const b = document.querySelector('#aiAskAnswer [data-belvoice="' + i + '"]');
        if (b) { b.textContent = '😕 ' + (isNetErr(e) ? 'Pas de connexion' : (e.message || 'Voix indisponible')); setTimeout(belVoiceUi, 4000); }
        setTimeout(() => { if (!aiBusy) belMood('idle'); }, 2500);
        return;
      }
      if (belAudioLoading !== i) return; // l'utilisateur a arrêté ou demandé autre chose
    }
    belAudioLoading = -1;
    const a = new Audio(url); belAudio = a; belAudioIdx = i; belVoiceUi(); belMood('happy');
    const done = () => { if (belAudio === a) { belAudio = null; belAudioIdx = -1; belVoiceUi(); if (!aiBusy) belMood('idle'); } };
    a.onended = done; a.onerror = done;
    try { await a.play(); } catch (e) { done(); }
  }
  function belMicInit() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mic = document.getElementById('belMic'); if (!SR || !mic) return;
    mic.style.display = '';
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { try { rec.stop(); } catch (e) {} return; }
      belStop();
      rec = new SR(); rec.lang = ({ fr: 'fr-FR', en: 'en-US', ar: 'ar-SA' })[UI_LANG] || 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 1;
      mic.textContent = '⏺'; mic.classList.add('primary'); belMood('think');
      document.getElementById('belSay').innerHTML = '🎤 Je t\'écoute… parle maintenant.';
      rec.onresult = (ev) => { const txt = ev.results[0][0].transcript; document.getElementById('aiAskInput').value = '🎤 ' + txt; aiAsk(); };
      rec.onerror = () => { document.getElementById('belSay').innerHTML = '🙉 Je n\'ai pas entendu. Touche 🎤 et réessaie.'; belMood('sad'); };
      rec.onend = () => { rec = null; mic.textContent = '🎤'; mic.classList.remove('primary'); if (!aiBusy) belMood('idle'); };
      try { rec.start(); } catch (e) { rec = null; }
    });
  }
  function aiPhoneOf(nom) {
    const k = String(nom || '').trim().toLowerCase();
    const cl = (state.clients || []).find(x => (x.nom || '').trim().toLowerCase() === k);
    if (cl && cl.telephone) return cl.telephone;
    const f = (state.fournisseurs || []).find(x => (x.nom || '').trim().toLowerCase() === k);
    return f && f.telephone ? f.telephone : '';
  }
  function aiFormat(txt, hi, hEntry) {
    // Le texte de l'IA est d'abord échappé : aucun HTML venant de l'IA n'est exécuté
    // Les opérations proposées par Bel (dépense, paiement, commande) sont mises de côté, puis remises en cartes « à confirmer »
    const X = belExtractActs(txt);
    let h = escapeHtml(X.out);
    h = h.replace(/\[\[WHATSAPP\|([^|\]]{1,80})\|([^\]]{1,1000})\]\]/g, (m, nom, msg) => {
      const i = aiWaActions.push({ nom: nom.trim().replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), msg: msg.trim().replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') }) - 1;
      return '<div style="margin:6px 0; padding:8px 10px; border:1px solid rgba(34,197,94,.45); border-radius:10px; background:rgba(34,197,94,.08);">'
        + '<div style="font-size:12.5px; margin-bottom:6px;">💬 <b>' + nom.trim() + '</b> : ' + msg.trim() + '</div>'
        + '<button type="button" class="primary" data-aiwa="' + i + '" style="padding:4px 10px; font-size:12px;">📱 Ouvrir dans WhatsApp</button></div>';
    });
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>').replace(/^\s*[-*] /gm, '• ');
    return belInsertActs(h.replace(/\n/g, '<br>'), X.acts, hi, hEntry);
  }
  function aiRender(pendingQ) {
    const out = document.getElementById('aiAskAnswer');
    aiWaActions = [];
    const me = (q) => `<div class="bel-row me"><div class="bel-bub">${escapeHtml(q)}</div></div>`;
    const bot = (inner, cls, live) => `<div class="bel-row bot"><span class="bel-av${live ? ' live' : ''}" data-mood="${live ? 'think' : 'idle'}">${belAvatarSvg(30)}</span><div class="bel-bub ${cls || ''}">${inner}</div></div>`;
    const parts = aiHistory.map((h, i) => me(h.q) + (h.err
      ? bot('😕 ' + escapeHtml(h.a), 'err')
      : bot(aiFormat(h.a, i, h) + `<div><button type="button" class="bel-speak" data-belvoice="${i}">${belVoiceLabel(i)}</button></div>`)));
    if (pendingQ) parts.push(me(pendingQ) + bot('<span class="bel-dots"><span></span><span></span><span></span></span> <span class="muted" style="font-size:12.5px;">🧠 Je regarde tes chiffres…</span>', '', true));
    out.innerHTML = parts.join('');
    out.style.display = parts.length ? 'block' : 'none';
    document.getElementById('aiAskReset').style.display = aiHistory.length ? '' : 'none';
    document.getElementById('belSay').style.display = parts.length ? 'none' : '';
    out.scrollTop = out.scrollHeight;
  }
  async function aiAsk() {
    if (aiBusy) return;
    const input = document.getElementById('aiAskInput'), btn = document.getElementById('aiAskBtn');
    const q = (input.value || '').trim();
    if (!q) { input.focus(); return; }
    if (!needOnline('l\'IA')) return;
    aiBusy = true; btn.disabled = true; input.value = '';
    belStop(); belMood('think');
    document.querySelectorAll('#aiAskChips .bel-tile').forEach(b => b.disabled = true);
    aiRender(q);
    const history = aiHistory.filter(h => !h.err).slice(-6).map(h => ({ q: h.q, a: h.a }));
    try {
      const { data, error } = await supabaseClient.functions.invoke('ask-ai', { body: { question: q, contexte: aiContexte(), history } });
      if (error) {
        let msg = error.message || 'Erreur';
        try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch (e) {}
        aiHistory.push({ q, a: msg, err: true });
      } else {
        aiHistory.push({ q, a: (data && data.reponse) || 'Pas de réponse.' });
      }
    } catch (e) {
      aiHistory.push({ q, a: isNetErr(e) ? 'Pas de connexion internet.' : ((e && e.message) || 'Erreur'), err: true });
    } finally {
      aiHistory = aiHistory.slice(-10);
      aiBusy = false; btn.disabled = false; aiRender();
      // Question posée à la voix (🎤) : Bel répond aussi à la voix
      if (q.startsWith('🎤') && aiHistory.length && !aiHistory[aiHistory.length - 1].err) belSpeak(aiHistory.length - 1);
      document.querySelectorAll('#aiAskChips .bel-tile').forEach(b => b.disabled = false);
      const last = aiHistory[aiHistory.length - 1];
      belMood(last && last.err ? 'sad' : 'happy');
      setTimeout(() => { if (!aiBusy) belMood('idle'); }, 2500);
    }
  }
