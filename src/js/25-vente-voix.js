  // ================= Vente à la voix (test) : la phrase remplit la facture, le commerçant vérifie et finalise =================
  let vsBusy = false;
  function vsStatus(html) { const s = document.getElementById('vsStatus'); if (s) s.innerHTML = html; }
  let vsAppend = false;   // « ➕ Ajouter d'autres produits » : la nouvelle dictée s'ajoute à la facture au lieu de la remplacer
  // Retrouve un client connu : d'abord le nom donné par l'IA, sinon un nom de la liste prononcé dans la phrase
  function vsFindClient(nomIA, phrase) {
    const list = (state.clients || []).map(c => c.nom).filter(Boolean);
    const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    if (nomIA) {
      const n = norm(nomIA);
      const hit = list.find(c => norm(c) === n) || list.find(c => norm(c).includes(n) || n.includes(norm(c)));
      return { nom: hit || String(nomIA).trim(), connu: !!hit };
    }
    const ph = ' ' + norm(phrase) + ' ';
    const hit = list.filter(c => norm(c).length >= 3 && ph.includes(' ' + norm(c) + ' ')).sort((a, b) => b.length - a.length)[0];
    return hit ? { nom: hit, connu: true } : null;
  }
  async function vsParse(phrase) {
    phrase = String(phrase || '').replace(/^🎤\s*/, '').trim();
    if (!phrase || vsBusy) return;
    if (!needOnline('la vente à la voix')) return;
    vsBusy = true; document.getElementById('vsGo').disabled = true;
    vsStatus('🧠 ' + escapeHtml(tr('Bel prépare la facture…')) + ' « ' + escapeHtml(phrase) + ' »');
    try {
      const catalogue = (state.products || []).slice(0, 1500).map(p => `${p.id} | ${p.nom} | ${p.unite || ''} | ${Number(p.prixVente) || 0}`).join('\n');
      const clients = (state.clients || []).slice(0, 400).map(c => c.nom).filter(Boolean).join(' ; ');
      const { data, error } = await supabaseClient.functions.invoke('ask-ai', { body: { vente: phrase, catalogue, clients, devise: curSym(), lang: UI_LANG } });
      if (error || !data || !data.resultat) {
        let msg = 'La vente à la voix n\'est pas encore activée.';
        try { const j = error && error.context && typeof error.context.json === 'function' && await error.context.json(); if (j && j.error && !/Question vide/.test(j.error)) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      const R = data.resultat, lignes = Array.isArray(R.lignes) ? R.lignes : [];
      if (!lignes.length) throw new Error(tr('Je n\'ai trouvé aucun article. Redis la vente avec le nom des produits.'));
      const dt = document.getElementById('f-doctype'); if (dt && dt.value !== 'facture') { dt.value = 'facture'; dt.dispatchEvent(new Event('change')); }
      const nouvelles = lignes.map(l => {
        const p = l.id && (state.products || []).find(x => x.id === l.id);
        const q = Number(l.quantite) || 1;
        return p ? { ref: p.ref, nom: p.nom, qte: q, prix: l.prix != null ? Number(l.prix) : Number(p.prixVente) || 0, unite: p.unite || '', matched: true }
                 : { ref: '', nom: String(l.nom || '').trim(), qte: q, prix: Number(l.prix) || 0, unite: '', matched: false };
      }).filter(l => l.nom);
      const garder = vsAppend ? (invoiceLines || []).filter(l => l.nom && l.nom.trim()) : [];
      invoiceLines = garder.concat(nouvelles);
      renderInvoiceLines();
      const cl = document.getElementById('f-client');
      const cli = vsFindClient(R.client, phrase);
      let cliTxt = '';
      if (cl && cli) { cl.value = cli.nom; cliTxt = ' · 👤 ' + escapeHtml(cli.nom) + (cli.connu ? '' : ' <b>(🆕 ' + escapeHtml(tr('nouveau client')) + ')</b>'); }
      if (!vsAppend || R.credit) setSaleType(R.credit ? 'credit' : 'comptant');
      const chip = document.querySelector(`#modeChips .mode-chip[data-mode="${R.mode === 'Mobile Money' ? 'Mobile Money' : 'Espèces'}"]`); if (chip) chip.click();
      const pay = document.getElementById('f-paye'); if (pay) pay.value = R.paye != null ? Math.round(Number(R.paye)) : '';
      try { updateGrandTotal(); } catch (e) {}
      const inconnus = invoiceLines.filter(l => l.nom && l.nom.trim() && !l.matched).length;
      vsStatus('✅ ' + escapeHtml(tr('Facture remplie : vérifie puis touche « Finaliser la vente ».')) + cliTxt + (inconnus ? ' ⚠️ ' + inconnus + ' ' + escapeHtml(tr('article(s) hors catalogue')) : '')
        + `<div style="margin-top:6px;"><button type="button" class="ghost" id="vsMore">➕ ${escapeHtml(tr('Ajouter d\'autres produits'))}</button></div>`);
      const more = document.getElementById('vsMore');
      if (more) more.addEventListener('click', () => { vsAppend = true; const m = document.getElementById('vsMic'); if (m) m.click(); });
      document.getElementById('vsText').value = '';
      const fin = document.getElementById('btnFinalize'); if (fin) fin.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      vsStatus('😕 ' + escapeHtml(isNetErr(e) ? tr('Pas de connexion internet.') : (e.message || 'Erreur')));
    } finally { vsBusy = false; vsAppend = false; document.getElementById('vsGo').disabled = false; }
  }
  (function vsInit() {
    const mic = document.getElementById('vsMic'), txt = document.getElementById('vsText'), go = document.getElementById('vsGo');
    if (!mic) return;
    go.addEventListener('click', () => vsParse(txt.value));
    txt.addEventListener('keydown', (e) => { if (e.key === 'Enter') vsParse(txt.value); });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { mic.addEventListener('click', () => { vsStatus('ℹ️ ' + escapeHtml(tr('Le micro n\'est pas disponible sur ce navigateur : écris la vente dans la case.'))); txt.focus(); }); return; }
    // Le micro reste ouvert (même pendant les pauses) jusqu'à « ✅ J'ai fini » ; tout ce qui a été dit est gardé
    let rec = null, ecoute = false, deja = '', enCours = '';
    const finEcoute = () => {
      ecoute = false; mic.classList.remove('rec'); mic.textContent = '🎤';
      const t = (deja + ' ' + enCours).replace(/\s+/g, ' ').trim(); deja = ''; enCours = '';
      if (t) { txt.value = t; vsParse(t); } else vsStatus('🙉 ' + escapeHtml(tr('Je n\'ai pas entendu. Touche 🎤 et réessaie.')));
    };
    const demarre = () => {
      rec = new SR(); rec.lang = ({ fr: 'fr-FR', en: 'en-US', ar: 'ar-SA' })[UI_LANG] || 'fr-FR'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        let fin = '', tmp = '';
        for (let i = 0; i < ev.results.length; i++) { if (ev.results[i].isFinal) fin += ev.results[i][0].transcript + ' '; else tmp += ev.results[i][0].transcript; }
        enCours = (fin + tmp).trim(); txt.value = (deja + ' ' + enCours).trim();
      };
      rec.onerror = (e) => { if (e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')) { ecoute = false; vsStatus('🔒 ' + escapeHtml(tr('Autorise le micro pour ce site, puis réessaie.'))); } };
      // Certains téléphones coupent le micro tout seul après un silence : on le relance tant que le commerçant n'a pas fini
      rec.onend = () => { rec = null; if (ecoute) { deja = (deja + ' ' + enCours).trim(); enCours = ''; try { demarre(); } catch (e) { finEcoute(); } } else finEcoute(); };
      rec.start();
    };
    mic.addEventListener('click', () => {
      if (ecoute) { ecoute = false; if (rec) { try { rec.stop(); } catch (e) { finEcoute(); } } else finEcoute(); return; }
      ecoute = true; deja = ''; enCours = ''; if (!vsAppend) txt.value = '';
      mic.classList.add('rec'); mic.textContent = '✅';
      vsStatus('🎤 ' + escapeHtml(tr('Je t\'écoute… dis tous les produits, prends ton temps.')) + '<br><b>' + escapeHtml(tr('Touche ✅ quand tu as fini.')) + '</b>');
      try { demarre(); } catch (e) { ecoute = false; mic.classList.remove('rec'); mic.textContent = '🎤'; }
    });
  })();

  document.getElementById('btnAddPerte').addEventListener('click', async () => {
    const productId = document.getElementById('ps-produit').value;
    const qte = Number(document.getElementById('ps-qte').value) || 0;
    const raison = document.getElementById('ps-raison').value;
    const note = document.getElementById('ps-note').value.trim();

    const prod = state.products.find(p => p.id === productId);
    if (!prod) { toast('Choisis un produit.'); return; }
    if (qte <= 0) { toast('La quantité doit être supérieure à 0.'); return; }
    if (!state.db) { toast('Connexion non disponible.'); return; }

    const retrait = Math.min(qte, Number(prod.stock) || 0);   // on ne descend jamais sous 0

    try {
      const nouveauStock = retrait > 0 ? await adjustStock(productId, -retrait) : (Number(prod.stock) || 0);   // retrait atomique côté base
      const ancienStock = nouveauStock + retrait;
      await logMovement({ productId, ref: prod.ref, nom: prod.nom, quantite: qte, ancienStock, nouveauStock, unite: prod.unite, source: 'perte', raison, note });
      document.getElementById('ps-qte').value = '1';
      document.getElementById('ps-note').value = '';
      logAction('PERTE_STOCK', `${qte} ${prod.unite || ''} de "${prod.nom}" (${raison})${note ? ' — ' + note : ''}`);
      toast(`Perte enregistrée : ${qte} ${prod.unite || ''} de "${prod.nom}" (${raison}).`);
    } catch (err) {
      console.error(err);
      toast('Erreur : ' + (err.message || err));
    }
  });

  function renderMovements() {
    const box = document.getElementById('movementsList');
    const empty = document.getElementById('movementsEmpty');
    if (!box) return;
    const list = (state.movements || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 12);
    if (list.length === 0) { box.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    const srcLabel = { 'scan-usb': 'scan USB/BT', 'scan-camera': 'scan caméra', 'manuel': 'saisie manuelle', 'perte': 'casse / perte', 'annulation': 'annulation facture', 'inventaire': 'inventaire' };
    box.innerHTML = list.map(m => {
      const isPerte = m.source === 'perte';
      const sign = isPerte ? '−' : (m.source === 'inventaire' && Number(m.nouveauStock) < Number(m.ancienStock) ? '−' : '+');
      const raisonTxt = isPerte && m.raison ? ` · ${escapeHtml(m.raison)}` : '';
      return `<li><span>${escapeHtml(m.nom)} — ${sign}${m.quantite} ${escapeHtml(m.unite || '')} <span class="r">(${srcLabel[m.source] || m.source || ''}${raisonTxt}${m.operateur ? ' · ' + escapeHtml(m.operateur) : ''})</span></span><span class="r">${m.ancienStock} → ${m.nouveauStock}</span></li>`;
    }).join('');
  }

