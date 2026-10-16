  // ================= Rapports =================
  function applyRpPreset(preset) {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    let du, au = todayStr();
    if (preset === 'today') { du = todayStr(); }
    else if (preset === '7j') { const d = new Date(today); d.setDate(d.getDate() - 6); du = iso(d); }
    else if (preset === 'mois') { du = iso(new Date(today.getFullYear(), today.getMonth(), 1)); }
    else if (preset === 'tout') { du = '2000-01-01'; }
    document.getElementById('rp-du').value = du;
    document.getElementById('rp-au').value = au;
    document.querySelectorAll('.rp-preset').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
    renderRapports();
  }
  document.querySelectorAll('.rp-preset').forEach(b => b.addEventListener('click', () => applyRpPreset(b.dataset.preset)));
  document.getElementById('rp-du').addEventListener('change', () => { document.querySelectorAll('.rp-preset').forEach(b => b.classList.remove('active')); renderRapports(); });
  document.getElementById('rp-au').addEventListener('change', () => { document.querySelectorAll('.rp-preset').forEach(b => b.classList.remove('active')); renderRapports(); });

  function facturesPeriode() {
    const du = document.getElementById('rp-du').value || '2000-01-01';
    const au = document.getElementById('rp-au').value || todayStr();
    return state.invoices.filter(i => !i.annulee && i.date >= du && i.date <= au);
  }

  function renderRapports() {
    const factures = facturesPeriode();
    const ca = factures.reduce((s, i) => s + htOf(i), 0);
    const tvaCollectee = factures.reduce((s, i) => s + (Number(i.tvaMontant) || 0), 0);
    const remisesTotal = factures.reduce((s, i) => s + (Number(i.remise) || 0), 0);
    const resteDu = factures.reduce((s, i) => s + Math.max(0, (Number(i.total) || 0) - (Number(i.montantPaye) || 0)), 0);

    let benefice = 0;
    const parProduit = {}; // nom -> { qte, ca }
    factures.forEach(inv => (inv.lignes || []).forEach(l => {
      const qte = Number(l.qte) || 0;
      const ligneCa = (Number(l.prix) || 0) * qte;
      const prod = l.productId ? state.products.find(p => p.id === l.productId) : null;
      if (prod) benefice += ((Number(l.prix) || 0) - (Number(prod.prixAchat) || 0)) * qte;
      const key = l.nom || '—';
      if (!parProduit[key]) parProduit[key] = { qte: 0, ca: 0 };
      parProduit[key].qte += qte;
      parProduit[key].ca += ligneCa;
    }));

    document.getElementById('rpVentes').textContent = factures.length;
    // Bénéfice : on retire les remises et la TVA (qui n'est pas un gain pour le commerce)
    factures.forEach(inv => { const lineSum = (inv.lignes || []).reduce((s, l) => s + (Number(l.prix) || 0) * (Number(l.qte) || 0), 0); if (inv.remise || inv.tvaMontant) benefice += htOf(inv) - lineSum; });
    document.getElementById('rpCa').textContent = euros(ca);
    document.getElementById('rpTva').textContent = euros(tvaCollectee);
    document.getElementById('rpRemises').textContent = euros(remisesTotal);
    document.getElementById('rpBenefice').textContent = euros(benefice);
    document.getElementById('rpResteDu').textContent = euros(resteDu);

    const top = Object.entries(parProduit).sort((a, b) => b[1].qte - a[1].qte).slice(0, 10);
    const topBody = document.getElementById('rpTopBody');
    const topEmpty = document.getElementById('rpTopEmpty');
    if (top.length === 0) { topBody.innerHTML = ''; topEmpty.style.display = 'block'; }
    else {
      topEmpty.style.display = 'none';
      topBody.innerHTML = top.map(([nom, v]) => `<tr><td>${escapeHtml(nom)}</td><td class="num-cell">${v.qte}</td><td class="num-cell">${euros(v.ca)}</td></tr>`).join('');
    }

    const fBody = document.getElementById('rpFacturesBody');
    const fEmpty = document.getElementById('rpFacturesEmpty');
    if (factures.length === 0) { fBody.innerHTML = ''; fEmpty.style.display = 'block'; }
    else {
      fEmpty.style.display = 'none';
      fBody.innerHTML = factures.slice().sort((a, b) => (b.num || 0) - (a.num || 0)).map(inv => {
        const paye = Number(inv.montantPaye) || 0;
        const reste = Math.max(0, (Number(inv.total) || 0) - paye);
        let statut = '<span class="badge" style="background:var(--good,#16a34a); color:#fff;">Payée</span>';
        if (paye <= 0) statut = '<span class="badge" style="background:var(--danger); color:#fff;">Non payée</span>';
        else if (reste > 0) statut = '<span class="badge" style="background:#d97706; color:#fff;">Partielle</span>';
        return `<tr><td>FAC-${String(inv.num).padStart(4, '0')}</td><td class="muted">${escapeHtml(inv.date || '')}</td><td>${escapeHtml(inv.client || '—')}</td><td class="num-cell">${euros(inv.total)}</td><td>${statut}</td></tr>`;
      }).join('');
    }
  }

  document.getElementById('btnExportRapport').addEventListener('click', async () => {
    toast('Préparation du rapport…');
    try {
      await loadXlsx();
      const factures = facturesPeriode();
      const du = document.getElementById('rp-du').value;
      const au = document.getElementById('rp-au').value;
      const wb = window.XLSX.utils.book_new();

      const ca = factures.reduce((s, i) => s + htOf(i), 0);
      const resteDu = factures.reduce((s, i) => s + Math.max(0, (Number(i.total) || 0) - (Number(i.montantPaye) || 0)), 0);
      const wsResume = window.XLSX.utils.json_to_sheet([{
        'Période': `${du} au ${au}`, 'Nombre de ventes': factures.length, "Chiffre d'affaires": ca, 'Reste dû': resteDu,
      }]);
      window.XLSX.utils.book_append_sheet(wb, wsResume, 'Résumé');

      const lignes = [];
      factures.forEach(inv => (inv.lignes || []).forEach(l => {
        lignes.push({ Facture: 'FAC-' + String(inv.num).padStart(4, '0'), Date: inv.date, Client: inv.client || '', Référence: l.ref || '', Désignation: l.nom, Quantité: l.qte, Unité: l.unite || '', 'Prix unitaire': l.prix, 'Total ligne': (Number(l.prix) || 0) * (Number(l.qte) || 0) });
      }));
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(lignes), 'Ventes détaillées');

      const arrayBuf = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([arrayBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const ok = await saveFile(`rapport-boromboutik-${du}-au-${au}.xlsx`, blob);
      if (ok) toast('Rapport prêt.');
    } catch (err) {
      console.error(err);
      toast('Impossible de générer le rapport.');
    }
  });

