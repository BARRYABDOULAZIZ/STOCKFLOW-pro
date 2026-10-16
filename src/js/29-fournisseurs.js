  // ================= Fournisseurs =================
  let editingFournisseurId = null;
  let selectedFournisseurId = null;

  function supplierStats(supplierId) {
    const orders = state.commandes.filter(o => o.fournisseurId === supplierId);
    const totalCommande = orders.reduce((s, o) => s + (Number(o.montantCommande) || 0), 0);
    const totalPaye = orders.reduce((s, o) => s + (Number(o.montantPaye) || 0), 0);
    const dette = totalCommande - totalPaye;
    const derniere = orders.reduce((max, o) => (!max || (o.date || '') > max) ? o.date : max, null);
    return { totalCommande, totalPaye, dette, derniere, orders };
  }

  function renderFournisseurs() {
    const body = document.getElementById('fsBody');
    const empty = document.getElementById('fsEmpty');
    body.innerHTML = '';

    let detteTotale = 0, avecDette = 0;

    if (state.fournisseurs.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      state.fournisseurs.slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || '')).forEach(f => {
        const { dette, derniere } = supplierStats(f.id);
        if (dette > 0) { detteTotale += dette; avecDette++; }
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(f.nom)}</td>
          <td class="muted">${escapeHtml(f.telephone || '—')}</td>
          <td class="muted">${escapeHtml(f.email || '—')}</td>
          <td class="num-cell ${dette > 0 ? 'margin-neg' : 'margin-pos'}">${euros(dette)}</td>
          <td class="muted">${derniere ? escapeHtml(derniere) : '—'}</td>
          <td class="num-cell" style="white-space:nowrap;">
            <button class="ghost" data-view-fs="${f.id}" style="padding:6px 10px; font-size:12px;">Voir</button>
            <button class="icon-btn" data-edit-fs="${f.id}" title="Modifier" style="opacity:0.6;">✎</button>
            <button class="icon-btn" data-del-fs="${f.id}" title="Supprimer">✕</button>
          </td>
        `;
        body.appendChild(tr);
      });
    }

    document.getElementById('fsCount').textContent = state.fournisseurs.length;
    document.getElementById('fsDetteTotale').textContent = euros(detteTotale);
    document.getElementById('fsAvecDette').textContent = avecDette;

    body.querySelectorAll('[data-view-fs]').forEach(b => b.addEventListener('click', () => openFournisseurDetail(b.dataset.viewFs)));
    body.querySelectorAll('[data-edit-fs]').forEach(b => b.addEventListener('click', () => startEditFournisseur(b.dataset.editFs)));
    body.querySelectorAll('[data-del-fs]').forEach(b => b.addEventListener('click', () => deleteFournisseur(b.dataset.delFs)));

    if (selectedFournisseurId) renderFournisseurDetail();
  }

  function resetFournisseurForm() {
    editingFournisseurId = null;
    ['fs-nom','fs-tel','fs-email','fs-adresse'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('fsFormTitle').textContent = 'Ajouter un fournisseur';
    document.getElementById('btnAddFournisseur').textContent = 'Ajouter le fournisseur';
    document.getElementById('btnCancelFsEdit').style.display = 'none';
  }

  function startEditFournisseur(id) {
    const f = state.fournisseurs.find(x => x.id === id);
    if (!f) return;
    editingFournisseurId = id;
    document.getElementById('fs-nom').value = f.nom || '';
    document.getElementById('fs-tel').value = f.telephone || '';
    document.getElementById('fs-email').value = f.email || '';
    document.getElementById('fs-adresse').value = f.adresse || '';
    document.getElementById('fsFormTitle').textContent = `Modifier "${f.nom}"`;
    document.getElementById('btnAddFournisseur').textContent = 'Enregistrer les modifications';
    document.getElementById('btnCancelFsEdit').style.display = 'inline-block';
    document.querySelector('#panel-fournisseurs .card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.getElementById('btnCancelFsEdit').addEventListener('click', resetFournisseurForm);

  document.getElementById('btnAddFournisseur').addEventListener('click', async () => {
    const nom = document.getElementById('fs-nom').value.trim();
    const telephone = document.getElementById('fs-tel').value.trim();
    const email = document.getElementById('fs-email').value.trim();
    const adresse = document.getElementById('fs-adresse').value.trim();
    if (!nom) { toast('Le nom du fournisseur est obligatoire.'); return; }
    if (!state.db) { toast('Connexion non disponible.'); return; }

    try {
      if (editingFournisseurId) {
        await state.db.doc('fournisseurs/' + editingFournisseurId).update({ nom, telephone, email, adresse });
        toast(`"${nom}" mis à jour.`);
      } else {
        const id = 'f-' + nom.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '-' + Date.now().toString(36);
        await state.db.doc('fournisseurs/' + id).set({ nom, telephone, email, adresse, createdAt: Date.now() });
        toast('Fournisseur ajouté.');
      }
      resetFournisseurForm();
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'opération.");
    }
  });

  async function deleteFournisseur(id) {
    if (!state.db) return;
    const f = state.fournisseurs.find(x => x.id === id);
    if (!confirm(`Supprimer le fournisseur "${f ? f.nom : ''}" ? Son historique de commandes restera enregistré mais ne sera plus rattaché.`)) return;
    try {
      await state.db.doc('fournisseurs/' + id).delete();
      if (selectedFournisseurId === id) { selectedFournisseurId = null; document.getElementById('fsDetailCard').style.display = 'none'; }
      if (editingFournisseurId === id) resetFournisseurForm();
      toast('Fournisseur supprimé.');
    } catch (err) { console.error(err); toast('Erreur lors de la suppression.'); }
  }

  function openFournisseurDetail(id) {
    selectedFournisseurId = id;
    document.getElementById('fsDetailCard').style.display = 'block';
    renderFournisseurDetail();
    document.getElementById('fsDetailCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.getElementById('btnCloseFsDetail').addEventListener('click', () => {
    selectedFournisseurId = null;
    document.getElementById('fsDetailCard').style.display = 'none';
  });

  function renderFournisseurDetail() {
    const f = state.fournisseurs.find(x => x.id === selectedFournisseurId);
    if (!f) { document.getElementById('fsDetailCard').style.display = 'none'; return; }

    document.getElementById('fsd-nom').textContent = f.nom;
    const phone = f.telephone || '';
    const cleanPhone = toWhatsAppNumber(phone);
    const globalWaUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Bonjour ' + f.nom + ', je souhaite passer une commande.')}` : null;
    document.getElementById('fsd-tel').innerHTML = phone
      ? `${escapeHtml(phone)} ${globalWaUrl ? `<a href="${globalWaUrl}" target="_blank" rel="noopener noreferrer" style="margin-left:6px; text-decoration:none; font-weight:600; color:var(--moss);">💬 WhatsApp</a>` : ''}`
      : '—';
    document.getElementById('fsd-email').textContent = f.email || '—';
    document.getElementById('fsd-adresse').textContent = f.adresse || '—';

    const { totalCommande, totalPaye, dette, derniere, orders } = supplierStats(f.id);
    document.getElementById('fsd-commande').textContent = euros(totalCommande);
    document.getElementById('fsd-paye').textContent = euros(totalPaye);
    document.getElementById('fsd-dette').textContent = euros(dette);
    document.getElementById('fsd-derniere').textContent = derniere || 'Aucune commande enregistrée';

    // Produits associés (correspondance sur le champ "Fournisseur" des produits)
    const produits = state.products.filter(p => (p.fournisseur || '').trim().toLowerCase() === (f.nom || '').trim().toLowerCase());
    const prodBox = document.getElementById('fsd-produits');
    const prodEmpty = document.getElementById('fsd-produits-empty');
    if (produits.length === 0) { prodBox.innerHTML = ''; prodEmpty.style.display = 'block'; }
    else {
      prodEmpty.style.display = 'none';
      prodBox.innerHTML = produits.map(p => `<li><span>${escapeHtml(p.nom)} <span class="r">(${escapeHtml(p.ref)})</span></span><span class="r">${p.stock} ${escapeHtml(p.unite || '')} · achat ${euros(p.prixAchat)}</span></li>`).join('');
    }

    // Historique commandes
    const histBody = document.getElementById('fsd-historique');
    const histEmpty = document.getElementById('fsd-historique-empty');
    if (orders.length === 0) { histBody.innerHTML = ''; histEmpty.style.display = 'block'; }
    else {
      histEmpty.style.display = 'none';
      histBody.innerHTML = orders.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(o => `
        <tr><td class="muted">${escapeHtml(o.date || '')}</td><td class="num-cell">${euros(o.montantCommande)}</td><td class="num-cell">${euros(o.montantPaye)}</td><td class="muted">${escapeHtml(o.note || '')}</td></tr>
      `).join('');
    }

    document.getElementById('fo-date').value = document.getElementById('fo-date').value || todayStr();
  }

  document.getElementById('btnAddCommande').addEventListener('click', async () => {
    if (!selectedFournisseurId) return;
    const f = state.fournisseurs.find(x => x.id === selectedFournisseurId);
    if (!f) return;
    const date = document.getElementById('fo-date').value || todayStr();
    const montantCommande = Number(document.getElementById('fo-commande').value) || 0;
    const montantPaye = Number(document.getElementById('fo-paye').value) || 0;
    const note = document.getElementById('fo-note').value.trim();

    if (montantCommande <= 0 && montantPaye <= 0) { toast('Renseigne au moins un montant commandé ou payé.'); return; }
    if (!state.db) { toast('Connexion non disponible.'); return; }

    try {
      const id = 'co-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
      await state.db.doc('commandes_fournisseurs/' + id).set({ fournisseurId: f.id, fournisseurNom: f.nom, date, montantCommande, montantPaye, note, createdAt: Date.now() });
      document.getElementById('fo-commande').value = '0';
      document.getElementById('fo-paye').value = '0';
      document.getElementById('fo-note').value = '';
      toast('Commande enregistrée.');
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'enregistrement.");
    }
  });

