  async function forgetLocal(userId, commerceId) {
    try { localStorage.removeItem('sf_last_user'); } catch (e) {}
    try { if (state.db && state.db.wipe && userId) await state.db.wipe(userId, commerceId); } catch (e) {}
  }

  async function loadProfileAndCommerce(user) {
    let applied = false, sig0 = null;
    try {
      const cached = await sfStore.get('identity:' + user.id);
      if (cached && cached.profile && cached.commerce) { sig0 = JSON.stringify([cached.profile, cached.commerce]); applyIdentity(user, cached.profile, cached.commerce); applied = true; }
    } catch (e) { console.error(e); }
    const noNet = () => showAuthError("Pas de connexion internet. La toute première connexion sur cet appareil demande internet ; ensuite l'app marche aussi sans réseau.");
    try {
      // Réessaie quelques fois si le serveur répond « JWT issued at future » (petit décalage d'horloge temporaire juste après la connexion)
      let profile = null, pErr = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
        profile = r.data; pErr = r.error;
        const clockIssue = pErr && (pErr.code === 'PGRST303' || /issued at future/i.test(pErr.message || ''));
        if (!clockIssue) break;
        await new Promise(res => setTimeout(res, 1500));
      }
      if (pErr && isNetErr(pErr)) { if (!applied) noNet(); return; }
      if (pErr && pErr.code !== 'PGRST116' && applied) return;   // autre problème temporaire : on garde la copie locale
      if ((!profile && (!pErr || pErr.code === 'PGRST116')) && !loadProfileAndCommerce._pending) {
        const done = await completePendingSignup(user);
        if (done === true) { loadProfileAndCommerce._pending = true; try { await loadProfileAndCommerce(user); } finally { loadProfileAndCommerce._pending = false; } return; }
        if (typeof done === 'string') { showAuthError(done); await supabaseClient.auth.signOut(); return; }
      }
      if (pErr || !profile) {
        showAuthError("Profil introuvable — détail technique : " + (pErr ? (pErr.message + (pErr.code ? ' [' + pErr.code + ']' : '')) : 'aucune ligne trouvée pour cet utilisateur'));
        await forgetLocal(user.id, CURRENT_COMMERCE_ID);
        await supabaseClient.auth.signOut();
        return;
      }
      let commerce = null, cErr = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const r = await supabaseClient.from('commerces').select('*').eq('id', profile.commerce_id).single();
        commerce = r.data; cErr = r.error;
        const clockIssue = cErr && (cErr.code === 'PGRST303' || /issued at future/i.test(cErr.message || ''));
        if (!clockIssue) break;
        await new Promise(res => setTimeout(res, 1500));
      }
      if (cErr && isNetErr(cErr)) { if (!applied) noNet(); return; }
      if (cErr && cErr.code !== 'PGRST116' && applied) return;
      if (cErr || !commerce) {
        showAuthError("Commerce introuvable — détail technique : " + (cErr ? (cErr.message + (cErr.code ? ' [' + cErr.code + ']' : '')) : 'aucune ligne trouvée'));
        await forgetLocal(user.id, profile.commerce_id);
        await supabaseClient.auth.signOut();
        return;
      }
      const sig = JSON.stringify([profile, commerce]);
      if (!applied || sig !== sig0) applyIdentity(user, profile, commerce);
      sfStore.set('identity:' + user.id, { email: user.email, profile, commerce });
      state.offlineBoot = false;
      if (state.db && state.db.resumeAuth) state.db.resumeAuth();
    } catch (err) {
      console.error(err);
      if (isNetErr(err)) { if (!applied) noNet(); return; }
      if (!applied) showAuthError("Erreur : " + (err && err.message ? err.message : String(err)));
    }
  }

  function handleSignedOut() {
    clearTimeout(reauthTimer);
    stopAllPolling();
    if (state.db && state.db.reset) state.db.reset();
    CURRENT_COMMERCE_ID = null;
    CURRENT_USER_ID = null;
    state.currentUser = null;
    state.commerce = null;
    state.syncStarted = false;
    state.offlineBoot = false;
    document.getElementById('userBadge').style.display = 'none';
    document.getElementById('commerceTag').textContent = 'Non connecté';
    document.getElementById('loginOverlay').style.display = 'flex';
    abo.row = null; abo.admin = false; try { aboRender(); } catch (e) {}
    showAuthTab('login');
    try { netBarUpdate(); } catch (e) {}
  }

  // Ouvre l'app avec les données gardées sur l'appareil quand la session ne peut pas être relue (pas d'internet)
  async function tryOfflineBoot() {
    let uid = null; try { uid = localStorage.getItem('sf_last_user'); } catch (e) {}
    if (!uid || state.recoveryInProgress || state.signupInProgress) return false;
    const cached = await sfStore.get('identity:' + uid);
    if (!cached || !cached.profile || !cached.commerce) return false;
    applyIdentity({ id: uid, email: cached.email || '' }, cached.profile, cached.commerce);
    state.offlineBoot = true;
    reauthProbe(cached.email);
    return true;
  }
  let reauthTimer = null;
  function sessionExpiredUI(email) {
    document.getElementById('loginOverlay').style.display = 'flex';
    showAuthTab('login');
    const el = document.getElementById('login-email'); if (el && email && !el.value) el.value = email;
    showAuthError('Ta session a expiré : reconnecte-toi. Tes ventes en attente sont gardées et seront envoyées juste après.');
  }
  function reauthProbe(email) {
    clearTimeout(reauthTimer);
    const run = async () => {
      if (!state.offlineBoot || !state.db) return;
      if (navigator.onLine === false) { reauthTimer = setTimeout(run, 15000); return; }
      const s = await state.db.checkSession();
      if (s === 'ok') { state.offlineBoot = false; state.db.resumeAuth(); state.db.refresh('produits', 'factures', 'paiements', 'clients', 'depenses', 'fournisseurs', 'commandes_fournisseurs', 'documents', 'mouvements'); return; }
      if (s === 'auth') { sessionExpiredUI(email); return; }
      reauthTimer = setTimeout(run, 20000);
    };
    run();
  }

  function initAuth() {
    if (!supabaseClient) { showAuthError('Connexion indisponible.'); document.getElementById('loginOverlay').style.display = 'flex'; return; }
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { state.recoveryInProgress = true; showRecoveryForm(); return; }
      if (session && session.user) {
        if (state.recoveryInProgress) { showRecoveryForm(); return; } // lien « mot de passe oublié » : on choisit d'abord un nouveau mot de passe
        if (state.signupInProgress) return;               // inscription en cours : le profil n'existe pas encore
        if (event === 'TOKEN_REFRESHED' && state.currentUser) return; // simple renouvellement de jeton
        loadProfileAndCommerce(session.user);
      } else {
        // Pas de session lisible : si c'est faute de réseau, on ouvre quand même l'app avec la copie locale
        tryOfflineBoot().then(ok => { if (!ok) handleSignedOut(); }).catch(() => handleSignedOut());
      }
    });
  }

