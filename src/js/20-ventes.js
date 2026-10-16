  // ================= Ventes (invoice builder) =================
  let saleType = 'comptant';
  let invoiceLines = [freshLine()];
  function freshLine() { return { ref: '', nom: '', qte: 1, prix: 0, unite: '', matched: false }; }

  function matchProducts(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return state.products.slice(0, 8);
    return state.products.filter(p => (p.ref || '').toLowerCase().includes(q) || (p.nom || '').toLowerCase().includes(q) || (p.codeBarre || '').toLowerCase().includes(q)).slice(0, 8);
  }

  function lineStockHtml(line) {
    const prod = line.matched ? state.products.find(p => p.ref === line.ref) : null;
    if (prod) return Number(line.qte) > Number(prod.stock) ? `<span class="il-warn" title="Stock insuffisant">⚠ ${prod.stock}</span>` : `<span class="il-ok" title="En stock">${prod.stock}</span>`;
    return line.nom && line.nom.trim() ? `<span class="il-hors" title="Hors stock : ne sera pas déduit du stock">hors</span>` : '';
  }
  function pickProduct(i, prod) {
    if (!prod || !invoiceLines[i]) return;
    invoiceLines[i] = { ref: prod.ref, nom: prod.nom, qte: Number(invoiceLines[i].qte) || 1, prix: prod.prixVente, unite: prod.unite || '', matched: true };
  }
  function renderInvoiceLines() {
    const wrap = document.getElementById('invLines');
    wrap.innerHTML = '';
    while (invoiceLines.length < 6) invoiceLines.push(freshLine());   // lignes vides prêtes à remplir, comme dans un tableur

    invoiceLines.forEach((line, idx) => {
      const filled = !!(line.nom && line.nom.trim());
      const total = (Number(line.prix) || 0) * (Number(line.qte) || 0);
      const row = document.createElement('div');
      row.className = 'inv-line il2';
      row.innerHTML = `
        <div class="il-name autocomplete-wrap">
          <input type="text" class="line-nom" data-idx="${idx}" value="${escapeHtml(line.nom)}" placeholder="${idx === 0 ? 'Tape le nom d\'un article…' : ''}" autocomplete="off">
          <div class="ac-list" data-ac="${idx}" style="display:none;"></div>
        </div>
        <div class="il-stock" data-stk="${idx}">${lineStockHtml(line)}</div>
        <div class="qty-box"><button type="button" class="q-btn" data-q="-1" data-idx="${idx}" tabindex="-1">−</button><input type="number" min="0" step="any" class="line-qty" data-idx="${idx}" value="${filled ? line.qte : ''}" inputmode="decimal"><button type="button" class="q-btn" data-q="1" data-idx="${idx}" tabindex="-1">+</button></div>
        <input type="text" class="line-unite" data-idx="${idx}" value="${escapeHtml(line.unite)}" title="Unité">
        <input type="number" min="0" step="1" class="line-prix" data-idx="${idx}" value="${filled ? line.prix : ''}" inputmode="numeric">
        <div class="ltotal-box">${filled ? Math.round(total).toLocaleString('fr-FR') : ''}</div>
        <button class="icon-btn il-rm" data-rm="${idx}" title="Vider cette ligne" type="button" tabindex="-1">✕</button>
      `;
      wrap.appendChild(row);
    });

    wrap.querySelectorAll('.line-nom').forEach(inp => {
      inp.addEventListener('input', e => { const idx = +e.target.dataset.idx; const l = invoiceLines[idx]; l.nom = e.target.value; l.ref = ''; l.matched = false;
        const rw = e.target.closest('.inv-line'), qi = rw.querySelector('.line-qty'), pi = rw.querySelector('.line-prix');
        if (l.nom.trim()) { if (qi && qi.value === '') qi.value = l.qte; if (pi && pi.value === '') pi.value = l.prix; }
        updateLineTotal(idx); openAutocomplete(idx, e.target.value); });
      inp.addEventListener('focus', e => openAutocomplete(+e.target.dataset.idx, e.target.value));
      inp.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return; e.preventDefault();
        const idx = +e.target.dataset.idx, m = matchProducts(e.target.value);
        if (m.length) { pickProduct(idx, m[0]); closeAllAutocomplete(); renderInvoiceLines(); const q = document.querySelectorAll('.line-qty')[idx]; if (q) { q.focus(); q.select(); } }
      });
      inp.addEventListener('blur', e => {
        const idx = +e.target.dataset.idx;
        setTimeout(() => {
          closeAllAutocomplete();
          // Si le nom tapé correspond exactement à un produit du stock, on le relie automatiquement
          const l = invoiceLines[idx]; if (!l || l.matched) return;
          const t = (l.nom || '').trim().toLowerCase(); if (!t) return;
          const hit = state.products.filter(p => (p.nom || '').trim().toLowerCase() === t || (p.ref || '').trim().toLowerCase() === t || (p.codeBarre || '').trim().toLowerCase() === t);
          if (hit.length === 1) { pickProduct(idx, hit[0]); renderInvoiceLines(); }
        }, 160);
      });
    });
    wrap.querySelectorAll('.line-unite').forEach(inp => inp.addEventListener('input', e => { invoiceLines[+e.target.dataset.idx].unite = e.target.value; }));
    wrap.querySelectorAll('.line-qty').forEach(inp => inp.addEventListener('input', e => { invoiceLines[+e.target.dataset.idx].qte = e.target.value; updateLineTotal(+e.target.dataset.idx); }));
    wrap.querySelectorAll('.line-prix').forEach(inp => inp.addEventListener('input', e => { invoiceLines[+e.target.dataset.idx].prix = e.target.value; updateLineTotal(+e.target.dataset.idx); }));
    wrap.querySelectorAll('.q-btn').forEach(b => b.addEventListener('click', () => {
      const idx = +b.dataset.idx, l = invoiceLines[idx];
      l.qte = Math.max(1, (Number(l.qte) || 0) + Number(b.dataset.q));
      const box = b.parentElement.querySelector('.line-qty'); if (box) box.value = l.qte;
      updateLineTotal(idx);
    }));
    wrap.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => { invoiceLines.splice(+b.dataset.rm, 1); if (invoiceLines.length === 0) invoiceLines = [freshLine()]; renderInvoiceLines(); }));

    updateGrandTotal();
    updateFinalizeHint();
  }
  function refreshLineStock(idx) {
    const el = document.querySelector(`[data-stk="${idx}"]`); if (el && invoiceLines[idx]) el.innerHTML = lineStockHtml(invoiceLines[idx]);
  }

  function updateLineTotal(idx) {
    const row = document.querySelectorAll('.inv-line')[idx];
    if (row) { const line = invoiceLines[idx]; row.querySelector('.ltotal-box').textContent = (line.nom && line.nom.trim()) ? Math.round((Number(line.prix) || 0) * (Number(line.qte) || 0)).toLocaleString('fr-FR') : ''; }
    refreshLineStock(idx);
    updateGrandTotal(); updateFinalizeHint();
  }
  // WhatsApp exige le format international (ex : 221771234567). Numéro local (9 chiffres ou moins) => on ajoute l'indicatif du Sénégal.
  const DEFAULT_COUNTRY_CODE = '221';
  function toWhatsAppNumber(raw) {
    let d = String(raw || '').replace(/[^0-9]/g, '');
    if (!d) return '';
    if (d.startsWith('00')) return d.slice(2);
    if (String(raw).trim().startsWith('+')) return d;
    if (d.length <= 9) return DEFAULT_COUNTRY_CODE + d;
    return d;
  }

  function getWhatsAppLink(telephone, produitNom, ref) {
    if (!telephone) return null;
    const cleanPhone = toWhatsAppNumber(telephone);
    if (!cleanPhone) return null;
    const msg = `Bonjour, je souhaite passer une commande pour le produit "${produitNom}"${ref ? ' (Réf: ' + ref + ')' : ''}. Merci de m'indiquer la disponibilité et le délai de livraison.`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  }

  // ---- Remise + TVA ----
  const htOf = (i) => (Number(i.total) || 0) - (Number(i.tvaMontant) || 0);   // montant hors TVA d'une facture
  function computeTotals(lines) {
    const sub = Math.round((lines || []).reduce((s, l) => s + (Number(l.prix) || 0) * (Number(l.qte) || 0), 0));
    const noFiscal = currentDocType() === 'bon_livraison';
    const rv = Math.max(0, Number(document.getElementById('f-remise').value) || 0);
    const pct = document.getElementById('f-remise-unit').value === 'pct';
    let remise = noFiscal ? 0 : (pct ? sub * Math.min(rv, 100) / 100 : rv);
    remise = Math.round(Math.min(remise, sub));
    const net = sub - remise;
    let mode = noFiscal ? 'none' : document.getElementById('f-tva-mode').value;
    const taux = Math.max(0, Number(document.getElementById('f-tva-taux').value) || 0);
    if (taux === 0) mode = 'none';
    let tva = 0, total = net;
    if (mode === 'add') { tva = Math.round(net * taux / 100); total = net + tva; }
    else if (mode === 'incl') { tva = Math.round(net - net / (1 + taux / 100)); }
    return { sub, remise, net, mode, taux, tva, total };
  }
  const fiscalExtra = (t) => (t.remise > 0 || t.mode !== 'none') ? { sousTotal: t.sub, remise: t.remise, tvaMode: t.mode, tvaTaux: t.taux, tvaMontant: t.tva } : {};
  const fiscalFromDoc = (d) => (d.remise || (d.tvaMode && d.tvaMode !== 'none')) ? { sousTotal: d.sousTotal || null, remise: d.remise || 0, tvaMode: d.tvaMode || 'none', tvaTaux: d.tvaTaux || 0, tvaMontant: d.tvaMontant || 0 } : {};

  function updateGrandTotal() {
    const T = computeTotals(invoiceLines);
    const total = T.total;
    document.getElementById('invGrandTotal').textContent = euros(total);
    document.getElementById('f-tva-taux').style.display = document.getElementById('f-tva-mode').value === 'none' ? 'none' : '';
    document.getElementById('invTotalLbl').textContent = T.mode === 'none' ? 'Total' : 'Total TTC';
    const bd = [];
    if (T.remise > 0 || T.mode !== 'none') {
      bd.push(`Sous-total : <b>${euros(T.sub)}</b>`);
      if (T.remise > 0) bd.push(`Remise : <b style="color:var(--danger);">− ${euros(T.remise)}</b>`);
      if (T.mode === 'add') { bd.push(`Montant HT : <b>${euros(T.net)}</b>`); bd.push(`TVA (${T.taux} %) : <b>+ ${euros(T.tva)}</b>`); }
      if (T.mode === 'incl') bd.push(`dont TVA (${T.taux} %) : <b>${euros(T.tva)}</b>`);
    }
    document.getElementById('invBreakdown').innerHTML = bd.join('<br>');
    { const lt = document.getElementById('invLettres'); if (lt) lt.textContent = total > 0 ? 'Arrêtée à la somme de : ' + fcfaEnLettres(total) : ''; }

    const payeVal = document.getElementById('f-paye').value.trim();
    const infoEl = document.getElementById('f-rendu-info');
    if (infoEl) {
      if (payeVal !== '' && total > 0) {
        const paye = Number(payeVal) || 0;
        if (paye > total) {
          infoEl.textContent = `💵 Monnaie à rendre : ${euros(paye - total)}`;
          infoEl.style.color = 'var(--moss)';
        } else if (paye < total) {
          infoEl.textContent = `⚠ Reste dû : ${euros(total - paye)}`;
          infoEl.style.color = 'var(--danger)';
        } else {
          infoEl.textContent = `✓ Compte exact`;
          infoEl.style.color = 'var(--moss)';
        }
      } else if (saleType === 'credit' && total > 0) {
        infoEl.textContent = `⚠ Vente à crédit : reste dû ${euros(total)}`;
        infoEl.style.color = 'var(--danger)';
      } else {
        infoEl.textContent = '';
      }
    }
  }
  ['f-remise', 'f-remise-unit', 'f-tva-mode', 'f-tva-taux'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', updateGrandTotal);
    el.addEventListener('change', () => {
      updateGrandTotal();
      if (id === 'f-tva-mode' || id === 'f-tva-taux') {
        try { localStorage.setItem('sf_tva', JSON.stringify({ mode: document.getElementById('f-tva-mode').value, taux: document.getElementById('f-tva-taux').value })); } catch (e) {}
      }
    });
  });
  try {
    const sv = JSON.parse(localStorage.getItem('sf_tva') || 'null');
    if (sv && ['none', 'add', 'incl'].includes(sv.mode)) { document.getElementById('f-tva-mode').value = sv.mode; if (sv.taux) document.getElementById('f-tva-taux').value = sv.taux; }
  } catch (e) {}
  document.getElementById('f-paye').addEventListener('input', updateGrandTotal);
  // Type de vente : comptant (par défaut) ou à crédit (date limite + acompte facultatif)
  function setSaleType(t) {
    saleType = t;
    document.querySelectorAll('.st-btn').forEach(b => b.classList.toggle('on', b.dataset.st === t));
    document.getElementById('f-echeance-wrap').style.display = t === 'credit' ? '' : 'none';
    const lab = document.querySelector('#f-paye-wrap label'), inp = document.getElementById('f-paye');
    if (lab) lab.textContent = t === 'credit' ? 'Acompte versé maintenant (' + curSym() + ') — facultatif' : 'Montant payé par le client (' + curSym() + ')';
    inp.placeholder = t === 'credit' ? 'Vide = rien payé maintenant' : 'Laisse vide si le client paie tout';
    if (t === 'credit' && !document.getElementById('f-echeance').value) { const d = new Date(Date.now() + 7 * 86400000); document.getElementById('f-echeance').value = d.toISOString().slice(0, 10); }
    updateGrandTotal();
  }
  document.querySelectorAll('.st-btn').forEach(b => b.addEventListener('click', () => setSaleType(b.dataset.st)));
  document.getElementById('modeChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    document.getElementById('f-mode-paiement').value = b.dataset.mode;
    document.querySelectorAll('.mode-chip').forEach(c => c.classList.toggle('on', c === b));
  });
  function updateFinalizeHint() {
    const hint = document.getElementById('finalizeHint');
    const shortages = invoiceLines.filter(l => l.matched).map(l => {
      const prod = state.products.find(p => p.ref === l.ref);
      if (!prod) return null;
      if (Number(l.qte) > Number(prod.stock)) return `${prod.nom} (stock: ${prod.stock} ${prod.unite || ''}, demandé: ${l.qte})`;
      return null;
    }).filter(Boolean);
    const customLines = invoiceLines.filter(l => !l.matched && l.nom && l.nom.trim()).length;
    hint.classList.remove('fh-warn');
    if (shortages.length) { hint.textContent = '⚠ Stock insuffisant — ' + shortages.join(', '); hint.style.color = ''; hint.classList.add('fh-warn'); }
    else if (customLines) { hint.textContent = `⚠ ${customLines} ligne(s) hors catalogue (produit non enregistré dans ton stock) — le stock ne sera PAS déduit pour ces lignes.`; hint.style.color = ''; hint.classList.add('fh-warn'); }
    else { hint.textContent = 'La finalisation déduit automatiquement les quantités du stock pour les articles du catalogue.'; hint.style.color = ''; }
  }
  function closeAllAutocomplete() { document.querySelectorAll('.ac-list').forEach(el => el.style.display = 'none'); }
  function openAutocomplete(idx, query) {
    closeAllAutocomplete();
    const list = document.querySelector(`.ac-list[data-ac="${idx}"]`);
    if (!list) return;
    const matches = matchProducts(query);
    if (matches.length === 0) list.innerHTML = `<div class="ac-empty">Aucune correspondance — la ligne restera libre (hors-catalogue).</div>`;
    else list.innerHTML = matches.map(p => `
      <div class="ac-item" data-pick="${escapeHtml(p.ref)}" data-idx="${idx}">
        <div class="ac-ref">${escapeHtml(p.nom)}</div>
        <div class="ac-meta">${euros(p.prixVente)} / ${escapeHtml(p.unite || 'unité')} · en stock : ${p.stock}${p.ref ? ' · ' + escapeHtml(p.ref) : ''}</div>
      </div>`).join('');
    list.style.display = 'block';
    list.querySelectorAll('[data-pick]').forEach(el => {
      el.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        const i = +el.dataset.idx;
        const prod = state.products.find(p => p.ref === el.dataset.pick);
        if (prod) pickProduct(i, prod);
        closeAllAutocomplete();
        renderInvoiceLines();
      });
    });
  }

  document.getElementById('btnAddLine').addEventListener('click', () => { invoiceLines.push(freshLine()); renderInvoiceLines(); const all = document.querySelectorAll('.line-nom'); if (all.length) all[all.length - 1].focus(); });
  document.getElementById('btnFinalize').addEventListener('click', () => { if (currentDocType() === 'facture') finalizeInvoice(); else saveDocument(); });
  document.getElementById('f-doctype').addEventListener('change', () => { convertingDocId = null; applyDocMode(); });

  // Modifie le stock de façon atomique côté base (fonction SQL adjust_stock) :
  // delta négatif = vente, delta positif = remise en stock. Évite les écrasements si deux personnes vendent en même temps.
  async function adjustStock(productId, delta) {
    // Passe par la file d'attente de l'appareil : marche aussi sans internet (envoyé dès que le réseau revient)
    if (state.db && state.db.queueStock) return await state.db.queueStock(productId, delta);
    const { data, error } = await supabaseClient.rpc('adjust_stock', { p_product_id: productId, p_delta: delta });
    if (error) throw new Error(error.message);
    if (state.db && state.db.refresh) state.db.refresh('produits');
    return Number(data);
  }

  async function finalizeInvoice() {
    const validLines = invoiceLines.filter(l => l.nom && Number(l.qte) > 0);
    if (validLines.length === 0) { toast('Ajoute au moins une ligne valide (désignation + quantité).'); return; }
    const shortage = validLines.find(l => { if (!l.matched) return false; const prod = state.products.find(p => p.ref === l.ref); return prod && Number(l.qte) > Number(prod.stock); });
    if (shortage) { toast(`Stock insuffisant pour ${shortage.nom}.`); return; }
    if (!state.db) { toast('Connexion non disponible — réessaie dans un instant.'); return; }
    if (saleType === 'credit' && !document.getElementById('f-client').value.trim()) { toast('⚠ Pour une vente à crédit, indique le nom du client : sans nom, impossible de savoir qui doit payer.'); document.getElementById('f-client').focus(); return; }

    const btn = document.getElementById('btnFinalize');
    btn.disabled = true;
    try {
      const num = (state.invoices.reduce((m, i) => Math.max(m, Number(i.num) || 0), 0)) + 1;
      const T = computeTotals(validLines);
      const total = T.total;
      const date = document.getElementById('f-date').value || todayStr();
      const client = document.getElementById('f-client').value.trim();

      // Retrouve ou crée automatiquement la fiche client à partir du nom saisi
      let clientId = null;
      if (client) {
        const existing = state.clients.find(c => c.nom.trim().toLowerCase() === client.toLowerCase());
        if (existing) {
          clientId = existing.id;
        } else {
          clientId = 'cl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
          await state.db.doc('clients/' + clientId).set({ nom: client, telephone: '', adresse: '', createdAt: Date.now() });
        }
      }

      const invDoc = {
        num, date, client, clientId,
        lignes: validLines.map(l => {
          const prod = l.matched ? state.products.find(p => p.ref === l.ref) : null;
          return { ref: l.ref || '', nom: l.nom, qte: Number(l.qte), prix: Number(l.prix) || 0, unite: l.unite || '', matched: !!prod, productId: prod ? prod.id : null };
        }),
        total, ...fiscalExtra(T), montantPaye: 0, createdAt: Date.now(), annulee: false,
        operateur: state.currentUser ? `${state.currentUser.nom} (${ROLE_LABEL[state.currentUser.role]})` : '',
      };

      // Montant payé au moment de la vente : champ vide = payé en totalité (cas le plus courant).
      const payeRaw = document.getElementById('f-paye').value.trim();
      const mode = document.getElementById('f-mode-paiement').value;
      let montantPaye = payeRaw === '' ? (saleType === 'credit' ? 0 : total) : Math.max(0, Math.min(total, Number(payeRaw) || 0));
      invDoc.montantPaye = montantPaye;
      const remarque = (document.getElementById('f-remarque').value || '').trim();
      if (remarque) invDoc.remarque = remarque;
      if (saleType === 'credit' && montantPaye < total) { const ech = document.getElementById('f-echeance').value; if (ech) invDoc.echeance = ech; }
      const invId = 'fac-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

      // Regrouper les quantités par produit avant de déduire, pour éviter d'écraser
      // la déduction si le même article apparaît sur plusieurs lignes de la facture.
      const deductions = {};
      for (const l of invDoc.lignes) {
        if (!l.matched || !l.productId) continue;
        deductions[l.productId] = (deductions[l.productId] || 0) + Number(l.qte);
      }

      // 1) Le stock d'abord (atomique côté base : refuse si le stock est insuffisant)
      const deducted = [];
      try {
        for (const [productId, qteTotale] of Object.entries(deductions)) {
          await adjustStock(productId, -qteTotale);
          deducted.push([productId, qteTotale]);
        }
        // 2) Puis la facture et son premier paiement
        await state.db.collection('factures').doc(invId).set(invDoc);

        // Note le paiement (mode, vendeur) : sert à l'historique du client ET au suivi de la caisse.
        if (montantPaye > 0) {
          const payId = 'pa-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
          try {
            await state.db.doc('paiements/' + payId).set({ factureId: invId, clientId: clientId || null, montant: montantPaye, mode, date, operateur: state.currentUser ? state.currentUser.nom : '', createdAt: Date.now() });
          } catch (payErr) {
            if (clientId) throw payErr;
            console.error(payErr);
            toast("Vente enregistrée, mais le paiement n'a pas pu être noté dans la caisse.");
          }
        }
      } catch (saleErr) {
        // En cas d'échec en cours de route, on remet le stock déjà déduit
        for (const [productId, qte] of deducted) { try { await adjustStock(productId, qte); } catch (e2) { console.error(e2); } }
        throw saleErr;
      }

      if (convertingDocId) {
        try { await state.db.doc('documents/' + convertingDocId).update({ statut: 'facture', factureId: invId }); } catch (e5) { console.error(e5); }
        convertingDocId = null;
      }
      invoiceLines = [freshLine()];
      document.getElementById('f-client').value = '';
      document.getElementById('f-paye').value = '';
      document.getElementById('f-remise').value = '';
      document.getElementById('f-remarque').value = '';
      document.getElementById('f-echeance').value = '';
      setSaleType('comptant');
      renderInvoiceLines();
      const resteMsg = montantPaye < total ? ` — reste à payer : ${euros(total - montantPaye)}` : '';
      const nbHors = invDoc.lignes.filter(l => !l.matched).length;
      const stockMsg = nbHors === invDoc.lignes.length ? 'aucun article du catalogue, stock inchangé' : (nbHors ? `stock mis à jour (sauf ${nbHors} ligne(s) hors catalogue)` : 'stock mis à jour');
      toast(`Facture FAC-${String(num).padStart(4, '0')} finalisée — ${stockMsg}${resteMsg}.`);
      if (document.getElementById('tkAuto') && document.getElementById('tkAuto').checked) printTicket(invDoc);
      if (document.getElementById('tkWa') && document.getElementById('tkWa').checked) sendTicketWhatsApp(invDoc, false);
    } catch (err) {
      console.error(err);
      const detail = (err && err.message) ? err.message : String(err);
      toast('Erreur : ' + detail);
    } finally {
      btn.disabled = false;
    }
  }

