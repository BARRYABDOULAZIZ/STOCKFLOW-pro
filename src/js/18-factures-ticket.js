  // ================= Factures =================
  function renderHistory() {
    const body = document.getElementById('histBody');
    const empty = document.getElementById('histEmpty');
    body.innerHTML = '';
    const flt = (document.getElementById('histFilter') || {}).value || '';
    const list = state.invoices.filter(i => !flt || (flt === 'af' ? isAncienneFacture(i) : flt === 'dette' ? (isDette(i) && !isAncienneFacture(i)) : !isDette(i)));
    empty.textContent = state.invoices.length && !list.length ? 'Aucune facture pour ce filtre.' : 'Aucune facture émise pour l\'instant.';
    if (list.length === 0) { empty.style.display = 'block'; }
    else {
      empty.style.display = 'none';
      // Plus récentes d'abord (les anciennes factures AF-… ont un numéro négatif : on trie par date de saisie)
      list.slice().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0) || (b.num || 0) - (a.num || 0)).forEach(inv => {
        const tr = document.createElement('tr');
        const nbArticles = (inv.lignes || []).reduce((s, l) => s + (Number(l.qte) || 0), 0);
        const annulee = !!inv.annulee;
        const paye = Number(inv.montantPaye) || 0;
        const reste = Math.max(0, Number(inv.total || 0) - paye);
        let statutHtml = '<span class="badge" style="background:var(--good,#16a34a); color:#fff;">Payée</span>';
        if (!annulee) {
          if (paye <= 0) statutHtml = '<span class="badge" style="background:var(--danger); color:#fff;">Non payée</span>';
          else if (reste > 0) statutHtml = '<span class="badge" style="background:#d97706; color:#fff;">Partielle</span>';
        } else {
          statutHtml = '—';
        }
        tr.style.opacity = annulee ? '0.5' : '1';
        tr.innerHTML = `
          <td>${numFac(inv)}${badgeDette(inv)}${annulee ? ' <span class="badge">Annulée</span>' : ''}</td>
          <td class="muted">${escapeHtml(inv.date)}${heureDoc(inv) ? ' <span style="white-space:nowrap;">' + escapeHtml(heureDoc(inv)) + '</span>' : ''}</td>
          <td>${escapeHtml(inv.client || '—')}</td>
          <td class="muted">${escapeHtml(inv.operateur || '—')}</td>
          <td class="num-cell">${nbArticles}</td>
          <td class="num-cell">${euros(inv.total)}</td>
          <td>${statutHtml}</td>
          <td class="num-cell" style="white-space:nowrap;">
            <button class="ghost" data-print="${inv.id}" style="padding:6px 12px; font-size:12px;">Imprimer</button>
            <button class="ghost" data-ticket="${inv.id}" style="padding:6px 12px; font-size:12px; margin-left:6px;">🧾 Ticket</button>
            <button class="ghost" data-wa-ticket="${inv.id}" style="padding:6px 12px; font-size:12px; margin-left:6px;">💬 WhatsApp</button>
            ${(annulee || !(state.currentUser && (state.currentUser.role === 'proprietaire' || state.currentUser.role === 'admin'))) ? '' : `<button class="ghost" data-cancel="${inv.id}" style="padding:6px 12px; font-size:12px; margin-left:6px;">Annuler</button>`}
          </td>
        `;
        body.appendChild(tr);
      });
      body.querySelectorAll('[data-print]').forEach(b => {
        b.addEventListener('click', () => { const inv = state.invoices.find(i => i.id === b.dataset.print); if (inv) printInvoice(inv); });
      });
      body.querySelectorAll('[data-ticket]').forEach(b => {
        b.addEventListener('click', () => { const inv = state.invoices.find(i => i.id === b.dataset.ticket); if (inv) printTicket(inv); });
      });
      body.querySelectorAll('[data-wa-ticket]').forEach(b => {
        b.addEventListener('click', () => { const inv = state.invoices.find(i => i.id === b.dataset.waTicket); if (inv) sendTicketWhatsApp(inv, true); });
      });
      body.querySelectorAll('[data-cancel]').forEach(b => {
        b.addEventListener('click', () => cancelInvoice(b.dataset.cancel));
      });
    }
  }

  { const hf = document.getElementById('histFilter'); if (hf) hf.addEventListener('change', renderHistory); }

  async function cancelInvoice(invId) {
    const inv = state.invoices.find(i => i.id === invId);
    if (!inv || inv.annulee) return;
    const numLabel = numFac(inv);
    const role = state.currentUser && state.currentUser.role;

    // 1. Réservé au propriétaire et à l'admin (vérifié aussi côté base)
    if (role !== 'proprietaire' && role !== 'admin') {
      toast("🔒 Annulation réservée au propriétaire ou à l'admin.");
      logAction('TENTATIVE_ANNULATION', `Tentative d'annulation refusée de la facture ${numLabel}`);
      return;
    }
    // 2. Motif obligatoire
    const reason = prompt(`Motif de l'annulation de la facture ${numLabel} (obligatoire) :`);
    if (!reason || !reason.trim()) { toast('Annulation abandonnée : un motif est requis.'); return; }
    // 3. Confirmation finale
    if (!confirm(`Annuler définitivement la facture ${numLabel} (${euros(inv.total)}) ? ${isDette(inv) ? 'La dette du client sera retirée.' : 'Les quantités seront remises en stock.'}`)) return;
    if (!supabaseClient) { toast('Connexion non disponible.'); return; }
    if (!needOnline('annuler une facture')) return;

    try {
      // Annulation + remise en stock + journal, en une seule opération côté base
      const { data, error } = await supabaseClient.rpc('cancel_invoice', { p_invoice_id: inv.id, p_reason: reason.trim() });
      if (error) throw new Error(error.message);
      if (state.db && state.db.refresh) state.db.refresh('produits', 'factures', 'paiements', 'mouvements');
      // Historique des mouvements de stock (la base renvoie les nouveaux stocks)
      for (const r of (data || [])) {
        const prod = state.products.find(p => p.id === r.productId);
        if (!prod) continue;
        try {
          await logMovement({ productId: r.productId, ref: prod.ref, nom: prod.nom, quantite: r.qte, ancienStock: r.nouveauStock - r.qte, nouveauStock: r.nouveauStock, unite: prod.unite || 'unité', source: 'annulation', note: numLabel });
        } catch (e3) { console.error(e3); }
      }
      toast(`Facture ${numLabel} annulée — stock restauré.`);
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'annulation : " + (err.message || ''));
    }
  }

  // ================= Ticket de caisse (imprimante thermique 58 / 80 mm) =================
  (function () {
    const auto = document.getElementById('tkAuto'), wsel = document.getElementById('tkWidth');
    try { if (auto) auto.checked = localStorage.getItem('sf_ticket_auto') === '1'; if (wsel && localStorage.getItem('sf_ticket_w')) wsel.value = localStorage.getItem('sf_ticket_w'); } catch (e) {}
    if (auto) auto.addEventListener('change', () => { try { localStorage.setItem('sf_ticket_auto', auto.checked ? '1' : '0'); } catch (e) {} });
    const wa = document.getElementById('tkWa');
    try { if (wa) wa.checked = localStorage.getItem('sf_ticket_wa') === '1'; } catch (e) {}
    if (wa) wa.addEventListener('change', () => { try { localStorage.setItem('sf_ticket_wa', wa.checked ? '1' : '0'); } catch (e) {} });
    if (wsel) wsel.addEventListener('change', () => { try { localStorage.setItem('sf_ticket_w', wsel.value); } catch (e) {} });
  })();

