  // ================= Suggestions de noms de produits =================
  // Quand on tape les premières lettres dans « Nom du produit », l'appli propose :
  //   1) les produits déjà dans le stock (choisir = réapprovisionner, pas de doublon) ;
  //   2) une liste de produits courants des boutiques (nom + catégorie + unité déjà remplis).
  // On peut aussi taper les initiales : « hd » trouve « Huile Dinor », « lp » trouve « Lait en poudre ».
  // Si la référence est vide, une référence est proposée toute seule (elle reste modifiable).
  // true = pour tous les commerçants ; false = seulement sur le compte de test (aiAskOk).
  const SUGG_POUR_TOUS = true;
  function suggOn() { return SUGG_POUR_TOUS || aiAskOk; }

  // [nom, catégorie, unité]
  const SUGG_CATALOGUE = [
    // Céréales, féculents
    ['Riz parfumé 25 kg', 'Céréales', 'sac'], ['Riz parfumé 50 kg', 'Céréales', 'sac'], ['Riz brisé 50 kg', 'Céréales', 'sac'], ['Riz au kilo', 'Céréales', 'kg'],
    ['Mil', 'Céréales', 'kg'], ['Maïs', 'Céréales', 'kg'], ['Fonio', 'Céréales', 'kg'], ['Couscous de mil (thiéré)', 'Céréales', 'paquet'],
    ['Farine de blé 1 kg', 'Céréales', 'paquet'], ['Farine de blé 50 kg', 'Céréales', 'sac'], ['Semoule', 'Céréales', 'paquet'],
    ['Pâtes spaghetti 500 g', 'Épicerie', 'paquet'], ['Pâtes macaroni 500 g', 'Épicerie', 'paquet'], ['Vermicelle', 'Épicerie', 'paquet'],
    ['Pain', 'Boulangerie', 'pièce'], ['Biscuits', 'Épicerie', 'paquet'],
    // Huiles, sucre, sel, condiments
    ['Huile Dinor 1 L', 'Huiles', 'bouteille'], ['Huile Dinor 5 L', 'Huiles', 'bidon'], ['Huile Dinor 20 L', 'Huiles', 'bidon'],
    ['Huile de palme', 'Huiles', 'litre'], ['Huile en vrac', 'Huiles', 'litre'], ['Huile d\'arachide 1 L', 'Huiles', 'bouteille'],
    ['Sucre en poudre 1 kg', 'Épicerie', 'paquet'], ['Sucre en poudre 50 kg', 'Épicerie', 'sac'], ['Sucre en morceaux', 'Épicerie', 'boîte'],
    ['Sel', 'Épicerie', 'paquet'], ['Poivre', 'Épicerie', 'sachet'], ['Piment', 'Épicerie', 'sachet'], ['Ail', 'Légumes', 'kg'],
    ['Bouillon Maggi', 'Épicerie', 'boîte'], ['Bouillon Jumbo', 'Épicerie', 'boîte'], ['Bouillon Adja', 'Épicerie', 'boîte'],
    ['Tomate concentrée 70 g', 'Conserves', 'boîte'], ['Tomate concentrée 400 g', 'Conserves', 'boîte'], ['Tomate concentrée 2,2 kg', 'Conserves', 'boîte'],
    ['Mayonnaise', 'Épicerie', 'pot'], ['Moutarde', 'Épicerie', 'pot'], ['Vinaigre', 'Épicerie', 'bouteille'], ['Ketchup', 'Épicerie', 'bouteille'],
    // Petit-déjeuner, lait
    ['Lait en poudre 400 g', 'Épicerie', 'boîte'], ['Lait en poudre 900 g', 'Épicerie', 'boîte'], ['Lait en poudre sachet', 'Épicerie', 'sachet'],
    ['Lait concentré sucré', 'Épicerie', 'boîte'], ['Lait caillé', 'Frais', 'pot'], ['Yaourt', 'Frais', 'pot'],
    ['Café Touba', 'Épicerie', 'paquet'], ['Nescafé', 'Épicerie', 'boîte'], ['Thé vert Ataya', 'Épicerie', 'paquet'], ['Thé Lipton', 'Épicerie', 'boîte'],
    ['Chocolat en poudre', 'Épicerie', 'boîte'], ['Beurre', 'Frais', 'pot'], ['Chocolat à tartiner', 'Épicerie', 'pot'], ['Œufs', 'Frais', 'plateau'],
    // Conserves
    ['Sardines 125 g', 'Conserves', 'boîte'], ['Thon en boîte', 'Conserves', 'boîte'], ['Petits pois en boîte', 'Conserves', 'boîte'], ['Haricots en boîte', 'Conserves', 'boîte'],
    // Légumes secs, légumes
    ['Oignons', 'Légumes', 'kg'], ['Oignons 25 kg', 'Légumes', 'sac'], ['Pommes de terre', 'Légumes', 'kg'], ['Pommes de terre 25 kg', 'Légumes', 'sac'],
    ['Niébé', 'Légumes secs', 'kg'], ['Arachides', 'Légumes secs', 'kg'], ['Pâte d\'arachide', 'Épicerie', 'kg'], ['Lentilles', 'Légumes secs', 'kg'],
    // Boissons
    ['Eau minérale 1,5 L', 'Boissons', 'bouteille'], ['Eau minérale 0,5 L', 'Boissons', 'bouteille'], ['Eau en sachet', 'Boissons', 'sachet'], ['Pack d\'eau 6 × 1,5 L', 'Boissons', 'pack'],
    ['Coca-Cola 33 cl', 'Boissons', 'canette'], ['Coca-Cola 1,5 L', 'Boissons', 'bouteille'], ['Fanta 33 cl', 'Boissons', 'canette'], ['Sprite 33 cl', 'Boissons', 'canette'],
    ['Jus de fruits', 'Boissons', 'bouteille'], ['Bissap', 'Boissons', 'bouteille'], ['Gingembre (jus)', 'Boissons', 'bouteille'], ['Boisson énergisante', 'Boissons', 'canette'],
    // Hygiène, beauté
    ['Savon Madar', 'Hygiène', 'pièce'], ['Savon de Marseille', 'Hygiène', 'pièce'], ['Savon de toilette', 'Hygiène', 'pièce'], ['Savon liquide', 'Hygiène', 'bouteille'],
    ['Lessive en poudre', 'Entretien', 'paquet'], ['Lessive en sachet', 'Entretien', 'sachet'], ['Eau de Javel', 'Entretien', 'bouteille'], ['Liquide vaisselle', 'Entretien', 'bouteille'],
    ['Dentifrice', 'Hygiène', 'tube'], ['Brosse à dents', 'Hygiène', 'pièce'], ['Papier toilette', 'Hygiène', 'rouleau'], ['Serviettes hygiéniques', 'Hygiène', 'paquet'],
    ['Couches bébé', 'Hygiène', 'paquet'], ['Lait de toilette', 'Beauté', 'flacon'], ['Pommade', 'Beauté', 'pot'], ['Parfum', 'Beauté', 'flacon'],
    ['Déodorant', 'Hygiène', 'pièce'], ['Lames de rasoir', 'Hygiène', 'paquet'], ['Mèches', 'Beauté', 'paquet'], ['Encens (thiouraye)', 'Beauté', 'sachet'],
    // Maison, divers
    ['Bougies', 'Maison', 'paquet'], ['Allumettes', 'Maison', 'boîte'], ['Briquet', 'Maison', 'pièce'], ['Charbon', 'Maison', 'sac'], ['Gaz 6 kg', 'Maison', 'bouteille'], ['Gaz 12 kg', 'Maison', 'bouteille'],
    ['Piles', 'Maison', 'paquet'], ['Ampoule', 'Maison', 'pièce'], ['Sachets plastique', 'Maison', 'paquet'], ['Insecticide', 'Entretien', 'bombe'], ['Tortillon anti-moustique', 'Maison', 'boîte'],
    // Téléphonie
    ['Carte SIM Orange', 'Téléphonie', 'pièce'], ['Carte SIM Free', 'Téléphonie', 'pièce'], ['Carte SIM Expresso', 'Téléphonie', 'pièce'], ['Carte SIM Yas', 'Téléphonie', 'pièce'],
    ['Carte de recharge', 'Téléphonie', 'pièce'], ['Chargeur de téléphone', 'Téléphonie', 'pièce'], ['Écouteurs', 'Téléphonie', 'pièce'], ['Câble USB', 'Téléphonie', 'pièce'],
    // Quincaillerie de base
    ['Ciment 50 kg', 'Quincaillerie', 'sac'], ['Fer à béton', 'Quincaillerie', 'barre'], ['Clous', 'Quincaillerie', 'kg'], ['Peinture', 'Quincaillerie', 'pot'], ['Cadenas', 'Quincaillerie', 'pièce'],
  ];

  const suggNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const suggWords = (n) => n.split(' ').filter(Boolean);
  // Initiales des mots importants : « Huile Dinor 5 L » → « hd », « Lait en poudre 400 g » → « lp »
  // (on saute les petits mots « en, de, du… » et les unités « g, kg, l, cl… »)
  const SUGG_PETITS = new Set(['de', 'du', 'des', 'en', 'au', 'aux', 'la', 'le', 'les', 'et', 'a', 'd', 'l', 'g', 'kg', 'cl', 'ml']);
  const suggInit = (n) => suggWords(n).filter(w => /^[a-z]/.test(w) && !SUGG_PETITS.has(w)).map(w => w[0]).join('');

  // Score : 3 = le nom commence par le texte, 2 = un mot commence par le texte, 1 = les initiales correspondent ; 0 = pas de rapport
  function suggScore(nomNorm, q) {
    if (nomNorm.startsWith(q)) return 3;
    const parts = q.split(' ');
    const ws = suggWords(nomNorm);
    if (parts.every(p => ws.some(w => w.startsWith(p)))) return 2;
    if (!q.includes(' ') && q.length >= 2 && suggInit(nomNorm).startsWith(q)) return 1;
    return 0;
  }

  function suggSearch(text, max) {
    const q = suggNorm(text);
    if (!q) return [];
    const seen = new Set(), out = [];
    (state.products || []).forEach(p => {
      const n = suggNorm(p.nom); if (!n) return;
      const s = suggScore(n, q); if (!s) return;
      seen.add(n); out.push({ type: 'stock', nom: p.nom, ref: p.ref, categorie: p.categorie || '', unite: p.unite || '', score: s + 10 });
    });
    SUGG_CATALOGUE.forEach(([nom, categorie, unite]) => {
      const n = suggNorm(nom); if (seen.has(n)) return;
      const s = suggScore(n, q); if (!s) return;
      out.push({ type: 'cat', nom, categorie, unite, score: s });
    });
    out.sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom, 'fr'));
    return out.slice(0, max || 6);
  }

  // Référence proposée : initiales + chiffres du nom (« Huile Dinor 5 L » → « HD5 », « Lait en poudre 400 g » → « LP400 »), rendue unique
  function suggRef(nom) {
    const ws = suggWords(suggNorm(nom)).filter(w => !SUGG_PETITS.has(w));
    let base = ws.map(w => /^\d/.test(w) ? w : w[0]).join('').toUpperCase().slice(0, 8);
    if (base.length < 3) base = (ws.join('').toUpperCase() + 'XXX').slice(0, Math.max(3, base.length));
    const used = new Set((state.products || []).map(p => String(p.ref || '').toUpperCase()));
    let ref = base, i = 2;
    while (used.has(ref)) ref = base + '-' + (i++);
    return ref;
  }

  let suggIdx = -1, suggItems = [];
  // Ce que la dernière suggestion a rempli toute seule : si on s'est trompé, un autre choix (ou effacer le nom) le remplace.
  let suggAuto = null;        // { nom, 'p-ref', 'p-categorie', 'p-unite' } après un produit du catalogue
  let suggStockNom = null;    // nom du produit du stock choisi (mode réapprovisionnement)
  const SUGG_CHAMPS = ['p-ref', 'p-categorie', 'p-unite'];
  // Efface ce que la suggestion avait rempli, sauf ce que le commerçant a changé à la main
  function suggUndo() {
    if (suggAuto) {
      SUGG_CHAMPS.forEach(id => { const el = document.getElementById(id); if (el && el.value === suggAuto[id]) el.value = ''; });
      suggAuto = null;
    }
    if (suggStockNom !== null) {
      // On quitte le produit du stock : la fiche se vide (comme quand on efface la référence), le nom tapé est gardé
      const inp = document.getElementById('p-nom'), keep = inp.value;
      const ref = document.getElementById('p-ref'); ref.value = ''; ref.dispatchEvent(new Event('input', { bubbles: true }));
      inp.value = keep; suggStockNom = null;
    }
  }
  function suggBox() {
    let box = document.getElementById('suggNom');
    if (!box) {
      box = document.createElement('div'); box.id = 'suggNom'; box.className = 'sugg-nom'; box.setAttribute('role', 'listbox');
      const inp = document.getElementById('p-nom');
      inp.parentElement.style.position = 'relative';
      inp.parentElement.appendChild(box);
    }
    return box;
  }
  function suggHide() { const b = document.getElementById('suggNom'); if (b) b.style.display = 'none'; suggIdx = -1; suggItems = []; }
  function suggShow() {
    const inp = document.getElementById('p-nom');
    if (!suggOn() || editingId) { suggHide(); return; }
    suggItems = suggSearch(inp.value, 6);
    if (!suggItems.length) { suggHide(); return; }
    const box = suggBox();
    box.innerHTML = `<div class="sugg-head">💡 Touche un produit pour le choisir</div>` + suggItems.map((it, i) => `<div class="sugg-it${it.type === 'stock' ? ' stock' : ''}${i === suggIdx ? ' on' : ''}" role="option" data-i="${i}">
        <span class="sugg-ic">${it.type === 'stock' ? '📦' : '🛒'}</span>
        <span class="sugg-tx"><span class="sugg-n">${escapeHtml(it.nom)}</span>
        <span class="sugg-m">${it.type === 'stock' ? 'Déjà dans ton stock · ' + escapeHtml(it.ref || '') : escapeHtml([it.categorie, it.unite].filter(Boolean).join(' · '))}</span></span>
        <span class="sugg-go">${it.type === 'stock' ? 'Réappro' : 'Choisir'}</span>
      </div>`).join('');
    box.style.display = 'block';
  }
  function suggPick(i) {
    const it = suggItems[i]; if (!it) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    suggUndo();   // un choix précédent (peut-être par erreur) ne reste pas collé
    if (it.type === 'stock') {
      // Produit déjà connu : on passe par la référence, ce qui remplit la fiche (mode réapprovisionnement)
      set('p-ref', it.ref || '');
      document.getElementById('p-ref').dispatchEvent(new Event('input', { bubbles: true }));
      set('p-nom', it.nom);
      suggStockNom = it.nom;
    } else {
      set('p-nom', it.nom);
      suggAuto = { nom: it.nom };
      const fill = (id, v) => { const el = document.getElementById(id); if (el && !el.value.trim()) { el.value = v; suggAuto[id] = v; } };
      fill('p-categorie', it.categorie); fill('p-unite', it.unite); fill('p-ref', suggRef(it.nom));
    }
    suggHide();
    const next = document.getElementById(it.type === 'stock' ? 'p-stock' : 'p-prixachat') || document.getElementById('p-stock');
    if (next) { try { next.focus(); next.select && next.select(); } catch (e) {} }
  }

  (function suggInitUI() {
    const inp = document.getElementById('p-nom'); if (!inp) return;
    inp.setAttribute('autocomplete', 'off');
    inp.addEventListener('input', () => {
      // Le nom ne correspond plus au produit choisi : on retire ce qui avait été rempli tout seul
      if ((suggAuto && inp.value !== suggAuto.nom) || (suggStockNom !== null && inp.value !== suggStockNom)) suggUndo();
      suggIdx = -1; suggShow();
    });
    inp.addEventListener('focus', () => { if (inp.value.trim()) suggShow(); });
    inp.addEventListener('keydown', (e) => {
      const b = document.getElementById('suggNom'); if (!b || b.style.display === 'none') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); suggIdx = Math.min(suggItems.length - 1, suggIdx + 1); suggShow(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); suggIdx = Math.max(0, suggIdx - 1); suggShow(); }
      else if (e.key === 'Enter' && suggIdx >= 0) { e.preventDefault(); suggPick(suggIdx); }
      else if (e.key === 'Escape') suggHide();
    });
    // Le choix se fait au « click » (doigt levé sans glisser) : faire défiler la liste avec le doigt ne choisit rien.
    // Toucher la liste ne la ferme pas ; toucher ailleurs la ferme.
    document.addEventListener('pointerdown', (e) => {
      if (e.target.closest && e.target.closest('#suggNom')) return;
      if (e.target !== inp) suggHide();
    });
    document.addEventListener('click', (e) => {
      const it = e.target.closest && e.target.closest('#suggNom .sugg-it');
      if (it) { e.preventDefault(); suggPick(Number(it.dataset.i)); }
    });
  })();
