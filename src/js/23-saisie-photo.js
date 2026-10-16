  // ================= Saisie par photo (test) : étagère → produits, facture fournisseur → réassort =================
  let pfMode = 'etagere', pfRows = [], pfMeta = {}, pfBusy = false;
  const pfNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function pfMatch(nom) {
    const a = new Set(pfNorm(nom).split(' ').filter(w => w.length > 1));
    if (!a.size) return '';
    let best = '', score = 0;
    (state.products || []).forEach(p => {
      const b = new Set(pfNorm(p.nom).split(' ').filter(w => w.length > 1));
      if (!b.size) return;
      let common = 0; a.forEach(w => { if (b.has(w)) common++; });
      const s = common / Math.max(a.size, b.size);
      if (s > score) { score = s; best = p.id; }
    });
    return score >= 0.6 ? best : '';
  }
  function pfResize(file) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onerror = () => reject(new Error('Lecture impossible'));
      rd.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image illisible'));
        img.onload = () => {
          // Photo réduite (1280 px, JPEG) puis compressée jusqu'à ~350 Ko : les photos de téléphone (4-12 Mo) sont refusées en route sinon
          const r = Math.min(1280 / img.width, 1280 / img.height, 1);
          const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
          const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
          let q = 0.72, data = c.toDataURL('image/jpeg', q).split(',')[1];
          while (data.length > 470000 && q > 0.35) { q -= 0.1; data = c.toDataURL('image/jpeg', q).split(',')[1]; }
          resolve({ mime: 'image/jpeg', data });
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }
  function pfStatus(html) { const s = document.getElementById('pfStatus'); if (s) s.innerHTML = html; }
  function pfRender() {
    const box = document.getElementById('pfReview');
    if (!pfRows.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const isF = pfMode === 'facture';
    const opts = (sel) => '<option value="">➕ ' + escapeHtml(tr('Nouveau produit')) + '</option>' + (state.products || []).slice().sort((x, y) => (x.nom || '').localeCompare(y.nom || '')).map(p => `<option value="${escapeHtml(p.id)}"${p.id === sel ? ' selected' : ''}>${escapeHtml(p.nom)}</option>`).join('');
    const head = isF && (pfMeta.fournisseur || pfMeta.date) ? `<p style="margin:0 0 8px;">🚚 <b>${escapeHtml(pfMeta.fournisseur || '?')}</b>${pfMeta.date ? ' · 📅 ' + escapeHtml(pfMeta.date) : ''}${pfMeta.total ? ' · ' + tr('Total') + ' ' + euros(pfMeta.total) : ''}</p>` : '';
    box.innerHTML = head + `<div class="pf-scroll"><table><thead><tr><th></th><th>${tr('Produit')}</th><th>${tr('Quantité')}</th><th>${tr('Unité')}</th>${isF ? `<th>${tr('Prix d\'achat')}</th>` : ''}<th>${tr('Prix de vente')}</th><th>${tr('Dans le catalogue')}</th></tr></thead><tbody>` +
      pfRows.map((r, i) => `<tr data-pfi="${i}">
        <td><input type="checkbox" data-pf-k="on" ${r.on ? 'checked' : ''} style="width:auto; min-width:0;"></td>
        <td class="pf-n"><input data-pf-k="nom" value="${escapeHtml(r.nom)}">${r.doute ? `<div class="pf-doute">⚠️ ${tr('Chiffres à vérifier')}</div>` : ''}${!isF && r.matchId ? `<div class="pf-doute">${tr('Déjà dans le catalogue : coché = le stock devient la quantité comptée')}</div>` : ''}</td>
        <td><input type="number" min="0" step="any" data-pf-k="quantite" value="${escapeHtml(String(r.quantite))}"></td>
        <td><input data-pf-k="unite" value="${escapeHtml(r.unite)}"></td>
        ${isF ? `<td><input type="number" min="0" step="1" data-pf-k="prixAchat" value="${r.prixAchat == null ? '' : escapeHtml(String(r.prixAchat))}"></td>` : ''}
        <td><input type="number" min="0" step="1" data-pf-k="prixVente" value="${r.prixVente == null ? '' : escapeHtml(String(r.prixVente))}" placeholder="?"></td>
        <td><select data-pf-k="matchId">${opts(r.matchId)}</select></td></tr>`).join('') +
      `</tbody></table></div>
      <p class="hint-text">${isF ? tr('Le prix de vente proposé pour un nouveau produit = prix d\'achat + 15 %, à vérifier.') : tr('Les quantités sont comptées sur la photo : vérifie-les avant d\'enregistrer.')}</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap;"><button type="button" class="primary" id="pfSave">✅ ${tr('Enregistrer dans mon stock')} (${pfRows.filter(r => r.on).length})</button><button type="button" class="ghost" id="pfCancel">${tr('Annuler')}</button></div>`;
    box.style.display = 'block';
  }
  async function pfAnalyse(files) {
    if (pfBusy || !files.length) return;
    if (!needOnline('la saisie par photo')) return;
    pfBusy = true; pfRows = []; pfRender();
    document.querySelectorAll('.pf-big').forEach(b => b.disabled = true);
    pfStatus('<span class="bel-dots" style="display:inline-block;"></span> 🧠 ' + escapeHtml(tr(pfMode === 'facture' ? 'Bel lit la facture…' : 'Bel regarde ton étagère…')));
    try {
      const images = [];
      for (const f of [...files].slice(0, 3)) images.push(await pfResize(f));
      const catalogue = (state.products || []).slice(0, 400).map(p => p.nom).join(' ; ');
      const { data, error } = await supabaseClient.functions.invoke('ask-ai', { body: { vision: pfMode, images, catalogue, devise: curSym(), lang: UI_LANG } });
      if (error || !data || !data.resultat) {
        let msg = error && error.name === 'FunctionsFetchError' ? 'La photo n\'a pas pu être envoyée (réseau faible ou photo trop lourde). Réessaie avec une seule photo.' : 'La lecture de la photo n\'est pas encore activée.';
        try { const j = error && error.context && typeof error.context.json === 'function' && await error.context.json(); if (j && j.error && !/Question vide/.test(j.error)) msg = j.error; } catch (e) {}
        console.error('Photo', error && error.name, error && error.message);
        throw new Error(msg);
      }
      const R = data.resultat;
      if (pfMode === 'facture') {
        pfMeta = { fournisseur: R.fournisseur || '', date: R.date || '', total: Number(R.total) || 0 };
        pfRows = (R.lignes || []).map(l => {
          const q = Number(l.quantite) || 0, pa = l.prix_achat != null ? Math.round(Number(l.prix_achat)) : (l.total && q ? Math.round(l.total / q) : null);
          const matchId = pfMatch(l.nom), ex = matchId && state.products.find(p => p.id === matchId);
          return { on: q > 0, nom: String(l.nom || '').trim(), quantite: q, unite: String(l.unite || (ex && ex.unite) || 'unité'), prixAchat: pa, prixVente: ex ? Number(ex.prixVente) || null : (pa ? Math.round(pa * 1.15 / 25) * 25 : null), matchId, doute: !!l.doute };
        }).filter(r => r.nom);
      } else {
        pfMeta = {};
        pfRows = (R.produits || []).map(p => {
          const matchId = pfMatch(p.nom);
          return { on: !matchId && (Number(p.confiance) || 0) >= 0.4, nom: String(p.nom || '').trim(), quantite: Math.max(0, Math.round(Number(p.quantite) || 0)), unite: String(p.unite || 'pièce'), categorie: String(p.categorie || ''), prixAchat: null, prixVente: p.prix_vente != null ? Math.round(Number(p.prix_vente)) : null, matchId, doute: (Number(p.confiance) || 0) < 0.6 };
        }).filter(r => r.nom);
      }
      pfStatus(pfRows.length ? '✅ ' + escapeHtml(tr('Vérifie la liste, corrige si besoin, puis enregistre.')) + ' (' + pfRows.length + ')' : '😕 ' + escapeHtml(tr('Aucun produit trouvé. Reprends la photo de plus près, avec plus de lumière.')));
      pfRender();
    } catch (e) {
      pfStatus('😕 ' + escapeHtml(isNetErr(e) ? tr('Pas de connexion internet.') : (e.message || 'Erreur')));
    } finally {
      pfBusy = false; document.querySelectorAll('.pf-big').forEach(b => b.disabled = false);
      document.getElementById('pfFile').value = '';
    }
  }
  async function pfSave() {
    const rows = pfRows.filter(r => r.on && r.nom && Number(r.quantite) >= 0);
    if (!rows.length) { toast(tr('Coche au moins un produit.')); return; }
    if (!state.db) { toast('Connexion non disponible — réessaie dans un instant.'); return; }
    const btn = document.getElementById('pfSave'); if (btn) btn.disabled = true;
    const isF = pfMode === 'facture', fournisseur = isF ? (pfMeta.fournisseur || '') : '';
    let crees = 0, maj = 0;
    const refs = new Set((state.products || []).map(p => p.ref));
    try {
      for (const r of rows) {
        const q = Number(r.quantite) || 0;
        const ex = r.matchId && state.products.find(p => p.id === r.matchId);
        if (ex) {
          const ancien = Number(ex.stock) || 0, nouveau = isF ? ancien + q : q;
          const up = { stock: nouveau };
          if (isF && r.prixAchat) up.prixAchat = Number(r.prixAchat);
          if (r.prixVente && Number(r.prixVente) !== Number(ex.prixVente)) up.prixVente = Number(r.prixVente);
          if (fournisseur && !ex.fournisseur) up.fournisseur = fournisseur;
          await state.db.doc('produits/' + ex.id).update(up);
          if (nouveau !== ancien) logMovement({ productId: ex.id, ref: ex.ref, nom: ex.nom, quantite: nouveau - ancien, ancienStock: ancien, nouveauStock: nouveau, unite: ex.unite || r.unite, source: isF ? 'photo facture' : 'photo étagère' }).catch(() => {});
          maj++;
        } else {
          let base = 'PH-' + pfNorm(r.nom).toUpperCase().replace(/ /g, '-').slice(0, 18), ref = base, n = 2;
          while (refs.has(ref)) ref = base + '-' + (n++);
          refs.add(ref);
          const id = 'p-' + ref.toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, 60) + '-' + Date.now().toString(36);
          await state.db.doc('produits/' + id).set({ ref, nom: r.nom, codeBarre: '', fournisseur, categorie: r.categorie || '', emplacement: '', stock: q, unite: r.unite || 'unité', prixAchat: Number(r.prixAchat) || 0, prixVente: Number(r.prixVente) || 0, seuil: Math.max(1, Math.round(q * 0.2)), createdAt: Date.now() });
          if (q > 0) logMovement({ productId: id, ref, nom: r.nom, quantite: q, ancienStock: 0, nouveauStock: q, unite: r.unite || 'unité', source: isF ? 'photo facture' : 'photo étagère' }).catch(() => {});
          crees++;
        }
      }
      try { logAction('SAISIE_PHOTO', `${isF ? 'Facture' : 'Étagère'} : ${crees} produit(s) créé(s), ${maj} mis à jour${fournisseur ? ' — ' + fournisseur : ''}`); } catch (e) {}
      pfRows = []; pfRender();
      pfStatus('🎉 ' + escapeHtml(`${crees} ${tr('produit(s) créé(s)')}, ${maj} ${tr('mis à jour')}.`) + (isF ? '' : ' 💡 ' + escapeHtml(tr('Ajoute les prix d\'achat pour voir ton vrai bénéfice.'))));
      toast('📸 ' + crees + ' + ' + maj);
    } catch (e) {
      console.error(e); toast("Erreur lors de l'opération.");
      if (btn) btn.disabled = false;
    }
  }
  (function pfInit() {
    const card = document.getElementById('photoFillCard'); if (!card) return;
    const file = document.getElementById('pfFile');
    card.querySelectorAll('[data-pf]').forEach(b => b.addEventListener('click', () => { pfMode = b.dataset.pf; file.click(); }));
    file.addEventListener('change', () => pfAnalyse(file.files || []));
    const rev = document.getElementById('pfReview');
    rev.addEventListener('input', (e) => {
      const tr0 = e.target.closest('[data-pfi]'), k = e.target.dataset.pfK; if (!tr0 || !k) return;
      const r = pfRows[Number(tr0.dataset.pfi)]; if (!r) return;
      if (k === 'on') r.on = e.target.checked;
      else if (k === 'quantite' || k === 'prixAchat' || k === 'prixVente') r[k] = e.target.value === '' ? null : Number(e.target.value);
      else r[k] = e.target.value;
      if (k === 'on' || k === 'matchId') pfRender();
    });
    rev.addEventListener('change', (e) => { if (e.target.dataset.pfK === 'on' || e.target.dataset.pfK === 'matchId') { const tr0 = e.target.closest('[data-pfi]'); const r = tr0 && pfRows[Number(tr0.dataset.pfi)]; if (r) { r[e.target.dataset.pfK] = e.target.dataset.pfK === 'on' ? e.target.checked : e.target.value; pfRender(); } } });
    rev.addEventListener('click', (e) => { if (e.target.id === 'pfSave') pfSave(); if (e.target.id === 'pfCancel') { pfRows = []; pfRender(); pfStatus(''); } });
  })();

