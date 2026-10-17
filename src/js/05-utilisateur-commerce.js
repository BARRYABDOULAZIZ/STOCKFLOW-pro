  // ================= Utilisateur / rôle / commerce =================
  const ROLE_LABEL = { proprietaire: 'Propriétaire', admin: 'Admin', caissier: 'Caissier', employe: 'Employé' };
  const ROLE_TABS = {
    proprietaire: ['dashboard', 'produits', 'scanner', 'inventaire', 'ventes', 'factures', 'fournisseurs', 'clients', 'rapports', 'parametres', 'comptabilite', 'donnees', 'caisse', 'documents'],
    admin: ['dashboard', 'produits', 'scanner', 'inventaire', 'ventes', 'factures', 'fournisseurs', 'clients', 'rapports', 'parametres', 'comptabilite', 'donnees', 'caisse', 'documents'],
    caissier: ['dashboard', 'ventes', 'factures', 'clients', 'documents'],
    employe: ['dashboard', 'scanner', 'produits'],
  };

  function applyRoleVisibility() {
    const role = state.currentUser ? state.currentUser.role : 'employe';
    const allowed = ROLE_TABS[role] || ROLE_TABS.employe;
    document.querySelectorAll('nav.tabs button[data-tab]').forEach(btn => {
      if (btn.dataset.platform) return;   // onglet Admin : géré par l'abonnement (aboRender)
      const ok = allowed.includes(btn.dataset.tab);
      btn.style.display = ok ? '' : 'none';
    });
    const activeBtn = document.querySelector('nav.tabs button.active');
    if (!activeBtn || activeBtn.style.display === 'none') {
      const fallback = document.querySelector(`nav.tabs button[data-tab="${allowed[0]}"]`);
      if (fallback) fallback.click();
    }

    // Le caissier ne voit pas les totaux financiers globaux de l'entreprise (investi, valeur potentielle, bénéfice, marges)
    document.body.classList.toggle('no-cost', !(role === 'proprietaire' || role === 'admin'));
    const hideFinancials = role === 'caissier';
    const heroRow = document.getElementById('dashboardHeroRow');
    const statsBlock = document.getElementById('dashboardStatsBlock');
    if (heroRow) heroRow.style.display = hideFinancials ? 'none' : '';
    if (statsBlock) statsBlock.style.display = hideFinancials ? 'none' : '';

    const inviteCard = document.getElementById('inviteCard');
    if (inviteCard) inviteCard.style.display = (role === 'proprietaire' || role === 'admin') ? '' : 'none';
  }

  function updateCommerceForm() {
    if (!state.commerce) return;
    document.getElementById('commerceTag').textContent = state.commerce.nom || 'BoromBoutik';
    const setIfIdle = (id, val) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = val || ''; };
    setIfIdle('cm-nom', state.commerce.nom);
    setIfIdle('cm-adresse', state.commerce.adresse);
    setIfIdle('cm-telephone', state.commerce.telephone);
    setIfIdle('cm-email', state.commerce.email);
    setIfIdle('cm-fiscal', state.commerce.numeroFiscal);
    setIfIdle('cm-message', state.commerce.messageFacture);
    {
      const ds = document.getElementById('cm-devise'), ls = document.getElementById('cm-langue');
      if (ds && !ds.options.length) ds.innerHTML = Object.entries(DEVISES).map(([k, d]) => `<option value="${k}">${escapeHtml(d.label)}</option>`).join('');
      if (ls && !ls.options.length) ls.innerHTML = Object.entries(INV_LANGS).map(([k, l]) => `<option value="${k}">${escapeHtml(l)}</option>`).join('');
      if (ds && document.activeElement !== ds) ds.value = curCode();
      if (ls && document.activeElement !== ls) ls.value = invLang();
    }
    applyCurrencyUi();
    renderCommerceImages();
    const codeEl = document.getElementById('inviteCodeDisplay');
    if (codeEl) codeEl.textContent = state.commerce.inviteCode || '------';
  }

  // ----- Logo et signature (images réduites, stockées en base) -----
  const pendingImages = {};   // undefined = inchangé, '' = retiré, 'data:image…' = nouvelle image
  const IMAGE_KINDS = {
    logo: { stateKey: 'logoUrl', col: 'logo_url', file: 'cm-logo-file', img: 'cm-logo-preview', rm: 'btnRemoveLogo', maxW: 320, maxH: 160 },
    signature: { stateKey: 'signatureUrl', col: 'signature_url', file: 'cm-signature-file', img: 'cm-signature-preview', rm: 'btnRemoveSignature', maxW: 400, maxH: 200 },
  };
  const isImageData = (v) => typeof v === 'string' && /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(v);

  function fileToSmallDataUrl(file, maxW, maxH) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image illisible'));
        img.onload = () => {
          const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = Math.max(1, Math.round(img.width * ratio)), h = Math.max(1, Math.round(img.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          let out = canvas.toDataURL('image/png');
          if (out.length > 120000) { // photo lourde : version JPEG sur fond blanc
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
            out = canvas.toDataURL('image/jpeg', 0.85);
          }
          resolve(out);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderCommerceImages() {
    Object.entries(IMAGE_KINDS).forEach(([kind, k]) => {
      const imgEl = document.getElementById(k.img), rmEl = document.getElementById(k.rm);
      if (!imgEl) return;
      const src = pendingImages[kind] !== undefined ? pendingImages[kind] : ((state.commerce && state.commerce[k.stateKey]) || '');
      if (isImageData(src)) { imgEl.src = src; imgEl.style.display = ''; rmEl.style.display = ''; }
      else { imgEl.removeAttribute('src'); imgEl.style.display = 'none'; rmEl.style.display = 'none'; }
    });
  }

  Object.entries(IMAGE_KINDS).forEach(([kind, k]) => {
    document.getElementById(k.file).addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const statusEl = document.getElementById('commerceStatus');
      try {
        pendingImages[kind] = await fileToSmallDataUrl(file, k.maxW, k.maxH);
        renderCommerceImages();
        statusEl.textContent = 'Image prête — clique sur Enregistrer pour la valider.';
      } catch (err) {
        statusEl.textContent = "Impossible de lire cette image : " + err.message;
      }
      e.target.value = '';
    });
    document.getElementById(k.rm).addEventListener('click', () => {
      pendingImages[kind] = '';
      renderCommerceImages();
      document.getElementById('commerceStatus').textContent = 'Image retirée — clique sur Enregistrer pour valider.';
    });
  });

  document.getElementById('btnSaveCommerce').addEventListener('click', async () => {
    if (!supabaseClient || !state.currentUser) return;
    const statusEl = document.getElementById('commerceStatus');
    const payload = {
      nom: document.getElementById('cm-nom').value.trim() || 'BoromBoutik',
      adresse: document.getElementById('cm-adresse').value.trim(),
      telephone: document.getElementById('cm-telephone').value.trim(),
      email: document.getElementById('cm-email').value.trim(),
      numero_fiscal: document.getElementById('cm-fiscal').value.trim(),
    };
    // Logo, signature et message : envoyés seulement s'ils ont changé
    const extra = {};
    Object.entries(IMAGE_KINDS).forEach(([kind, k]) => {
      if (pendingImages[kind] !== undefined) extra[k.col] = pendingImages[kind] || null;
    });
    const msg = document.getElementById('cm-message').value.trim();
    if (msg !== ((state.commerce && state.commerce.messageFacture) || '')) extra.message_facture = msg || null;
    Object.assign(payload, extra);
    if (!needOnline('enregistrer les réglages')) return;
    try {
      const { error } = await supabaseClient.from('commerces').update(payload).eq('id', state.currentUser.commerceId);
      if (error) throw error;
      state.commerce = { ...state.commerce, nom: payload.nom, adresse: payload.adresse, telephone: payload.telephone, email: payload.email, numeroFiscal: payload.numero_fiscal };
      if ('logo_url' in extra) state.commerce.logoUrl = extra.logo_url;
      if ('signature_url' in extra) state.commerce.signatureUrl = extra.signature_url;
      if ('message_facture' in extra) state.commerce.messageFacture = extra.message_facture;
      Object.keys(pendingImages).forEach(k => delete pendingImages[k]);
      // Devise et langue des factures : enregistrées à part, pour ne pas bloquer le reste si la base n'est pas encore à jour
      let localOnly = false;
      const dv = document.getElementById('cm-devise').value, lgv = document.getElementById('cm-langue').value;
      if (dv !== curCode() || lgv !== invLang()) {
        const { error: e2 } = await supabaseClient.from('commerces').update({ devise: dv, langue_facture: lgv }).eq('id', state.currentUser.commerceId);
        if (e2) { console.error(e2); localOnly = true; }
        state.commerce.devise = dv; state.commerce.langueFacture = lgv;
        try { localStorage.setItem('sf_devise:' + (state.commerce.id || ''), dv); localStorage.setItem('sf_langue:' + (state.commerce.id || ''), lgv); } catch (e) {}
      }
      updateCommerceForm();
      [renderDashboard, renderStock, renderInsights].forEach(f => { try { f(); } catch (e) {} });
      try { updateGrandTotal(); } catch (e) {}
      statusEl.textContent = localOnly ? '✅ Enregistré. ⚠ Devise et langue gardées seulement sur cet appareil pour l\'instant (mise à jour de la base à faire).' : '✅ Informations enregistrées.';
      toast('Commerce mis à jour.');
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Erreur lors de l'enregistrement.";
    }
  });

  document.getElementById('btnCopyInvite').addEventListener('click', () => {
    const code = document.getElementById('inviteCodeDisplay').textContent;
    if (!code || code === '------') return;
    navigator.clipboard?.writeText(code).then(() => toast('Code copié !')).catch(() => {});
  });

  document.getElementById('btnRegenInvite').addEventListener('click', async () => {
    if (!confirm("Renouveler le code d'invitation ?\n\nL'ancien code ne marchera plus. Les personnes déjà dans l'équipe ne sont pas affectées.")) return;
    if (!needOnline('renouveler le code')) return;
    const { data, error } = await supabaseClient.rpc('regenerate_invite_code');
    if (error) { toast('Erreur : ' + error.message); return; }
    const code = Array.isArray(data) ? data[0] : data;
    document.getElementById('inviteCodeDisplay').textContent = code;
    if (state.commerce) state.commerce.inviteCode = code;
    toast('Nouveau code créé !');
  });

  // ---- Menu : garde l'onglet actif visible dans la liste ----
  (function () {
    const nav = document.querySelector('nav.tabs');
    if (!nav) return;
    function reveal() {
      const a = nav.querySelector('button.active');
      if (!a || nav.scrollHeight <= nav.clientHeight + 2) return;
      const top = a.offsetTop - nav.offsetTop;
      if (top < nav.scrollTop + 10) nav.scrollTop = Math.max(0, top - 10);
      else if (top + a.offsetHeight > nav.scrollTop + nav.clientHeight - 10) nav.scrollTop = top + a.offsetHeight - nav.clientHeight + 10;
    }
    nav.addEventListener('click', () => setTimeout(reveal, 30));
    window.addEventListener('resize', reveal);
    setTimeout(reveal, 400);
  })();

