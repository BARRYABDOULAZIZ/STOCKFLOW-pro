  // ================= Clients / Paiements =================
  let editingClientId = null;
  let selectedClientId = null;

  function clientStats(clientId) {
    const factures = state.invoices.filter(i => i.clientId === clientId && !i.annulee);
    const totalFacture = factures.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalPaye = factures.reduce((s, i) => s + (Number(i.montantPaye) || 0), 0);
    const reste = totalFacture - totalPaye;
    return { totalFacture, totalPaye, reste, factures };
  }

  function renderClients() {
    const body = document.getElementById('clBody');
    const empty = document.getElementById('clEmpty');
    body.innerHTML = '';

    let detteTotale = 0, avecDette = 0;

    if (state.clients.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      state.clients.slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || '')).forEach(c => {
        const { totalFacture, reste } = clientStats(c.id);
        if (reste > 0) { detteTotale += reste; avecDette++; }
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(c.nom)}</td>
          <td class="muted">${escapeHtml(c.telephone || '—')}</td>
          <td class="num-cell">${euros(totalFacture)}</td>
          <td class="num-cell ${reste > 0 ? 'margin-neg' : 'margin-pos'}">${euros(reste)}</td>
          <td class="num-cell" style="white-space:nowrap;">
            <button class="ghost" data-view-cl="${c.id}" style="padding:6px 10px; font-size:12px;">Voir</button>
            <button class="icon-btn" data-edit-cl="${c.id}" title="Modifier" style="opacity:0.6;">✎</button>
            <button class="icon-btn" data-del-cl="${c.id}" title="Supprimer">✕</button>
          </td>
        `;
        body.appendChild(tr);
      });
    }

    document.getElementById('clCount').textContent = state.clients.length;
    document.getElementById('clDetteTotale').textContent = euros(detteTotale);
    document.getElementById('clAvecDette').textContent = avecDette;

    body.querySelectorAll('[data-view-cl]').forEach(b => b.addEventListener('click', () => openClientDetail(b.dataset.viewCl)));
    body.querySelectorAll('[data-edit-cl]').forEach(b => b.addEventListener('click', () => startEditClient(b.dataset.editCl)));
    body.querySelectorAll('[data-del-cl]').forEach(b => b.addEventListener('click', () => deleteClient(b.dataset.delCl)));

    if (selectedClientId) renderClientDetail();
  }

  function resetClientForm() {
    editingClientId = null;
    ['cl-nom', 'cl-tel', 'cl-adresse'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('clFormTitle').textContent = 'Ajouter un client';
    document.getElementById('btnAddClient').textContent = 'Ajouter le client';
    document.getElementById('btnCancelClEdit').style.display = 'none';
  }

  function startEditClient(id) {
    const c = state.clients.find(x => x.id === id);
    if (!c) return;
    editingClientId = id;
    document.getElementById('cl-nom').value = c.nom || '';
    document.getElementById('cl-tel').value = c.telephone || '';
    document.getElementById('cl-adresse').value = c.adresse || '';
    document.getElementById('clFormTitle').textContent = `Modifier "${c.nom}"`;
    document.getElementById('btnAddClient').textContent = 'Enregistrer les modifications';
    document.getElementById('btnCancelClEdit').style.display = 'inline-block';
    document.querySelector('#panel-clients .card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.getElementById('btnCancelClEdit').addEventListener('click', resetClientForm);

  document.getElementById('btnAddClient').addEventListener('click', async () => {
    const nom = document.getElementById('cl-nom').value.trim();
    const telephone = document.getElementById('cl-tel').value.trim();
    const adresse = document.getElementById('cl-adresse').value.trim();
    if (!nom) { toast('Le nom du client est obligatoire.'); return; }
    if (!state.db) { toast('Connexion non disponible.'); return; }

    try {
      if (editingClientId) {
        await state.db.doc('clients/' + editingClientId).update({ nom, telephone, adresse });
        toast(`"${nom}" mis à jour.`);
      } else {
        const id = 'cl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
        await state.db.doc('clients/' + id).set({ nom, telephone, adresse, createdAt: Date.now() });
        toast('Client ajouté.');
      }
      resetClientForm();
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'opération.");
    }
  });

  async function deleteClient(id) {
    if (!state.db) return;
    const c = state.clients.find(x => x.id === id);
    if (!confirm(`Supprimer le client "${c ? c.nom : ''}" ? Son historique de factures restera enregistré mais ne sera plus rattaché.`)) return;
    try {
      await state.db.doc('clients/' + id).delete();
      if (selectedClientId === id) { selectedClientId = null; document.getElementById('clDetailCard').style.display = 'none'; }
      if (editingClientId === id) resetClientForm();
      toast('Client supprimé.');
    } catch (err) { console.error(err); toast('Erreur lors de la suppression.'); }
  }

  function openClientDetail(id) {
    selectedClientId = id;
    document.getElementById('clDetailCard').style.display = 'block';
    renderClientDetail();
    document.getElementById('clDetailCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.getElementById('btnCloseClDetail').addEventListener('click', () => {
    selectedClientId = null;
    document.getElementById('clDetailCard').style.display = 'none';
  });

  function renderClientDetail() {
    const c = state.clients.find(x => x.id === selectedClientId);
    if (!c) { document.getElementById('clDetailCard').style.display = 'none'; return; }

    document.getElementById('cld-nom').textContent = c.nom;
    document.getElementById('cld-tel').textContent = c.telephone || '—';
    document.getElementById('cld-adresse').textContent = c.adresse || '—';

    const { totalFacture, totalPaye, reste, factures } = clientStats(c.id);
    document.getElementById('cld-facture').textContent = euros(totalFacture);
    document.getElementById('cld-paye').textContent = euros(totalPaye);
    document.getElementById('cld-reste').textContent = euros(reste);

    // Sélecteur de facture pour le paiement — seulement celles avec un reste à payer
    const select = document.getElementById('cld-facture-select');
    const withBalance = factures.filter(i => (Number(i.total) || 0) - (Number(i.montantPaye) || 0) > 0);
    select.innerHTML = withBalance.length === 0
      ? '<option value="">Aucune facture avec un solde dû</option>'
      : withBalance.slice().sort((a, b) => (b.num || 0) - (a.num || 0)).map(i => {
          const r = (Number(i.total) || 0) - (Number(i.montantPaye) || 0);
          return `<option value="${i.id}">FAC-${String(i.num).padStart(4, '0')} — reste ${euros(r)}</option>`;
        }).join('');

    // Liste des factures
    const fBody = document.getElementById('cld-factures');
    const fEmpty = document.getElementById('cld-factures-empty');
    if (factures.length === 0) { fBody.innerHTML = ''; fEmpty.style.display = 'block'; }
    else {
      fEmpty.style.display = 'none';
      fBody.innerHTML = factures.slice().sort((a, b) => (b.num || 0) - (a.num || 0)).map(i => {
        const p = Number(i.montantPaye) || 0;
        const r = (Number(i.total) || 0) - p;
        return `<tr><td>FAC-${String(i.num).padStart(4, '0')}</td><td class="muted">${escapeHtml(i.date || '')}</td><td class="num-cell">${euros(i.total)}</td><td class="num-cell">${euros(p)}</td><td class="num-cell ${r > 0 ? 'margin-neg' : 'margin-pos'}">${euros(r)}</td></tr>`;
      }).join('');
    }

    // Historique des paiements
    const payments = state.paiements.filter(p => p.clientId === c.id);
    const pBody = document.getElementById('cld-paiements');
    const pEmpty = document.getElementById('cld-paiements-empty');
    if (payments.length === 0) { pBody.innerHTML = ''; pEmpty.style.display = 'block'; }
    else {
      pEmpty.style.display = 'none';
      pBody.innerHTML = payments.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map(p => {
        const inv = state.invoices.find(i => i.id === p.factureId);
        return `<tr><td class="muted">${escapeHtml(p.date || '')}</td><td>${inv ? 'FAC-' + String(inv.num).padStart(4, '0') : '—'}</td><td class="num-cell">${euros(p.montant)}</td><td class="muted">${escapeHtml(p.mode || '')}</td></tr>`;
      }).join('');
    }

    document.getElementById('cld-date').value = document.getElementById('cld-date').value || todayStr();
  }

  document.getElementById('btnAddPaiement').addEventListener('click', async () => {
    if (!selectedClientId) return;
    const c = state.clients.find(x => x.id === selectedClientId);
    if (!c) return;
    const factureId = document.getElementById('cld-facture-select').value;
    const montant = Number(document.getElementById('cld-montant').value) || 0;
    const mode = document.getElementById('cld-mode').value;
    const date = document.getElementById('cld-date').value || todayStr();

    if (!factureId) { toast('Choisis la facture concernée par ce paiement.'); return; }
    if (montant <= 0) { toast('Le montant doit être supérieur à 0.'); return; }
    if (!state.db) { toast('Connexion non disponible.'); return; }

    const inv = state.invoices.find(i => i.id === factureId);
    if (!inv) { toast('Facture introuvable.'); return; }
    const nouveauPaye = (Number(inv.montantPaye) || 0) + montant;

    try {
      const id = 'pa-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      await state.db.doc('paiements/' + id).set({ factureId, clientId: c.id, montant, mode, date, operateur: state.currentUser ? state.currentUser.nom : '', createdAt: Date.now() });
      await state.db.doc('factures/' + factureId).update({ montantPaye: nouveauPaye });
      document.getElementById('cld-montant').value = '0';
      toast('Paiement enregistré.');
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'enregistrement : " + (err.message || err));
    }
  });

