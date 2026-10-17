  // ================= Abonnement (étape 1 : paiement manuel Wave / Orange Money) =================
  // Une boutique SANS abonnement enregistré marche exactement comme avant (rien n'est bloqué).
  // Avec un abonnement : rappel 5 jours avant la fin, 3 jours de grâce, puis lecture seule
  // (les données restent visibles et téléchargeables ; seules les nouvelles saisies sont bloquées).
  const ABO_RAPPEL = 5, ABO_GRACE = 3;
  const ABO_RO_MSG = 'Abonnement terminé : l\'appli est en lecture seule. Renouvelle ton abonnement pour enregistrer à nouveau.';
  const ABO_FORMULES = [[1, '1 mois'], [3, '3 mois'], [12, '12 mois']];
  const abo = { row: null, cfg: {}, pays: [], admin: false };
  let aboAdminRows = [], aboAdminFilter = 'tous', aboAdminOpen = null;

  const aboKey = () => 'sf_abo:' + (CURRENT_COMMERCE_ID || '');
  const aboDays = (from, to) => Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000);
  const aboFmt = (d) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—';
  const aboIsBoss = () => !!state.currentUser && (state.currentUser.role === 'proprietaire' || state.currentUser.role === 'admin');

  // État d'un abonnement à une date donnée : none | actif | bientot | grace | lecture
  function aboStatusOf(row, today) {
    today = today || todayStr();
    if (!row || !row.actif_jusqua) return { mode: 'none' };
    const fin = String(row.actif_jusqua).slice(0, 10), left = aboDays(today, fin);
    if (left >= 0) return { mode: left < ABO_RAPPEL ? 'bientot' : 'actif', left, fin, essai: !!row.essai };
    const late = -left;
    if (late <= ABO_GRACE) return { mode: 'grace', late, rest: ABO_GRACE - late + 1, fin, essai: !!row.essai };
    return { mode: 'lecture', late, fin, essai: !!row.essai };
  }
  const aboStatus = () => aboStatusOf(abo.row);
  function aboReadOnly() { try { return aboStatus().mode === 'lecture'; } catch (e) { return false; } }

  async function aboLoad() {
    const cid = CURRENT_COMMERCE_ID;
    if (!cid) return;
    try { const c = JSON.parse(localStorage.getItem(aboKey()) || 'null'); if (c) { abo.row = c.row || null; abo.cfg = c.cfg || {}; abo.pays = c.pays || []; } else { abo.row = null; abo.cfg = {}; abo.pays = []; } } catch (e) {}
    aboRender();
    if (!supabaseClient || navigator.onLine === false) return;
    try {
      const [a, c, p, ad] = await Promise.all([
        supabaseClient.from('abonnements').select('*').eq('commerce_id', String(cid)).maybeSingle(),
        supabaseClient.from('plateforme_config').select('cle, valeur'),
        supabaseClient.from('paiements_abonnement').select('*').eq('commerce_id', String(cid)).order('created_at', { ascending: false }).limit(5),
        supabaseClient.rpc('est_admin_plateforme'),
      ]);
      if (cid !== CURRENT_COMMERCE_ID) return;
      // Table absente ou erreur : on garde ce qu'on sait (par défaut : sans abonnement = rien de bloqué)
      if (!a.error) abo.row = a.data || null;
      if (!c.error) { abo.cfg = {}; (c.data || []).forEach(x => { abo.cfg[x.cle] = x.valeur || {}; }); }
      if (!p.error) abo.pays = p.data || [];
      abo.admin = !ad.error && ad.data === true;
      try { localStorage.setItem(aboKey(), JSON.stringify({ row: abo.row, cfg: abo.cfg, pays: abo.pays })); } catch (e) {}
    } catch (e) { console.error(e); }
    aboRender();
  }

  function aboPrix(devise, mois) { const t = (abo.cfg.tarifs || {})[devise || curCode()] || {}; return Number(t['m' + mois]) || 0; }
  function aboMoney(n, devise) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') + ' ' + ((DEVISES[devise] || DEVISES.XOF).sym); }
  function aboGoto() {
    const b = document.querySelector('nav.tabs button[data-tab="parametres"]');
    if (b && b.style.display !== 'none') { b.click(); setTimeout(() => { const c = document.getElementById('aboCard'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); }
  }

  function aboRender() {
    const S = aboStatus(), boss = aboIsBoss();
    // Bandeau d'alerte (en haut de toutes les pages)
    const ban = document.getElementById('aboBanner');
    if (ban) {
      let h = '', cls = '';
      if (S.mode === 'bientot') { cls = 'warn'; h = `⏳ ${S.essai ? 'Ta période d\'essai' : 'Ton abonnement'} se termine ${S.left === 0 ? 'aujourd\'hui' : 'dans ' + S.left + ' jour' + (S.left > 1 ? 's' : '')} (le ${aboFmt(S.fin)}).`; }
      else if (S.mode === 'grace') { cls = 'bad'; h = `⚠️ ${S.essai ? 'Ta période d\'essai' : 'Ton abonnement'} est terminé depuis le ${aboFmt(S.fin)}. Encore ${S.rest} jour${S.rest > 1 ? 's' : ''} avant le passage en lecture seule.`; }
      else if (S.mode === 'lecture') { cls = 'bad'; h = `🔒 ${S.essai ? 'Période d\'essai terminée' : 'Abonnement terminé'} : l'appli est en lecture seule. Tes données restent visibles, mais tu ne peux plus rien enregistrer.`; }
      if (h) h += boss ? ` <button type="button" class="primary" data-abogo="1">💳 ${escapeHtml(tr('Renouveler'))}</button>` : ` <b>${escapeHtml(tr('Préviens ton patron.'))}</b>`;
      ban.className = 'abo-banner ' + cls;
      ban.innerHTML = h;
      ban.style.display = h ? '' : 'none';
    }
    document.body.classList.toggle('abo-lecture', S.mode === 'lecture');
    // Carte « Mon abonnement » (Paramètres) : visible pour tous les patrons (propriétaire / admin du commerce).
    // Sans abonnement enregistré, elle montre juste les tarifs et comment payer : rien n'est bloqué.
    const card = document.getElementById('aboCard');
    if (card) {
      const show = boss;
      card.style.display = show ? '' : 'none';
      if (show) aboCardRender(S);
    }
    // Onglet Admin : seulement pour l'admin de la plateforme
    const tab = document.querySelector('nav.tabs button[data-tab="admin"]');
    if (tab) tab.style.display = abo.admin ? '' : 'none';
    if (!abo.admin) { const p = document.getElementById('panel-admin'); if (p && p.classList.contains('active')) { const d = document.querySelector('nav.tabs button[data-tab="dashboard"]'); if (d) d.click(); } }
  }

  function aboCardRender(S) {
    const dv = curCode(), pay = abo.cfg.paiement || {};
    const lab = { none: '— Pas encore d\'abonnement', actif: '✅ Actif', bientot: '⏳ Bientôt terminé', grace: '⚠️ Terminé (délai de grâce)', lecture: '🔒 Terminé : lecture seule' }[S.mode];
    let h = `<div class="abo-status ${S.mode}"><b>${escapeHtml(lab)}</b>${S.fin ? `<span>${S.essai ? 'Essai gratuit' : 'Abonnement'} ${S.mode === 'actif' || S.mode === 'bientot' ? 'actif jusqu\'au' : 'terminé le'} <b>${aboFmt(S.fin)}</b>${S.mode === 'actif' || S.mode === 'bientot' ? ` (${S.left} jour${S.left > 1 ? 's' : ''} restant${S.left > 1 ? 's' : ''})` : ''}</span>` : ''}</div>`;
    const prix = ABO_FORMULES.map(([m, l]) => [m, l, aboPrix(dv, m)]).filter(x => x[2] > 0);
    if (prix.length) {
      const base = aboPrix(dv, 1);
      h += `<div class="abo-prix">${prix.map(([m, l, p]) => { const eco = base && m > 1 ? base * m - p : 0; return `<div class="abo-p"><small>${escapeHtml(tr(l))}</small><b>${aboMoney(p, dv)}</b>${eco > 0 ? `<em>${escapeHtml(tr('tu économises'))} ${aboMoney(eco, dv)}</em>` : ''}</div>`; }).join('')}</div>`;
    } else h += `<p class="muted">${escapeHtml(tr('Contacte BoromBoutik pour connaître le tarif.'))}</p>`;
    const ways = [pay.wave ? `<li>📱 <b>Wave</b> : ${escapeHtml(pay.wave)}</li>` : '', pay.orange ? `<li>🟠 <b>Orange Money</b> : ${escapeHtml(pay.orange)}</li>` : '', pay.autre ? `<li>💬 ${escapeHtml(pay.autre)}</li>` : ''].join('');
    if (ways) h += `<div class="abo-how"><b>${escapeHtml(tr('Comment payer'))}</b><ol><li>${escapeHtml(tr('Envoie le montant de la formule choisie à :'))}<ul>${ways}</ul></li><li>${escapeHtml(tr('Appuie sur « J\'ai payé » pour prévenir BoromBoutik.'))}</li><li>${escapeHtml(tr('Ton abonnement est prolongé dès que le paiement est vérifié.'))}</li></ol></div>`;
    if (pay.whatsapp) h += `<button type="button" class="primary" id="aboPaid">📤 ${escapeHtml(tr('J\'ai payé : prévenir BoromBoutik'))}</button>`;
    if ((abo.pays || []).length) h += `<details class="abo-hist"><summary>${escapeHtml(tr('Mes derniers paiements'))}</summary>${abo.pays.map(p => `<div>${aboFmt(p.created_at)} — ${p.essai ? 'Essai ' + p.jours + ' j' : p.mois ? p.mois + ' mois' : (p.note || 'Ajustement')}${Number(p.montant) > 0 ? ' — ' + aboMoney(p.montant, p.devise || dv) : ''}${p.actif_jusqua ? ' → ' + aboFmt(p.actif_jusqua) : ''}</div>`).join('')}</details>`;
    document.getElementById('aboBody').innerHTML = h;
    const paid = document.getElementById('aboPaid');
    if (paid) paid.addEventListener('click', () => {
      const u = state.currentUser || {}, shop = (state.commerce && state.commerce.nom) || '';
      aiOpenWa(pay.whatsapp, `Bonjour BoromBoutik, je suis ${u.nom || ''}${shop ? ' (' + shop + ')' : ''}. Je viens de payer mon abonnement.\nFormule : … mois\nMontant : …\nPayé par : Wave / Orange Money\nNuméro utilisé : …\nMerci !`, 'BoromBoutik');
    });
  }

  // ---------------- Page Admin (toi seul) ----------------
  async function adminLoad() {
    if (!abo.admin || !supabaseClient) return;
    const st = document.getElementById('adminStatus');
    st.textContent = '⏳ ' + tr('Chargement…');
    const { data, error } = await supabaseClient.rpc('admin_boutiques');
    if (error) { st.textContent = '😕 ' + (error.message || 'Erreur'); return; }
    aboAdminRows = data || [];
    st.textContent = '';
    adminRender();
    adminCfgRender();
  }
  function adminRender() {
    const today = todayStr();
    const rows = aboAdminRows.map(r => ({ ...r, S: aboStatusOf(r, today) }));
    const cnt = { tous: rows.length, relancer: 0, expires: 0, actifs: 0, sans: 0 };
    rows.forEach(r => { if (r.S.mode === 'bientot' || r.S.mode === 'grace') cnt.relancer++; if (r.S.mode === 'lecture') cnt.expires++; if (r.S.mode === 'actif' || r.S.mode === 'bientot') cnt.actifs++; if (r.S.mode === 'none') cnt.sans++; });
    const chips = [['tous', 'Toutes'], ['relancer', '⏳ À relancer'], ['expires', '🔒 Expirées'], ['actifs', '✅ Actives'], ['sans', '— Sans abonnement']];
    document.getElementById('adminChips').innerHTML = chips.map(([k, l]) => `<button type="button" class="tablike ${aboAdminFilter === k ? 'active' : ''}" data-adf="${k}">${escapeHtml(tr(l))} (${cnt[k]})</button>`).join('');
    const q = (document.getElementById('adminSearch').value || '').trim().toLowerCase();
    const keep = (r) => (aboAdminFilter === 'tous') || (aboAdminFilter === 'relancer' && (r.S.mode === 'bientot' || r.S.mode === 'grace')) || (aboAdminFilter === 'expires' && r.S.mode === 'lecture') || (aboAdminFilter === 'actifs' && (r.S.mode === 'actif' || r.S.mode === 'bientot')) || (aboAdminFilter === 'sans' && r.S.mode === 'none');
    const list = rows.filter(keep).filter(r => !q || [r.nom, r.proprietaire, r.email, r.telephone].some(x => String(x || '').toLowerCase().includes(q)));
    const badge = (S) => ({ none: ['', 'Sans abonnement'], actif: ['good', 'Actif → ' + aboFmt(S.fin)], bientot: ['warn', 'Fin le ' + aboFmt(S.fin) + ' (' + S.left + ' j)'], grace: ['bad', 'Terminé le ' + aboFmt(S.fin) + ' (grâce)'], lecture: ['bad', 'Lecture seule depuis ' + aboFmt(S.fin)] }[S.mode]);
    document.getElementById('adminList').innerHTML = list.length ? list.map(r => {
      const [bc, bt] = badge(r.S), open = aboAdminOpen === r.commerce_id;
      return `<div class="adm-row" data-adr="${escapeHtml(r.commerce_id)}">
        <div class="adm-top"><div class="adm-id"><b>${escapeHtml(r.nom || '(sans nom)')}</b><small>${escapeHtml(r.proprietaire || '')}${r.email ? ' · ' + escapeHtml(r.email) : ''}${r.telephone ? ' · ' + escapeHtml(r.telephone) : ''}</small><small>${escapeHtml(r.devise || 'XOF')} · ${Number(r.nb_factures) || 0} ${escapeHtml(tr('factures'))}${r.derniere_vente ? ' · ' + escapeHtml(tr('dernière vente')) + ' ' + aboFmt(r.derniere_vente) : ''}${r.essai ? ' · ' + escapeHtml(tr('essai')) : ''}</small></div><span class="adm-badge ${bc}">${escapeHtml(bt)}</span></div>
        <div class="adm-btns">${ABO_FORMULES.map(([m]) => `<button type="button" class="ghost" data-adadd="${m}">+${m} ${escapeHtml(tr('mois'))}</button>`).join('')}<button type="button" class="ghost" data-adtrial="14">🎁 ${escapeHtml(tr('Essai 14 j'))}</button><button type="button" class="ghost" data-adwa="1">📤 ${escapeHtml(tr('Rappel'))}</button><button type="button" class="ghost" data-adinfo="1">${open ? '▲' : '⋯'}</button></div>
        <div class="adm-form" data-adform style="display:none;"></div>
        ${open ? `<div class="adm-more" data-admore>⏳</div>` : ''}
      </div>`;
    }).join('') : `<p class="muted">${escapeHtml(tr('Aucune boutique dans cette liste.'))}</p>`;
    if (aboAdminOpen) adminMore(aboAdminOpen);
  }
  async function adminMore(cid) {
    const box = document.querySelector(`.adm-row[data-adr="${CSS.escape(cid)}"] [data-admore]`); if (!box) return;
    const { data, error } = await supabaseClient.rpc('admin_paiements', { p_commerce: cid });
    if (error) { box.textContent = '😕 ' + error.message; return; }
    box.innerHTML = `<b>${escapeHtml(tr('Historique'))}</b>` + ((data || []).length ? data.map(p => `<div>${aboFmt(p.created_at)} — ${p.essai ? 'Essai ' + p.jours + ' j' : p.mois ? p.mois + ' mois' : escapeHtml(p.note || 'Ajustement')}${Number(p.montant) > 0 ? ' — ' + aboMoney(p.montant, p.devise) : ''}${p.moyen ? ' · ' + escapeHtml(p.moyen) : ''}${p.reference ? ' · réf. ' + escapeHtml(p.reference) : ''}${p.actif_jusqua ? ' → ' + aboFmt(p.actif_jusqua) : ''}</div>`).join('') : `<div class="muted">${escapeHtml(tr('Aucun paiement enregistré.'))}</div>`)
      + `<div class="adm-fix"><label>${escapeHtml(tr('Corriger la date de fin'))} <input type="date" data-adfixdate></label><button type="button" class="ghost" data-adfix="1">${escapeHtml(tr('Enregistrer la date'))}</button><button type="button" class="ghost" data-adremove="1">${escapeHtml(tr('Retirer l\'abonnement'))}</button></div>`;
  }
  function adminForm(rowEl, r, mois) {
    const f = rowEl.querySelector('[data-adform]');
    const prix = aboPrix(r.devise || 'XOF', mois);
    f.style.display = '';
    f.innerHTML = `<b>+${mois} ${escapeHtml(tr('mois'))} — ${escapeHtml(r.nom || '')}</b>
      <div class="adm-grid"><label>${escapeHtml(tr('Montant reçu'))}<input type="number" min="0" step="1" data-adm-montant value="${prix || ''}" inputmode="numeric"> ${escapeHtml((DEVISES[r.devise] || DEVISES.XOF).sym)}</label>
      <label>${escapeHtml(tr('Payé par'))}<select data-adm-moyen><option>Wave</option><option>Orange Money</option><option>Free Money</option><option>Espèces</option><option>Autre</option></select></label>
      <label>${escapeHtml(tr('Référence (facultatif)'))}<input type="text" data-adm-ref placeholder="ID de la transaction"></label></div>
      <div class="adm-btns"><button type="button" class="primary" data-adok="${mois}">✓ ${escapeHtml(tr('Valider le paiement'))}</button><button type="button" class="ghost" data-adcancel="1">${escapeHtml(tr('Annuler'))}</button></div>`;
  }
  async function adminCall(fn, args, okMsg) {
    const { data, error } = await supabaseClient.rpc(fn, args);
    if (error) { toast('😕 ' + (error.message || 'Erreur')); return false; }
    toast(okMsg(data));
    await adminLoad();
    if (args.p_commerce && String(args.p_commerce) === String(CURRENT_COMMERCE_ID)) aboLoad();
    return true;
  }
  function adminCfgRender() {
    const box = document.getElementById('adminCfg'); if (!box || box._done) return;
    box._done = true;
    const t = abo.cfg.tarifs || {}, p = abo.cfg.paiement || {};
    box.innerHTML = `<table class="adm-tarifs"><tr><th></th>${ABO_FORMULES.map(([, l]) => `<th>${escapeHtml(tr(l))}</th>`).join('')}</tr>${Object.keys(DEVISES).map(dv => `<tr><th>${escapeHtml(DEVISES[dv].sym)}</th>${ABO_FORMULES.map(([m]) => `<td><input type="number" min="0" step="1" inputmode="numeric" data-tarif="${dv}" data-m="${m}" value="${(t[dv] || {})['m' + m] || ''}"></td>`).join('')}</tr>`).join('')}</table>
      <div class="adm-grid"><label>📱 ${escapeHtml(tr('Numéro Wave'))}<input type="text" data-pay="wave" value="${escapeHtml(p.wave || '')}"></label><label>🟠 ${escapeHtml(tr('Numéro Orange Money'))}<input type="text" data-pay="orange" value="${escapeHtml(p.orange || '')}"></label>
      <label>💬 ${escapeHtml(tr('Autre moyen (texte libre)'))}<input type="text" data-pay="autre" value="${escapeHtml(p.autre || '')}" placeholder="ex. Guinée : Orange Money 6xx xx xx xx"></label><label>🟢 ${escapeHtml(tr('Ton WhatsApp (pour « J\'ai payé »)'))}<input type="text" data-pay="whatsapp" value="${escapeHtml(p.whatsapp || '')}"></label></div>
      <button type="button" class="primary" id="adminCfgSave">💾 ${escapeHtml(tr('Enregistrer les tarifs'))}</button>`;
    document.getElementById('adminCfgSave').addEventListener('click', async () => {
      const tarifs = {}; box.querySelectorAll('[data-tarif]').forEach(i => { const dv = i.dataset.tarif; tarifs[dv] = tarifs[dv] || {}; const v = Math.round(Number(i.value) || 0); if (v > 0) tarifs[dv]['m' + i.dataset.m] = v; });
      const paiement = {}; box.querySelectorAll('[data-pay]').forEach(i => { const v = i.value.trim(); if (v) paiement[i.dataset.pay] = v; });
      const a = await supabaseClient.rpc('admin_config', { p_cle: 'tarifs', p_valeur: tarifs });
      const b = a.error ? a : await supabaseClient.rpc('admin_config', { p_cle: 'paiement', p_valeur: paiement });
      if (b.error) { toast('😕 ' + b.error.message); return; }
      abo.cfg.tarifs = tarifs; abo.cfg.paiement = paiement;
      try { localStorage.setItem(aboKey(), JSON.stringify({ row: abo.row, cfg: abo.cfg, pays: abo.pays })); } catch (e) {}
      toast('✅ ' + tr('Tarifs enregistrés.'));
      aboRender();
    });
  }

  (function aboInit() {
    const ban = document.getElementById('aboBanner');
    if (ban) ban.addEventListener('click', (e) => { if (e.target.closest('[data-abogo]')) aboGoto(); });
    const s = document.getElementById('adminSearch'); if (s) s.addEventListener('input', adminRender);
    const rf = document.getElementById('adminRefresh'); if (rf) rf.addEventListener('click', adminLoad);
    const ch = document.getElementById('adminChips'); if (ch) ch.addEventListener('click', (e) => { const b = e.target.closest('[data-adf]'); if (b) { aboAdminFilter = b.dataset.adf; adminRender(); } });
    const list = document.getElementById('adminList');
    if (!list) return;
    list.addEventListener('click', async (e) => {
      const rowEl = e.target.closest('.adm-row'); if (!rowEl) return;
      const cid = rowEl.dataset.adr, r = aboAdminRows.find(x => String(x.commerce_id) === cid); if (!r) return;
      const btn = e.target.closest('button'); if (!btn) return;
      if (btn.dataset.adadd) { adminForm(rowEl, r, Number(btn.dataset.adadd)); return; }
      if (btn.dataset.adcancel) { const f = rowEl.querySelector('[data-adform]'); f.style.display = 'none'; f.innerHTML = ''; return; }
      if (btn.dataset.adok) {
        const mois = Number(btn.dataset.adok), f = rowEl.querySelector('[data-adform]');
        btn.disabled = true;
        await adminCall('admin_prolonger', { p_commerce: cid, p_mois: mois, p_jours: 0, p_montant: Math.round(Number(f.querySelector('[data-adm-montant]').value) || 0), p_devise: r.devise || 'XOF', p_moyen: f.querySelector('[data-adm-moyen]').value, p_reference: f.querySelector('[data-adm-ref]').value.trim() || null, p_note: null, p_essai: false },
          (d) => `✅ ${r.nom} : ${tr('actif jusqu\'au')} ${aboFmt(d)}`);
        return;
      }
      if (btn.dataset.adtrial) {
        if (r.actif_jusqua && !confirm(`${r.nom} a déjà un abonnement (fin le ${aboFmt(r.actif_jusqua)}). Ajouter quand même 14 jours d'essai ?`)) return;
        await adminCall('admin_prolonger', { p_commerce: cid, p_mois: 0, p_jours: Number(btn.dataset.adtrial), p_montant: 0, p_devise: r.devise || 'XOF', p_moyen: null, p_reference: null, p_note: 'Essai gratuit', p_essai: true }, (d) => `🎁 ${r.nom} : ${tr('essai jusqu\'au')} ${aboFmt(d)}`);
        return;
      }
      if (btn.dataset.adwa) {
        const S = aboStatusOf(r), pay = abo.cfg.paiement || {}, dv = r.devise || 'XOF';
        const tarif = ABO_FORMULES.map(([m, l]) => aboPrix(dv, m) ? `${l} : ${aboMoney(aboPrix(dv, m), dv)}` : '').filter(Boolean).join(' · ');
        const quand = S.mode === 'none' ? '' : S.mode === 'actif' || S.mode === 'bientot' ? `se termine le ${aboFmt(S.fin)}` : `est terminé depuis le ${aboFmt(S.fin)}`;
        const msg = `Bonjour ${r.proprietaire || ''}, ici BoromBoutik 👋\n${quand ? 'Votre abonnement pour « ' + r.nom + ' » ' + quand + '.\n' : ''}${tarif ? 'Tarifs : ' + tarif + '\n' : ''}${pay.wave ? 'Wave : ' + pay.wave + '\n' : ''}${pay.orange ? 'Orange Money : ' + pay.orange + '\n' : ''}${pay.autre ? pay.autre + '\n' : ''}Merci pour votre confiance 🙏`;
        aiOpenWa(r.telephone, msg, r.proprietaire || r.nom);
        return;
      }
      if (btn.dataset.adinfo) { aboAdminOpen = aboAdminOpen === cid ? null : cid; adminRender(); return; }
      if (btn.dataset.adfix) {
        const d = rowEl.querySelector('[data-adfixdate]').value;
        if (!d) { toast(tr('Choisis une date.')); return; }
        await adminCall('admin_fixer_date', { p_commerce: cid, p_date: d, p_note: 'Date corrigée à la main' }, () => `✅ ${r.nom} : ${tr('fin le')} ${aboFmt(d)}`);
        return;
      }
      if (btn.dataset.adremove) {
        if (!confirm(`Retirer l'abonnement de « ${r.nom} » ? La boutique repasse « sans abonnement » (rien n'est bloqué). L'historique des paiements est gardé.`)) return;
        await adminCall('admin_fixer_date', { p_commerce: cid, p_date: null, p_note: 'Abonnement retiré' }, () => `✅ ${r.nom} : ${tr('sans abonnement')}`);
      }
    });
  })();
