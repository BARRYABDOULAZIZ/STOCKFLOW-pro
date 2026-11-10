  // ================= Petite fête quand une vente est finalisée 🎉 =================
  // Confettis + montant au milieu de l'écran pendant 1 seconde. Ne bloque rien : on peut continuer à taper pendant ce temps.
  // Légère : quelques petits carrés animés par le téléphone lui-même (transform / opacity), retirés de la page juste après.
  // true = pour tous les commerçants et leurs caissiers ; false = seulement sur le compte de test (aiAskOk).
  const FETE_POUR_TOUS = true;
  const FETE_COULEURS = ['#5b3df5', '#e2387e', '#ffb400', '#18b877', '#2aa7ff'];
  function feteVente(montant) {
    try {
      if (!FETE_POUR_TOUS && !aiAskOk) return false;
      if (document.hidden) return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      const old = document.getElementById('feteVente'); if (old) old.remove();
      // Téléphone modeste (peu de mémoire ou peu de cœurs) : moins de confettis
      const petit = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
      const n = petit ? 10 : 18;
      const box = document.createElement('div');
      box.className = 'fete'; box.id = 'feteVente'; box.setAttribute('aria-hidden', 'true');
      let html = '';
      for (let k = 0; k < n; k++) {
        const angle = (k / n) * 2 * Math.PI + Math.random() * 0.5;
        const dist = 90 + Math.random() * 110;
        const x = Math.round(Math.cos(angle) * dist), y = Math.round(Math.sin(angle) * dist * 0.8 + 70);
        html += `<i${k % 3 === 0 ? ' class="rond"' : ''} style="background:${FETE_COULEURS[k % FETE_COULEURS.length]};--x:${x}px;--y:${y}px;--r:${Math.round(Math.random() * 540 - 270)}deg;animation-delay:${k % 4 * 25}ms"></i>`;
      }
      const txt = Number(montant) > 0 ? '+ ' + escapeHtml(euros(montant)) : '✓';
      box.innerHTML = html + `<b><span>🎉</span>${txt}</b>`;
      document.body.appendChild(box);
      clearTimeout(feteVente._h);
      feteVente._h = setTimeout(() => box.remove(), 1400);
      return true;
    } catch (e) { console.error(e); return false; }   // une fête ratée ne doit jamais gêner une vente
  }
