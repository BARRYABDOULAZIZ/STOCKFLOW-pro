  // ================= Caisse (encaissements par mode de paiement) =================
  const CAISSE_MODES = ['Espèces', 'Mobile Money', 'Virement', 'Chèque'];

  function applyCaissePreset(preset) {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    let du = todayStr(), au = todayStr();
    if (preset === '7j') { const d = new Date(today); d.setDate(d.getDate() - 6); du = iso(d); }
    else if (preset === 'mois') { du = iso(new Date(today.getFullYear(), today.getMonth(), 1)); }
    document.getElementById('cs-du').value = du;
    document.getElementById('cs-au').value = au;
    document.querySelectorAll('.cs-preset').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
    renderCaisse();
  }
  document.querySelectorAll('.cs-preset').forEach(b => b.addEventListener('click', () => applyCaissePreset(b.dataset.preset)));
  ['cs-du', 'cs-au'].forEach(id => document.getElementById(id).addEventListener('change', () => {
    document.querySelectorAll('.cs-preset').forEach(b => b.classList.remove('active'));
    renderCaisse();
  }));
  document.getElementById('cs-mode-filter').addEventListener('change', renderCaisse);

  // Paiements de la période, sans ceux des factures annulées
  function caissePaiements() {
    const du = document.getElementById('cs-du').value || '2000-01-01';
    const au = document.getElementById('cs-au').value || todayStr();
    const byId = {};
    state.invoices.forEach(i => { byId[i.id] = i; });
    return (state.paiements || []).filter(p => {
      const inv = byId[p.factureId];
      if (inv && inv.annulee) return false;
      return p.date >= du && p.date <= au;
    });
  }

  function renderCaisse() {
    if (!document.getElementById('cs-du') || !document.getElementById('cs-du').value) return;
    if (!document.getElementById('panel-caisse').classList.contains('active')) return;
    if (typeof renderCloture === 'function') renderCloture();
    const list = caissePaiements();

    const totals = { 'Espèces': 0, 'Mobile Money': 0, 'Virement': 0, 'Chèque': 0 };
    let autre = 0, total = 0;
    const vendeurs = {};
    list.forEach(p => {
      const a = Number(p.montant) || 0;
      total += a;
      if (p.mode in totals) totals[p.mode] += a; else autre += a;
      const v = p.operateur || '—';
      if (!vendeurs[v]) vendeurs[v] = { esp: 0, autres: 0 };
      if (p.mode === 'Espèces') vendeurs[v].esp += a; else vendeurs[v].autres += a;
    });

    document.getElementById('csEsp').textContent = euros(totals['Espèces']);
    document.getElementById('csMobile').textContent = euros(totals['Mobile Money']);
    document.getElementById('csVirement').textContent = euros(totals['Virement']);
    document.getElementById('csCheque').textContent = euros(totals['Chèque']);
    document.getElementById('csTotal').textContent = euros(total);

    const du = document.getElementById('cs-du').value || '2000-01-01';
    const au = document.getElementById('cs-au').value || todayStr();
    const depenses = (state.depenses || []).filter(d => d.date >= du && d.date <= au).reduce((s, d) => s + (Number(d.montant) || 0), 0);
    document.getElementById('csHint').textContent =
      `Espèces encaissées : ${euros(totals['Espèces'])} − dépenses de la période : ${euros(depenses)} = ${euros(totals['Espèces'] - depenses)} d'espèces attendues en caisse (estimation, si les dépenses ont été payées en espèces).` +
      (autre ? ` Autres modes non classés : ${euros(autre)}.` : '') +
      ` Les ventes faites avant la mise en place de la caisse n'apparaissent pas ici.`;

    document.getElementById('csVendeurs').innerHTML = Object.entries(vendeurs)
      .sort((a, b) => (b[1].esp + b[1].autres) - (a[1].esp + a[1].autres))
      .map(([nom, v]) => `<tr><td>${escapeHtml(nom)}</td><td class="num-cell">${euros(v.esp)}</td><td class="num-cell">${euros(v.autres)}</td><td class="num-cell">${euros(v.esp + v.autres)}</td></tr>`)
      .join('') || '<tr><td colspan="4" class="muted">Aucun paiement.</td></tr>';

    const modeFilter = document.getElementById('cs-mode-filter').value;
    const invById = {};
    state.invoices.forEach(i => { invById[i.id] = i; });
    const rows = list
      .filter(p => !modeFilter || p.mode === modeFilter)
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    document.getElementById('csEmpty').style.display = rows.length ? 'none' : 'block';
    document.getElementById('csPaiements').innerHTML = rows.map(p => {
      const inv = invById[p.factureId];
      const cl = state.clients.find(c => c.id === p.clientId);
      const clientNom = cl ? cl.nom : ((inv && inv.client) || 'Client de passage');
      return `<tr>
        <td>${escapeHtml(p.date || '')}</td>
        <td>${inv ? 'FAC-' + String(inv.num).padStart(4, '0') : '—'}</td>
        <td>${escapeHtml(clientNom)}</td>
        <td>${escapeHtml(p.mode || '—')}</td>
        <td class="num-cell">${euros(p.montant)}</td>
        <td>${escapeHtml(p.operateur || '—')}</td>
      </tr>`;
    }).join('');
  }

