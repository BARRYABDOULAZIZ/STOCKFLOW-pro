  // ================= Modèles de facture (Classique, Moderne, Élégant, Compact) =================
  // Choix du modèle et de la couleur, numéros Wave / Orange Money et RCCM imprimés sur les factures.
  // Le réglage n'est visible que sur les comptes de test (aiAskOk) tant qu'il n'est pas validé.
  // Sans réglage, la facture reste exactement le modèle Classique d'origine.
  const FSTYLE_MODELES = [
    { k: 'classique', label: 'Classique', desc: 'Sobre, passe-partout' },
    { k: 'moderne', label: 'Moderne', desc: 'Bandeau de couleur en haut' },
    { k: 'elegant', label: 'Élégant', desc: 'Aéré : mode, cosmétique' },
    { k: 'compact', label: 'Compact', desc: 'Beaucoup de lignes par page' },
  ];
  const FSTYLE_COULEURS = ['#1d4ed8', '#1f7a5c', '#c2410c', '#7c3aed', '#9d4e6e', '#111827'];
  const FSTYLE_DEFAUT = { modele: 'classique', couleur: '#1d4ed8', wave: '', om: '', rccm: '' };
  const FSTYLE_TXT = {
    fr: { payer: 'Payer par', ou: ' · ' },
    en: { payer: 'Pay with', ou: ' · ' },
    ar: { payer: 'الدفع عبر', ou: ' · ' },
  };
  let fstyleDraft = null;       // choix en cours dans Mon commerce (pas encore enregistré)
  let fstylePreviewing = null;  // style utilisé pour l'aperçu d'exemple
  let fstyleFor = null;         // commerce auquel appartient le brouillon

  const fstyleKey = () => 'sf_fstyle:' + ((state.commerce && state.commerce.id) || '');
  function fstyleClean(s) {
    const out = { ...FSTYLE_DEFAUT, ...(s && typeof s === 'object' ? s : {}) };
    if (!FSTYLE_MODELES.some(m => m.k === out.modele)) out.modele = 'classique';
    if (!/^#[0-9a-f]{6}$/i.test(String(out.couleur))) out.couleur = FSTYLE_DEFAUT.couleur;
    ['wave', 'om', 'rccm'].forEach(k => { out[k] = String(out[k] || '').trim().slice(0, 40); });
    return { modele: out.modele, couleur: out.couleur.toLowerCase(), wave: out.wave, om: out.om, rccm: out.rccm };
  }
  function fstyle() {
    let s = state.commerce && state.commerce.factureStyle;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
    if (!s || typeof s !== 'object') { try { s = JSON.parse(localStorage.getItem(fstyleKey()) || 'null'); } catch (e) { s = null; } }
    return fstyleClean(s);
  }
  const fstyleSame = (a, b) => JSON.stringify(fstyleClean(a)) === JSON.stringify(fstyleClean(b));

  // ----- À l'impression : applique le modèle, la couleur, le RCCM et la ligne de paiement -----
  function fstyleApply(pa, lg) {
    const s = fstylePreviewing || fstyle();
    FSTYLE_MODELES.forEach(m => pa.classList.toggle('pi-tpl-' + m.k, m.k === s.modele));
    pa.style.setProperty('--pi-accent', s.couleur);
    const T = FSTYLE_TXT[lg] || FSTYLE_TXT.fr, sp = lg === 'fr' ? ' : ' : ': ';
    const iso = (v) => bidiIso(v, lg);
    if (s.rccm) {
      const ad = document.getElementById('pi-commerce-adresse');
      ad.textContent = [ad.textContent, 'RCCM' + sp + iso(s.rccm)].filter(Boolean).join(' · ');
    }
    const pay = document.getElementById('pi-pay');
    const parts = [];
    if (s.wave) parts.push('Wave' + sp + iso(s.wave));
    if (s.om) parts.push('Orange Money' + sp + iso(s.om));
    if (pay) {
      pay.textContent = parts.length ? T.payer + ' ' + parts.join(T.ou) : '';
      pay.style.display = parts.length ? '' : 'none';
    }
  }

  // ----- Réglages dans Données > Mon commerce -----
  function fstyleRender() {
    const card = document.getElementById('fstyleCard');
    if (!card) return;
    const show = !!(aiAskOk && state.commerce && isOwnerOrAdmin());
    card.style.display = show ? '' : 'none';
    if (!show) return;
    if (fstyleFor !== state.commerce.id) { fstyleDraft = null; fstyleFor = state.commerce.id; }
    if (!fstyleDraft) fstyleDraft = fstyle();
    const d = fstyleDraft;
    document.getElementById('fstyleModeles').innerHTML = FSTYLE_MODELES.map(m => `
      <button type="button" class="fstyle-opt${m.k === d.modele ? ' on' : ''}" data-fmodele="${m.k}" aria-pressed="${m.k === d.modele}">
        <span class="fstyle-mini fstyle-mini-${m.k}" style="--pi-accent:${d.couleur}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <b>${escapeHtml(m.label)}</b><small>${escapeHtml(m.desc)}</small>
      </button>`).join('');
    document.getElementById('fstyleCouleurs').innerHTML = FSTYLE_COULEURS.map(c => `
      <button type="button" class="fstyle-color${c === d.couleur ? ' on' : ''}" data-fcouleur="${c}" style="background:${c}" aria-label="Couleur ${c}" aria-pressed="${c === d.couleur}"></button>`).join('')
      + `<label class="fstyle-custom" title="Autre couleur"><input type="color" id="fstyleCustom" value="${d.couleur}" aria-label="Choisir une autre couleur"></label>`;
    const setIfIdle = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = v || ''; };
    setIfIdle('cm-wave', d.wave); setIfIdle('cm-om', d.om); setIfIdle('cm-rccm', d.rccm);
  }
  function fstyleReadInputs() {
    if (!fstyleDraft) fstyleDraft = fstyle();
    fstyleDraft.wave = document.getElementById('cm-wave').value;
    fstyleDraft.om = document.getElementById('cm-om').value;
    fstyleDraft.rccm = document.getElementById('cm-rccm').value;
    fstyleDraft = fstyleClean(fstyleDraft);
    return fstyleDraft;
  }
  (function fstyleWire() {
    const card = document.getElementById('fstyleCard');
    if (!card) return;
    card.addEventListener('click', (e) => {
      const mo = e.target.closest('[data-fmodele]'), co = e.target.closest('[data-fcouleur]');
      if (!mo && !co) return;
      fstyleReadInputs();
      if (mo) fstyleDraft.modele = mo.dataset.fmodele;
      if (co) fstyleDraft.couleur = co.dataset.fcouleur;
      fstyleRender();
      document.getElementById('commerceStatus').textContent = 'Modèle choisi — clique sur Enregistrer pour le garder.';
    });
    card.addEventListener('input', (e) => {
      if (e.target.id !== 'fstyleCustom') return;
      fstyleReadInputs();
      fstyleDraft.couleur = e.target.value;
      fstyleDraft = fstyleClean(fstyleDraft);
      document.querySelectorAll('#fstyleCouleurs .fstyle-color').forEach(b => b.classList.remove('on'));
      document.querySelectorAll('#fstyleModeles .fstyle-mini').forEach(el => el.style.setProperty('--pi-accent', fstyleDraft.couleur));
    });
    document.getElementById('btnFstylePreview').addEventListener('click', () => {
      fstylePreviewing = fstyleReadInputs();
      const today = todayStr();
      const sample = { num: 42, date: today, client: 'Client exemple', remise: 1500, montantPaye: 50000, total: 85000, sousTotal: 86500,
        lignes: [
          { ref: 'A-01', nom: 'Article exemple 1', qte: 2, unite: 'pièce', prix: 15000 },
          { ref: 'A-02', nom: 'Article exemple 2', qte: 1, unite: 'pièce', prix: 25000 },
          { ref: 'A-03', nom: 'Article exemple 3', qte: 3, unite: 'pièce', prix: 4500 },
          { ref: 'A-04', nom: 'Article exemple 4', qte: 1, unite: 'pièce', prix: 18000 },
        ] };
      try { printInvoice(sample, 'facture'); } finally { setTimeout(() => { fstylePreviewing = null; }, 1500); }
    });
  })();

  // Appelé par le bouton Enregistrer de Mon commerce. Renvoie true si le style n'a pu être gardé que sur cet appareil.
  async function fstyleSave() {
    const card = document.getElementById('fstyleCard');
    if (!card || card.style.display === 'none' || !fstyleDraft) return false;
    const next = fstyleReadInputs();
    if (fstyleSame(next, fstyle())) return false;
    state.commerce.factureStyle = next;
    try { localStorage.setItem(fstyleKey(), JSON.stringify(next)); } catch (e) {}
    const { error } = await supabaseClient.from('commerces').update({ facture_style: next }).eq('id', state.currentUser.commerceId);
    if (error) { console.error(error); return true; }
    return false;
  }
