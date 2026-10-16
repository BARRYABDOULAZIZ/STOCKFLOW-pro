  // ---- Gestion / fusion des catégories ----
  const cmSel = new Set();
  let cmLastMerge = null;
  try { const raw = localStorage.getItem('sf_last_cat_merge'); if (raw) cmLastMerge = JSON.parse(raw); } catch (e) {}
  const cmEsc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const cmKey = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
  function cmCounts() {
    const m = new Map();
    (state.products || []).forEach(p => { const c = (p.categorie || '').trim(); if (c) m.set(c, (m.get(c) || 0) + 1); });
    return m;
  }
  function renderCatManager() {
    const dl = document.getElementById('cat-suggestions');
    const counts = cmCounts();
    if (dl) dl.innerHTML = [...counts.keys()].sort((a, b) => a.localeCompare(b)).map(c => `<option value="${cmEsc(c)}"></option>`).join('');
    const box = document.getElementById('catMgr');
    if (!box) return;
    const ok = !!(state.currentUser && (state.currentUser.role === 'proprietaire' || state.currentUser.role === 'admin'));
    box.style.display = ok ? '' : 'none';
    if (!ok) return;
    for (const c of [...cmSel]) if (!counts.has(c)) cmSel.delete(c);
    const sansCat = (state.products || []).filter(p => !(p.categorie || '').trim()).length;
    document.getElementById('cmSummary').textContent = `${counts.size} catégorie(s)` + (sansCat ? ` · ${sansCat} produit(s) sans catégorie` : '');
    document.getElementById('cmUndoBtn').style.display = cmLastMerge && cmLastMerge.items && cmLastMerge.items.length ? '' : 'none';
    if (!box.open) return;
    const q = document.getElementById('cmSearch').value.trim().toLowerCase();
    const qk = cmKey(q);
    const sort = document.getElementById('cmSort').value;
    let rows = [...counts.entries()].filter(([c]) => !q || c.toLowerCase().includes(q) || (qk && cmKey(c).includes(qk)));
    rows.sort((a, b) => sort === 'count' ? (b[1] - a[1]) || a[0].localeCompare(b[0]) : sort === 'small' ? (a[1] - b[1]) || a[0].localeCompare(b[0]) : a[0].localeCompare(b[0]));
    document.getElementById('cmList').innerHTML = rows.length ? rows.map(([c, n]) =>
      `<label class="cm-row${cmSel.has(c) ? ' sel' : ''}"><input type="checkbox" data-cat="${cmEsc(c)}"${cmSel.has(c) ? ' checked' : ''}><span class="cm-name">${cmEsc(c)}</span><span class="cm-badge">${n}</span></label>`).join('')
      : '<div class="muted" style="padding:12px;">Aucune catégorie trouvée.</div>';
    let nProd = 0; cmSel.forEach(c => nProd += counts.get(c) || 0);
    document.getElementById('cmSelInfo').textContent = cmSel.size ? `${cmSel.size} catégorie(s) cochée(s) · ${nProd} produit(s) concerné(s)` : 'Aucune catégorie cochée';
  }
  function cmShowDups() {
    const counts = cmCounts(); const groups = new Map();
    counts.forEach((n, c) => { const k = cmKey(c); if (!k) return; if (!groups.has(k)) groups.set(k, []); groups.get(k).push([c, n]); });
    const dups = [...groups.values()].filter(g => g.length > 1);
    const el = document.getElementById('cmDups');
    el.style.display = '';
    el.innerHTML = dups.length ? dups.map((g, i) => {
      g.sort((a, b) => b[1] - a[1]);
      return `<div class="cm-dup"><span class="cm-dup-names">${g.map(([c, n]) => `${cmEsc(c)} <span class="cm-badge">${n}</span>`).join(' &nbsp;+&nbsp; ')}</span><button class="ghost" data-dup="${i}" type="button">Cocher ces ${g.length}</button></div>`;
    }).join('') : '<div class="muted">Aucun doublon évident (majuscules, accents, pluriel). Tu peux cocher les catégories toi-même dans la liste.</div>';
    el._groups = dups;
  }
  async function cmApply(map, label) {
    // map : [{id, old, neu}]
    const status = document.getElementById('cmStatus');
    let done = 0;
    const chunk = 6;
    for (let i = 0; i < map.length; i += chunk) {
      await Promise.all(map.slice(i, i + chunk).map(it => state.db.doc('produits/' + it.id).update({ categorie: it.neu })));
      done += Math.min(chunk, map.length - i);
      status.textContent = `${label}… ${done} / ${map.length}`;
    }
  }
  document.getElementById('catMgr').addEventListener('toggle', renderCatManager);
  document.getElementById('cmSearch').addEventListener('input', renderCatManager);
  document.getElementById('cmSort').addEventListener('change', renderCatManager);
  document.getElementById('cmDupBtn').addEventListener('click', cmShowDups);
  document.getElementById('cmDups').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dup]'); if (!b) return;
    const g = document.getElementById('cmDups')._groups[Number(b.dataset.dup)];
    g.forEach(([c]) => cmSel.add(c));
    document.getElementById('cmTarget').value = g[0][0];
    renderCatManager();
    document.getElementById('cmList').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  document.getElementById('cmList').addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-cat]'); if (!cb) return;
    if (cb.checked) cmSel.add(cb.dataset.cat); else cmSel.delete(cb.dataset.cat);
    renderCatManager();
  });
  document.getElementById('cmClearBtn').addEventListener('click', () => { cmSel.clear(); renderCatManager(); });
  document.getElementById('cmMergeBtn').addEventListener('click', async () => {
    const target = document.getElementById('cmTarget').value.trim();
    if (!cmSel.size) { toast('Coche au moins une catégorie.'); return; }
    if (!target) { toast('Tape le nom de la catégorie finale.'); return; }
    const todo = (state.products || []).filter(p => cmSel.has((p.categorie || '').trim()) && (p.categorie || '').trim() !== target);
    if (!todo.length) { toast('Rien à changer : les produits sont déjà dans cette catégorie.'); return; }
    if (!confirm(`Mettre ${todo.length} produit(s) venant de ${cmSel.size} catégorie(s) dans « ${target} » ?\n\nTu pourras annuler cette fusion juste après.`)) return;
    const btn = document.getElementById('cmMergeBtn'); btn.disabled = true;
    try {
      const items = todo.map(p => ({ id: p.id, old: p.categorie || '', neu: target }));
      await cmApply(items, 'Fusion en cours');
      cmLastMerge = { target, items: items.map(i => ({ id: i.id, old: i.old })) };
      try { localStorage.setItem('sf_last_cat_merge', JSON.stringify(cmLastMerge)); } catch (e) {}
      cmSel.clear(); document.getElementById('cmTarget').value = '';
      document.getElementById('cmStatus').textContent = `✅ ${items.length} produit(s) classés dans « ${target} ».`;
      toast('Catégories fusionnées !');
    } catch (err) {
      console.error(err);
      document.getElementById('cmStatus').textContent = 'Erreur pendant la fusion : ' + (err.message || err) + ' — recharge la page et vérifie le catalogue.';
    }
    btn.disabled = false; renderCatManager();
  });
  document.getElementById('cmUndoBtn').addEventListener('click', async () => {
    if (!cmLastMerge || !cmLastMerge.items || !cmLastMerge.items.length) return;
    if (!confirm(`Annuler la dernière fusion (${cmLastMerge.items.length} produit(s) reviennent à leur catégorie d'avant) ?`)) return;
    try {
      await cmApply(cmLastMerge.items.map(i => ({ id: i.id, neu: i.old })), 'Annulation en cours');
      cmLastMerge = null; try { localStorage.removeItem('sf_last_cat_merge'); } catch (e) {}
      document.getElementById('cmStatus').textContent = '↩️ Fusion annulée.';
      toast('Fusion annulée.');
    } catch (err) { document.getElementById('cmStatus').textContent = 'Erreur : ' + (err.message || err); }
    renderCatManager();
  });

