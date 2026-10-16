  // ---- Onglets Connexion / Créer / Rejoindre ----
  const authTabs = { login: 'authPaneLogin', signup: 'authPaneSignup', join: 'authPaneJoin' };
  function showAuthTab(name) {
    Object.entries(authTabs).forEach(([key, paneId]) => {
      document.getElementById(paneId).style.display = key === name ? '' : 'none';
      document.getElementById('authTab' + key[0].toUpperCase() + key.slice(1)).classList.toggle('active', key === name);
    });
    document.getElementById('authPaneForgot').style.display = 'none';
    document.getElementById('authPaneRecovery').style.display = 'none';
    document.getElementById('authTabsRow').style.display = 'flex';
    document.getElementById('authTitle').textContent = 'Connexion';
  }

  // ---- Mot de passe oublié ----
  function showOnlyAuthPane(paneId, title) {
    Object.values(authTabs).forEach(id => { document.getElementById(id).style.display = 'none'; });
    document.getElementById('authPaneForgot').style.display = paneId === 'authPaneForgot' ? '' : 'none';
    document.getElementById('authPaneRecovery').style.display = paneId === 'authPaneRecovery' ? '' : 'none';
    document.getElementById('authTabsRow').style.display = 'none';
    document.getElementById('authTitle').textContent = title;
  }
  document.getElementById('linkForgot').addEventListener('click', (e) => {
    e.preventDefault();
    clearAuthError();
    document.getElementById('forgot-email').value = document.getElementById('login-email').value.trim();
    document.getElementById('forgotInfo').textContent = '';
    showOnlyAuthPane('authPaneForgot', 'Mot de passe oublié');
  });
  document.getElementById('linkForgotBack').addEventListener('click', (e) => { e.preventDefault(); clearAuthError(); showAuthTab('login'); });
  document.getElementById('btnForgotSend').addEventListener('click', async () => {
    if (!supabaseClient) { showAuthError('Connexion indisponible.'); return; }
    clearAuthError();
    const email = document.getElementById('forgot-email').value.trim();
    const info = document.getElementById('forgotInfo');
    if (!email) { showAuthError('Entre ton email.'); return; }
    const btn = document.getElementById('btnForgotSend');
    btn.disabled = true;
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
      if (error) {
        if (error.status === 429 || /rate limit/i.test(error.message || '')) showAuthError('Trop de demandes. Réessaie dans quelques minutes.');
        else showAuthError("Impossible d'envoyer l'email pour le moment. Demande à ton propriétaire de réinitialiser ton mot de passe.");
        return;
      }
      info.textContent = "Si cet email correspond à un compte, un lien vient d'être envoyé. Pense à vérifier les courriers indésirables (spam).";
    } finally { btn.disabled = false; }
  });

  // ---- Nouveau mot de passe, après le lien reçu par email ----
  function showRecoveryForm() {
    state.recoveryFormShown = true;
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('recovery-p1').value = '';
    document.getElementById('recovery-p2').value = '';
    clearAuthError();
    showOnlyAuthPane('authPaneRecovery', 'Nouveau mot de passe');
  }
  document.getElementById('btnRecoverySave').addEventListener('click', async () => {
    if (!supabaseClient) { showAuthError('Connexion indisponible.'); return; }
    clearAuthError();
    const p1 = document.getElementById('recovery-p1').value;
    const p2 = document.getElementById('recovery-p2').value;
    if (p1.length < 8) { showAuthError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (p1 !== p2) { showAuthError('Les deux mots de passe ne sont pas identiques.'); return; }
    const { error } = await supabaseClient.auth.updateUser({ password: p1 });
    if (error) { showAuthError(error.message || 'Impossible de changer le mot de passe.'); return; }
    state.recoveryInProgress = false;
    try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
    showAuthTab('login');
    const { data } = await supabaseClient.auth.getSession();
    if (data && data.session) loadProfileAndCommerce(data.session.user);
    toast('Mot de passe modifié.');
  });
  function clearAuthError() {
    document.getElementById('loginError').style.display = 'none';
  }
  document.getElementById('authTabLogin').addEventListener('click', () => { showAuthTab('login'); clearAuthError(); });
  document.getElementById('authTabSignup').addEventListener('click', () => { showAuthTab('signup'); clearAuthError(); });
  document.getElementById('authTabJoin').addEventListener('click', () => { showAuthTab('join'); clearAuthError(); });

  function showAuthError(msg) {
    const el = document.getElementById('loginError');
    el.style.color = '#dc2626';
    el.textContent = msg;
    el.style.display = 'block';
  }

  document.getElementById('btnLogin').addEventListener('click', async () => {
    if (!supabaseClient) { showAuthError('Connexion indisponible.'); return; }
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) { showAuthError('Entre ton email et ton mot de passe.'); return; }
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { showAuthError(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message); return; }
  });

  document.getElementById('btnSignup').addEventListener('click', async () => {
    if (!supabaseClient) { showAuthError('Connexion indisponible.'); return; }
    const commerceNom = document.getElementById('signup-commerce').value.trim();
    const nom = document.getElementById('signup-nom').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    if (!commerceNom || !nom || !email || !password) { showAuthError('Remplis tous les champs.'); return; }
    if (password.length < 8) { showAuthError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    state.signupInProgress = true;
    // Les infos du commerce sont gardées avec le compte : si l'e-mail doit d'abord être confirmé, le commerce est créé à la première connexion.
    const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: location.origin, data: { sf_action: 'create', sf_commerce: commerceNom, sf_nom: nom } } });
    if (error) { state.signupInProgress = false; showAuthError(error.message); return; }
    if (!data.session) { state.signupInProgress = false; showConfirmEmailInfo(email); return; }
    const { error: rpcErr } = await supabaseClient.rpc('create_commerce_and_owner', { p_commerce_nom: commerceNom, p_user_nom: nom });
    if (rpcErr) { await abortSignup("Compte créé mais erreur lors de la création du commerce : " + rpcErr.message); return; }
    await finishSignup(data.session.user);
  });

  document.getElementById('btnJoin').addEventListener('click', async () => {
    if (!supabaseClient) { showAuthError('Connexion indisponible.'); return; }
    const code = document.getElementById('join-code').value.trim().toLowerCase();
    const nom = document.getElementById('join-nom').value.trim();
    const role = document.getElementById('join-role').value;
    const email = document.getElementById('join-email').value.trim();
    const password = document.getElementById('join-password').value;
    if (!code || !nom || !email || !password) { showAuthError('Remplis tous les champs.'); return; }
    if (password.length < 8) { showAuthError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    state.signupInProgress = true;
    const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: location.origin, data: { sf_action: 'join', sf_code: code, sf_nom: nom } } });
    if (error) { state.signupInProgress = false; showAuthError(error.message); return; }
    if (!data.session) { state.signupInProgress = false; showConfirmEmailInfo(email); return; }
    const { error: rpcErr } = await supabaseClient.rpc('join_commerce', { p_invite_code: code, p_user_nom: nom, p_role: role });
    if (rpcErr) { await abortSignup(rpcErr.message.includes('invalide') ? 'Code invitation invalide.' : rpcErr.message); return; }
    await finishSignup(data.session.user);
  });

  document.getElementById('userBadge').addEventListener('click', async () => {
    if (!confirm('Se déconnecter ?')) return;
    await supabaseClient.auth.signOut();
  });

  // Fin d'inscription : le profil existe maintenant, on peut le charger (l'écouteur d'auth l'ignorait pendant l'inscription)
  // Confirmation de l'e-mail : message clair après l'inscription
  function showConfirmEmailInfo(email) {
    showAuthTab('login');
    const le = document.getElementById('login-email'); if (le) le.value = email;
    showAuthError('📧 Compte créé ! Ouvre l\'e-mail envoyé à ' + email + ' et clique sur le lien de confirmation (regarde aussi dans les spams). Ensuite, reviens ici et connecte-toi.');
    const el = document.getElementById('loginError'); if (el) el.style.color = '#15803d';
  }
  // Première connexion après confirmation de l'e-mail : on termine la création du commerce (ou l'arrivée dans l'équipe)
  async function completePendingSignup(user) {
    const m = (user && user.user_metadata) || {};
    if (m.sf_action === 'create' && m.sf_commerce && m.sf_nom) {
      const { error } = await supabaseClient.rpc('create_commerce_and_owner', { p_commerce_nom: m.sf_commerce, p_user_nom: m.sf_nom });
      return error ? error.message : true;
    }
    if (m.sf_action === 'join' && m.sf_code && m.sf_nom) {
      const { error } = await supabaseClient.rpc('join_commerce', { p_invite_code: m.sf_code, p_user_nom: m.sf_nom, p_role: 'caissier' });
      return error ? (/invalide/i.test(error.message) ? 'Code invitation invalide : demande un nouveau code à ton propriétaire.' : error.message) : true;
    }
    return false;
  }
  async function finishSignup(user) {
    state.signupInProgress = false;
    await loadProfileAndCommerce(user);
  }
  async function abortSignup(message) {
    state.signupInProgress = false;
    await supabaseClient.auth.signOut();
    showAuthError(message);
  }

  // ---------- Identité gardée sur l'appareil : permet d'ouvrir l'app sans internet ----------
  function applyIdentity(user, profile, commerce) {
    const changed = (CURRENT_USER_ID && CURRENT_USER_ID !== user.id) || (CURRENT_COMMERCE_ID && CURRENT_COMMERCE_ID !== profile.commerce_id);
    if (changed) { stopAllPolling(); if (state.db && state.db.reset) state.db.reset(); state.syncStarted = false; }
    CURRENT_USER_ID = user.id;
    CURRENT_COMMERCE_ID = profile.commerce_id;
    state.currentUser = { id: user.id, email: user.email, nom: profile.nom, role: profile.role, commerceId: profile.commerce_id };
    state.commerce = fromDbRow('commerces', commerce);
    document.getElementById('loginOverlay').style.display = 'none';
    const badge = document.getElementById('userBadge');
    badge.style.display = 'inline-block';
    badge.textContent = `👤 ${state.currentUser.nom} · ${ROLE_LABEL[state.currentUser.role]}`;
    updateCommerceForm();
    applyRoleVisibility();
    try { localStorage.setItem('sf_last_user', user.id); } catch (e) {}
    if (state.db && !state.syncStarted) { state.syncStarted = true; startDataSync(state.db); }
    aiAskInit();
  }

