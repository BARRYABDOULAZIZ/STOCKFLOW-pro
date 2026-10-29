  // ================= Export / Import / Sauvegarde =================
  const LOCAL_BACKUP_KEY = 'stockflow_pro_backup_v1';
  let xlsxLoadingPromise = null;

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    if (xlsxLoadingPromise) return xlsxLoadingPromise;
    xlsxLoadingPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.integrity = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT'; s.crossOrigin = 'anonymous';  // empreinte : un fichier modifié sur le CDN est refusé
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('load-failed'));
      document.head.appendChild(s);
    });
    return xlsxLoadingPromise;
  }

  function buildFullDataset() {
    return {
      exportedAt: new Date().toISOString(),
      app: 'BoromBoutik',
      produits: state.products,
      factures: state.invoices,
      mouvements: state.movements,
      fournisseurs: state.fournisseurs,
      commandes_fournisseurs: state.commandes,
      clients: state.clients,
      paiements: state.paiements,
      depenses: state.depenses,
      documents: state.documents,
    };
  }
  // Rappel de copie de secours (propriétaire / admin) : une fois par semaine
  const backupKey = () => 'sf_last_export:' + (CURRENT_COMMERCE_ID || '');
  function markExported() { try { localStorage.setItem(backupKey(), String(Date.now())); } catch (e) {} updateBackupReminder(); }
  function updateBackupReminder() {
    const box = document.getElementById('backupReminder'); if (!box) return;
    let show = false, txt = '';
    try {
      if (isOwnerOrAdmin() && CURRENT_COMMERCE_ID && (state.products || []).length) {
        const last = Number(localStorage.getItem(backupKey())) || 0;
        const snooze = Number(localStorage.getItem(backupKey() + ':later')) || 0;
        const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
        if ((days === null || days >= 7) && Date.now() > snooze) {
          show = true;
          txt = days === null ? "tu n'as encore jamais téléchargé de copie de tes données sur cet appareil. Garde-la en sécurité (WhatsApp, Google Drive…)."
                              : 'ta dernière copie date de ' + days + ' jours. Pense à en télécharger une nouvelle.';
        }
      }
    } catch (e) {}
    document.getElementById('backupReminderTxt').textContent = txt;
    box.style.display = show ? 'flex' : 'none';
  }
  async function downloadBackup() {
    const json = JSON.stringify(buildFullDataset(), null, 2);
    const nom = String((state.commerce && state.commerce.nom) || 'boutique').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 30);
    const ok = await saveFile(`copie-${nom}-${todayStr()}.json`, json);
    if (ok) { markExported(); toast('Copie téléchargée ✅ Garde ce fichier en lieu sûr. Pour la remettre : onglet Données > Import JSON.'); }
  }
  document.getElementById('btnBackupNow').addEventListener('click', downloadBackup);
  document.getElementById('btnBackupLater').addEventListener('click', () => {
    try { localStorage.setItem(backupKey() + ':later', String(Date.now() + 2 * 86400000)); } catch (e) {}
    updateBackupReminder();
  });

  function csvEscape(v) {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function buildProductsCsv() {
    const headers = ['Référence','Nom','Code-barres','Fournisseur','Catégorie','Prix achat','Prix vente','Stock','Unité','Seuil'];
    const rows = state.products.map(p => [p.ref, p.nom, p.codeBarre || '', p.fournisseur || '', p.categorie || '', p.prixAchat || 0, p.prixVente || 0, p.stock || 0, p.unite || '', p.seuil || 0]);
    return '\ufeff' + [headers, ...rows].map(r => r.map(csvEscape).join(';')).join('\r\n');
  }

  async function saveFile(filename, data) {
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return true;
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la préparation du fichier.');
      return false;
    }
  }

  document.getElementById('btnExportExcel').addEventListener('click', async () => {
    toast('Préparation du fichier Excel…');
    try {
      await loadXlsx();
      const wb = window.XLSX.utils.book_new();

      const wsProduits = window.XLSX.utils.json_to_sheet(state.products.map(p => ({
        Référence: p.ref, Nom: p.nom, 'Code-barres': p.codeBarre || '', Fournisseur: p.fournisseur || '',
        Catégorie: p.categorie || '', 'Prix achat': p.prixAchat || 0, 'Prix vente': p.prixVente || 0,
        Stock: p.stock || 0, Unité: p.unite || '', Seuil: p.seuil || 0,
      })));
      window.XLSX.utils.book_append_sheet(wb, wsProduits, 'Produits');

      const factureLignes = [];
      state.invoices.forEach(inv => (inv.lignes || []).forEach(l => {
        factureLignes.push({ Facture: 'FAC-' + String(inv.num).padStart(4, '0'), Date: inv.date, Client: inv.client || '', Annulée: inv.annulee ? 'Oui' : 'Non', Référence: l.ref || '', Désignation: l.nom, Quantité: l.qte, Unité: l.unite || '', 'Prix unitaire': l.prix, 'Total ligne': (Number(l.prix) || 0) * (Number(l.qte) || 0) });
      }));
      const wsFactures = window.XLSX.utils.json_to_sheet(factureLignes);
      window.XLSX.utils.book_append_sheet(wb, wsFactures, 'Factures');

      const wsMouv = window.XLSX.utils.json_to_sheet(state.movements.map(m => ({
        Date: m.date, Produit: m.nom, Référence: m.ref || '', Quantité: m.quantite, Unité: m.unite || '',
        'Ancien stock': m.ancienStock, 'Nouveau stock': m.nouveauStock, Source: m.source || '',
      })));
      window.XLSX.utils.book_append_sheet(wb, wsMouv, 'Mouvements');

      const clientNom = (id) => { const c = state.clients.find(x => x.id === id); return c ? c.nom : ''; };
      const wsClients = window.XLSX.utils.json_to_sheet(state.clients.map(c => ({ Nom: c.nom, Téléphone: c.telephone || '', Adresse: c.adresse || '' })));
      window.XLSX.utils.book_append_sheet(wb, wsClients, 'Clients');

      const wsPaiements = window.XLSX.utils.json_to_sheet(state.paiements.map(p => {
        const inv = state.invoices.find(i => i.id === p.factureId);
        return { Date: p.date, Client: clientNom(p.clientId), Facture: inv ? 'FAC-' + String(inv.num).padStart(4, '0') : '', Montant: p.montant, Mode: p.mode || '', Opérateur: p.operateur || '' };
      }));
      window.XLSX.utils.book_append_sheet(wb, wsPaiements, 'Paiements');

      const wsDepenses = window.XLSX.utils.json_to_sheet(state.depenses.map(d => ({ Date: d.date, Catégorie: d.categorie || '', Montant: d.montant, Note: d.note || '', Opérateur: d.operateur || '' })));
      window.XLSX.utils.book_append_sheet(wb, wsDepenses, 'Dépenses');

      const arrayBuf = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([arrayBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const ok = await saveFile(`boromboutik-${todayStr()}.xlsx`, blob);
      if (ok) { markExported(); toast('Export Excel prêt.'); }
    } catch (err) {
      console.error(err);
      toast("Impossible de générer le fichier Excel.");
    }
  });

  document.getElementById('btnExportCsv').addEventListener('click', async () => {
    const csv = buildProductsCsv();
    const ok = await saveFile(`boromboutik-produits-${todayStr()}.csv`, csv);
    if (ok) toast('Export CSV prêt.');
  });

  document.getElementById('btnExportJson').addEventListener('click', async () => {
    const json = JSON.stringify(buildFullDataset(), null, 2);
    const ok = await saveFile(`boromboutik-${todayStr()}.json`, json);
    if (ok) { markExported(); toast('Export JSON prêt.'); }
  });

  // ---- Import JSON ----
  document.getElementById('btnImportJson').addEventListener('click', () => document.getElementById('importJsonFile').click());
  document.getElementById('importJsonFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const statusEl = document.getElementById('importStatus');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await runImport(data, statusEl);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Fichier invalide — impossible de le lire comme un export JSON de l'application.";
      statusEl.style.color = 'var(--danger)';
    }
  });

  async function runImport(data, statusEl) {
    const produits = Array.isArray(data.produits) ? data.produits : [];
    const factures = Array.isArray(data.factures) ? data.factures : [];
    const mouvements = Array.isArray(data.mouvements) ? data.mouvements : [];
    const fournisseurs = Array.isArray(data.fournisseurs) ? data.fournisseurs : [];
    const commandes = Array.isArray(data.commandes_fournisseurs) ? data.commandes_fournisseurs : [];
    const clients = Array.isArray(data.clients) ? data.clients : [];
    const paiements = Array.isArray(data.paiements) ? data.paiements : [];
    const depenses = Array.isArray(data.depenses) ? data.depenses : [];
    const documents = Array.isArray(data.documents) ? data.documents : [];
    if (produits.length === 0 && factures.length === 0 && mouvements.length === 0 && fournisseurs.length === 0 && commandes.length === 0 && clients.length === 0 && paiements.length === 0 && depenses.length === 0 && documents.length === 0) {
      statusEl.textContent = "Ce fichier ne contient aucune donnée reconnue.";
      statusEl.style.color = 'var(--danger)';
      return;
    }
    const total = produits.length + factures.length + mouvements.length + fournisseurs.length + commandes.length + clients.length + paiements.length + depenses.length + documents.length;
    if (!confirm(`Importer ${produits.length} produit(s), ${factures.length} facture(s), ${mouvements.length} mouvement(s), ${fournisseurs.length} fournisseur(s), ${commandes.length} commande(s), ${clients.length} client(s), ${paiements.length} paiement(s), ${depenses.length} dépense(s) et ${documents.length} devis/bon(s) ? Les éléments ayant le même identifiant seront remplacés.`)) return;
    if (!state.db) { statusEl.textContent = 'Connexion non disponible.'; return; }

    statusEl.style.color = '';
    statusEl.textContent = `Import en cours… 0 / ${total}`;
    let done = 0;
    try {
      for (const p of produits) { const { id, ...rest } = p; if (id) { await state.db.doc('produits/' + id).set(rest); done++; statusEl.textContent = `Import en cours… ${done} / ${total}`; } }
      for (const f of factures) { const { id, ...rest } = f; if (id) { await state.db.doc('factures/' + id).set(rest); done++; statusEl.textContent = `Import en cours… ${done} / ${total}`; } }
      for (const m of mouvements) { const { id, ...rest } = m; if (id) { await state.db.doc('mouvements/' + id).set(rest); done++; statusEl.textContent = `Import en cours… ${done} / ${total}`; } }
      for (const s of fournisseurs) { const { id, ...rest } = s; if (id) { await state.db.doc('fournisseurs/' + id).set(rest); done++; statusEl.textContent = `Import en cours… ${done} / ${total}`; } }
      for (const c of commandes) { const { id, ...rest } = c; if (id) { await state.db.doc('commandes_fournisseurs/' + id).set(rest); done++; statusEl.textContent = `Import en cours… ${done} / ${total}`; } }
      for (const c of clients) { const { id, ...rest } = c; if (id) { await state.db.doc('clients/' + id).set(rest); done++; statusEl.textContent = `Import en cours… ${done} / ${total}`; } }
      for (const c of paiements) { const { id, ...rest } = c; if (id) { await state.db.doc('paiements/' + id).set(rest); done++; statusEl.textContent = `Import en cours… ${done} / ${total}`; } }
      for (const c of depenses) { const { id, ...rest } = c; if (id) { await state.db.doc('depenses/' + id).set(rest); done++; statusEl.textContent = `Import en cours… ${done} / ${total}`; } }
      for (const c of documents) { const { id, ...rest } = c; if (id) { await state.db.doc('documents/' + id).set(rest); done++; statusEl.textContent = `Import en cours… ${done} / ${total}`; } }
      statusEl.textContent = `Import terminé : ${done} élément(s) importé(s).`;
      toast('Import terminé.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Erreur pendant l'import — certains éléments ont peut-être été importés.";
      statusEl.style.color = 'var(--danger)';
    }
  }

  // ---- Sauvegarde locale (localStorage, propre à ce navigateur) ----
  let autoBackupTimer = null, autoBackupLast = 0;

  function scheduleAutoBackup() {
    clearTimeout(autoBackupTimer);
    // La copie locale transforme TOUTES les données en texte : c'est lourd dans un gros magasin.
    // On la fait au plus une fois toutes les 5 minutes, quand l'appareil est au repos, et quand on quitte la page.
    const wait = Math.max(4000, autoBackupLast + 300000 - Date.now());
    autoBackupTimer = setTimeout(() => {
      const run = () => { autoBackupLast = Date.now(); saveLocalBackup(true); };
      if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 15000 }); else run();
    }, wait);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.products && state.products.length && Date.now() - autoBackupLast > 60000) { autoBackupLast = Date.now(); saveLocalBackup(true); } });

  function saveLocalBackup(silent) {
    try {
      const payload = JSON.stringify(buildFullDataset());
      localStorage.setItem(LOCAL_BACKUP_KEY, payload);
      updateLocalBackupStatus();
      if (!silent) toast('Sauvegarde locale enregistrée.');
    } catch (err) {
      console.error(err);
      if (!silent) toast('Impossible de sauvegarder localement (stockage plein ou indisponible).');
    }
  }

  function updateLocalBackupStatus() {
    const el = document.getElementById('localBackupStatus');
    if (!el) return;
    try {
      const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
      if (!raw) { el.textContent = 'Aucune sauvegarde locale pour l\'instant.'; return; }
      const parsed = JSON.parse(raw);
      const d = new Date(parsed.exportedAt);
      el.textContent = `Dernière sauvegarde locale : ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR')} (${(parsed.produits||[]).length} produits, ${(parsed.factures||[]).length} factures)`;
    } catch (err) {
      el.textContent = 'Sauvegarde locale présente mais illisible.';
    }
  }

  document.getElementById('btnManualBackup').addEventListener('click', () => saveLocalBackup(false));
  document.getElementById('btnRestoreBackup').addEventListener('click', async () => {
    const statusEl = document.getElementById('importStatus');
    try {
      const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
      if (!raw) { toast('Aucune sauvegarde locale trouvée sur cet appareil.'); return; }
      const data = JSON.parse(raw);
      document.querySelector('[data-tab="donnees"]').click();
      await runImport(data, statusEl);
    } catch (err) {
      console.error(err);
      toast('Impossible de lire la sauvegarde locale.');
    }
  });

