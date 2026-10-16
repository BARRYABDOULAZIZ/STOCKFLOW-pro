  // ================= Derived metrics =================
  function computeGlobals() {
    const montantInvesti = state.products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.prixAchat) || 0), 0);
    const valeurPotentielle = state.products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.prixVente) || 0), 0);
    const beneficePotentiel = valeurPotentielle - montantInvesti;
    const rupture = state.products.filter(p => Number(p.stock) <= 0).length;
    const reappro = state.products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.seuil)).length;
    return { montantInvesti, valeurPotentielle, beneficePotentiel, rupture, reappro };
  }

  // ================= Dashboard =================
  function renderDashboard() {
    try { updateBackupReminder(); } catch (e) {}
    try { bossRender(); } catch (e) { console.error(e); }
    const g = computeGlobals();
    document.getElementById('heroInvesti').textContent = euros(g.montantInvesti);
    document.getElementById('heroValeur').textContent = euros(g.valeurPotentielle);
    document.getElementById('heroBenefice').textContent = euros(g.beneficePotentiel);

    document.getElementById('dbProduits').textContent = state.products.length;
    document.getElementById('dbRupture').textContent = g.rupture;
    document.getElementById('dbReappro').textContent = g.reappro;

    const activeInvoices = state.invoices.filter(i => !i.annulee);
    const today = todayStr();
    const ym = today.slice(0, 7);
    const ventesJour = activeInvoices.filter(i => i.date === today).reduce((s, i) => s + (Number(i.total) || 0), 0);
    const ventesMois = activeInvoices.filter(i => (i.date || '').slice(0, 7) === ym).reduce((s, i) => s + (Number(i.total) || 0), 0);
    document.getElementById('dbVentesJour').textContent = euros(ventesJour);
    document.getElementById('dbVentesMois').textContent = euros(ventesMois);

    // Statistiques
    document.getElementById('statTotalValue').textContent = euros(g.valeurPotentielle);
    document.getElementById('statTotalProfit').textContent = euros(g.beneficePotentiel);

    // Produit le plus rentable (marge potentielle totale = (prixVente-prixAchat)*stock)
    let topMargin = null, topMarginVal = -Infinity;
    state.products.forEach(p => {
      const marge = ((Number(p.prixVente) || 0) - (Number(p.prixAchat) || 0)) * (Number(p.stock) || 0);
      if (marge > topMarginVal) { topMarginVal = marge; topMargin = p; }
    });
    if (topMargin && state.products.length) {
      document.getElementById('statTopMargin').textContent = topMargin.nom;
      document.getElementById('statTopMarginSub').textContent = `Marge potentielle : ${euros(topMarginVal)}`;
    } else {
      document.getElementById('statTopMargin').textContent = '–';
      document.getElementById('statTopMarginSub').textContent = '';
    }

    // Produit le plus vendu (somme des quantités dans les factures, groupé par nom) — factures annulées exclues
    const soldMap = {};
    activeInvoices.forEach(inv => (inv.lignes || []).forEach(l => {
      const key = l.nom || l.ref || '—';
      soldMap[key] = (soldMap[key] || 0) + (Number(l.qte) || 0);
    }));
    let topSoldName = null, topSoldQty = -Infinity;
    Object.entries(soldMap).forEach(([k, v]) => { if (v > topSoldQty) { topSoldQty = v; topSoldName = k; } });
    if (topSoldName) {
      document.getElementById('statTopSold').textContent = topSoldName;
      document.getElementById('statTopSoldSub').textContent = `${topSoldQty} unités vendues au total`;
    } else {
      document.getElementById('statTopSold').textContent = '–';
      document.getElementById('statTopSoldSub').textContent = '';
    }

    // Dernières factures (les annulées restent visibles ici, avec mention)
    const recentBox = document.getElementById('dbRecentInvoices');
    const recentEmpty = document.getElementById('dbRecentEmpty');
    const recent = state.invoices.slice().sort((a, b) => (b.num || 0) - (a.num || 0)).slice(0, 6);
    if (recent.length === 0) { recentBox.innerHTML = ''; recentEmpty.style.display = 'block'; }
    else {
      recentEmpty.style.display = 'none';
      recentBox.innerHTML = recent.map(inv => `<li><span>FAC-${String(inv.num).padStart(4,'0')} — ${escapeHtml(inv.client || 'Client')}</span><span class="r">${euros(inv.total)}</span></li>`).join('');
    }

    // Stock à surveiller
    const lowBox = document.getElementById('dbLowStock');
    const lowEmpty = document.getElementById('dbLowStockEmpty');
    const low = state.products.filter(p => Number(p.stock) <= Number(p.seuil)).sort((a,b) => Number(a.stock) - Number(b.stock)).slice(0, 8);
    if (low.length === 0) { lowBox.innerHTML = ''; lowEmpty.style.display = 'block'; }
    else {
      lowEmpty.style.display = 'none';
      lowBox.innerHTML = low.map(p => {
        const tag = Number(p.stock) <= 0 ? 'Rupture' : 'Réappro nécessaire';
        const fs = state.fournisseurs.find(f => (f.nom || '').trim().toLowerCase() === (p.fournisseur || '').trim().toLowerCase());
        const waUrl = fs && fs.telephone ? getWhatsAppLink(fs.telephone, p.nom, p.ref) : null;
        const waBtn = waUrl ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; margin-left:8px; font-size:13px;" title="Commander sur WhatsApp">💬</a>` : '';
        return `<li><span>${escapeHtml(p.nom)}${waBtn}</span><span class="r">${p.stock} ${escapeHtml(p.unite || 'unité')} · ${tag}</span></li>`;
      }).join('');
    }    if (typeof renderInsights === 'function') renderInsights();
  }

