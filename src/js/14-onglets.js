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

