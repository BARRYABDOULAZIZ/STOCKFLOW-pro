  // ================= Animation des chiffres (compteur) =================
  (function () {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const IDS = ['heroInvesti','heroValeur','heroBenefice','dbProduits','dbRupture','dbReappro','dbVentesJour','dbVentesMois','statTotalValue','statCount','statAlert','statCategories','csEsp','csMobile','csVirement','csCheque','csTotal','clDetteTotale','clEsp','clAttendu','clAutres','clNb','clCompte','clEcart'];
    const RX = /^([^\d-]*)(-?\d[\d\s  ]*)(.*)$/;
    const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
    IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      let busy = false, raf = 0, shown = null;
      const write = (txt) => { busy = true; el.textContent = txt; obs.takeRecords(); busy = false; };
      const obs = new MutationObserver(() => {
        if (busy) return;
        const m = RX.exec(el.textContent || '');
        if (!m) { shown = null; return; }
        const target = parseInt(m[2].replace(/[^\d-]/g, ''), 10);
        if (isNaN(target)) return;
        const pre = m[1], post = m[3], final = el.textContent;
        if (shown === target) return;
        const from = shown === null ? 0 : shown, t0 = performance.now(), dur = 650;
        cancelAnimationFrame(raf);
        const step = (t) => {
          const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
          if (k < 1) { write(pre + fmt(from + (target - from) * e) + post); raf = requestAnimationFrame(step); }
          else { write(final); }
        };
        shown = target;
        raf = requestAnimationFrame(step);
      });
      obs.observe(el, { childList: true, characterData: true, subtree: true });
    });
  })();

