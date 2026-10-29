  // ================= Conseils intelligents v2 (tableau de bord) =================
  let aiFilter = 'all', aiShowAll = false;
  const aiDismKey = () => 'sf_ai_dismissed_' + todayStr();
  const aiDism = () => { try { return JSON.parse(localStorage.getItem(aiDismKey()) || '[]'); } catch (e) { return []; } };
  const aiActions = {};   // id -> fonction (boutons d'action des conseils)
  function aiOpenWa(phoneRaw, text, name) {
    let phone = toWhatsAppNumber(phoneRaw);
    const key = String(name || '').trim().toLowerCase();
    let cache = {}; try { cache = JSON.parse(localStorage.getItem('sf_wa_phones' + clNs()) || '{}') || {}; } catch (e) {}
    if (!phone && key) phone = toWhatsAppNumber(cache[key]);
    if (!phone) {
      const r = prompt('Numéro WhatsApp de ' + (name || 'cette personne') + ' (ex : 77 123 45 67).\nIl sera mémorisé. Laissez vide pour choisir le contact dans WhatsApp :');
      if (r === null) return;
      phone = toWhatsAppNumber(r);
      if (phone && key) { cache[key] = phone; try { localStorage.setItem('sf_wa_phones' + clNs(), JSON.stringify(cache)); } catch (e) {} }
    }
    const w = window.open((phone ? 'https://wa.me/' + phone : 'https://wa.me/') + '?text=' + encodeURIComponent(text), 'sf_whatsapp');
    if (!w) toast('⚠ Le navigateur a bloqué WhatsApp. Autorise les fenêtres pour ce site.');
  }
  function renderInsights() {
    const box = document.getElementById('aiInsights');
    if (!box) return;
    const role = state.currentUser && state.currentUser.role;
    const boss = role === 'proprietaire' || role === 'admin';
    const shop = (state.commerce && state.commerce.nom) || 'notre boutique';
    const all = state.invoices || [];
    const inv = all.filter(i => !i.annulee);
    const prods = state.products || [];
    const today = todayStr();
    const dayMs = 86400000;
    const ago = (d) => Math.round((Date.now() - new Date((d || today) + 'T12:00:00').getTime()) / dayMs);
    const dOf = (k) => new Date(Date.now() - k * dayMs).toISOString().slice(0, 10);
    const n0 = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
    const refToId = {}, byId = {}; prods.forEach(p => { byId[p.id] = p; if (p.ref) refToId[p.ref] = p.id; });
    const pkey = (l) => l.productId || refToId[l.ref] || null;
    let maxAgo = 0; const qty30 = {}, lastSold = {}, rev7 = {}, qty7 = {}, nameOf = {};
    const byDay = {}, hours = Array(24).fill(0), dow = Array(7).fill(0), dowN = Array(7).fill(0);
    let margeMois = 0, caMois = 0, hors7 = 0, nbVentes30 = 0;
    const monthStr = today.slice(0, 7);
    const pairs = {};
    inv.forEach(i => {
      const a = ago(i.date); if (a > maxAgo) maxAgo = a;
      byDay[i.date] = (byDay[i.date] || 0) + (Number(i.total) || 0);
      if (a <= 30) {
        nbVentes30++;
        if (i.createdAt) hours[new Date(i.createdAt).getHours()]++;
        const wd = new Date(i.date + 'T12:00:00').getDay(); dow[wd] += Number(i.total) || 0;
      }
      if ((i.date || '').slice(0, 7) === monthStr) caMois += Number(i.total) || 0;
      const keys = new Set();
      (i.lignes || []).forEach(l => {
        const k = pkey(l); const q = Number(l.qte) || 0, pr = Number(l.prix) || 0;
        if (!k) { if (a <= 7 && l.nom) hors7++; return; }
        nameOf[k] = l.nom || (byId[k] && byId[k].nom) || '';
        keys.add(k);
        if (a <= 30) qty30[k] = (qty30[k] || 0) + q;
        if (a <= 7) { rev7[k] = (rev7[k] || 0) + q * pr; qty7[k] = (qty7[k] || 0) + q; }
        if (lastSold[k] === undefined || a < lastSold[k]) lastSold[k] = a;
        if ((i.date || '').slice(0, 7) === monthStr && byId[k] && Number(byId[k].prixAchat) > 0) margeMois += (pr - Number(byId[k].prixAchat)) * q;
      });
      if (a <= 60 && keys.size > 1) { const arr = [...keys].sort(); for (let x = 0; x < arr.length; x++) for (let y = x + 1; y < arr.length; y++) { const pk = arr[x] + '|' + arr[y]; pairs[pk] = (pairs[pk] || 0) + 1; } }
    });
    for (let w = 0; w < 7; w++) { const cnt = new Set(inv.filter(i => new Date(i.date + 'T12:00:00').getDay() === w && ago(i.date) <= 30).map(i => i.date)).size; dowN[w] = cnt; }
    const win = Math.min(30, Math.max(7, maxAgo));
    const nm = (p) => escapeHtml(p.nom || p.ref || '—');
    const items = [];
    const add = (o) => { o.id = o.id || o.t.replace(/<[^>]*>/g, ''); items.push(o); };
    let urgentStock = 0, soonOut = 0;

    // ---- Stock : jours restants + quantité à commander ----
    if (maxAgo >= 6) {
      prods.filter(p => Number(p.stock) > 0 && (qty30[p.id] || 0) > 0).map(p => ({ p, rate: qty30[p.id] / win })).map(o => ({ ...o, days: Number(o.p.stock) / o.rate }))
        .filter(o => o.days <= 7).sort((a, b) => a.days - b.days).slice(0, 4).forEach(o => {
          const d = Math.max(1, Math.round(o.days)); soonOut++;
          const toOrder = Math.max(1, Math.ceil(o.rate * 14 - Number(o.p.stock)));
          const f = (state.fournisseurs || []).find(x => (x.nom || '').trim().toLowerCase() === (o.p.fournisseur || '').trim().toLowerCase());
          const aid = 'cmd_' + o.p.id;
          if (boss) aiActions[aid] = () => aiOpenWa(f && f.telephone, `Bonjour${f ? ' ' + f.nom : ''}, je souhaite commander ${toOrder} ${o.p.unite || 'unité(s)'} de "${o.p.nom}"${o.p.ref ? ' (Réf : ' + o.p.ref + ')' : ''}. Merci de m'indiquer la disponibilité et le délai de livraison. — ${shop}`, (f && f.nom) || 'le fournisseur');
          add({ cat: 'stock', sev: d <= 2 ? 'danger' : 'warn', ic: '⏳', tab: 'produits', t: `${nm(o.p)} : il reste environ ${d} jour${d > 1 ? 's' : ''} de stock`, d: `Tu en vends ~${(Math.round(o.rate * 10) / 10).toLocaleString('fr-FR')} ${escapeHtml(o.p.unite || 'unité')}/jour. Pour tenir 2 semaines, commande environ <b>${n0(toOrder)}</b>.`, act: boss ? aid : '', actLabel: '💬 Commander' });
        });
      prods.filter(p => Number(p.stock) <= 0 && (qty30[p.id] || 0) > 0).sort((a, b) => qty30[b.id] - qty30[a.id]).slice(0, 3).forEach(p => {
        urgentStock++;
        add({ cat: 'stock', sev: 'danger', ic: '🚫', tab: 'produits', t: `${nm(p)} est en rupture`, d: `${Math.round(qty30[p.id])} vendus sur 30 jours : chaque jour sans stock, tu perds des ventes.` });
      });
    }
    const sousSeuil = prods.filter(p => Number(p.seuil) > 0 && Number(p.stock) > 0 && Number(p.stock) <= Number(p.seuil));
    if (sousSeuil.length) add({ cat: 'stock', sev: 'warn', ic: '📦', tab: 'produits', t: `${sousSeuil.length} produit${sousSeuil.length > 1 ? 's' : ''} sous le seuil d'alerte`, d: `Par exemple : ${sousSeuil.slice(0, 3).map(p => nm(p)).join(', ')}.` });

    // ---- Argent : impayés par client + relance WhatsApp ----
    const reste = inv.map(i => ({ i, r: Math.max(0, (Number(i.total) || 0) - (Number(i.montantPaye) || 0)) })).filter(o => o.r > 0);
    let oldDebt = 0;
    if (reste.length) {
      const groups = {};
      reste.forEach(o => { const k = o.i.clientId || (o.i.client || 'Client comptoir'); const g = groups[k] || (groups[k] = { name: o.i.client || 'Client comptoir', cid: o.i.clientId, sum: 0, oldest: 0, nums: [] }); g.sum += o.r; g.oldest = Math.max(g.oldest, ago(o.i.date)); if (o.i.echeance && o.i.echeance < today) g.late = Math.max(g.late || 0, ago(o.i.echeance)); g.nums.push('FAC-' + String(o.i.num).padStart(4, '0')); });
      const sum = reste.reduce((t, o) => t + o.r, 0), old = reste.filter(o => ago(o.i.date) > 7).length; oldDebt = old;
      add({ cat: 'argent', sev: old ? 'warn' : 'info', ic: '💰', tab: 'clients', t: `${reste.length} facture${reste.length > 1 ? 's' : ''} impayée${reste.length > 1 ? 's' : ''} : ${euros(sum)} à encaisser`, d: old ? `Dont ${old} depuis plus de 7 jours. Les plus gros débiteurs sont juste en dessous.` : 'Aucune n\'est en retard de plus de 7 jours.' });
      Object.values(groups).sort((a, b) => b.sum - a.sum).slice(0, 3).forEach((g, idx) => {
        if (g.name === 'Client comptoir' && !g.cid) return;
        const cl = g.cid ? (state.clients || []).find(c => c.id === g.cid) : (state.clients || []).find(c => (c.nom || '').trim().toLowerCase() === g.name.trim().toLowerCase());
        const aid = 'rel_' + idx + '_' + g.name;
        aiActions[aid] = () => aiOpenWa(cl && cl.telephone, `Bonjour ${g.name}, petit rappel amical de ${shop} : il reste ${n0(g.sum)} ${curSym()} à régler (${g.nums.slice(0, 3).join(', ')}). Merci d'avance et bonne journée !`, g.name);
        add({ cat: 'argent', sev: (g.late > 3 || g.oldest > 14) ? 'danger' : (g.late || g.oldest > 7) ? 'warn' : 'info', ic: '🙋', tab: 'clients', t: `${escapeHtml(g.name)} te doit ${euros(g.sum)}`, d: g.late ? `⏰ En retard de ${g.late} jour${g.late > 1 ? 's' : ''} sur la date promise. Un message WhatsApp poli suffit souvent.` : `Plus ancienne dette : ${g.oldest} jour${g.oldest > 1 ? 's' : ''}. Un message WhatsApp poli suffit souvent.`, act: aid, actLabel: '💬 Relancer' });
      });
    }
    // ---- Clients : meilleur client du mois + clients qui ne reviennent plus ----
    const cm = {}; inv.filter(i => ago(i.date) <= 30 && (i.client || i.clientId)).forEach(i => { const k = i.clientId || i.client; const c = cm[k] || (cm[k] = { name: i.client || '—', cid: i.clientId, sum: 0, n: 0 }); c.sum += Number(i.total) || 0; c.n++; });
    const topC = Object.values(cm).sort((a, b) => b.sum - a.sum)[0];
    if (boss && topC && Object.keys(cm).length >= 3) add({ cat: 'ventes', sev: 'good', ic: '🏅', tab: 'clients', t: `Meilleur client du mois : ${escapeHtml(topC.name)}`, d: `${euros(topC.sum)} en ${topC.n} achat${topC.n > 1 ? 's' : ''}. Pense à le remercier ou lui faire un petit geste.` });
    if (boss && maxAgo >= 45) {
      const last = {}, cnt = {}, tot = {}; inv.forEach(i => { const k = i.clientId || i.client; if (!k) return; const a = ago(i.date); if (last[k] === undefined || a < last[k]) last[k] = a; cnt[k] = (cnt[k] || 0) + 1; tot[k] = (tot[k] || 0) + (Number(i.total) || 0); });
      const lost = Object.keys(last).filter(k => last[k] > 30 && cnt[k] >= 3).sort((a, b) => tot[b] - tot[a])[0];
      if (lost) {
        const row = inv.find(i => (i.clientId || i.client) === lost); const name = row.client || 'ce client';
        const cl = row.clientId ? (state.clients || []).find(c => c.id === row.clientId) : null;
        const aid = 'back_' + lost; aiActions[aid] = () => aiOpenWa(cl && cl.telephone, `Bonjour ${name}, ça fait un moment qu'on ne vous a pas vu chez ${shop} ! Passez nous voir, on a de nouveaux arrivages. À bientôt !`, name);
        add({ cat: 'ventes', sev: 'info', ic: '💤', tab: 'clients', t: `${escapeHtml(name)} ne revient plus (${last[lost]} jours)`, d: `Il avait acheté ${cnt[lost]} fois pour ${euros(tot[lost])}. Un petit message peut le ramener.`, act: aid, actLabel: '💬 Le relancer' });
      }
    }
    // ---- Ventes : meilleur produit, heure de pointe, meilleur jour, binômes ----
    const bestK = Object.keys(rev7).sort((a, b) => rev7[b] - rev7[a])[0];
    if (bestK && maxAgo >= 3) add({ cat: 'ventes', sev: 'good', ic: '🏆', tab: 'produits', t: `Produit star de la semaine : ${escapeHtml(nameOf[bestK] || '')}`, d: `${euros(rev7[bestK])} de ventes (${Math.round(qty7[bestK])} vendus). Assure-toi d'en avoir toujours en stock.` });
    if (nbVentes30 >= 15) {
      let h = 0; hours.forEach((v, i) => { if (v > hours[h]) h = i; });
      if (hours[h] >= 4) add({ cat: 'ventes', sev: 'info', ic: '⏰', tab: '', t: `Ton heure de pointe : ${h}h – ${h + 1}h`, d: `C'est là que tu fais le plus de ventes (${hours[h]} sur 30 jours). Sois bien équipé à cette heure-là.` });
    }
    if (maxAgo >= 21) {
      const avg = dow.map((v, i) => dowN[i] ? v / dowN[i] : 0); let bd = 0; avg.forEach((v, i) => { if (v > avg[bd]) bd = i; });
      const names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      if (avg[bd] > 0) add({ cat: 'ventes', sev: 'info', ic: '📅', tab: 'rapports', t: `Ton meilleur jour : le ${names[bd]}`, d: `En moyenne ${euros(avg[bd])} ce jour-là. Prépare ton stock la veille.` });
    }
    const bp = Object.entries(pairs).filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1])[0];
    if (bp) { const [x, y] = bp[0].split('|'); add({ cat: 'ventes', sev: 'info', ic: '🤝', tab: 'produits', t: `${escapeHtml(nameOf[x] || '')} + ${escapeHtml(nameOf[y] || '')} s'achètent ensemble`, d: `Achetés ensemble ${bp[1]} fois. Mets-les côte à côte ou propose-les en duo.` }); }
    if (hors7 >= 3) add({ cat: 'ventes', sev: 'warn', ic: '📝', tab: 'produits', t: `${hors7} ventes hors catalogue cette semaine`, d: `Ces produits n'ont pas de fiche : leur stock n'est pas suivi. Ajoute-les dans Produits.` });

    // ---- Patron : marges, argent dormant, journée, annulations, bénéfice du mois ----
    if (boss) {
      const perte = prods.filter(p => Number(p.prixAchat) > 0 && Number(p.prixVente) > 0 && Number(p.prixVente) < Number(p.prixAchat));
      if (perte.length) add({ cat: 'urgent', sev: 'danger', ic: '💸', tab: 'produits', t: `${perte.length} produit${perte.length > 1 ? 's' : ''} vendu${perte.length > 1 ? 's' : ''} à perte`, d: `Prix de vente inférieur au prix d'achat, par exemple : ${nm(perte[0])}.` });
      const mince = prods.filter(p => Number(p.prixAchat) > 0 && Number(p.prixVente) >= Number(p.prixAchat) && (Number(p.prixVente) - Number(p.prixAchat)) / Number(p.prixVente) < 0.08 && (qty30[p.id] || 0) > 0);
      if (mince.length) add({ cat: 'argent', sev: 'warn', ic: '🪙', tab: 'produits', t: `${mince.length} produit${mince.length > 1 ? 's' : ''} avec une marge très faible (moins de 8 %)`, d: `Tu travailles presque pour rien dessus, par exemple : ${nm(mince[0])}. Vérifie ton prix de vente.` });
      if (maxAgo >= 60) {
        const dorm = prods.filter(p => Number(p.stock) > 0 && Number(p.prixAchat) > 0 && (lastSold[p.id] === undefined || lastSold[p.id] > 60));
        if (dorm.length) add({ cat: 'argent', sev: 'info', ic: '🧊', tab: 'produits', t: `${dorm.length} produit${dorm.length > 1 ? 's' : ''} sans vente depuis 60 jours`, d: `${euros(dorm.reduce((t, p) => t + Number(p.prixAchat) * Number(p.stock), 0))} d'argent immobilisé. Pense à une promotion.` });
      }
      const prev = Object.entries(byDay).filter(([d]) => d < today && ago(d) <= 8).map(([, v]) => v);
      const jour = byDay[today] || 0, hr = new Date().getHours();
      if (prev.length >= 3 && jour > 0 && hr >= 15) {
        const avg = prev.reduce((a, b) => a + b, 0) / prev.length, pct = Math.round((jour / avg - 1) * 100);
        if (pct >= 20) add({ cat: 'ventes', sev: 'good', ic: '🚀', tab: 'rapports', t: `Belle journée : +${pct} % par rapport à ta moyenne`, d: `${euros(jour)} aujourd'hui contre ${euros(avg)} en moyenne ces derniers jours.` });
        else if (pct <= -30) add({ cat: 'ventes', sev: 'info', ic: '📉', tab: 'rapports', t: `Journée calme : ${pct} % par rapport à ta moyenne`, d: `${euros(jour)} aujourd'hui contre ${euros(avg)} en moyenne.` });
      }
      const annul = all.filter(i => i.annulee && ago(i.date) <= 7).length;
      if (annul >= 3) add({ cat: 'urgent', sev: 'warn', ic: '🔎', tab: 'factures', t: `${annul} factures annulées cette semaine`, d: 'C\'est plus que d\'habitude : regarde le journal des actions pour comprendre pourquoi.' });
      const depM = (state.depenses || []).filter(d => (d.date || '').slice(0, 7) === monthStr).reduce((t, d) => t + (Number(d.montant) || 0), 0);
      if (margeMois > 0) add({ cat: 'argent', sev: margeMois - depM >= 0 ? 'good' : 'warn', ic: '📊', tab: 'comptabilite', t: `Ce mois : bénéfice estimé ${euros(margeMois - depM)}`, d: `Marge sur les ventes ${euros(margeMois)} − dépenses ${euros(depM)}. (Estimation : seuls les produits avec un prix d'achat sont comptés.)` });
      const lastClose = clLastCloseGet();
      if (new Date().getHours() >= 18 && (byDay[today] || 0) > 0 && lastClose !== today) add({ cat: 'urgent', sev: 'warn', ic: '🔒', tab: 'caisse', t: 'Pense à clôturer la caisse', d: 'Compte le tiroir et compare avec ce que l\'appli attend.' });
    }

    // ---- Score de santé ----
    let score = 100;
    score -= Math.min(30, urgentStock * 10) + Math.min(15, soonOut * 5) + Math.min(25, oldDebt * 5);
    if (boss) score -= Math.min(20, (items.filter(i => i.ic === '💸').length) * 20 + (items.filter(i => i.ic === '🪙').length) * 8);
    score = Math.max(5, Math.min(100, Math.round(score)));
    const scLab = score >= 80 ? 'Excellent' : score >= 60 ? 'Correct' : 'À surveiller', scCls = score >= 80 ? 'good' : score >= 60 ? 'warn' : 'danger';
    const jourV = byDay[today] || 0, hier = byDay[dOf(1)] || 0;
    const spark = []; for (let k = 6; k >= 0; k--) spark.push(byDay[dOf(k)] || 0);
    const smax = Math.max(1, ...spark);
    const cmp = hier > 0 ? Math.round((jourV / hier - 1) * 100) : null;
    const prenom = ((state.currentUser && state.currentUser.nom) || '').split(' ')[0];
    const hr2 = new Date().getHours();
    const hello = (hr2 < 12 ? 'Bonjour' : hr2 < 18 ? 'Bon après-midi' : 'Bonsoir') + (prenom ? ' ' + escapeHtml(prenom) : '');

    // ---- Tri, filtres, masquage ----
    const order = { danger: 0, warn: 1, info: 2, good: 3 };
    items.sort((a, b) => order[a.sev] - order[b.sev]);
    const dism = aiDism();
    const vis = items.filter(i => !dism.includes(i.id));
    const isIn = (i, f) => f === 'all' || (f === 'urgent' ? (i.sev === 'danger' || i.cat === 'urgent') : i.cat === f);
    const counts = { all: vis.length, urgent: vis.filter(i => isIn(i, 'urgent')).length, argent: vis.filter(i => i.cat === 'argent').length, stock: vis.filter(i => i.cat === 'stock').length, ventes: vis.filter(i => i.cat === 'ventes').length };
    if (!counts[aiFilter]) aiFilter = 'all';
    let shown = vis.filter(i => isIn(i, aiFilter));
    const total = shown.length, LIM = 6;
    if (!aiShowAll && shown.length > LIM) shown = shown.slice(0, LIM);
    document.getElementById('aiSub').textContent = vis.length ? `${vis.length} point${vis.length > 1 ? 's' : ''} à regarder` : '';
    const head = document.getElementById('aiHead');
    const R = 30, C = 2 * Math.PI * R;
    const hsig = JSON.stringify([score, jourV, hier, spark, hello, boss, aiFilter, counts]);
    if (head && head._sig !== hsig) {
      head._sig = hsig;
      head.innerHTML = `<div class="ai-hello">${hello} 👋</div>
        <div class="ai-top">
          <div class="ai-score ${scCls}"><svg viewBox="0 0 76 76" width="76" height="76"><circle cx="38" cy="38" r="${R}" class="ai-ring-bg"/><circle cx="38" cy="38" r="${R}" class="ai-ring" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - score / 100)).toFixed(1)}" transform="rotate(-90 38 38)"/></svg><div class="ai-score-n"><b>${score}</b><small>/100</small></div></div>
          <div class="ai-score-t"><b>Santé du commerce</b><span class="${scCls}">${scLab}</span></div>
          <div class="ai-kpi"><small>Ventes aujourd'hui</small><b>${euros(jourV)}</b><span class="${cmp === null ? '' : cmp >= 0 ? 'up' : 'down'}">${cmp === null ? 'pas de vente hier' : (cmp === 0 ? '＝ comme hier' : (cmp > 0 ? '▲ +' : '▼ ') + cmp + ' % vs hier')}</span></div>
          <div class="ai-spark" title="7 derniers jours">${spark.map((v, k) => `<i style="height:${Math.max(6, Math.round(v / smax * 100))}%" class="${k === 6 ? 'now' : ''}" title="${euros(v)}"></i>`).join('')}<small>7 jours</small></div>
        </div>
        <div class="ai-chips">${[['all', 'Tout'], ['urgent', '🔥 Urgent'], ['argent', '💰 Argent'], ['stock', '📦 Stock'], ['ventes', '📈 Ventes']].map(([k, l]) => `<button class="ai-chip ${aiFilter === k ? 'on' : ''}" data-f="${k}">${l} <em>${counts[k]}</em></button>`).join('')}</div>`;
    }
    if (!items.length) items.push({ cat: 'ventes', sev: 'good', ic: '✅', tab: '', t: 'Tout est en ordre', d: prods.length ? 'Rien d\'urgent à signaler pour le moment.' : 'Ajoute tes produits et fais tes premières ventes : les conseils apparaîtront ici.', id: 'ok' }), shown = items.slice();
    if (!shown.length) shown = [{ cat: 'ventes', sev: 'good', ic: '🎉', tab: '', t: 'Rien dans cette catégorie', d: 'Tout est calme de ce côté-là.', id: 'none' }];
    const sig = JSON.stringify([shown.map(i => i.id + i.sev), total, aiShowAll]);
    if (box._sig === sig) return;
    box._sig = sig;
    box.innerHTML = shown.map((i, k) => `<div class="ai-item sev-${i.sev}" ${i.tab ? `data-tab-go="${i.tab}"` : ''} style="--d:${k * 70}ms"><span class="ai-ic">${i.ic}</span><div class="ai-tx"><b>${i.t}</b><span>${i.d}</span>${i.act ? `<button class="ai-act" data-act="${escapeHtml(i.act)}">${i.actLabel}</button>` : ''}</div>${i.id && i.id !== 'ok' && i.id !== 'none' ? `<button class="ai-x" data-dis="${escapeHtml(i.id)}" title="Masquer pour aujourd'hui">✕</button>` : ''}${i.tab ? '<span class="ai-arrow">›</span>' : ''}</div>`).join('')
      + (total > LIM ? `<button class="ai-more" data-more="1">${aiShowAll ? 'Voir moins ▲' : 'Voir tout (' + total + ') ▼'}</button>` : '');
  }
  document.getElementById('aiCard').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-f]');
    if (chip) { aiFilter = chip.dataset.f; aiShowAll = false; document.getElementById('aiInsights')._sig = ''; renderInsights(); return; }
    if (e.target.closest('[data-more]')) { aiShowAll = !aiShowAll; document.getElementById('aiInsights')._sig = ''; renderInsights(); return; }
    const act = e.target.closest('[data-act]');
    if (act) { e.stopPropagation(); const fn = aiActions[act.dataset.act]; if (fn) fn(); return; }
    const x = e.target.closest('[data-dis]');
    if (x) { e.stopPropagation(); const d = aiDism(); d.push(x.dataset.dis); try { localStorage.setItem(aiDismKey(), JSON.stringify(d)); } catch (er) {} document.getElementById('aiInsights')._sig = ''; renderInsights(); return; }
    const it = e.target.closest('[data-tab-go]'); if (!it) return;
    const b = document.querySelector(`nav.tabs button[data-tab="${it.dataset.tabGo}"]`); if (b) b.click();
  });

