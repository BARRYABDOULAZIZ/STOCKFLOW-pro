  document.querySelectorAll('nav.tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('section.panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'ventes') renderInvoiceLines();
      if (btn.dataset.tab === 'dashboard') renderDashboard();
      if (btn.dataset.tab === 'inventaire') renderInventaire();
      if (btn.dataset.tab === 'scanner') { renderMovements(); focusUsbInput(); }
      if (btn.dataset.tab === 'rapports') renderRapports();
      if (btn.dataset.tab === 'parametres') loadTeam();
      if (btn.dataset.tab === 'donnees') loadAuditLogs();
      if (btn.dataset.tab === 'comptabilite') renderComptabilite();
      if (btn.dataset.tab === 'caisse') renderCaisse();
      if (btn.dataset.tab === 'documents') renderDocuments();
      if (btn.dataset.tab !== 'scanner') stopCameraScan();
      closeGlobalScanner();
      if (btn.dataset.tab === 'fournisseurs') renderFournisseurs();
      if (btn.dataset.tab === 'admin') adminLoad();
    });
  });

  // ---- Application Android : le bouton « retour » du téléphone revient à l'accueil au lieu de fermer l'appli ----
  // Accueil = page de base de l'historique ; les autres onglets (et la page de Bel) ajoutent UNE étape d'historique.
  if (ANDROID_APP) {
    let fromBack = false;
    const tabBtn = (t) => document.querySelector(`nav.tabs button[data-tab="${t}"]`);
    document.querySelectorAll('nav.tabs button').forEach(btn => btn.addEventListener('click', () => {
      if (fromBack) return;
      const t = btn.dataset.tab, inStep = !!(history.state && history.state.sfTab);
      if (t === 'dashboard') { if (inStep) history.back(); return; }
      try { inStep ? history.replaceState({ sfTab: t }, '') : history.pushState({ sfTab: t }, ''); } catch (e) {}
    }));
    window.addEventListener('popstate', () => {
      const page = document.getElementById('belPage');
      if (page && page.style.display === 'block') { try { belClosePage(); } catch (e) {} return; }
      if (document.body.classList.contains('menu-open')) document.body.classList.remove('menu-open');
      const want = (history.state && history.state.sfTab) || 'dashboard', b = tabBtn(want);
      if (b && !b.classList.contains('active') && b.style.display !== 'none') { fromBack = true; try { b.click(); } finally { fromBack = false; } }
    });
  }
