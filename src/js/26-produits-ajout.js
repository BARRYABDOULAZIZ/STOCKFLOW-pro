  // ================= Produits: add / restock / edit =================
  let editingId = null; // null = mode ajout/réappro ; sinon = id du produit en cours de modification

  document.getElementById('p-ref').addEventListener('input', e => {
    if (editingId) return; // en mode édition, on ne bascule pas en mode réappro
    const ref = e.target.value.trim();
    const existing = ref ? state.products.find(p => p.ref === ref) : null;
    const lbl = document.getElementById('lbl-stock');
    const hint = document.getElementById('restockHint');
    const btn = document.getElementById('btnAddProduct');
    if (existing) {
      lbl.textContent = 'Quantité à ajouter au stock';
      hint.style.display = 'block';
      hint.textContent = `Référence existante : ${existing.nom} — stock actuel ${existing.stock} ${existing.unite || 'unité'}. Le nombre saisi ci-dessus s'ajoutera à ce stock.`;
      btn.textContent = 'Réapprovisionner ce produit';
    } else {
      lbl.textContent = 'Quantité en stock';
      hint.style.display = 'none';
      btn.textContent = 'Ajouter au catalogue';
    }
  });

  function startEditProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    editingId = id;
    document.getElementById('p-ref').value = p.ref || '';
    document.getElementById('p-nom').value = p.nom || '';
    document.getElementById('p-barcode').value = p.codeBarre || '';
    document.getElementById('p-fournisseur').value = p.fournisseur || '';
    document.getElementById('p-categorie').value = p.categorie || '';
    document.getElementById('p-emplacement').value = p.emplacement || '';
    document.getElementById('p-stock').value = p.stock ?? 0;
    document.getElementById('p-unite').value = p.unite || '';
    document.getElementById('p-prixachat').value = p.prixAchat ?? 0;
    document.getElementById('p-prixvente').value = p.prixVente ?? 0;
    document.getElementById('p-seuil').value = p.seuil ?? 0;

    document.getElementById('lbl-stock').textContent = 'Quantité en stock (valeur exacte)';
    document.getElementById('restockHint').style.display = 'block';
    document.getElementById('restockHint').style.color = 'var(--brick)';
    document.getElementById('restockHint').textContent = `Modification de "${p.nom}" — tous les champs seront remplacés par ce que tu saisis ici (le stock n'est pas additionné, c'est la valeur exacte).`;
    document.getElementById('btnAddProduct').textContent = 'Enregistrer les modifications';
    document.getElementById('btnCancelEdit').style.display = 'inline-block';

    const formCard = document.getElementById('p-ref').closest('.card') || document.querySelector('.card');
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetProductForm() {
    editingId = null;
    ['p-ref','p-nom','p-barcode','p-fournisseur','p-categorie','p-emplacement','p-unite'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('p-stock').value = '0';
    document.getElementById('p-prixachat').value = '0';
    document.getElementById('p-prixvente').value = '0';
    document.getElementById('p-seuil').value = '5';
    document.getElementById('lbl-stock').textContent = 'Quantité en stock';
    document.getElementById('restockHint').style.display = 'none';
    document.getElementById('btnAddProduct').textContent = 'Ajouter au catalogue';
    document.getElementById('btnCancelEdit').style.display = 'none';
  }

  document.getElementById('btnCancelEdit').addEventListener('click', resetProductForm);

  document.getElementById('btnAddProduct').addEventListener('click', async () => {
    const ref = document.getElementById('p-ref').value.trim();
    const nom = document.getElementById('p-nom').value.trim();
    const codeBarre = document.getElementById('p-barcode').value.trim();
    const fournisseur = document.getElementById('p-fournisseur').value.trim();
    const categorie = document.getElementById('p-categorie').value.trim();
    const emplacement = document.getElementById('p-emplacement').value.trim();
    const stockInput = Number(document.getElementById('p-stock').value) || 0;
    const unite = document.getElementById('p-unite').value.trim() || 'unité';
    const prixAchat = Number(document.getElementById('p-prixachat').value) || 0;
    const prixVente = Number(document.getElementById('p-prixvente').value) || 0;
    const seuil = Number(document.getElementById('p-seuil').value) || 0;

    if (!ref) { toast('La référence est obligatoire.'); return; }
    if (!nom) { toast('Le nom est obligatoire.'); return; }
    if (!state.db) { toast('Connexion non disponible — réessaie dans un instant.'); return; }

    try {
      if (editingId) {
        // Mode édition : remplace tous les champs, y compris le stock en valeur exacte.
        await state.db.doc('produits/' + editingId).update({ ref, nom, codeBarre, fournisseur, categorie, emplacement, stock: stockInput, unite, prixAchat, prixVente, seuil });
        toast(`"${nom}" mis à jour.`);
        resetProductForm();
        return;
      }

      const existing = state.products.find(p => p.ref === ref);
      if (existing) {
        const newStock = Number(existing.stock) + stockInput;
        const updates = { stock: newStock };
        if (unite && unite !== existing.unite) updates.unite = unite;
        if (document.getElementById('p-prixachat').value !== '' && prixAchat !== existing.prixAchat) updates.prixAchat = prixAchat;
        if (document.getElementById('p-prixvente').value !== '' && prixVente !== existing.prixVente) updates.prixVente = prixVente;
        if (document.getElementById('p-seuil').value !== '' && seuil !== existing.seuil) updates.seuil = seuil;
        if (codeBarre && codeBarre !== existing.codeBarre) updates.codeBarre = codeBarre;
        if (fournisseur && fournisseur !== existing.fournisseur) updates.fournisseur = fournisseur;
        if (categorie && categorie !== existing.categorie) updates.categorie = categorie;
        if (emplacement && emplacement !== existing.emplacement) updates.emplacement = emplacement;
        await state.db.doc('produits/' + existing.id).update(updates);
        if (stockInput > 0) {
          logMovement({ productId: existing.id, ref: existing.ref, nom: existing.nom, quantite: stockInput, ancienStock: Number(existing.stock), nouveauStock: newStock, unite: updates.unite || existing.unite || 'unité', source: 'manuel' }).catch(() => {});
        }
        toast(`Stock mis à jour : ${existing.nom} — ${existing.stock} + ${stockInput} = ${newStock} ${updates.unite || existing.unite || 'unité'}.`);
      } else {
        if (state.products.length >= 3000) toast("Catalogue proche de 3000 références — pense à archiver les articles inactifs.");
        const id = 'p-' + ref.toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, 60) + '-' + Date.now().toString(36);
        await state.db.doc('produits/' + id).set({ ref, nom, codeBarre, fournisseur, categorie, emplacement, stock: stockInput, unite, prixAchat, prixVente, seuil, createdAt: Date.now() });
        toast('Produit ajouté au catalogue.');
      }
      resetProductForm();
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'opération.");
    }
  });


