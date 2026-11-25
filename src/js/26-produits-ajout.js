  // ================= Produits: add / restock / edit =================
  let editingStock = 0; // stock affiché à l'ouverture du formulaire de modification
  let editingId = null; // null = mode ajout/réappro ; sinon = id du produit en cours de modification

  // Référence déjà connue : on remplit le formulaire avec la fiche du produit (réapprovisionnement),
  // pour ne pas avoir à tout retaper et pour ne pas écraser les prix par 0.
  let autofilledRef = null;
  const AUTOFILL_FIELDS = [
    ['p-nom', p => p.nom, ''], ['p-barcode', p => p.codeBarre, ''], ['p-fournisseur', p => p.fournisseur, ''],
    ['p-categorie', p => p.categorie, ''], ['p-emplacement', p => p.emplacement, ''], ['p-unite', p => p.unite, ''],
    ['p-prixachat', p => p.prixAchat, '0'], ['p-prixvente', p => p.prixVente, '0'], ['p-seuil', p => p.seuil, '5'],
    ['p-expiration', p => expDate(p), ''],
  ];
  document.getElementById('p-ref').addEventListener('input', e => {
    if (editingId) return; // en mode édition, on ne bascule pas en mode réappro
    const ref = e.target.value.trim();
    const existing = ref ? state.products.find(p => p.ref === ref) : null;
    const lbl = document.getElementById('lbl-stock');
    const hint = document.getElementById('restockHint');
    const btn = document.getElementById('btnAddProduct');
    if (existing) {
      if (autofilledRef !== existing.ref) {
        AUTOFILL_FIELDS.forEach(([id, get]) => { const v = get(existing); document.getElementById(id).value = (v === undefined || v === null) ? '' : v; });
        document.getElementById('p-stock').value = '';
        autofilledRef = existing.ref;
      }
      lbl.textContent = 'Quantité à ajouter au stock';
      hint.style.display = 'block';
      hint.style.color = '';
      hint.textContent = `Référence existante : ${existing.nom} — stock actuel ${existing.stock} ${existing.unite || 'unité'}. Les informations du produit sont remplies : écris seulement la quantité à ajouter (tu peux aussi corriger un prix).`;
      btn.textContent = 'Réapprovisionner ce produit';
    } else {
      if (autofilledRef) {   // on a quitté une référence connue : on vide ce qui avait été rempli automatiquement
        AUTOFILL_FIELDS.forEach(([id, , empty]) => { document.getElementById(id).value = empty; });
        document.getElementById('p-stock').value = '0';
        autofilledRef = null;
      }
      lbl.textContent = pfSimpleOn() ? '🔢 ' + tr('Tu en as combien ?') : 'Quantité en stock';
      hint.style.display = 'none';
      btn.textContent = 'Ajouter au catalogue';
    }
  });

  function startEditProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    editingId = id;
    editingStock = Number(p.stock) || 0;
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
    document.getElementById('p-expiration').value = expDate(p);

    document.getElementById('lbl-stock').textContent = 'Quantité en stock (valeur exacte)';
    document.getElementById('restockHint').style.display = 'block';
    document.getElementById('restockHint').style.color = 'var(--brick)';
    document.getElementById('restockHint').textContent = `Modification de "${p.nom}" — tous les champs seront remplacés par ce que tu saisis ici (le stock n'est pas additionné, c'est la valeur exacte).`;
    document.getElementById('btnAddProduct').textContent = 'Enregistrer les modifications';
    document.getElementById('btnCancelEdit').style.display = 'inline-block';

    const formCard = document.getElementById('p-ref').closest('.card') || document.querySelector('.card');
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { pfMoreOpenIfFilled(); } catch (e) {}
    achatHint();
  }

  function resetProductForm() {
    try { suggAuto = null; suggStockNom = null; } catch (e) {}
    editingId = null;
    autofilledRef = null;
    ['p-ref','p-nom','p-barcode','p-fournisseur','p-categorie','p-emplacement','p-unite','p-expiration'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('p-stock').value = '0';
    document.getElementById('p-prixachat').value = '0';
    document.getElementById('p-prixvente').value = '0';
    document.getElementById('p-seuil').value = '5';
    if (pfSimpleOn()) ['p-stock', 'p-prixachat', 'p-prixvente'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('lbl-stock').textContent = pfSimpleOn() ? '🔢 ' + tr('Tu en as combien ?') : 'Quantité en stock';
    document.getElementById('restockHint').style.display = 'none';
    document.getElementById('btnAddProduct').textContent = 'Ajouter au catalogue';
    document.getElementById('btnCancelEdit').style.display = 'none';
    achatHint();
  }

  // Sous le prix d'achat : « = 12 500 pour 1 sac · 10 × 12 500 = 125 000 payés », et alerte si plus cher que le prix de vente
  // (erreur fréquente : taper le prix TOTAL de la facture au lieu du prix d'une seule unité)
  function achatHint() {
    const inp = document.getElementById('p-prixachat'); if (!inp) return;
    let h = document.getElementById('p-achat-hint');
    if (!h) { h = document.createElement('div'); h.id = 'p-achat-hint'; h.className = 'achat-hint'; inp.insertAdjacentElement('afterend', h); }
    const pa = Number(inp.value) || 0, pv = Number(document.getElementById('p-prixvente').value) || 0;
    const q = Number(document.getElementById('p-stock').value) || 0, u = escapeHtml((document.getElementById('p-unite').value || '').trim() || tr('unité'));
    if (!pa) { h.style.display = 'none'; return; }
    let t = '= ' + euros(pa) + ' ' + tr('pour 1') + ' ' + u;
    if (q > 0) t += ' · ' + q + ' × ' + euros(pa).replace(/\s\S+$/, '') + ' = <b>' + euros(q * pa) + '</b>';
    if (pv > 0 && pa > pv) t += '<div class="achat-warn">⚠️ ' + tr("Plus cher que le prix de vente ! As-tu tapé le prix TOTAL au lieu du prix d'une seule unité ?") + '</div>';
    h.innerHTML = t; h.style.display = '';
  }
  ['p-prixachat', 'p-prixvente', 'p-stock', 'p-unite', 'p-ref', 'p-nom'].forEach(id => { const el = document.getElementById(id); if (el) { el.addEventListener('input', achatHint); el.addEventListener('change', achatHint); } });

  document.getElementById('btnCancelEdit').addEventListener('click', resetProductForm);

  document.getElementById('btnAddProduct').addEventListener('click', async () => {
    let ref = document.getElementById('p-ref').value.trim();
    const nom = document.getElementById('p-nom').value.trim();
    // Formulaire simplifié : pas de référence à taper. Même nom qu'un produit déjà en stock = réapprovisionnement, sinon référence créée toute seule
    if (!ref && nom && !editingId && pfSimpleOn()) {
      const same = state.products.find(p => String(p.nom || '').trim().toLowerCase() === nom.toLowerCase());
      ref = same ? same.ref : suggRef(nom);
    }
    const codeBarre = document.getElementById('p-barcode').value.trim();
    const fournisseur = document.getElementById('p-fournisseur').value.trim();
    const categorie = document.getElementById('p-categorie').value.trim();
    const emplacement = document.getElementById('p-emplacement').value.trim();
    const stockInput = Number(document.getElementById('p-stock').value) || 0;
    const unite = document.getElementById('p-unite').value.trim() || 'unité';
    const prixAchat = Number(document.getElementById('p-prixachat').value) || 0;
    const prixVente = Number(document.getElementById('p-prixvente').value) || 0;
    const seuil = Number(document.getElementById('p-seuil').value) || 0;
    // Date d'expiration : envoyée seulement quand la fonction est ouverte (sinon la colonne n'existe peut-être pas encore dans la base)
    const expVal = expOn() ? (document.getElementById('p-expiration').value || '') : '';

    if (!ref) { toast('La référence est obligatoire.'); return; }
    if (!nom) { toast('Le nom est obligatoire.'); return; }
    if (!state.db) { toast('Connexion non disponible — réessaie dans un instant.'); return; }

    try {
      if (editingId) {
        // Mode édition : remplace tous les champs, y compris le stock en valeur exacte.
        // Le stock n'est jamais écrasé : on applique seulement la différence avec ce qui était affiché,
        // pour ne pas effacer une vente faite pendant que le formulaire était ouvert.
        await state.db.doc('produits/' + editingId).update({ ref, nom, codeBarre, fournisseur, categorie, emplacement, unite, prixAchat, prixVente, seuil, ...(expOn() ? { dateExpiration: expVal || null } : {}) });
        const dStock = stockInput - editingStock;
        if (dStock !== 0) {
          const ed = state.products.find(x => x.id === editingId) || {};
          try {
            const nv = await adjustStock(editingId, dStock);
            logMovement({ productId: editingId, ref, nom, quantite: Math.abs(dStock), ancienStock: nv - dStock, nouveauStock: nv, unite: unite || ed.unite || 'unité', source: 'manuel', note: 'Modification de la fiche produit' }).catch(() => {});
          } catch (e) { console.error(e); toast(`"${nom}" mis à jour, mais le stock n'a pas pu être corrigé (stock insuffisant ?).`); resetProductForm(); return; }
        }
        toast(`"${nom}" mis à jour.`);
        resetProductForm();
        return;
      }

      const existing = state.products.find(p => p.ref === ref);
      if (existing) {
        const updates = {};
        if (unite && unite !== existing.unite) updates.unite = unite;
        if (document.getElementById('p-prixachat').value !== '' && prixAchat !== existing.prixAchat) updates.prixAchat = prixAchat;
        if (document.getElementById('p-prixvente').value !== '' && prixVente !== existing.prixVente) updates.prixVente = prixVente;
        if (document.getElementById('p-seuil').value !== '' && seuil !== existing.seuil) updates.seuil = seuil;
        if (codeBarre && codeBarre !== existing.codeBarre) updates.codeBarre = codeBarre;
        if (fournisseur && fournisseur !== existing.fournisseur) updates.fournisseur = fournisseur;
        if (categorie && categorie !== existing.categorie) updates.categorie = categorie;
        if (emplacement && emplacement !== existing.emplacement) updates.emplacement = emplacement;
        // Réappro avec une date : on garde la date la plus proche tant qu'il reste de l'ancien stock (ce sont ces articles qui expirent en premier)
        if (expVal && expVal !== expDate(existing)) {
          const old = expDate(existing);
          if (!old || !(Number(existing.stock) > 0) || expVal < old) updates.dateExpiration = expVal;
          else toast(`Date d'expiration gardée au ${expFmt(existing)} : l'ancien stock expire avant le nouveau.`);
        }
        if (Object.keys(updates).length) await state.db.doc('produits/' + existing.id).update(updates);
        // Réappro : ajout atomique côté base (une vente en même temps n'est jamais effacée)
        let newStock = Number(existing.stock) || 0;
        if (stockInput !== 0) {
          newStock = await adjustStock(existing.id, stockInput);
          logMovement({ productId: existing.id, ref: existing.ref, nom: existing.nom, quantite: stockInput, ancienStock: newStock - stockInput, nouveauStock: newStock, unite: updates.unite || existing.unite || 'unité', source: 'manuel' }).catch(() => {});
        }
        toast(`Stock mis à jour : ${existing.nom} — ${newStock - stockInput} + ${stockInput} = ${newStock} ${updates.unite || existing.unite || 'unité'}.`);
      } else {
        if (state.products.length >= 3000) toast("Catalogue proche de 3000 références — pense à archiver les articles inactifs.");
        const id = 'p-' + ref.toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, 60) + '-' + Date.now().toString(36);
        await state.db.doc('produits/' + id).set({ ref, nom, codeBarre, fournisseur, categorie, emplacement, stock: stockInput, unite, prixAchat, prixVente, seuil, ...(expVal ? { dateExpiration: expVal } : {}), createdAt: Date.now() });
        toast('Produit ajouté au catalogue.');
      }
      resetProductForm();
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'opération.");
    }
  });




  // ================= Formulaire « Ajouter un produit » simplifié (EN TEST : compte de test seulement) =================
  // 4 questions visibles (produit, combien, achat, vente) ; tout le reste rangé dans « ➕ Plus de détails ».
  function pfSimpleOn() { return window.BB_TEST === true; }
  function pfSimpleApply() {
    if (!pfSimpleOn() || document.getElementById('pfMore')) return;
    const card = document.getElementById('p-nom').closest('.card'); if (!card) return;
    const box = (id) => { const el = document.getElementById(id); return el ? el.closest('.field-grid > div') : null; };
    const grids = card.querySelectorAll('.field-grid');
    // Nouvelle grille « essentiel » : nom, quantité, prix d'achat, prix de vente
    const main = document.createElement('div'); main.className = 'field-grid pf-main';
    ['p-nom', 'p-stock', 'p-prixachat', 'p-prixvente'].forEach(id => { const b = box(id); if (b) main.appendChild(b); });
    grids[0].before(main);
    // Le reste dans un bloc repliable
    const more = document.createElement('details'); more.id = 'pfMore'; more.className = 'pf-more';
    more.innerHTML = '<summary>➕ ' + tr('Plus de détails') + ' <span class="muted">(' + tr('code-barres, catégorie, unité, fournisseur…') + ')</span></summary>';
    const rest = document.createElement('div'); rest.className = 'field-grid';
    ['p-barcode', 'p-unite', 'p-categorie', 'p-fournisseur', 'p-emplacement', 'p-seuil', 'p-ref'].forEach(id => { const b = box(id); if (b) rest.appendChild(b); });
    const exp = document.getElementById('p-exp-box'); if (exp) rest.appendChild(exp);
    more.appendChild(rest); main.after(more);
    grids.forEach(g => { if (!g.children.length) g.remove(); });
    // Questions simples + exemples
    const lab = (id, t) => { const el = document.getElementById(id); const l = el && el.closest('div').querySelector('label'); if (l) l.innerHTML = t; };
    lab('p-nom', '📦 ' + tr("C'est quoi le produit ?"));
    lab('p-stock', '🔢 ' + tr('Tu en as combien ?'));
    lab('p-prixachat', '💰 ' + tr("Tu l'achètes à combien ?") + ' <span class="muted pf-u">(' + tr('pour 1') + ')</span>');
    lab('p-prixvente', '🏷️ ' + tr('Tu le vends à combien ?') + ' <span class="muted pf-u">(' + tr('pour 1') + ')</span>');
    const ph = (id, t) => { const el = document.getElementById(id); if (el) el.placeholder = t; };
    ph('p-nom', tr('Ex. : Riz 25 kg, huile 1 L, savon…'));
    ['p-stock', 'p-prixachat', 'p-prixvente'].forEach(id => { const el = document.getElementById(id); if (el && el.value === '0') el.value = ''; });
    ph('p-stock', tr('Ex. : 10')); ph('p-prixachat', tr('Ex. : 12 000')); ph('p-prixvente', tr('Ex. : 14 000'));
    const r = document.getElementById('p-ref'); if (r) r.placeholder = tr('Créée toute seule si tu la laisses vide');
    const h = card.querySelector('.hint-text'); if (h && !h.id) h.style.display = 'none';
    const btn = document.getElementById('btnAddProduct'); if (btn) btn.classList.add('pf-big');
    const h2 = card.querySelector('.row-head h2'); if (h2) h2.textContent = '➕ ' + tr('Ajouter un produit');
    const nb = box('p-nom'); if (nb) nb.style.gridColumn = '1 / -1';
    // En modification : on ouvre « Plus de détails » s'il y a quelque chose dedans
  }
  function pfMoreOpenIfFilled() {
    const more = document.getElementById('pfMore'); if (!more) return;
    const filled = ['p-barcode', 'p-categorie', 'p-fournisseur', 'p-emplacement', 'p-expiration'].some(id => { const el = document.getElementById(id); return el && el.value.trim(); });
    if (filled) more.open = true;
  }
