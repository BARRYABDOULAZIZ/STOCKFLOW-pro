
  const state = { db: null, downloads: null, products: [], invoices: [], movements: [], fournisseurs: [], commandes: [], clients: [], paiements: [], depenses: [], documents: [], currentUser: null };
  state.recoveryInProgress = /type=recovery/.test(window.location.hash) || /[?&]type=recovery/.test(window.location.search);
  // Lien reçu par email invalide, expiré ou déjà utilisé : on l'explique au lieu d'afficher une simple page de connexion
  (function () {
    const raw = (window.location.hash || '').replace(/^#/, '') || (window.location.search || '').replace(/^\?/, '');
    const params = new URLSearchParams(raw);
    const errCode = params.get('error_code'), errDesc = params.get('error_description');
    if (errCode || (params.get('error') && errDesc)) {
      const msg = (errCode === 'otp_expired')
        ? "Ce lien a expiré ou a déjà été utilisé. Clique sur « Mot de passe oublié ? », puis ouvre le DERNIER email reçu, une seule fois."
        : "Lien invalide : " + (errDesc || errCode).replace(/\+/g, ' ');
      state.urlAuthError = msg;
      try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
      setTimeout(() => { try { showAuthError(msg); } catch (e) {} }, 800);
    } else if (state.recoveryInProgress) {
      // Le lien est censé ouvrir la page « Nouveau mot de passe » : si elle n'apparaît pas, on prévient
      setTimeout(() => {
        if (!state.recoveryFormShown) { try { showAuthError("Le lien n'a pas pu être validé. Refais « Mot de passe oublié ? » et ouvre le dernier email reçu, dans le même navigateur."); } catch (e) {} }
      }, 4000);
    }
  })();
