  // ================= Produits (catalogue) =================
  let stockFilter = '', stockCat = '';
  let stockView = 'cards'; try { stockView = localStorage.getItem('sf_stock_view') || 'cards'; } catch (e) {}
  const stockAmt = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
  let stockSearchT = null;
  document.getElementById('stockSearch').addEventListener('input', e => { stockFilter = e.target.value.trim().toLowerCase(); clearTimeout(stockSearchT); stockSearchT = setTimeout(renderStock, 150); });

  function renderStock() {
    const body = document.getElementById('stockBody');
    const empty = document.getElementById('stockEmpty');
    body.innerHTML = '';

    // Pastilles de catégories (les plus remplies d'abord) + "Stock bas"
    const catCount = {}; state.products.forEach(p => { const c = (p.categorie || '').trim(); if (c) catCount[c] = (catCount[c] || 0) + 1; });
    const lowCount = state.products.filter(p => Number(p.stock) <= Number(p.seuil)).length;
    const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (stockCat && stockCat !== '__low' && !catCount[stockCat]) stockCat = '';
    document.getElementById('catChips').innerHTML = [['', 'Tous', state.products.length]].concat(lowCount ? [['__low', '⚠ Stock bas', lowCount]] : []).concat(topCats.map(([c, n]) => [c, c, n]))
      .map(([k, l, n]) => `<button type="button" class="cat-chip ${stockCat === k ? 'on' : ''}" data-cat="${escapeHtml(k)}">${escapeHtml(l)} <em>${n}</em></button>`).join('');
    document.getElementById('stockValue').textContent = stockAmt(state.products.reduce((t, p) => t + (Number(p.prixAchat) || 0) * (Number(p.stock) || 0), 0)) + ' ' + curSym();
    document.querySelectorAll('.view-toggle button').forEach(b => b.classList.toggle('on', b.dataset.view === stockView));
    document.getElementById('stockTableWrap').style.display = stockView === 'table' ? '' : 'none';
    const cardsBox = document.getElementById('stockCards');
    cardsBox.style.display = stockView === 'cards' ? '' : 'none';
    cardsBox.innerHTML = '';

    const filtered = state.products.filter(p => {
      if (stockCat === '__low' && !(Number(p.stock) <= Number(p.seuil))) return false;
      if (stockCat && stockCat !== '__low' && (p.categorie || '').trim() !== stockCat) return false;
      if (!stockFilter) return true;
      return (p.ref || '').toLowerCase().includes(stockFilter) || (p.nom || '').toLowerCase().includes(stockFilter) || (p.codeBarre || '').toLowerCase().includes(stockFilter) || (p.emplacement || '').toLowerCase().includes(stockFilter);
    }).sort((a, b) => (a.ref || '').localeCompare(b.ref || ''));

    document.getElementById('catalogCount').textContent = state.products.length ? `(${filtered.length} affiché${filtered.length > 1 ? 's' : ''} sur ${state.products.length})` : '';

    if (filtered.length === 0) {
      empty.style.display = 'block';
      empty.textContent = state.products.length === 0 ? "Aucun produit pour l'instant — ajoute ton premier article ci-dessus." : "Aucun résultat pour cette recherche.";
    } else {
      empty.style.display = 'none';
      const frag = document.createDocumentFragment();
      const CAP = 500;
      if (stockView === 'cards') {
        cardsBox.innerHTML = filtered.slice(0, 300).map(p => {
          const zero = Number(p.stock) <= 0, low = !zero && Number(p.stock) <= Number(p.seuil);
          const unit = escapeHtml(p.unite || 'unité');
          return `<div class="sc ${zero ? 'zero' : low ? 'low' : ''}">
            <div class="sc-main"><div class="sc-name">${escapeHtml(p.nom)}</div><div class="sc-sub">${escapeHtml(p.ref || '')}${p.categorie ? ' · ' + escapeHtml(p.categorie) : ''}${p.emplacement ? ' · 📍' + escapeHtml(p.emplacement) : ''}</div></div>
            <div class="sc-stock"><b>${zero ? 'Rupture' : escapeHtml(String(p.stock))}</b><small>${zero ? 'à commander' : unit + (low ? ' · bas' : '')}</small></div>
            <div class="sc-prices"><span class="v">Vente ${stockAmt(p.prixVente)}</span><span class="a cost-col">Achat ${stockAmt(p.prixAchat)}</span></div>
            <div class="sc-act"><button class="icon-btn" data-edit="${p.id}" title="Modifier">✎</button><button class="icon-btn" data-del="${p.id}" title="Supprimer">✕</button></div>
          </div>`;
        }).join('') + (filtered.length > 300 ? `<div class="muted" style="grid-column:1/-1;text-align:center;padding:12px;">+ ${filtered.length - 300} autres produits — affine ta recherche.</div>` : '');
      } else
      filtered.slice(0, CAP).forEach(p => {
        const zero = Number(p.stock) <= 0;
        const low = !zero && Number(p.stock) <= Number(p.seuil);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(p.ref)}</td>
          <td>${escapeHtml(p.nom)}</td>
          <td class="muted">${escapeHtml(p.codeBarre || '—')}</td>
          <td class="muted">${escapeHtml(p.fournisseur || '—')}</td>
          <td class="muted">${escapeHtml(p.categorie || '—')}</td>
          <td class="muted">${escapeHtml(p.emplacement || '—')}</td>
          <td class="num-cell cost-col">${euros(p.prixAchat)}</td>
          <td class="num-cell">${euros(p.prixVente)}</td>
          <td class="num-cell ${zero ? '' : (low ? 'stock-low' : 'stock-ok')}">${zero ? `<span class="stock-zero">0</span>` : `<span class="stk ${low ? 'low' : 'ok'}">${p.stock}</span>`}${low ? ' <span class="badge warn">bas</span>' : ''}</td>
          <td class="muted">${escapeHtml(p.unite || 'unité')}</td>
          <td class="num-cell">
            <button class="icon-btn" data-edit="${p.id}" title="Modifier" style="opacity:0.6;">✎</button>
            <button class="icon-btn" data-del="${p.id}" title="Supprimer">✕</button>
          </td>
        `;
        frag.appendChild(tr);
      });
      body.appendChild(frag);
      if (filtered.length > CAP) {
        const trMore = document.createElement('tr');
        trMore.innerHTML = `<td colspan="10" class="muted" style="text-align:center; padding:14px;">+ ${filtered.length - CAP} autres résultats — affine ta recherche.</td>`;
        body.appendChild(trMore);
      }
    }

    document.getElementById('statCount').textContent = state.products.length;
    document.getElementById('statAlert').textContent = state.products.filter(p => Number(p.stock) <= Number(p.seuil)).length;
    document.getElementById('statCategories').textContent = new Set(state.products.map(p => p.categorie).filter(Boolean)).size;

    body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.del)));
    body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => startEditProduct(b.dataset.edit)));
    cardsBox.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteProduct(b.dataset.del)));
    cardsBox.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => startEditProduct(b.dataset.edit)));

    if (state.products.length > 3000) setSync(true, `synchronisé · ${state.products.length} réf. — catalogue volumineux, pense à archiver les articles inactifs`);

    updatePerteSelect();
  }

  document.getElementById('catChips').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; stockCat = b.dataset.cat; renderStock(); });
  document.querySelector('.view-toggle').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (!b) return; stockView = b.dataset.view; try { localStorage.setItem('sf_stock_view', stockView); } catch (er) {} renderStock(); });
  // Œil : masque les gros montants quand un client regarde l'écran
  (function () {
    const apply = (on) => { document.body.classList.toggle('hide-amounts', on); document.querySelectorAll('[data-eye]').forEach(b => { b.textContent = on ? '🙈' : '👁'; }); };
    try { apply(localStorage.getItem('sf_hide_amounts') === '1'); } catch (e) {}
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-eye]'); if (!b) return; const on = !document.body.classList.contains('hide-amounts'); apply(on); try { localStorage.setItem('sf_hide_amounts', on ? '1' : '0'); } catch (er) {} });
  })();

  function updatePerteSelect() {
    const sel = document.getElementById('ps-produit');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = state.products.slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
      .map(p => `<option value="${p.id}">${escapeHtml(p.nom)} (${escapeHtml(p.ref || '')}) — stock : ${p.stock} ${escapeHtml(p.unite || '')}</option>`).join('');
    if (current && state.products.some(p => p.id === current)) sel.value = current;
  }

