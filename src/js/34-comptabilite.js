  // ================= Comptabilité =================
  function applyCpPreset(preset) {
    const today = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    let du, au = todayStr();
    if (preset === '7j') { const d = new Date(today); d.setDate(d.getDate() - 6); du = iso(d); }
    else if (preset === 'mois') { du = iso(new Date(today.getFullYear(), today.getMonth(), 1)); }
    else if (preset === 'tout') { du = '2000-01-01'; }
    document.getElementById('cp-du').value = du;
    document.getElementById('cp-au').value = au;
    document.querySelectorAll('.cp-preset').forEach(b => b.classList.toggle('active', b.dataset.preset === preset));
    renderComptabilite();
  }
  document.querySelectorAll('.cp-preset').forEach(b => b.addEventListener('click', () => applyCpPreset(b.dataset.preset)));
  document.getElementById('cp-du').addEventListener('change', () => { document.querySelectorAll('.cp-preset').forEach(b => b.classList.remove('active')); renderComptabilite(); });
  document.getElementById('cp-au').addEventListener('change', () => { document.querySelectorAll('.cp-preset').forEach(b => b.classList.remove('active')); renderComptabilite(); });

  function depensesPeriode() {
    const du = document.getElementById('cp-du').value || '2000-01-01';
    const au = document.getElementById('cp-au').value || todayStr();
    return (state.depenses || []).filter(d => d.date >= du && d.date <= au);
  }

  function renderComptabilite() {
    if (!document.getElementById('cp-du').value) return; // pas encore initialisé
    const du = document.getElementById('cp-du').value;
    const au = document.getElementById('cp-au').value;
    const factures = state.invoices.filter(i => !i.annulee && i.date >= du && i.date <= au);
    const ca = factures.reduce((s, i) => s + htOf(i), 0);

    let cogs = 0;
    factures.forEach(inv => (inv.lignes || []).forEach(l => {
      const prod = l.productId ? state.products.find(p => p.id === l.productId) : null;
      if (prod) cogs += (Number(prod.prixAchat) || 0) * (Number(l.qte) || 0);
    }));

    const depenses = depensesPeriode();
    const totalDepenses = depenses.reduce((s, d) => s + (Number(d.montant) || 0), 0);

    const pertes = (state.movements || []).filter(m => m.source === 'perte' && m.date >= du && m.date <= au);
    const valeurPertes = pertes.reduce((s, m) => {
      const prod = m.productId ? state.products.find(p => p.id === m.productId) : null;
      return s + (prod ? (Number(prod.prixAchat) || 0) * (Number(m.quantite) || 0) : 0);
    }, 0);

    const net = ca - cogs - totalDepenses - valeurPertes;

    document.getElementById('cpCa').textContent = euros(ca);
    document.getElementById('cpCogs').textContent = euros(cogs);
    document.getElementById('cpDepenses').textContent = euros(totalDepenses);
    document.getElementById('cpPertes').textContent = euros(valeurPertes);
    document.getElementById('cpNet').textContent = euros(net);

    const parCateg = {};
    depenses.forEach(d => { parCateg[d.categorie || 'Autre'] = (parCateg[d.categorie || 'Autre'] || 0) + (Number(d.montant) || 0); });
    const categBody = document.getElementById('cpCategBody');
    const categEmpty = document.getElementById('cpCategEmpty');
    const categEntries = Object.entries(parCateg).sort((a, b) => b[1] - a[1]);
    if (categEntries.length === 0) { categBody.innerHTML = ''; categEmpty.style.display = 'block'; }
    else { categEmpty.style.display = 'none'; categBody.innerHTML = categEntries.map(([cat, mt]) => `<tr><td>${escapeHtml(cat)}</td><td class="num-cell">${euros(mt)}</td></tr>`).join(''); }

    const depBody = document.getElementById('cpDepBody');
    const depEmpty = document.getElementById('cpDepEmpty');
    if (depenses.length === 0) { depBody.innerHTML = ''; depEmpty.style.display = 'block'; }
    else {
      depEmpty.style.display = 'none';
      depBody.innerHTML = depenses.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(d => `
        <tr>
          <td class="muted">${escapeHtml(d.date || '')}</td>
          <td>${escapeHtml(d.categorie || '')}</td>
          <td class="muted">${escapeHtml(d.note || '—')}</td>
          <td class="num-cell">${euros(d.montant)}</td>
          <td class="num-cell"><button class="icon-btn" data-del-dep="${d.id}" title="Supprimer">✕</button></td>
        </tr>`).join('');
      depBody.querySelectorAll('[data-del-dep]').forEach(b => b.addEventListener('click', () => deleteDepense(b.dataset.delDep)));
    }
  }

  document.getElementById('btnAddDepense').addEventListener('click', async () => {
    const categorie = document.getElementById('dp-categorie').value;
    const montant = Number(document.getElementById('dp-montant').value) || 0;
    const date = document.getElementById('dp-date').value || todayStr();
    const note = document.getElementById('dp-note').value.trim();
    if (montant <= 0) { toast('Le montant doit être supérieur à 0.'); return; }
    if (!state.db) { toast('Connexion non disponible.'); return; }
    try {
      const id = 'dp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      await state.db.doc('depenses/' + id).set({ categorie, montant, date, note, operateur: state.currentUser ? state.currentUser.nom : '', createdAt: Date.now() });
      document.getElementById('dp-montant').value = '0';
      document.getElementById('dp-note').value = '';
      toast('Dépense enregistrée.');
    } catch (err) {
      console.error(err);
      toast('Erreur : ' + (err.message || err));
    }
  });

  async function deleteDepense(id) {
    if (!state.db) return;
    if (!confirm('Supprimer cette dépense ?')) return;
    try {
      await state.db.doc('depenses/' + id).delete();
      toast('Dépense supprimée.');
    } catch (err) { console.error(err); toast('Erreur lors de la suppression.'); }
  }

