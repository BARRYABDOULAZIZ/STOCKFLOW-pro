  // ================= Devis et bons de commande =================
  const DOC_LABELS = { devis: 'Devis', bon_commande: 'Bon de commande', bon_livraison: 'Bon de livraison' };
  const DOC_PREFIX = { devis: 'DEV', bon_commande: 'BC', bon_livraison: 'BL' };
  let convertingDocId = null;
  const docNumLabel = (d) => `${DOC_PREFIX[d.type] || 'DOC'}-${String(d.num).padStart(4, '0')}`;
  const newId = (p) => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const isOwnerOrAdmin = () => !!(state.currentUser && (state.currentUser.role === 'proprietaire' || state.currentUser.role === 'admin'));

  function currentDocType() { return document.getElementById('f-doctype').value; }

  function applyDocMode() {
    const t = currentDocType();
    const isInv = t === 'facture';
    document.getElementById('ventesTitle').textContent = isInv ? 'Nouvelle vente' : (t === 'devis' ? 'Nouveau devis' : (t === 'bon_livraison' ? 'Nouveau bon de livraison' : 'Nouveau bon de commande'));
    document.getElementById('f-paye-wrap').style.display = isInv ? '' : 'none';
    document.getElementById('f-extra-wrap').style.display = isInv ? '' : 'none';
    document.getElementById('saleStep3').style.display = isInv ? '' : 'none';
    document.getElementById('f-remarque-wrap').style.display = isInv ? '' : 'none';
    if (!isInv) document.getElementById('saleMore').open = true;
    document.getElementById('fiscalBlock').style.display = t === 'bon_livraison' ? 'none' : '';
    updateGrandTotal();
    document.getElementById('f-mode-wrap').style.display = isInv ? '' : 'none';
    document.getElementById('f-validite-wrap').style.display = t === 'devis' ? '' : 'none';
    document.getElementById('finalizeHint').style.display = isInv ? '' : 'none';
    document.getElementById('btnFinalize').textContent = isInv ? 'Finaliser la vente' : (t === 'devis' ? 'Enregistrer le devis' : (t === 'bon_livraison' ? 'Enregistrer le bon de livraison' : 'Enregistrer le bon de commande'));
    if (t === 'devis' && !document.getElementById('f-validite').value) {
      const d = new Date(); d.setDate(d.getDate() + 15);
      document.getElementById('f-validite').value = d.toISOString().slice(0, 10);
    }
  }

  async function saveDocument() {
    const type = currentDocType();
    const validLines = invoiceLines.filter(l => l.nom && Number(l.qte) > 0);
    if (validLines.length === 0) { toast('Ajoute au moins une ligne valide (désignation + quantité).'); return; }
    if (!state.db) { toast('Connexion non disponible — réessaie dans un instant.'); return; }
    const btn = document.getElementById('btnFinalize');
    btn.disabled = true;
    try {
      const num = state.documents.filter(d => d.type === type).reduce((m, d) => Math.max(m, Number(d.num) || 0), 0) + 1;
      const T = computeTotals(validLines);
      const total = T.total;
      const client = document.getElementById('f-client').value.trim();
      const existing = client ? state.clients.find(c => (c.nom || '').trim().toLowerCase() === client.toLowerCase()) : null;
      const doc = {
        type, num,
        date: document.getElementById('f-date').value || todayStr(),
        client, clientId: existing ? existing.id : null,
        lignes: validLines.map(l => {
          const prod = l.matched ? state.products.find(p => p.ref === l.ref) : null;
          return { ref: l.ref || '', nom: l.nom, qte: Number(l.qte), prix: Number(l.prix) || 0, unite: l.unite || '', matched: !!prod, productId: prod ? prod.id : null };
        }),
        total, ...fiscalExtra(T), statut: 'en_attente',
        validite: type === 'devis' ? (document.getElementById('f-validite').value || '') : '',
        operateur: state.currentUser ? `${state.currentUser.nom} (${ROLE_LABEL[state.currentUser.role]})` : '',
        createdAt: Date.now(), factureId: null, sourceId: null,
      };
      await state.db.collection('documents').doc(newId('doc')).set(doc);
      invoiceLines = [freshLine()];
      document.getElementById('f-client').value = '';
      document.getElementById('f-remise').value = '';
      renderInvoiceLines();
      if (confirm(`${DOC_LABELS[type]} ${docNumLabel(doc)} enregistré. L'imprimer maintenant ?`)) printInvoice(doc, type);
      else toast(`${DOC_LABELS[type]} ${docNumLabel(doc)} enregistré.`);
    } catch (err) {
      console.error(err);
      toast('Erreur : ' + ((err && err.message) ? err.message : String(err)));
    } finally {
      btn.disabled = false;
    }
  }

  // Texte WhatsApp d'un devis / bon de commande / bon de livraison (le BL n'affiche pas les prix, comme à l'impression)
  function docWhatsAppText(d) {
    const c = state.commerce || {};
    const isBL = d.type === 'bon_livraison';
    const n0 = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
    const icon = d.type === 'devis' ? '📋' : (isBL ? '🚚' : '📦');
    const lg = invLang(), X = invT(lg), sp = lg === 'fr' ? ' : ' : ': ', iso = (s) => bidiIso(s, lg);
    const L = [];
    L.push(icon + ' *' + (c.nom || 'BoromBoutik') + '*');
    if (c.adresse) L.push(c.adresse);
    if (c.telephone) L.push(X.tel + sp + iso(c.telephone));
    L.push('─────────────');
    L.push('*' + (X[d.type] || 'Document') + ' ' + iso(docNumLabel(d)) + '*' + (d.date ? ' — ' + iso(frDate(d.date)) : ''));
    if (d.client) L.push(X.client + sp + d.client);
    L.push('─────────────');
    (d.lignes || []).forEach(l => {
      const q = Number(l.qte) || 0, pr = Number(l.prix) || 0, u = l.unite ? ' ' + l.unite : '';
      L.push(isBL ? ('• ' + l.nom + sp + iso(q + u)) : ('• ' + l.nom + '\n   ' + iso(q + u + ' × ' + n0(pr) + ' = ' + n0(q * pr))));
    });
    L.push('─────────────');
    if (isBL) {
      L.push(X.blCheck);
    } else {
      const rem = Number(d.remise) || 0, tm = d.tvaMode || 'none', tv = Number(d.tvaMontant) || 0, tx = Number(d.tvaTaux) || 0;
      if (rem > 0) L.push(X.remise + sp + iso('- ' + n0(rem)));
      if (tm === 'add') L.push(X.tva + ' ' + iso(tx + '%') + sp + iso('+ ' + n0(tv))); else if (tm === 'incl') L.push(X.dontTva + ' ' + iso(tx + '%') + sp + iso(n0(tv)));
      L.push('*' + X.total.toUpperCase() + sp + invMoney(d.total, lg) + '*');
      L.push('_' + montantEnLettres(Number(d.total) || 0, lg) + '_');
      if (d.type === 'devis') L.push(d.validite ? X.valable(iso(frDate(d.validite))) : X.sansEng);
    }
    L.push('');
    L.push(c.messageFacture || X.merci);
    return L.join('\n');
  }

  function renderDocuments() {
    const body = document.getElementById('docsBody');
    if (!body || !document.getElementById('panel-documents').classList.contains('active')) return;
    const filter = document.getElementById('docs-filter').value;
    const list = state.documents.filter(d => !filter || d.type === filter).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    document.getElementById('docsEmpty').style.display = list.length ? 'none' : 'block';
    const statutBadge = (d) => {
      if (d.statut === 'accepte') return '<span class="badge" style="background:#16a34a; color:#fff;">Accepté</span>';
      if (d.statut === 'refuse') return '<span class="badge" style="background:var(--danger); color:#fff;">Refusé</span>';
      if (d.statut === 'facture') {
        const inv = state.invoices.find(i => i.id === d.factureId);
        return `<span class="badge" style="background:#2563eb; color:#fff;">Facturé${inv ? ' (FAC-' + String(inv.num).padStart(4, '0') + ')' : ''}</span>`;
      }
      if (d.statut === 'livre') return '<span class="badge" style="background:#0891ff; color:#fff;">Livré</span>';
      return '<span class="badge">En attente</span>';
    };
    const btnStyle = 'padding:6px 10px; font-size:12px; margin:2px;';
    body.innerHTML = list.map(d => {
      const open = d.statut === 'en_attente' || d.statut === 'accepte' || (d.type === 'bon_livraison' && d.statut === 'livre');
      return `<tr>
        <td>${escapeHtml(docNumLabel(d))}<div class="muted" style="font-size:11px;">${escapeHtml(DOC_LABELS[d.type] || '')}</div></td>
        <td class="muted">${escapeHtml(d.date || '')}</td>
        <td>${escapeHtml(d.client || '—')}</td>
        <td class="num-cell">${euros(d.total)}</td>
        <td>${statutBadge(d)}</td>
        <td class="num-cell" style="white-space:nowrap;">
          <button class="ghost" data-doc-act="print" data-doc-id="${escapeHtml(d.id)}" style="${btnStyle}">Imprimer</button><button class="ghost" data-doc-act="wa" data-doc-id="${escapeHtml(d.id)}" style="${btnStyle}">💬 WhatsApp</button>
          ${d.type === 'devis' && d.statut === 'en_attente' ? `<button class="ghost" data-doc-act="accept" data-doc-id="${escapeHtml(d.id)}" style="${btnStyle}">✓ Accepté</button><button class="ghost" data-doc-act="refuse" data-doc-id="${escapeHtml(d.id)}" style="${btnStyle}">✗ Refusé</button>` : ''}
          ${d.type === 'devis' && open ? `<button class="ghost" data-doc-act="tobc" data-doc-id="${escapeHtml(d.id)}" style="${btnStyle}">→ Bon de commande</button>` : ''}
          ${(d.type === 'bon_commande' || d.type === 'devis') && (d.statut === 'en_attente' || d.statut === 'accepte') ? `<button class="ghost" data-doc-act="tobl" data-doc-id="${escapeHtml(d.id)}" style="${btnStyle}">🚚 Bon de livraison</button>` : ''}
          ${d.type === 'bon_livraison' && d.statut === 'en_attente' ? `<button class="ghost" data-doc-act="livre" data-doc-id="${escapeHtml(d.id)}" style="${btnStyle}">✓ Livré</button>` : ''}
          ${open ? `<button class="ghost" data-doc-act="toinv" data-doc-id="${escapeHtml(d.id)}" style="${btnStyle}">→ Facture</button>` : ''}
          ${isOwnerOrAdmin() ? `<button class="ghost" data-doc-act="delete" data-doc-id="${escapeHtml(d.id)}" style="${btnStyle}">Supprimer</button>` : ''}
        </td>
      </tr>`;
    }).join('');
    body.querySelectorAll('[data-doc-act]').forEach(b => b.addEventListener('click', () => docAction(b.dataset.docAct, b.dataset.docId)));
  }
  document.getElementById('docs-filter').addEventListener('change', renderDocuments);

  async function docAction(act, id) {
    const d = state.documents.find(x => x.id === id);
    if (!d || !state.db) return;
    try {
      if (act === 'print') { printInvoice(d, d.type); return; }
      if (act === 'wa') { sendTicketWhatsApp(d, true, docWhatsAppText(d)); return; }
      if (act === 'accept') { await state.db.doc('documents/' + id).update({ statut: 'accepte' }); toast(`${docNumLabel(d)} marqué comme accepté.`); return; }
      if (act === 'refuse') { await state.db.doc('documents/' + id).update({ statut: 'refuse' }); toast(`${docNumLabel(d)} marqué comme refusé.`); return; }
      if (act === 'livre') { await state.db.doc('documents/' + id).update({ statut: 'livre' }); toast(`${docNumLabel(d)} marqué comme livré.`); return; }
      if (act === 'tobl') {
        const num = state.documents.filter(x => x.type === 'bon_livraison').reduce((m, x) => Math.max(m, Number(x.num) || 0), 0) + 1;
        const bl = { type: 'bon_livraison', num, date: todayStr(), client: d.client || '', clientId: d.clientId || null, lignes: d.lignes || [], total: d.total || 0, ...fiscalFromDoc(d), statut: 'en_attente', validite: '', operateur: state.currentUser ? `${state.currentUser.nom} (${ROLE_LABEL[state.currentUser.role]})` : '', createdAt: Date.now(), factureId: null, sourceId: d.id };
        await state.db.collection('documents').doc(newId('doc')).set(bl);
        toast(`Bon de livraison ${docNumLabel(bl)} créé à partir de ${docNumLabel(d)}.`);
        if (confirm(`Bon de livraison ${docNumLabel(bl)} créé. L'imprimer maintenant ?`)) printInvoice(bl, 'bon_livraison');
        return;
      }
      if (act === 'delete') {
        if (!confirm(`Supprimer définitivement ${docNumLabel(d)} ?`)) return;
        await state.db.doc('documents/' + id).delete();
        logAction('SUPPRESSION_DOCUMENT', `${DOC_LABELS[d.type]} ${docNumLabel(d)} supprimé (${euros(d.total)})`);
        return;
      }
      if (act === 'tobc') {
        const num = state.documents.filter(x => x.type === 'bon_commande').reduce((m, x) => Math.max(m, Number(x.num) || 0), 0) + 1;
        const bc = { type: 'bon_commande', num, date: todayStr(), client: d.client || '', clientId: d.clientId || null, lignes: d.lignes || [], total: d.total || 0, ...fiscalFromDoc(d), statut: 'en_attente', validite: '', operateur: state.currentUser ? `${state.currentUser.nom} (${ROLE_LABEL[state.currentUser.role]})` : '', createdAt: Date.now(), factureId: null, sourceId: d.id };
        await state.db.collection('documents').doc(newId('doc')).set(bc);
        await state.db.doc('documents/' + id).update({ statut: 'accepte' });
        toast(`Bon de commande ${docNumLabel(bc)} créé à partir du devis ${docNumLabel(d)}.`);
        return;
      }
      if (act === 'toinv') {
        document.getElementById('f-doctype').value = 'facture';
        applyDocMode();
        invoiceLines = (d.lignes || []).map(l => ({ ref: l.ref || '', nom: l.nom, qte: l.qte, prix: l.prix, unite: l.unite || '', matched: !!l.matched }));
        if (invoiceLines.length === 0) invoiceLines = [freshLine()];
        document.getElementById('f-client').value = d.client || '';
        document.getElementById('f-paye').value = '';
        document.getElementById('f-remise').value = d.remise ? d.remise : '';
        document.getElementById('f-remise-unit').value = 'fcfa';
        document.getElementById('f-tva-mode').value = (d.tvaMode && d.tvaMode !== 'none') ? d.tvaMode : 'none';
        if (d.tvaTaux) document.getElementById('f-tva-taux').value = d.tvaTaux;
        convertingDocId = d.id;
        renderInvoiceLines();
        document.querySelector('[data-tab="ventes"]').click();
        toast(`${docNumLabel(d)} chargé dans Ventes : vérifie, puis clique sur « Finaliser la vente ».`);
      }
    } catch (err) {
      console.error(err);
      toast('Erreur : ' + ((err && err.message) ? err.message : String(err)));
    }
  }

