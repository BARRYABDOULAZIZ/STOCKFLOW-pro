  // ================= Inventaire intelligent =================
  let invFilter = 'tous';
  let invCategorie = '';

  document.querySelectorAll('.filter-bar [data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-bar [data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      invFilter = btn.dataset.filter;
      renderInventaire();
    });
  });
  document.getElementById('catFilter').addEventListener('change', e => { invCategorie = e.target.value; renderInventaire(); });

  // ----- Feuille d'inventaire imprimable (sans prix) -----
  const NO_CAT = '__sans_categorie__';
  function renderInvSheetCats() {
    const box = document.getElementById('is-cats');
    if (!box) return;
    const checked = new Set(Array.from(box.querySelectorAll('input:checked')).map(i => i.value));
    const cats = Array.from(new Set(state.products.map(p => p.categorie).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    if (state.products.some(p => !p.categorie)) cats.push(NO_CAT);
    box.innerHTML = cats.map(c => `<label style="display:flex; align-items:center; gap:6px; font-weight:400; margin:0;"><input type="checkbox" style="width:auto;" value="${escapeHtml(c)}" ${checked.has(c) ? 'checked' : ''}> ${c === NO_CAT ? '(Sans catégorie)' : escapeHtml(c)}</label>`).join('') || '<span class="muted">Aucune catégorie.</span>';
    updateInvSheetCount();
  }
  function invSheetList() {
    const scope = document.getElementById('is-scope').value;
    const sort = document.getElementById('is-sort').value;
    const cats = new Set(Array.from(document.querySelectorAll('#is-cats input:checked')).map(i => i.value));
    let list = state.products.slice();
    if (scope === 'faible') list = list.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.seuil));
    else if (scope === 'rupture') list = list.filter(p => Number(p.stock) <= 0);
    else if (scope === 'reappro') list = list.filter(p => Number(p.stock) <= Number(p.seuil));
    if (cats.size) list = list.filter(p => cats.has(p.categorie || NO_CAT));
    const cmp = (a, b) => (a || '').localeCompare(b || '', 'fr', { numeric: true });
    list.sort((a, b) => {
      if (sort === 'emplacement') return cmp(a.emplacement, b.emplacement) || cmp(a.nom, b.nom);
      if (sort === 'categorie') return cmp(a.categorie, b.categorie) || cmp(a.nom, b.nom);
      return cmp(a.nom, b.nom);
    });
    return list;
  }
  function updateInvSheetCount() {
    const el = document.getElementById('is-count');
    if (el) el.textContent = invSheetList().length + ' produit(s) sur la feuille';
  }
  ['is-scope', 'is-sort'].forEach(id => document.getElementById(id).addEventListener('change', updateInvSheetCount));
  document.getElementById('is-cats').addEventListener('change', updateInvSheetCount);

  function printInventorySheet() {
    const list = invSheetList();
    if (list.length === 0) { toast('Aucun produit à imprimer avec ces choix.'); return; }
    const blind = document.getElementById('is-blind').checked;
    const sort = document.getElementById('is-sort').value;
    const scopeSel = document.getElementById('is-scope');
    const scopeLabel = scopeSel.options[scopeSel.selectedIndex].text;
    const cats = Array.from(document.querySelectorAll('#is-cats input:checked')).map(i => i.value === NO_CAT ? 'Sans catégorie' : i.value);
    const commerceNom = (state.commerce && state.commerce.nom) || 'BoromBoutik';
    const cols = blind ? 6 : 7;
    let rows = '', lastCat = null;
    list.forEach(p => {
      if (sort === 'categorie' && (p.categorie || '') !== lastCat) {
        lastCat = p.categorie || '';
        rows += `<tr class="is-cat"><td colspan="${cols}">${escapeHtml(lastCat || 'Sans catégorie')}</td></tr>`;
      }
      rows += `<tr>
        <td>${escapeHtml(p.ref || '')}</td>
        <td>${escapeHtml(p.codeBarre || '')}</td>
        <td>${escapeHtml(p.nom || '')}${p.emplacement ? `<div style="font-size:10.5px; color:#444;">${escapeHtml(p.emplacement)}</div>` : ''}</td>
        <td>${escapeHtml(p.unite || '')}</td>
        ${blind ? '' : `<td class="is-num">${escapeHtml(String(Number(p.stock) || 0))}</td>`}
        <td class="is-count"></td>
        <td class="is-obs"></td>
      </tr>`;
    });
    document.getElementById('printInvSheet').innerHTML = `
      <h1>Feuille d'inventaire — ${escapeHtml(commerceNom)}</h1>
      <div class="is-meta">
        <span>Date : ${escapeHtml(todayStr())}</span>
        <span>${escapeHtml(scopeLabel)}${cats.length ? ' · ' + escapeHtml(cats.join(', ')) : ''}</span>
        <span>${list.length} produit(s)${blind ? ' · comptage à l\'aveugle' : ''}</span>
      </div>
      <table>
        <thead><tr><th>Référence</th><th>Code-barres</th><th>Produit</th><th>Unité</th>${blind ? '' : '<th>Qté théorique</th>'}<th>Qté comptée</th><th>Observations</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="is-sign"><div>Compté par :</div><div>Vérifié par :</div><div>Date / heure :</div></div>`;
    document.body.classList.add('print-inv');
    const cleanup = () => { document.body.classList.remove('print-inv'); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 250);
  }
  document.getElementById('btnPrintInvSheet').addEventListener('click', printInventorySheet);

  // ================= Comptage d'inventaire (saisie + écarts + correction du stock) =================
  let countRows = [];
  function startCount() {
    countRows = invSheetList().map(p => ({ id: p.id, ref: p.ref, nom: p.nom, unite: p.unite || 'unité', theo: Number(p.stock) || 0, counted: '', obs: '' }));
    if (!countRows.length) { toast('Aucun produit à compter avec ces choix.'); return; }
    const blind = document.getElementById('is-blind').checked;
    document.getElementById('countArea').style.display = 'block';
    document.getElementById('countBody').innerHTML = countRows.map((r, i) => `
      <tr data-i="${i}">
        <td>${escapeHtml(r.ref || '')}</td>
        <td>${escapeHtml(r.nom)}</td>
        <td class="num-cell count-theo" style="${blind ? 'display:none;' : ''}">${r.theo} ${escapeHtml(r.unite)}</td>
        <td class="num-cell"><input type="number" min="0" step="any" class="count-in" style="width:90px;"></td>
        <td class="num-cell count-diff">${blind ? '—' : ''}</td>
        <td><input type="text" class="count-obs" placeholder="Observation" style="min-width:140px;"></td>
      </tr>`).join('');
    document.querySelectorAll('.count-theo').forEach(el => { if (blind) el.style.display = 'none'; });
    updateCountSummary();
  }
  function updateCountSummary() {
    const blind = document.getElementById('is-blind').checked;
    let done = 0, diffs = 0;
    document.querySelectorAll('#countBody tr').forEach(tr => {
      const r = countRows[Number(tr.dataset.i)];
      const v = tr.querySelector('.count-in').value;
      r.counted = v; r.obs = tr.querySelector('.count-obs').value.trim();
      const cell = tr.querySelector('.count-diff');
      if (v === '') { cell.textContent = blind ? '—' : ''; return; }
      done++;
      const d = Number(v) - r.theo;
      if (d !== 0) diffs++;
      if (!blind) { cell.textContent = (d > 0 ? '+' : '') + d; cell.style.color = d === 0 ? '' : (d > 0 ? '#16a34a' : '#dc2626'); cell.style.fontWeight = '700'; }
    });
    document.getElementById('countSummary').textContent = `${done} produit(s) compté(s) sur ${countRows.length}` + (blind ? ' — les écarts seront visibles à la validation.' : ` — ${diffs} écart(s).`);
  }
  async function validateCount() {
    updateCountSummary();
    const changes = countRows.filter(r => r.counted !== '' && Number(r.counted) >= 0).map(r => {
      const prod = state.products.find(p => p.id === r.id);
      const current = prod ? Number(prod.stock) || 0 : r.theo;
      return { ...r, current, delta: Number(r.counted) - current };
    }).filter(r => r.delta !== 0);
    const counted = countRows.filter(r => r.counted !== '').length;
    if (!counted) { toast('Saisis au moins une quantité comptée.'); return; }
    if (!changes.length) { toast('Aucun écart : le stock est déjà exact. ✅'); finishCount(); return; }
    const lines = changes.slice(0, 15).map(c => `• ${c.nom} : ${c.current} → ${c.counted} (${c.delta > 0 ? '+' : ''}${c.delta})`).join('\n');
    if (!confirm(`${changes.length} correction(s) de stock vont être appliquées :\n\n${lines}${changes.length > 15 ? '\n… et ' + (changes.length - 15) + ' autre(s)' : ''}\n\nConfirmer ?`)) return;
    const btn = document.getElementById('btnValidateCount');
    btn.disabled = true;
    let ok = 0, fail = 0;
    try {
      for (const c of changes) {
        try {
          const nouveau = await adjustStock(c.id, c.delta);
          await logMovement({ productId: c.id, ref: c.ref, nom: c.nom, quantite: Math.abs(c.delta), ancienStock: c.current, nouveauStock: nouveau, unite: c.unite, source: 'inventaire', note: c.obs || 'Comptage d\'inventaire' });
          ok++;
        } catch (e) { console.error(e); fail++; }
      }
      logAction('INVENTAIRE', `Comptage validé : ${ok} correction(s) de stock sur ${counted} produit(s) compté(s)${fail ? ', ' + fail + ' échec(s)' : ''}.`);
      toast(`Inventaire validé : ${ok} correction(s)` + (fail ? `, ${fail} échec(s)` : '') + '.');
      finishCount();
    } finally { btn.disabled = false; }
  }
  function finishCount() { countRows = []; document.getElementById('countArea').style.display = 'none'; document.getElementById('countBody').innerHTML = ''; }
  document.getElementById('btnStartCount').addEventListener('click', startCount);
  document.getElementById('btnCancelCount').addEventListener('click', () => { if (confirm('Annuler le comptage en cours ? Rien ne sera modifié.')) finishCount(); });
  document.getElementById('btnValidateCount').addEventListener('click', validateCount);
  document.getElementById('countBody').addEventListener('input', updateCountSummary);

  function renderInventaire() {
    const catSel = document.getElementById('catFilter');
    const cats = Array.from(new Set(state.products.map(p => p.categorie).filter(Boolean))).sort();
    const currentVal = catSel.value;
    catSel.innerHTML = '<option value="">Toutes catégories</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    catSel.value = cats.includes(currentVal) ? currentVal : '';
    invCategorie = catSel.value;
    renderInvSheetCats();

    let list = state.products.slice();
    if (invFilter === 'faible') list = list.filter(p => Number(p.stock) > 0 && Number(p.stock) <= Number(p.seuil));
    if (invFilter === 'rupture') list = list.filter(p => Number(p.stock) <= 0);
    if (invFilter === 'reappro') list = list.filter(p => Number(p.stock) <= Number(p.seuil));
    if (invCategorie) list = list.filter(p => p.categorie === invCategorie);
    list.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));

    const body = document.getElementById('invBody');
    const empty = document.getElementById('invEmpty');
    body.innerHTML = '';

    if (list.length === 0) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      list.forEach(p => {
        const stock = Number(p.stock) || 0;
        const pa = Number(p.prixAchat) || 0;
        const pv = Number(p.prixVente) || 0;
        const valAchat = pa * stock;
        const valVente = pv * stock;
        const marge = valVente - valAchat;
        const zero = stock <= 0;
        const low = !zero && stock <= Number(p.seuil);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(p.nom)}<div class="muted">${escapeHtml(p.ref)}</div></td>
          <td class="num-cell">${zero ? '<span class="stock-zero">0</span>' : `<span class="stk ${low ? 'low' : 'ok'}">${stock}</span>`} <span class="unit-tag">${escapeHtml(p.unite || '')}</span></td>
          <td class="num-cell">${euros(pa)}</td>
          <td class="num-cell">${euros(pv)}</td>
          <td class="num-cell">${euros(valAchat)}</td>
          <td class="num-cell">${euros(valVente)}</td>
          <td class="num-cell ${marge >= 0 ? 'margin-pos' : 'margin-neg'}">${euros(marge)}</td>
          <td>${zero ? '<span class="badge">⚠ Réappro. nécessaire</span>' : (low ? '<span class="badge warn">⚠ Réappro. nécessaire</span>' : '')}</td>
        `;
        body.appendChild(tr);
      });
    }
  }

