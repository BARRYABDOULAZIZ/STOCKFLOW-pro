  // ---- Liste déroulante des clients dans le formulaire de facture ----
  (function () {
    const input = document.getElementById('f-client');
    const box = document.getElementById('clientSuggest');
    if (!input || !box) return;
    const esc = (t) => String(t || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    let activeIdx = -1;
    function render() {
      const q = input.value.trim().toLowerCase();
      const list = (state.clients || []).filter(c => c.nom && (!q || c.nom.toLowerCase().includes(q)))
        .sort((a, b) => a.nom.localeCompare(b.nom));
      if (!(state.clients || []).length) { box.style.display = 'none'; return; }
      box.innerHTML = list.length
        ? list.map((c, i) => `<div class="cs-item" data-nom="${esc(c.nom)}"><span class="cs-av">${esc(c.nom.trim().charAt(0).toUpperCase())}</span><span class="cs-txt"><span class="cs-name">${esc(c.nom)}</span><span class="cs-tel">${esc(c.telephone || 'Pas de téléphone')}</span></span></div>`).join('')
        : '<div class="cs-empty">Aucun client trouvé — le nom tapé sera enregistré comme nouveau client.</div>';
      activeIdx = -1;
      box.style.display = '';
    }
    function pick(nom) {
      input.value = nom;
      box.style.display = 'none';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    input.addEventListener('focus', render);
    input.addEventListener('click', render);
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      const items = [...box.querySelectorAll('.cs-item')];
      if (box.style.display === 'none' || !items.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
        items[activeIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault(); pick(items[activeIdx].dataset.nom);
      } else if (e.key === 'Escape') { box.style.display = 'none'; }
    });
    box.addEventListener('mousedown', (e) => {
      const it = e.target.closest('.cs-item');
      if (it) { e.preventDefault(); pick(it.dataset.nom); }
    });
    document.addEventListener('mousedown', (e) => { if (e.target !== input && !box.contains(e.target)) box.style.display = 'none'; });
  })();

