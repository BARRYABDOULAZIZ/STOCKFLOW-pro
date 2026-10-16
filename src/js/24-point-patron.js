  // ================= Le point du patron (test) : résumé du jour + alertes anti-vol, à écouter ou envoyer =================
  let bossDay = 0;
  function bossDate(offset) { const d = new Date(Date.now() - offset * 86400000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function bossCompute(offset) {
    const day = bossDate(offset), all = state.invoices || [];
    const inv = all.filter(i => !i.annulee && i.date === day);
    const ventes = inv.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const byProdId = {}; (state.products || []).forEach(p => { byProdId[p.ref] = p; });
    let benef = 0, sansCout = 0; const qte = {};
    inv.forEach(i => (i.lignes || []).forEach(l => {
      const p = l.ref && byProdId[l.ref], q = Number(l.qte) || 0, pv = Number(l.prix) || 0;
      if (p && Number(p.prixAchat) > 0) benef += (pv - Number(p.prixAchat)) * q; else sansCout++;
      qte[l.nom] = (qte[l.nom] || 0) + q;
    }));
    const remises = inv.reduce((s, i) => s + (Number(i.remise) || 0), 0);
    benef -= remises;
    // moyenne des 7 jours précédents (jours avec ventes ou non)
    let s7 = 0; for (let k = 1; k <= 7; k++) { const d = bossDate(offset + k); s7 += all.filter(i => !i.annulee && i.date === d).reduce((s, i) => s + (Number(i.total) || 0), 0); }
    const moy7 = s7 / 7, delta = moy7 > 0 ? Math.round((ventes - moy7) / moy7 * 100) : null;
    const pays = (state.paiements || []).filter(p => p.date === day);
    const encaisse = pays.reduce((s, p) => s + (Number(p.montant) || 0), 0);
    const parMode = {}; pays.forEach(p => { parMode[p.mode || 'Espèces'] = (parMode[p.mode || 'Espèces'] || 0) + (Number(p.montant) || 0); });
    const credit = inv.reduce((s, i) => s + Math.max(0, (Number(i.total) || 0) - (Number(i.montantPaye) || 0)), 0);
    const depenses = (state.depenses || []).filter(d => d.date === day).reduce((s, d) => s + (Number(d.montant) || 0), 0);
    const parVendeur = {}; inv.forEach(i => { const v = String(i.operateur || '—').replace(/\s*\(.*\)$/, ''); parVendeur[v] = (parVendeur[v] || 0) + (Number(i.total) || 0); });
    const top = Object.entries(qte).sort((a, b) => b[1] - a[1]).slice(0, 3);
    // Alertes : ce qu'un patron absent doit savoir
    const alertes = [];
    const annulees = all.filter(i => i.annulee && i.date === day);
    if (annulees.length) alertes.push(`${annulees.length} vente(s) annulée(s) : ${annulees.slice(0, 3).map(i => 'FAC-' + String(i.num).padStart(4, '0') + ' (' + euros(i.total) + (i.operateur ? ', ' + String(i.operateur).replace(/\s*\(.*\)$/, '') : '') + ')').join(', ')}`);
    inv.forEach(i => { const st = Number(i.sousTotal) || Number(i.total) || 0, r = Number(i.remise) || 0; if (r > 0 && st > 0 && r / st >= 0.15) alertes.push(`Grosse remise de ${Math.round(r / st * 100)} % sur FAC-${String(i.num).padStart(4, '0')} (${euros(r)})${i.operateur ? ' par ' + String(i.operateur).replace(/\s*\(.*\)$/, '') : ''}`); });
    inv.forEach(i => { if (!i.createdAt) return; const h = new Date(i.createdAt).getHours(); if (h >= 22 || h < 6) alertes.push(`Vente à ${String(h).padStart(2, '0')} h ${String(new Date(i.createdAt).getMinutes()).padStart(2, '0')} : FAC-${String(i.num).padStart(4, '0')} (${euros(i.total)})`); });
    // Ventes en dessous du prix d'achat (erreur ou « arrangement » avec un client)
    const aPerte = []; inv.forEach(i => (i.lignes || []).forEach(l => { const p = l.ref && byProdId[l.ref], pv = Number(l.prix) || 0; if (p && Number(p.prixAchat) > 0 && pv < Number(p.prixAchat)) aPerte.push(`${l.nom} à ${euros(pv)} (achat ${euros(p.prixAchat)}, FAC-${String(i.num).padStart(4, '0')}${i.operateur ? ', ' + String(i.operateur).replace(/\s*\(.*\)$/, '') : ''})`); }));
    if (aPerte.length) alertes.push(`${aPerte.length} vente(s) à perte : ${aPerte.slice(0, 3).join(' ; ')}`);
    const pertes = (state.movements || []).filter(m => m.date === day && m.source === 'perte');
    if (pertes.length) alertes.push(`${pertes.length} perte(s) déclarée(s) : ${pertes.slice(0, 3).map(m => Math.abs(Number(m.quantite) || 0) + ' ' + (m.unite || '') + ' ' + m.nom + (m.raison ? ' (' + m.raison + ')' : '')).join(', ')}`);
    const negatifs = (state.products || []).filter(p => Number(p.stock) < 0);
    if (negatifs.length) alertes.push(`${negatifs.length} produit(s) en stock négatif (vendus sans être en stock) : ${negatifs.slice(0, 3).map(p => p.nom).join(', ')}`);
    const ruptures = (state.products || []).filter(p => Number(p.stock) <= Number(p.seuil || 0) && Number(p.seuil || 0) > 0).slice(0, 5);
    return { day, nb: inv.length, ventes, benef, sansCout, delta, encaisse, parMode, credit, depenses, parVendeur, top, alertes, ruptures };
  }
  function bossText(B, forVoice) {
    const n0 = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
    const cur = forVoice ? DEVISES[curCode()].fr[1] : curSym(), m = (n) => n0(n) + ' ' + cur;
    const shop = (state.commerce && state.commerce.nom) || 'la boutique';
    const L = [];
    L.push((forVoice ? '' : '👁 *') + 'Le point du ' + B.day.split('-').reverse().join('/') + ' — ' + shop + (forVoice ? '.' : '*'));
    L.push((forVoice ? '' : '💰 ') + 'Ventes : ' + m(B.ventes) + ' en ' + B.nb + ' vente(s)' + (B.delta != null ? (B.delta >= 0 ? ', ' + B.delta + ' % de plus' : ', ' + Math.abs(B.delta) + ' % de moins') + ' que la moyenne de la semaine' : '') + '.');
    L.push((forVoice ? '' : '💵 ') + 'Bénéfice estimé : ' + m(B.benef) + (B.sansCout ? ' (' + B.sansCout + ' article(s) sans prix d\'achat)' : '') + '.');
    L.push((forVoice ? '' : '🧾 ') + 'Encaissé : ' + m(B.encaisse) + (Object.keys(B.parMode).length > 1 ? ' (' + Object.entries(B.parMode).map(([k, v]) => k + ' ' + m(v)).join(', ') + ')' : '') + '.');
    if (B.credit > 0) L.push((forVoice ? '' : '💸 ') + 'Donné à crédit : ' + m(B.credit) + '.');
    if (B.depenses > 0) L.push((forVoice ? '' : '💳 ') + 'Dépenses : ' + m(B.depenses) + '.');
    if (B.top.length) L.push((forVoice ? '' : '🏆 ') + 'Plus vendus : ' + B.top.map(([k, v]) => k + ' (' + v + ')').join(', ') + '.');
    if (B.alertes.length) { L.push((forVoice ? 'Attention : ' : '🚨 *Alertes*')); B.alertes.forEach(a => L.push((forVoice ? '' : '• ') + a + (forVoice ? '.' : ''))); }
    else L.push((forVoice ? '' : '✅ ') + 'Aucune alerte : rien d\'anormal aujourd\'hui.');
    if (B.ruptures.length) L.push((forVoice ? '' : '🔥 ') + 'À racheter : ' + B.ruptures.map(p => p.nom + ' (' + (Number(p.stock) || 0) + ')').join(', ') + '.');
    return L.join('\n');
  }
  function bossRender() {
    const card = document.getElementById('bossCard'); if (!card || card.style.display === 'none') return;
    const B = bossCompute(bossDay);
    const kpi = (v, l, d) => `<div class="boss-kpi"><div class="v">${v}</div><div class="l">${escapeHtml(tr(l))}</div>${d || ''}</div>`;
    const dl = B.delta == null ? '' : `<div class="d ${B.delta >= 0 ? 'up' : 'down'}">${B.delta >= 0 ? '▲' : '▼'} ${Math.abs(B.delta)} % ${escapeHtml(tr('vs la semaine'))}</div>`;
    let h = `<div class="boss-kpis">${kpi(euros(B.ventes), 'Ventes', dl)}${kpi(euros(B.benef), 'Bénéfice estimé', B.sansCout ? `<div class="d">${B.sansCout} ${escapeHtml(tr('sans prix d\'achat'))}</div>` : '')}${kpi(euros(B.encaisse), 'Encaissé')}${kpi(euros(B.credit), 'Donné à crédit')}</div>`;
    h += B.alertes.length ? `<div class="boss-sec"><h3>🚨 ${escapeHtml(tr('À surveiller'))}</h3>${B.alertes.map(a => `<div class="boss-alert">${escapeHtml(a)}</div>`).join('')}</div>` : `<div class="boss-ok">✅ ${escapeHtml(tr('Rien d\'anormal : pas d\'annulation, de grosse remise, de vente de nuit ni de perte.'))}</div>`;
    const vend = Object.entries(B.parVendeur).sort((a, b) => b[1] - a[1]);
    if (vend.length) h += `<div class="boss-sec"><h3>👥 ${escapeHtml(tr('Par vendeur'))}</h3>${vend.map(([k, v]) => `<div class="boss-line">${escapeHtml(k)} : <b>${euros(v)}</b></div>`).join('')}</div>`;
    if (B.top.length) h += `<div class="boss-sec"><h3>🏆 ${escapeHtml(tr('Plus vendus'))}</h3>${B.top.map(([k, v]) => `<div class="boss-line">${escapeHtml(k)} : <b>${v}</b></div>`).join('')}</div>`;
    if (B.ruptures.length) h += `<div class="boss-sec"><h3>🔥 ${escapeHtml(tr('À racheter'))}</h3>${B.ruptures.map(p => `<div class="boss-line">${escapeHtml(p.nom)} : <b>${Number(p.stock) || 0}</b> ${escapeHtml(p.unite || '')}</div>`).join('')}</div>`;
    document.getElementById('bossBody').innerHTML = h;
  }
  (function bossInit() {
    const card = document.getElementById('bossCard'); if (!card) return;
    card.querySelectorAll('[data-bossday]').forEach(b => b.addEventListener('click', () => { bossDay = Number(b.dataset.bossday); card.querySelectorAll('[data-bossday]').forEach(x => x.classList.toggle('active', x === b)); bossRender(); }));
    document.getElementById('bossWa').addEventListener('click', () => { const w = window.open('https://wa.me/?text=' + encodeURIComponent(bossText(bossCompute(bossDay), false)), 'sf_whatsapp'); if (!w) toast('⚠ Le navigateur a bloqué WhatsApp. Autorise les fenêtres pour ce site.'); });
    let audio = null;
    document.getElementById('bossListen').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (audio) { try { audio.pause(); } catch (x) {} audio = null; btn.textContent = '🔊 ' + tr('Écouter le résumé'); return; }
      if (!needOnline('la voix de Bel')) return;
      btn.disabled = true; btn.textContent = '⏳ ' + tr('Bel prépare sa voix…');
      try {
        const { data, error } = await supabaseClient.functions.invoke('ask-ai', { body: { tts: bossText(bossCompute(bossDay), true), lang: 'fr' } });
        if (error || !data || !data.audio) throw new Error('Voix indisponible pour le moment');
        audio = new Audio(URL.createObjectURL(belPcmToWav(data.audio, data.mime)));
        audio.onended = () => { audio = null; btn.textContent = '🔊 ' + tr('Écouter le résumé'); };
        btn.textContent = '⏹ ' + tr('Arrêter'); await audio.play();
      } catch (x) { btn.textContent = '😕 ' + (x.message || 'Erreur'); setTimeout(() => { btn.textContent = '🔊 ' + tr('Écouter le résumé'); }, 4000); }
      finally { btn.disabled = false; }
    });
  })();

