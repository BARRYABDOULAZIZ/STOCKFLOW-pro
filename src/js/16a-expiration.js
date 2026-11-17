  // ================= Date d'expiration (péremption) des produits =================
  // Une date par produit : celle du lot qui expire le plus tôt. Rien n'est obligatoire : sans date, rien ne change.
  // Ce que ça ajoute : le champ « Date d'expiration » dans la fiche produit, une pastille ⛔ / ⏳ sur le produit,
  // le filtre « ⏳ Péremption » dans Produits, un conseil sur l'Accueil, et une alerte à la caisse si on vend un produit périmé.
  // AVANT de l'ouvrir : lancer une fois supabase/date_expiration.sql dans Supabase → SQL Editor (ajoute la colonne).
  // true = pour tous les commerçants ; false = seulement sur le compte de test (aiAskOk).
  const EXP_POUR_TOUS = true;
  const EXP_JOURS = 30;   // « expire bientôt » = dans 30 jours ou moins

  function expOn() { return EXP_POUR_TOUS || aiAskOk; }
  function expDate(p) { const d = p && p.dateExpiration ? String(p.dateExpiration).slice(0, 10) : ''; return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''; }
  // Nombre de jours avant la date (0 = aujourd'hui, négatif = déjà périmé) ; null si pas de date
  function expDays(p) {
    const d = expDate(p); if (!d) return null;
    return Math.round((new Date(d + 'T12:00:00').getTime() - new Date(todayStr() + 'T12:00:00').getTime()) / 86400000);
  }
  // 'perime' | 'bientot' | null — seulement pour les produits encore en stock
  function expState(p) {
    if (!expOn() || !(Number(p && p.stock) > 0)) return null;
    const n = expDays(p); if (n === null) return null;
    if (n < 0) return 'perime';
    if (n <= EXP_JOURS) return 'bientot';
    return null;
  }
  function expFmt(p) { const d = expDate(p); return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : ''; }
  function expBadge(p) {
    const s = expState(p); if (!s) return '';
    const n = expDays(p);
    if (s === 'perime') return `<span class="badge exp-out" title="Expiré le ${expFmt(p)}">⛔ Périmé</span>`;
    return `<span class="badge exp-soon" title="Expire le ${expFmt(p)}">⏳ ${n === 0 ? "expire aujourd'hui" : 'expire dans ' + n + ' j'}</span>`;
  }
  // Affiche ou cache le champ du formulaire, et redessine ce qui dépend de la péremption
  function expRefresh() {
    const box = document.getElementById('p-exp-box'); if (box) box.style.display = expOn() ? '' : 'none';
    if (!expOn() && stockCat === '__exp') stockCat = '';
    try { renderStock(); } catch (e) { console.error(e); }
    try { renderInsights(); } catch (e) { console.error(e); }
  }
