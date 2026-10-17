  // ================= Appli plus intelligente (test) : prévision de rupture + commande, anti-erreur à la caisse, 3 actions du jour =================
  // Tout est calculé sur l'appareil à partir des ventes : marche sans internet, ne coûte rien. Ouvert à tous les patrons (smartOk).
  const SMART_DAY = 86400000;
  let smartQty = {};            // quantités à commander modifiées à la main (id produit → quantité)
  let saleGuardAck = '';         // anomalies déjà confirmées par le vendeur pour la vente en cours

  // ---- 1. Prévision : à quelle vitesse chaque produit part, et dans combien de jours il sera fini ----
  function smartForecast() {
    const prods = state.products || [], inv = (state.invoices || []).filter(i => !i.annulee);
    const today = todayStr();
    const ago = (d) => Math.round((new Date(today + 'T12:00:00').getTime() - new Date((d || today) + 'T12:00:00').getTime()) / SMART_DAY);
    const byRef = {}, byId = {}; prods.forEach(p => { byId[p.id] = p; if (p.ref) byRef[p.ref] = p; });
    let maxAgo = 0; const q7 = {}, q30 = {};
    inv.forEach(i => {
      const a = ago(i.date); if (a < 0) return; if (a > maxAgo) maxAgo = a;
      (i.lignes || []).forEach(l => {
        const p = (l.productId && byId[l.productId]) || (l.ref && byRef[l.ref]); if (!p) return;
        const q = Number(l.qte) || 0;
        if (a < 7) q7[p.id] = (q7[p.id] || 0) + q;
        if (a < 30) q30[p.id] = (q30[p.id] || 0) + q;
      });
    });
    const span = maxAgo + 1;                              // nombre de jours d'historique (aujourd'hui compris)
    const ready = span >= 3;                              // trop peu de jours de ventes : pas de prévision fiable
    const fours = state.fournisseurs || [];
    const list = [];
    prods.forEach(p => {
      const stock = Number(p.stock) || 0, seuil = Number(p.seuil) || 0;
      const r30 = (q30[p.id] || 0) / Math.min(30, span), r7 = (q7[p.id] || 0) / Math.min(7, span);
      const rate = ready ? (span >= 7 ? 0.6 * r7 + 0.4 * r30 : r30) : 0;   // les 7 derniers jours comptent plus
      const days = rate > 0 ? Math.max(0, stock) / rate : null;
      const low = seuil > 0 && stock <= seuil;
      if (!((days !== null && days <= 7) || low || (stock <= 0 && (q30[p.id] || 0) > 0))) return;
      let qty = rate > 0 ? Math.ceil(rate * 14 - Math.max(0, stock)) : Math.ceil(seuil * 2 - Math.max(0, stock));   // de quoi tenir 2 semaines
      qty = Math.max(1, qty);
      const fNom = String(p.fournisseur || '').trim();
      const f = fNom ? fours.find(x => String(x.nom || '').trim().toLowerCase() === fNom.toLowerCase()) : null;
      list.push({ p, stock, rate, days, qty: smartQty[p.id] != null ? smartQty[p.id] : qty, qtyAuto: qty, fNom: fNom || '', tel: f ? f.telephone : '', pa: Number(p.prixAchat) || 0 });
    });
    list.sort((a, b) => (a.days === null ? 99 : a.days) - (b.days === null ? 99 : b.days));
    const groups = {};
    list.forEach(o => { const k = o.fNom.toLowerCase() || '—'; const g = groups[k] || (groups[k] = { nom: o.fNom, tel: o.tel, items: [], cout: 0, urgent: 99 }); g.items.push(o); g.cout += o.qty * o.pa; if (o.days !== null) g.urgent = Math.min(g.urgent, o.days); else if (o.stock <= 0) g.urgent = 0; });
    return { ready, span, list, groups: Object.values(groups).sort((a, b) => a.urgent - b.urgent), q30 };
  }
  const smartDaysTxt = (o) => o.stock <= 0 ? tr('rupture') : o.days === null ? tr('sous le seuil') : o.days < 1 ? tr('moins d\'1 jour') : '≈ ' + Math.round(o.days) + ' ' + tr(Math.round(o.days) > 1 ? 'jours' : 'jour');
  const smartDaysCls = (o) => (o.stock <= 0 || (o.days !== null && o.days <= 2)) ? 'bad' : 'warn';
  function smartOrderText(g) {
    const shop = (state.commerce && state.commerce.nom) || '';
    return `Bonjour${g.nom ? ' ' + g.nom : ''}, je voudrais commander :\n` + g.items.map(o => `- ${o.qty} ${o.p.unite || ''} ${o.p.nom}${o.p.ref ? ' (réf. ' + o.p.ref + ')' : ''}`.replace(/  +/g, ' ')).join('\n')
      + `\nMerci de me confirmer le prix et le jour de livraison.${shop ? '\n' + shop : ''}`;
  }
  function smartOrderRender() {
    const card = document.getElementById('smartOrderCard'); if (!card) return;
    if (!smartOk) { card.style.display = 'none'; return; }
    card.style.display = '';
    const F = smartForecast(), body = document.getElementById('smartOrderBody');
    document.getElementById('smartOrderSub').textContent = F.list.length ? F.list.length + ' ' + tr(F.list.length > 1 ? 'produits' : 'produit') : '';
    if (!F.list.length) { body.innerHTML = `<div class="boss-ok">✅ ${escapeHtml(tr('Rien à commander pour le moment : ton stock tient au moins une semaine.'))}</div>`; return; }
    let h = F.ready ? '' : `<p class="muted" style="margin:0 0 8px;">${escapeHtml(tr('Encore peu de ventes enregistrées : la liste se base surtout sur les seuils d\'alerte.'))}</p>`;
    F.groups.forEach((g, gi) => {
      h += `<div class="so-group"><div class="so-head"><b>🏪 ${escapeHtml(g.nom || tr('Fournisseur non indiqué'))}</b>${g.cout > 0 ? `<span class="muted">≈ ${euros(g.cout)}</span>` : ''}</div>`;
      g.items.forEach(o => {
        h += `<div class="so-row"><span class="so-nom">${escapeHtml(o.p.nom || o.p.ref || '—')}<small>${escapeHtml(tr('En stock'))} : ${o.stock} ${escapeHtml(o.p.unite || '')}${o.rate > 0 ? ' · ' + escapeHtml(tr('vendu')) + ' ≈ ' + (Math.round(o.rate * 10) / 10).toLocaleString('fr-FR') + '/' + escapeHtml(tr('jour')) : ''}</small></span>`
          + `<span class="so-days ${smartDaysCls(o)}">${escapeHtml(smartDaysTxt(o))}</span>`
          + `<input type="number" min="0" step="1" inputmode="numeric" class="so-qty" data-soq="${escapeHtml(o.p.id)}" value="${o.qty}" title="${escapeHtml(tr('Quantité à commander'))}"></div>`;
      });
      h += `<div class="so-actions"><button type="button" class="primary" data-sowa="${gi}">📤 ${escapeHtml(tr('Commander sur WhatsApp'))}</button></div></div>`;
    });
    body.innerHTML = h;
    body._groups = F.groups;
  }
  function smartOrderGoto() {
    const b = document.querySelector('nav.tabs button[data-tab="produits"]'); if (b) b.click();
    setTimeout(() => { const c = document.getElementById('smartOrderCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
  }

  // ---- 2. Anti-erreur à la caisse : vente à perte, prix à 0, prix très différent de d'habitude ----
  function saleGuardIssues(lines) {
    const out = [];
    (lines || []).forEach(l => {
      if (!l || !l.nom || !String(l.nom).trim() || !(Number(l.qte) > 0)) return;
      const prix = Number(l.prix) || 0, q = Number(l.qte) || 0;
      const p = l.matched ? (state.products || []).find(x => x.ref === l.ref) : null;
      const pa = p ? Number(p.prixAchat) || 0 : 0, pv = p ? Number(p.prixVente) || 0 : 0;
      if (prix <= 0) { out.push({ k: 'zero', t: `${l.nom} : ${tr('prix à 0 (article donné gratuitement ?)')}` }); return; }
      if (pa > 0 && prix < pa) { out.push({ k: 'perte', t: `${l.nom} : ${tr('vendu')} ${euros(prix)}, ${tr('acheté')} ${euros(pa)} → ${tr('perte de')} ${euros((pa - prix) * q)}` }); return; }
      if (pv > 0 && prix >= pv * 3) out.push({ k: 'cher', t: `${l.nom} : ${euros(prix)} ${tr('au lieu de')} ${euros(pv)} ${tr('d\'habitude (un zéro en trop ?)')}` });
      else if (pv > 0 && prix <= pv * 0.5) out.push({ k: 'bas', t: `${l.nom} : ${euros(prix)} ${tr('au lieu de')} ${euros(pv)} ${tr('d\'habitude (moitié prix ou moins)')}` });
    });
    return out;
  }
  function saleGuardRender() {
    const box = document.getElementById('saleGuard'); if (!box) return;
    const issues = smartOk && currentDocType() === 'facture' ? saleGuardIssues(invoiceLines) : [];
    if (!issues.length) { box.style.display = 'none'; box.innerHTML = ''; saleGuardAck = ''; return; }
    const sig = JSON.stringify(issues);
    if (saleGuardAck && saleGuardAck !== sig) saleGuardAck = '';
    box.style.display = '';
    box.innerHTML = `<b>🛑 ${escapeHtml(tr('Vérifie avant de valider'))}</b>` + issues.map(i => `<div class="sg-line">${i.k === 'perte' ? '💸' : i.k === 'zero' ? '🎁' : '🔢'} ${escapeHtml(i.t)}</div>`).join('')
      + (box.dataset.ask === sig ? `<div class="sg-actions"><button type="button" class="primary sg-yes" id="sgYes">${escapeHtml(tr('Oui, je confirme cette vente'))}</button><button type="button" class="ghost" id="sgNo">${escapeHtml(tr('Corriger'))}</button></div>` : '');
    const yes = document.getElementById('sgYes');
    if (yes) yes.addEventListener('click', () => { saleGuardAck = sig; delete box.dataset.ask; saleGuardRender(); document.getElementById('btnFinalize').click(); });
    const no = document.getElementById('sgNo');
    if (no) no.addEventListener('click', () => { delete box.dataset.ask; saleGuardRender(); const f = document.querySelector('.line-prix'); if (f) f.focus(); });
  }
  // Appelé au moment de finaliser : true = on peut enregistrer la vente
  function saleGuardCheck(lines) {
    if (!smartOk) return true;
    const issues = saleGuardIssues(lines);
    if (!issues.length) return true;
    const sig = JSON.stringify(issues);
    if (saleGuardAck === sig) {
      try { logAction('VENTE_ANOMALIE_CONFIRMEE', { anomalies: issues.map(i => i.t), client: document.getElementById('f-client').value.trim() }); } catch (e) { console.error(e); }
      saleGuardAck = '';
      return true;
    }
    const box = document.getElementById('saleGuard');
    box.dataset.ask = sig; saleGuardRender();
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  // ---- 5. Mes 3 actions du jour : les choses les plus utiles à faire aujourd'hui ----
  const smartDoneKey = () => 'sf_actions_faites_' + todayStr();
  const smartDone = () => { try { return JSON.parse(localStorage.getItem(smartDoneKey()) || '[]'); } catch (e) { return []; } };
  const smartActs = {};
  function smartActions() {
    const acts = [], today = todayStr(), shop = (state.commerce && state.commerce.nom) || 'notre boutique';
    const ago = (d) => Math.round((new Date(today + 'T12:00:00').getTime() - new Date((d || today) + 'T12:00:00').getTime()) / SMART_DAY);
    const n0 = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
    const F = smartForecast();
    // Commandes fournisseurs (une action par fournisseur)
    F.groups.forEach((g, gi) => {
      const urgent = g.urgent <= 2;
      const names = g.items.slice(0, 2).map(o => o.p.nom).join(', ') + (g.items.length > 2 ? '…' : '');
      acts.push({ id: 'cmd_' + (g.nom || '—'), kind: 'stock', score: urgent ? 100 - gi : 55 - gi, ic: '🛒',
        t: g.nom ? `Commander chez ${g.nom}` : `Racheter ${g.items.length > 1 ? g.items.length + ' produits' : g.items[0].p.nom}`,
        d: `${names} : ${g.urgent <= 0 ? 'déjà en rupture' : g.urgent < 99 ? 'plus que ≈ ' + Math.max(1, Math.round(g.urgent)) + ' jour(s) de stock' : 'sous le seuil d\'alerte'}.`,
        btn: '🛒 Voir la commande', go: smartOrderGoto });
    });
    // Produits vendus à perte dans le catalogue
    (state.products || []).filter(p => Number(p.prixAchat) > 0 && Number(p.prixVente) > 0 && Number(p.prixVente) < Number(p.prixAchat)).slice(0, 2).forEach(p => {
      acts.push({ id: 'perte_' + p.id, kind: 'prix', score: 90, ic: '💸', t: `Corriger le prix de ${p.nom}`,
        d: `Vendu ${euros(p.prixVente)} mais acheté ${euros(p.prixAchat)} : chaque vente te fait perdre ${euros(Number(p.prixAchat) - Number(p.prixVente))}.`,
        btn: '✏️ Corriger', go: () => { const b = document.querySelector('nav.tabs button[data-tab="produits"]'); if (b) b.click(); setTimeout(() => { try { startEditProduct(p.id); } catch (e) { console.error(e); } }, 120); } });
    });
    // Crédits : le client qui doit le plus, depuis le plus longtemps
    const groups = {};
    (state.invoices || []).filter(i => !i.annulee).forEach(i => {
      const r = Math.max(0, (Number(i.total) || 0) - (Number(i.montantPaye) || 0)); if (!r || !(i.client || i.clientId)) return;
      const k = i.clientId || String(i.client).trim().toLowerCase();
      const g = groups[k] || (groups[k] = { name: i.client || '', cid: i.clientId, sum: 0, oldest: 0, late: false });
      g.sum += r; g.oldest = Math.max(g.oldest, ago(i.date)); if (i.echeance && i.echeance < today) g.late = true;
    });
    Object.values(groups).filter(g => g.oldest >= 7 || g.late).sort((a, b) => (b.sum * (1 + b.oldest / 30)) - (a.sum * (1 + a.oldest / 30))).slice(0, 2).forEach((g, k) => {
      const cl = g.cid ? (state.clients || []).find(c => c.id === g.cid) : (state.clients || []).find(c => String(c.nom || '').trim().toLowerCase() === g.name.trim().toLowerCase());
      acts.push({ id: 'rel_' + (g.cid || g.name), kind: 'credit', score: 70 + Math.min(20, g.oldest / 2) - k * 5, ic: '🙋', t: `Relancer ${g.name}`,
        d: `${euros(g.sum)} à payer${g.late ? ', échéance dépassée' : ''} (depuis ${g.oldest} jours).`,
        btn: '📤 WhatsApp', go: () => aiOpenWa(cl && cl.telephone, `Bonjour ${g.name}, petit rappel amical de ${shop} : il reste ${n0(g.sum)} ${curSym()} à régler. Merci d'avance et bonne journée 🙏`, g.name) });
    });
    // Stock négatif : à recompter
    const neg = (state.products || []).filter(p => Number(p.stock) < 0);
    if (neg.length) acts.push({ id: 'neg', kind: 'stock2', score: 60, ic: '🔢', t: `Recompter ${neg.length > 1 ? neg.length + ' produits' : neg[0].nom}`,
      d: `Le stock affiché est négatif (${neg.slice(0, 2).map(p => p.nom + ' : ' + p.stock).join(', ')}) : il y a eu une erreur de saisie ou une sortie non notée.`,
      btn: '📋 Inventaire', go: () => { const b = document.querySelector('nav.tabs button[data-tab="inventaire"]'); if (b) b.click(); } });
    // Caisse du jour à clôturer (le soir)
    let lastClose = ''; try { lastClose = localStorage.getItem('sf_last_close') || ''; } catch (e) {}
    if (new Date().getHours() >= 18 && lastClose !== today && (state.invoices || []).some(i => !i.annulee && i.date === today))
      acts.push({ id: 'cloture', kind: 'caisse', score: 50, ic: '🔒', t: 'Clôturer la caisse', d: 'Compte le tiroir et compare avec les ventes de la journée.', btn: '🧾 Caisse', go: () => { const b = document.querySelector('nav.tabs button[data-tab="caisse"]'); if (b) b.click(); } });
    // Argent qui dort : produits sans vente depuis 45 jours
    if (F.span >= 45) {
      const lastSold = {}; (state.invoices || []).filter(i => !i.annulee).forEach(i => (i.lignes || []).forEach(l => { const a = ago(i.date); const k = l.productId || l.ref; if (k && (lastSold[k] === undefined || a < lastSold[k])) lastSold[k] = a; }));
      const dorm = (state.products || []).filter(p => Number(p.stock) > 0 && Number(p.prixAchat) > 0 && lastSold[p.id] === undefined && lastSold[p.ref] === undefined)
        .map(p => ({ p, v: Number(p.stock) * Number(p.prixAchat) })).sort((a, b) => b.v - a.v)[0];
      if (dorm && dorm.v > 0) acts.push({ id: 'dort_' + dorm.p.id, kind: 'dort', score: 25, ic: '💤', t: `Faire une promo sur ${dorm.p.nom}`,
        d: `Aucune vente depuis plus de 45 jours : ${euros(dorm.v)} dorment sur l'étagère.`, btn: '📦 Voir', go: () => { const b = document.querySelector('nav.tabs button[data-tab="produits"]'); if (b) b.click(); } });
    }
    // Les 3 plus utiles, avec au plus 2 actions du même genre
    acts.sort((a, b) => b.score - a.score);
    const pick = [], perKind = {};
    for (const a of acts) { if (pick.length >= 3) break; if ((perKind[a.kind] || 0) >= 2) continue; perKind[a.kind] = (perKind[a.kind] || 0) + 1; pick.push(a); }
    return pick;
  }
  function smartActionsRender() {
    const card = document.getElementById('smartActionsCard'); if (!card) return;
    if (!smartOk) { card.style.display = 'none'; return; }
    card.style.display = '';
    const acts = smartActions(), done = smartDone(), body = document.getElementById('smartActionsBody');
    Object.keys(smartActs).forEach(k => delete smartActs[k]);
    acts.forEach(a => { smartActs[a.id] = a.go; });
    if (!acts.length) { body.innerHTML = `<div class="boss-ok">✅ ${escapeHtml(tr('Rien d\'urgent aujourd\'hui. Belle journée de vente !'))}</div>`; return; }
    const nDone = acts.filter(a => done.includes(a.id)).length;
    body.innerHTML = acts.map((a, k) => {
      const ok = done.includes(a.id);
      return `<div class="sa-item ${ok ? 'done' : ''}"><button type="button" class="sa-check" data-sadone="${escapeHtml(a.id)}" title="${escapeHtml(tr(ok ? 'Pas encore fait' : 'Marquer comme fait'))}">${ok ? '✓' : k + 1}</button>`
        + `<div class="sa-tx"><b>${a.ic} ${escapeHtml(a.t)}</b><span>${escapeHtml(a.d)}</span></div>`
        + (ok ? '' : `<button type="button" class="ghost sa-go" data-sago="${escapeHtml(a.id)}">${escapeHtml(tr(a.btn))}</button>`) + `</div>`;
    }).join('') + (nDone === acts.length ? `<div class="boss-ok">🎉 ${escapeHtml(tr('Bravo, tout est fait pour aujourd\'hui !'))}</div>` : '');
  }

  (function smartInit() {
    const ob = document.getElementById('smartOrderBody');
    if (ob) {
      ob.addEventListener('input', (e) => { const i = e.target.closest('[data-soq]'); if (i) smartQty[i.dataset.soq] = Math.max(0, Math.round(Number(i.value) || 0)); });
      ob.addEventListener('click', (e) => {
        const b = e.target.closest('[data-sowa]'); if (!b || !ob._groups) return;
        const g = ob._groups[Number(b.dataset.sowa)]; if (!g) return;
        const items = g.items.map(o => ({ ...o, qty: smartQty[o.p.id] != null ? smartQty[o.p.id] : o.qty })).filter(o => o.qty > 0);
        if (!items.length) { toast(tr('Mets au moins une quantité.')); return; }
        aiOpenWa(g.tel, smartOrderText({ ...g, items }), g.nom || '');
        try { logAction('COMMANDE_WHATSAPP', { fournisseur: g.nom || '', lignes: items.map(o => o.qty + ' ' + (o.p.unite || '') + ' ' + o.p.nom) }); } catch (er) { console.error(er); }
      });
    }
    const ab = document.getElementById('smartActionsBody');
    if (ab) ab.addEventListener('click', (e) => {
      const d = e.target.closest('[data-sadone]');
      if (d) { const list = smartDone(), id = d.dataset.sadone, i = list.indexOf(id); if (i >= 0) list.splice(i, 1); else list.push(id); try { localStorage.setItem(smartDoneKey(), JSON.stringify(list)); } catch (er) {} smartActionsRender(); return; }
      const g = e.target.closest('[data-sago]'); if (g && smartActs[g.dataset.sago]) smartActs[g.dataset.sago]();
    });
  })();
