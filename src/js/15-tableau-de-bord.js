  // ================= Derived metrics =================
  function computeGlobals() {
    const montantInvesti = state.products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.prixAchat) || 0), 0);
    const valeurPotentielle = state.products.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.prixVente) || 0), 0);
    // Bénéfice : seulement les produits qui ont un prix de vente (sinon un produit sans prix compte comme une perte)
    const sansPrix = state.products.filter(p => (Number(p.stock) || 0) > 0 && !(Number(p.prixVente) > 0));
    const beneficePotentiel = state.products.reduce((s, p) => Number(p.prixVente) > 0 ? s + (Number(p.stock) || 0) * (Number(p.prixVente) - (Number(p.prixAchat) || 0)) : s, 0);
    const rupture = state.products.filter(p => Number(p.stock) <= 0).length;
    const reappro = state.products.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.seuil)).length;
    const perte = state.products.filter(p => Number(p.prixVente) > 0 && Number(p.prixAchat) > Number(p.prixVente));
    return { montantInvesti, valeurPotentielle, beneficePotentiel, rupture, reappro, sansPrix, perte };
  }

  // ================= Dashboard =================
  function renderDashboard() {
    try { updateBackupReminder(); } catch (e) {}
    try { bossRender(); } catch (e) { console.error(e); }
    try { smartActionsRender(); } catch (e) { console.error(e); }
    try { belMorningRender(); } catch (e) { console.error(e); }
    const g = computeGlobals();
    document.getElementById('heroInvesti').textContent = euros(g.montantInvesti);
    document.getElementById('heroValeur').textContent = euros(g.valeurPotentielle);
    document.getElementById('heroBenefice').textContent = euros(g.beneficePotentiel);
    heroSansPrixRender(g.sansPrix, g.perte);

    document.getElementById('dbProduits').textContent = state.products.length;
    document.getElementById('dbRupture').textContent = g.rupture;
    document.getElementById('dbReappro').textContent = g.reappro;

    const activeInvoices = state.invoices.filter(i => !i.annulee && !isDette(i));   // ventes seulement (pas les anciennes dettes)
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
      recentBox.innerHTML = recent.map(inv => `<li><span>${numFac(inv)} — ${escapeHtml(inv.client || 'Client')}</span><span class="r">${euros(inv.total)}</span></li>`).join('');
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


  // Alerte : produits en stock sans prix de vente (ils ne sont pas comptés dans le bénéfice)
  function heroSansPrixRender(list, perte) {
    const row = document.getElementById('dashboardHeroRow'); if (!row) return;
    let box = document.getElementById('heroSansPrix');
    list = list || []; perte = perte || [];
    if (!list.length && !perte.length) { if (box) box.style.display = 'none'; return; }
    if (!box) { box = document.createElement('div'); box.id = 'heroSansPrix'; box.className = 'hero-warn'; row.insertAdjacentElement('afterend', box); }
    const noms = (l) => l.slice(0, 3).map(p => escapeHtml(p.nom || '?')).join(', ') + (l.length > 3 ? '…' : '');
    let h = '';
    if (perte.length) h += '<div>🔴 <b>' + perte.length + ' ' + escapeHtml(tr(perte.length > 1 ? 'produits achetés plus cher que leur prix de vente' : 'produit acheté plus cher que son prix de vente')) + '</b> (' + noms(perte) + '). ' + escapeHtml(tr("Prix TOTAL tapé au lieu du prix d'une unité ?")) + ' <button type="button" class="btn-hw" data-hw="perte">✏️ ' + escapeHtml(tr('Corriger')) + '</button></div>';
    if (list.length) h += '<div' + (perte.length ? ' style="margin-top:8px"' : '') + '>⚠️ <b>' + list.length + ' ' + escapeHtml(tr(list.length > 1 ? 'produits sans prix de vente' : 'produit sans prix de vente')) + '</b> (' + noms(list) + ') : ' + escapeHtml(tr('pas comptés dans le bénéfice.')) + ' <button type="button" class="btn-hw" data-hw="prix">✏️ ' + escapeHtml(tr('Mettre le prix')) + '</button></div>';
    box.innerHTML = h; box.style.display = '';
    box.querySelectorAll('.btn-hw').forEach(b => b.onclick = () => { const p0 = (b.dataset.hw === 'perte' ? perte : list)[0]; const t = document.querySelector('nav.tabs button[data-tab="produits"]'); if (t) t.click(); setTimeout(() => { try { startEditProduct(p0.id); } catch (e) { console.error(e); } }, 120); });
  }
