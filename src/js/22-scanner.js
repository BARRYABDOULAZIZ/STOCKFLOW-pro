  // ================= Scanner (USB/Bluetooth + Caméra) =================
  let zxingReader = null;
  let zxingLoading = null;
  let currentVideoDeviceId = null;
  let videoDevices = [];
  let pendingScanBarcode = null;

  document.querySelectorAll('[data-scanmode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-scanmode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.scanmode;
      document.getElementById('scanUsbCard').style.display = mode === 'usb' ? 'block' : 'none';
      document.getElementById('scanCameraCard').style.display = mode === 'camera' ? 'block' : 'none';
      if (mode === 'usb') { stopCameraScan(); focusUsbInput(); }
    });
  });

  function focusUsbInput() {
    const inp = document.getElementById('scanUsbInput');
    if (inp && document.getElementById('panel-scanner').classList.contains('active') && document.getElementById('scanUsbCard').style.display !== 'none') {
      inp.focus();
    }
  }

  // Un scanner USB/Bluetooth "tape" le code très vite puis envoie Entrée.
  document.getElementById('scanUsbInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const code = e.target.value.trim();
      e.target.value = '';
      if (code) handleScannedCode(code, 'scan-usb');
    }
  });
  // Re-focus automatique pour enchaîner les scans sans re-cliquer.
  document.getElementById('scanUsbInput').addEventListener('blur', () => {
    setTimeout(() => { if (document.getElementById('scanResultCard').style.display === 'none' && document.getElementById('scanUnknownCard').style.display === 'none') focusUsbInput(); }, 300);
  });

  function loadZxing() {
    if (window.ZXing) return Promise.resolve();
    if (zxingLoading) return zxingLoading;
    zxingLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
      s.integrity = 'sha384-BzBxP10ZE72aitqj5UMmUsbKFliP/DZqA8Wq+BNNhlIJDGoEd1tpkMYXOg9+n6sB'; s.crossOrigin = 'anonymous';  // empreinte : un fichier modifié sur le CDN est refusé
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('load-failed'));
      document.head.appendChild(s);
    });
    return zxingLoading;
  }

  document.getElementById('btnStartCamera').addEventListener('click', startCameraScan);
  document.getElementById('btnStopCamera').addEventListener('click', stopCameraScan);
  document.getElementById('btnSwitchCamera').addEventListener('click', switchCamera);

  async function startCameraScan() {
    const statusEl = document.getElementById('cameraStatus');
    statusEl.textContent = 'Chargement du lecteur de codes-barres…';

    try {
      await loadZxing();
    } catch (e) {
      statusEl.textContent = "Impossible de charger le lecteur de codes-barres — vérifie ta connexion (ou désactive ton bloqueur de publicités).";
      return;
    }

    try {
      // 1. Force le navigateur à demander l'autorisation de la caméra (préfère la caméra arrière sur téléphone)
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop()); // flux temporaire, on le ferme
      await new Promise(res => setTimeout(res, 300));    // laisse la caméra se libérer

      // 2. Lecteur de codes-barres, une fois l'autorisation accordée
      if (!zxingReader) zxingReader = new window.ZXing.BrowserMultiFormatReader();
      // Liste des caméras avec la fonction standard du navigateur (la version statique de la bibliothèque n'existe pas dans @zxing/library)
      videoDevices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      if (videoDevices.length === 0) { statusEl.textContent = 'Aucune caméra détectée sur cet appareil.'; return; }
      const back = videoDevices.find(d => /back|rear|environment|arrière/i.test(d.label));
      currentVideoDeviceId = (back || videoDevices[videoDevices.length - 1]).deviceId;

      document.getElementById('btnStartCamera').style.display = 'none';
      document.getElementById('btnStopCamera').style.display = 'inline-block';
      if (videoDevices.length > 1) document.getElementById('btnSwitchCamera').style.display = 'inline-block';
      statusEl.textContent = 'Caméra active — vise le code-barres ou le QR code.';

      zxingReader.decodeFromVideoDevice(currentVideoDeviceId, 'scanVideo', (result, err) => {
        if (result) {
          const code = result.getText();
          stopCameraScan();
          handleScannedCode(code, 'scan-camera');
        }
      });
    } catch (e) {
      console.error('Erreur caméra :', e);
      let msg;
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) msg = "Caméra bloquée : autorise-la pour ce site (icône à gauche de l'adresse), puis recharge la page.";
      else if (e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError')) msg = 'Aucune caméra trouvée sur cet appareil.';
      else if (e && (e.name === 'NotReadableError' || e.name === 'AbortError')) msg = 'Caméra déjà utilisée par une autre application : ferme-la puis réessaie.';
      else msg = 'Caméra indisponible.';
      statusEl.textContent = msg + ' (' + ((e && e.name) || '') + (e && e.message ? ' : ' + e.message : '') + ')';
    }
  }

  // ================= SCANNER CAMÉRA UNIVERSEL (recherche produits, champ code-barres, ventes) =================
  let globalZxingReader = null;
  let currentScanCallback = null;

  // ---- Scanner v2 (Android) : détecteur natif du téléphone + caméra arrière principale en haute définition ----
  // Activé seulement avec le lien boromboutik.com/?scan2=1 (gardé sur le téléphone) ; ?scan2=0 pour revenir à l'ancien.
  try {
    const q = new URLSearchParams(location.search).get('scan2');
    if (q === '1') localStorage.setItem('bb_scan2', '1');
    if (q === '0') localStorage.removeItem('bb_scan2');
  } catch (e) {}
  function scan2On() { try { return localStorage.getItem('bb_scan2') === '1'; } catch (e) { return false; } }
  let s2Stream = null, s2Timer = null, s2Devices = [], s2Idx = -1, s2Done = false;
  function s2Stop() {
    if (s2Timer) { clearTimeout(s2Timer); s2Timer = null; }
    if (s2Stream) { s2Stream.getTracks().forEach(t => t.stop()); s2Stream = null; }
    if (globalZxingReader) { try { globalZxingReader.reset(); } catch (e) {} }
  }
  function s2Found(code) {
    if (s2Done || !code) return;
    s2Done = true;
    try { if (navigator.vibrate) navigator.vibrate(80); } catch (e) {}
    const cb = currentScanCallback;
    closeGlobalScanner();
    if (typeof cb === 'function') cb(String(code).trim());
  }
  function s2Extras() {
    let bar = document.getElementById('s2Bar');
    if (bar) { bar.style.display = 'flex'; return; }
    bar = document.createElement('div');
    bar.id = 's2Bar';
    bar.style.cssText = 'display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:10px;';
    bar.innerHTML = '<button class="ghost" id="s2Switch" type="button">🔄 Changer de caméra</button><button class="ghost" id="s2Type" type="button">⌨️ Taper le code</button>';
    document.getElementById('globalScanStatus').after(bar);
    document.getElementById('s2Switch').addEventListener('click', () => { if (s2Devices.length > 1) { s2Idx = (s2Idx + 1) % s2Devices.length; s2Start(s2Devices[s2Idx].deviceId); } else toast('Une seule caméra sur ce téléphone.'); });
    document.getElementById('s2Type').addEventListener('click', () => {
      const c = prompt('Tape les chiffres écrits sous le code-barres :');
      if (c && c.trim()) s2Found(c.trim());
    });
  }
  async function s2Start(deviceId) {
    const statusEl = document.getElementById('globalScanStatus');
    const video = document.getElementById('globalScanVideo');
    s2Stop(); s2Done = false;
    const hd = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const cons = deviceId ? { video: { deviceId: { exact: deviceId }, ...hd } } : { video: { facingMode: { ideal: 'environment' }, ...hd } };
    try { s2Stream = await navigator.mediaDevices.getUserMedia(cons); }
    catch (e) { s2Stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
    const track = s2Stream.getVideoTracks()[0];
    // Mise au point automatique continue quand le téléphone le permet (sinon le code reste flou sur beaucoup d'Android)
    try { const caps = track.getCapabilities ? track.getCapabilities() : {}; if (caps.focusMode && caps.focusMode.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
    try { const st = track.getSettings ? track.getSettings() : {}; const i = s2Devices.findIndex(d => d.deviceId === st.deviceId); if (i >= 0) s2Idx = i; } catch (e) {}
    video.srcObject = s2Stream; video.setAttribute('playsinline', ''); video.muted = true;
    try { await video.play(); } catch (e) {}
    statusEl.textContent = 'Pointe vers le code-barres (à 15-20 cm)…';
    if ('BarcodeDetector' in window) {
      let det;
      try {
        const want = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code', 'data_matrix'];
        const sup = BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : want;
        det = new BarcodeDetector({ formats: want.filter(f => sup.includes(f)) });
      } catch (e) { det = null; }
      if (det) {
        const loop = async () => {
          if (s2Done || !s2Stream) return;
          try { if (video.readyState >= 2) { const r = await det.detect(video); if (r && r.length && r[0].rawValue) { s2Found(r[0].rawValue); return; } } } catch (e) {}
          s2Timer = setTimeout(loop, 200);
        };
        loop();
        return;
      }
    }
    // Pas de détecteur natif (iPhone, vieux téléphones) : lecteur ZXing sur le même flux caméra
    await loadZxing();
    if (!globalZxingReader) globalZxingReader = new window.ZXing.BrowserMultiFormatReader();
    globalZxingReader.decodeFromStream(s2Stream, 'globalScanVideo', (result) => { if (result) s2Found(result.getText()); });
  }
  async function openGlobalScannerV2() {
    const statusEl = document.getElementById('globalScanStatus');
    s2Extras();
    try {
      await s2Start(null);
      try { s2Devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch (e) { s2Devices = []; }
    } catch (err) {
      console.error('Erreur caméra :', err);
      let msg;
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) msg = 'Caméra bloquée : autorise-la pour ce site, puis réessaie. Tu peux aussi taper le code.';
      else if (err && (err.name === 'NotReadableError' || err.name === 'AbortError')) msg = 'Caméra déjà utilisée par une autre application : ferme-la puis réessaie.';
      else msg = 'Caméra indisponible — tape le code avec le bouton ⌨️.';
      statusEl.textContent = msg + ' (' + ((err && err.name) || '') + ')';
    }
  }

  async function openGlobalScanner(title, onScanSuccess) {
    const modal = document.getElementById('globalScanModal');
    const statusEl = document.getElementById('globalScanStatus');
    document.getElementById('globalScanTitle').textContent = title || 'Scan caméra';
    modal.style.display = 'flex';
    statusEl.textContent = 'Initialisation de la caméra…';
    currentScanCallback = onScanSuccess;
    { const b = document.getElementById('s2Bar'); if (b) b.style.display = 'none'; }
    if (scan2On()) { await openGlobalScannerV2(); return; }

    try { await loadZxing(); }
    catch (e) { statusEl.textContent = "Impossible de charger le lecteur de codes-barres — vérifie ta connexion."; return; }

    try {
      // Demande l'autorisation (caméra arrière si possible, sinon n'importe laquelle)
      let stream = null;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
      catch (e) { stream = await navigator.mediaDevices.getUserMedia({ video: true }); }
      if (stream) stream.getTracks().forEach(t => t.stop());
      await new Promise(res => setTimeout(res, 300));

      if (!globalZxingReader) globalZxingReader = new window.ZXing.BrowserMultiFormatReader();
      // enumerateDevices (standard) : la version statique de ZXing n'existe pas dans @zxing/library
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      if (!devices.length) { statusEl.textContent = 'Aucune caméra détectée sur cet appareil.'; return; }
      const backDev = devices.find(d => /back|rear|environment|arrière/i.test(d.label)) || devices[devices.length - 1];
      statusEl.textContent = 'Pointe vers le code-barres…';

      globalZxingReader.decodeFromVideoDevice(backDev.deviceId, 'globalScanVideo', (result) => {
        if (result) {
          const code = result.getText();
          const cb = currentScanCallback;
          closeGlobalScanner();
          if (typeof cb === 'function') cb(code);
        }
      });
    } catch (err) {
      console.error('Erreur caméra :', err);
      let msg;
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) msg = "Caméra bloquée : autorise-la pour ce site, puis réessaie.";
      else if (err && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError')) msg = 'Aucune caméra trouvée sur cet appareil.';
      else if (err && (err.name === 'NotReadableError' || err.name === 'AbortError')) msg = 'Caméra déjà utilisée par une autre application : ferme-la puis réessaie.';
      else msg = 'Caméra indisponible.';
      statusEl.textContent = msg + ' (' + ((err && err.name) || '') + ')';
    }
  }

  function closeGlobalScanner() {
    s2Stop();
    if (globalZxingReader) { try { globalZxingReader.reset(); } catch (e) {} }
    const modal = document.getElementById('globalScanModal');
    if (modal) modal.style.display = 'none';
    currentScanCallback = null;
  }

  document.getElementById('btnCloseGlobalScan').addEventListener('click', closeGlobalScanner);

  // 1. Recherche dans la liste des produits
  document.getElementById('btnScanCatalog').addEventListener('click', () => {
    openGlobalScanner('Chercher un produit', (code) => {
      const input = document.getElementById('stockSearch');
      input.value = code;
      input.dispatchEvent(new Event('input')); // déclenche le filtre de la liste
      toast(`Recherche pour : ${code}`);
    });
  });

  // 2. Champ code-barres du formulaire produit
  document.getElementById('btnScanBarcodeField').addEventListener('click', () => {
    openGlobalScanner('Scanner le code-barres', (code) => {
      document.getElementById('p-barcode').value = code;
      toast(`Code-barres renseigné : ${code}`);
    });
  });

  // 3. Scan rapide en caisse (onglet Ventes)
  document.getElementById('btnQuickScanSale').addEventListener('click', () => {
    openGlobalScanner('Ajouter un article à la vente', (code) => {
      const c = code.trim();
      const prod = state.products.find(p => (p.codeBarre || '').trim() === c || (p.ref || '').toLowerCase() === c.toLowerCase());
      if (!prod) { toast(`⚠ Aucun produit trouvé pour le code : ${code}`); return; }
      // Déjà sur une ligne ? On ajoute 1 à la quantité au lieu de créer un doublon
      const existing = invoiceLines.find(l => l.matched && l.ref === prod.ref);
      if (existing) {
        existing.qte = (Number(existing.qte) || 0) + 1;
      } else {
        let line = invoiceLines.find(l => !l.nom && !l.ref);
        if (!line) { line = freshLine(); invoiceLines.push(line); }
        line.ref = prod.ref; line.nom = prod.nom; line.qte = 1;
        line.prix = prod.prixVente; line.unite = prod.unite || ''; line.matched = true;
      }
      renderInvoiceLines();
      toast(`✓ ${prod.nom} ajouté à la vente`);
    });
  });

  function stopCameraScan() {
    if (zxingReader) { try { zxingReader.reset(); } catch (e) {} }
    document.getElementById('btnStartCamera').style.display = 'inline-block';
    document.getElementById('btnStopCamera').style.display = 'none';
    document.getElementById('btnSwitchCamera').style.display = 'none';
    const statusEl = document.getElementById('cameraStatus');
    if (statusEl) statusEl.textContent = '';
  }

  async function switchCamera() {
    if (videoDevices.length < 2) return;
    const idx = videoDevices.findIndex(d => d.deviceId === currentVideoDeviceId);
    currentVideoDeviceId = videoDevices[(idx + 1) % videoDevices.length].deviceId;
    try {
      zxingReader.reset();
      zxingReader.decodeFromVideoDevice(currentVideoDeviceId, 'scanVideo', (result) => {
        if (result) { const code = result.getText(); stopCameraScan(); handleScannedCode(code, 'scan-camera'); }
      });
    } catch (e) { console.error(e); }
  }

  function handleScannedCode(code, source) {
    document.getElementById('scanResultCard').style.display = 'none';
    document.getElementById('scanUnknownCard').style.display = 'none';

    const prod = state.products.find(p => (p.codeBarre || '').trim() === code.trim());
    if (prod) {
      pendingScanBarcode = { code, source, productId: prod.id };
      document.getElementById('scanResultTitle').textContent = `${prod.nom}`;
      document.getElementById('sr-ref').value = prod.ref || '';
      document.getElementById('sr-fournisseur').value = prod.fournisseur || '—';
      document.getElementById('sr-stock').value = `${prod.stock} ${prod.unite || 'unité'}`;
      document.getElementById('sr-qte').value = 1;
      updateReceptionPreview();
      document.getElementById('scanResultCard').style.display = 'block';
    } else {
      pendingScanBarcode = { code, source, productId: null };
      document.getElementById('sr-unknown-code').textContent = code;
      document.getElementById('scanUnknownCard').style.display = 'block';
    }
  }

  document.getElementById('sr-qte').addEventListener('input', updateReceptionPreview);
  function updateReceptionPreview() {
    if (!pendingScanBarcode || !pendingScanBarcode.productId) return;
    const prod = state.products.find(p => p.id === pendingScanBarcode.productId);
    if (!prod) return;
    const qte = Number(document.getElementById('sr-qte').value) || 0;
    document.getElementById('sr-preview').textContent = `Stock actuel : ${prod.stock} → +${qte} → Nouveau stock : ${Number(prod.stock) + qte} ${prod.unite || 'unité'}`;
  }

  document.getElementById('btnCancelReception').addEventListener('click', () => {
    document.getElementById('scanResultCard').style.display = 'none';
    pendingScanBarcode = null;
    focusUsbInput();
  });
  document.getElementById('btnDismissUnknown').addEventListener('click', () => {
    document.getElementById('scanUnknownCard').style.display = 'none';
    pendingScanBarcode = null;
    focusUsbInput();
  });
  document.getElementById('btnCreateFromScan').addEventListener('click', () => {
    const code = pendingScanBarcode ? pendingScanBarcode.code : '';
    document.querySelector('[data-tab="produits"]').click();
    resetProductForm();
    document.getElementById('p-barcode').value = code;
    document.getElementById('p-nom').focus();
  });

  document.getElementById('btnConfirmReception').addEventListener('click', async () => {
    if (!pendingScanBarcode || !pendingScanBarcode.productId) return;
    const prod = state.products.find(p => p.id === pendingScanBarcode.productId);
    if (!prod) { toast('Ce produit a été supprimé entre-temps.'); return; }
    const qte = Number(document.getElementById('sr-qte').value) || 0;
    if (qte <= 0) { toast('La quantité doit être positive.'); return; }
    if (!state.db) { toast('Connexion non disponible.'); return; }

    try {
      const nouveauStock = await adjustStock(prod.id, qte);   // ajout atomique côté base
      const ancienStock = nouveauStock - qte;
      await logMovement({ productId: prod.id, ref: prod.ref, nom: prod.nom, quantite: qte, ancienStock, nouveauStock, unite: prod.unite || 'unité', source: pendingScanBarcode.source });
      toast(`${prod.nom} — stock ${ancienStock} → ${nouveauStock} ${prod.unite || 'unité'}.`);
      document.getElementById('scanResultCard').style.display = 'none';
      pendingScanBarcode = null;
      const modeCamera = document.getElementById('scanCameraCard').style.display !== 'none';
      if (modeCamera) startCameraScan(); else focusUsbInput();
    } catch (err) {
      console.error(err);
      toast("Erreur lors de la mise à jour du stock.");
    }
  });

  async function logMovement({ productId, ref, nom, quantite, ancienStock, nouveauStock, unite, source, raison, note }) {
    if (!state.db) return;
    const id = 'mv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    const operateur = state.currentUser ? `${state.currentUser.nom} (${ROLE_LABEL[state.currentUser.role]})` : '';
    const doc = {
      productId, ref, nom, quantite, ancienStock, nouveauStock, unite, source, operateur,
      date: todayStr(), createdAt: Date.now(),
    };
    if (raison) doc.raison = raison;
    if (note) doc.note = note;
    await state.db.doc('mouvements/' + id).set(doc);
  }


  // Icône de scan dans le champ « article » de chaque ligne de vente : même scanner que l'ancien bouton
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-scanline]'); if (!b) return;
    e.preventDefault(); document.getElementById('btnQuickScanSale').click();
  });
