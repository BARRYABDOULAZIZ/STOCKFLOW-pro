  // ================= Installation + fonctionnement hors connexion =================
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e)); });
    // L'app s'ouvre depuis la copie gardée (rapide) ; si une nouvelle version vient d'arriver, on propose de l'ouvrir
    const showMaj = () => {
      if (document.getElementById('bbMaj')) return;
      // Bandeau bien visible : pleine largeur en haut, couleur vive, gros bouton qui « respire »
      const b = document.createElement('div'); b.id = 'bbMaj'; b.className = 'bb-maj'; b.setAttribute('role', 'alert');
      b.innerHTML = '<span class="bb-maj-ic">🎉</span><span class="bb-maj-tx"><b>' + tr('Nouvelle version de BoromBoutik !') + '</b><small>' + tr('Touche le bouton pour avoir les nouveautés.') + '</small></span>'
        + '<button type="button" class="bb-maj-go">🔄 ' + tr('Mettre à jour') + '</button><button type="button" class="bb-maj-x" aria-label="' + tr('Plus tard') + '">✕</button>';
      b.querySelector('.bb-maj-go').addEventListener('click', async () => { try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.open(k).then(c => c.delete('./__bb-maj')))); } catch (e) {} location.reload(); });
      b.querySelector('.bb-maj-x').addEventListener('click', () => b.remove());   // revient à la prochaine ouverture
      document.body.appendChild(b);
      try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
    };
    const checkMaj = async () => { try { if (window.caches && await caches.match('./__bb-maj')) showMaj(); } catch (e) {} };
    navigator.serviceWorker.addEventListener('message', (ev) => { if (ev.data && ev.data.type === 'bb-maj') showMaj(); });
    window.addEventListener('load', () => setTimeout(checkMaj, 4000));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(checkMaj, 3000); });
  }

  // ================= Boot =================
  function startDataSync(db) {
    db.collection('produits').onSnapshot(
      (snap) => { state.products = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderStock(); renderDashboard(); renderInventaire(); if (typeof renderCatManager === 'function') renderCatManager(); scheduleAutoBackup(); },
      (err) => { console.error(err); setSync(false, 'connexion perdue'); }
    );
    db.collection('factures').onSnapshot(
      (snap) => { state.invoices = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderHistory(); renderDashboard(); renderClients(); if (selectedClientId) renderClientDetail(); renderRapports(); renderComptabilite(); renderCaisse(); scheduleAutoBackup(); },
      (err) => console.error(err)
    );
    db.collection('mouvements').onSnapshot(
      (snap) => { state.movements = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderMovements(); renderComptabilite(); scheduleAutoBackup(); },
      (err) => console.error(err)
    );
    db.collection('fournisseurs').onSnapshot(
      (snap) => { state.fournisseurs = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderFournisseurs(); scheduleAutoBackup(); },
      (err) => console.error(err)
    );
    db.collection('commandes_fournisseurs').onSnapshot(
      (snap) => { state.commandes = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderFournisseurs(); if (selectedFournisseurId) renderFournisseurDetail(); scheduleAutoBackup(); },
      (err) => console.error(err)
    );
    db.collection('clients').onSnapshot(
      (snap) => { state.clients = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderClients(); if (selectedClientId) renderClientDetail(); scheduleAutoBackup(); },
      (err) => console.error(err)
    );
    db.collection('paiements').onSnapshot(
      (snap) => { state.paiements = snap.docs.map(d => ({ id: d.id, ...d.data() })); if (selectedClientId) renderClientDetail(); renderCaisse(); scheduleAutoBackup(); },
      (err) => console.error(err)
    );
    db.collection('depenses').onSnapshot(
      (snap) => { state.depenses = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderComptabilite(); renderCaisse(); scheduleAutoBackup(); },
      (err) => console.error(err)
    );
    db.collection('documents').onSnapshot(
      (snap) => { state.documents = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderDocuments(); },
      (err) => console.error(err)
    );
  }

  async function boot() {
    document.getElementById('f-date').value = todayStr();
    document.getElementById('dp-date').value = todayStr();
    applyRpPreset('today');
    applyCpPreset('mois');
    applyCaissePreset('jour');

    let db = null;
    try { db = createSupabaseDb(supabaseClient); } catch (e) { console.error(e); db = null; }

    if (!db) {
      setSync(false, 'stockage indisponible');
      toast("La sauvegarde n'est pas disponible dans cette vue.");
      renderStock(); renderInvoiceLines(); renderHistory(); renderDashboard(); renderInventaire();
      updateLocalBackupStatus();
      return;
    }

    state.db = db;
    setSync(true, 'synchronisé');
    updateLocalBackupStatus();
    renderInvoiceLines();
  }

  (async () => {
    await boot();
    initAuth();
  })();
