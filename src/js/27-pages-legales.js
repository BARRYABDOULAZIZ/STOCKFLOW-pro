  // ================= Pages légales =================
  // ⚙️ Pour changer le nom de l'application, l'éditeur ou le contact : modifier UNIQUEMENT ces lignes.
  const LEGAL = {
    app: 'BoromBoutik',
    editeur: 'Abdoul Aziz Barry',
    pays: 'Sénégal',
    email: 'siradjisow23@gmail.com',
    maj: '15 octobre 2026',
  };
  function legalHtml(page) {
    const L = LEGAL, A = escapeHtml(L.app), E = escapeHtml(L.editeur), M = escapeHtml(L.email);
    const mail = `<a href="mailto:${M}">${M}</a>`;
    if (page === 'suppression') return `
      <h2 style="margin-top:0;">Supprimer mon compte ${A}</h2>
      <p class="muted">Dernière mise à jour : ${escapeHtml(L.maj)}</p>
      <p>Tu peux demander à tout moment la suppression de ton compte ${A} et des données qui y sont liées. C'est gratuit.</p>
      <h3>1. Comment faire ?</h3>
      <ul>
        <li><b>Dans l'application</b> : onglet <b>Paramètres</b>, carte « Supprimer mon compte », bouton <b>« Demander la suppression »</b>.</li>
        <li><b>Sans l'application</b> : écris à ${mail} depuis l'adresse e-mail de ton compte, avec pour objet « Suppression de compte » et le nom de ta boutique.</li>
      </ul>
      <p>Nous confirmons ta demande sous 48 heures, puis la suppression est faite au plus tard 30 jours après.</p>
      <h3>2. Ce qui est supprimé</h3>
      <ul>
        <li><b>Ton compte</b> : e-mail, nom, mot de passe, rôle.</li>
        <li>Si tu es <b>propriétaire</b> de la boutique : toutes les données de la boutique (produits, stocks, ventes, factures, devis, clients, fournisseurs, dépenses, journal des actions) et les comptes de ton équipe.</li>
        <li>Si tu es <b>caissier ou employé</b> : ton compte seulement. Les ventes que tu as enregistrées restent dans la boutique de ton patron, qui en est responsable.</li>
      </ul>
      <h3>3. Ce qui peut être gardé</h3>
      <p>Seulement ce que la loi oblige à conserver (par exemple les traces des paiements d'abonnement), et pas plus longtemps que nécessaire.</p>
      <p>Avant de demander la suppression, pense à télécharger une copie de tes données (onglet <b>Données</b>) : après la suppression, elles ne pourront plus être récupérées.</p>`;
    if (page === 'confidentialite') return `
      <h2 style="margin-top:0;">Politique de confidentialité</h2>
      <p class="muted">Dernière mise à jour : ${escapeHtml(L.maj)}</p>
      <p>Cette page explique quelles données ${A} utilise, pourquoi, et quels sont tes droits. Elle s'appuie sur la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel.</p>
      <h3>1. Qui est responsable ?</h3>
      <p>${A} est édité par ${E} (${escapeHtml(L.pays)}). Contact : ${mail}.</p>
      <p>Pour les données de <b>ton compte</b>, c'est ${A} qui est responsable. Pour les données que <b>tu enregistres sur tes propres clients</b> (noms, téléphones, achats, crédits), c'est <b>toi, le commerçant</b>, qui en es responsable : ${A} les garde et les traite uniquement pour ton compte et selon tes instructions.</p>
      <h3>2. Quelles données ?</h3>
      <ul>
        <li><b>Ton compte</b> : adresse e-mail, nom, rôle (propriétaire, admin, caissier, employé), mot de passe (stocké chiffré, jamais lisible).</li>
        <li><b>Ta boutique</b> : nom, adresse, téléphone, logo.</li>
        <li><b>Ton activité</b> : produits, stocks, prix, factures, devis, bons, paiements, dépenses, fournisseurs.</li>
        <li><b>Tes clients</b> : nom, téléphone, adresse, achats et sommes dues, si tu les saisis.</li>
        <li><b>Le journal des actions</b> : qui a fait quoi et quand (annulations, clôtures de caisse…), pour la sécurité de ta boutique.</li>
      </ul>
      <h3>3. Pourquoi ?</h3>
      <p>Uniquement pour faire fonctionner l'application : gérer ton stock, tes ventes et ta caisse, permettre à ton équipe de travailler ensemble et protéger ton compte. ${A} ne vend pas tes données et ne les utilise pas pour de la publicité.</p>
      <h3>4. Qui peut les voir ?</h3>
      <ul>
        <li><b>Toi et ton équipe</b>, selon les rôles que tu donnes. Chaque boutique est séparée : une boutique ne voit jamais les données d'une autre.</li>
        <li><b>Nos prestataires techniques</b>, seulement pour héberger le service : Supabase (base de données, serveurs situés dans l'Union européenne, à Paris) et Vercel (hébergement du site). Tes données sont donc conservées hors du Sénégal, chez des prestataires soumis à des règles strictes de protection des données.</li>
        <li><b>Fonction d'intelligence artificielle</b> (en test, non activée pour les commerçants) : si elle est activée un jour sur ton compte, un résumé de tes chiffres serait envoyé à un service d'IA (Google Gemini) pour répondre à tes questions. Tu en serais informé avant.</li>
        <li><b>WhatsApp</b> : quand tu envoies un ticket ou un devis par WhatsApp, c'est ton propre WhatsApp qui l'envoie ; ${A} ne fait que préparer le message.</li>
      </ul>
      <h3>5. Combien de temps ?</h3>
      <p>Tant que ton compte existe. Si tu fermes ton compte, tes données sont supprimées dans un délai de 30 jours, sauf ce que la loi oblige à garder.</p>
      <h3>6. Sécurité</h3>
      <p>Connexion protégée (HTTPS), mots de passe chiffrés, séparation stricte des boutiques, droits limités selon le rôle, journal des actions sensibles. Pense aussi à télécharger régulièrement une copie de tes données (bandeau « Copie de secours »).</p>
      <h3>7. Tes droits</h3>
      <p>Tu peux à tout moment demander à <b>accéder</b> à tes données, les <b>corriger</b>, t'<b>opposer</b> à leur utilisation ou les faire <b>supprimer</b>. Écris à ${mail}. Nous répondons en général <b>sous 48 heures</b>, et au plus tard dans un délai d'un mois.</p>
      <p>Si tu n'es pas satisfait de notre réponse, tu peux saisir la <b>Commission de Protection des Données Personnelles (CDP)</b> du Sénégal.</p>
      <p>Si un de tes clients veut exercer ses droits sur les informations que tu as saisies sur lui, c'est à toi de lui répondre ; nous t'aidons si besoin.</p>
      <h3>8. Modifications</h3>
      <p>Cette politique peut évoluer. En cas de changement important, tu seras prévenu dans l'application.</p>`;
    return `
      <h2 style="margin-top:0;">Conditions d'utilisation</h2>
      <p class="muted">Dernière mise à jour : ${escapeHtml(L.maj)}</p>
      <h3>1. Le service</h3>
      <p>${A} est une application de gestion de stock, de ventes, de factures et de caisse pour les commerces. Elle est éditée par ${E} (${escapeHtml(L.pays)}). Contact : ${mail}.</p>
      <h3>2. Ton compte</h3>
      <ul>
        <li>Tu dois donner des informations exactes et garder ton mot de passe secret.</li>
        <li>Le propriétaire du commerce est responsable des comptes de son équipe (caissiers, employés, admins) et des droits qu'il leur donne.</li>
        <li>Préviens-nous tout de suite si tu penses que ton compte a été utilisé par quelqu'un d'autre.</li>
      </ul>
      <h3>3. Ce qui est interdit</h3>
      <ul>
        <li>Utiliser l'application pour une activité illégale ou frauduleuse.</li>
        <li>Essayer d'accéder aux données d'une autre boutique ou de contourner la sécurité.</li>
        <li>Créer de faux comptes ou perturber le fonctionnement du service.</li>
      </ul>
      <p>En cas d'abus, nous pouvons suspendre le compte concerné.</p>
      <h3>4. Tes données</h3>
      <p>Les données de ta boutique t'appartiennent. Tu peux les télécharger à tout moment (onglet Données). La façon dont nous les protégeons est expliquée dans la <a href="#" data-legal="confidentialite">Politique de confidentialité</a>.</p>
      <h3>5. Prix</h3>
      <p>Pendant la phase de test, l'application est <b>gratuite</b>. Si elle devient payante, les prix te seront annoncés à l'avance, et tu pourras choisir de continuer ou d'arrêter et récupérer tes données.</p>
      <h3>6. Disponibilité et responsabilité</h3>
      <ul>
        <li>Nous faisons de notre mieux pour que l'application fonctionne en permanence, mais des coupures ou des erreurs peuvent arriver (réseau, maintenance, prestataires).</li>
        <li>Les chiffres, conseils et calculs affichés sont une aide : vérifie toujours les montants importants. Tu restes responsable de ta comptabilité, de tes déclarations fiscales et de tes factures.</li>
        <li>Garde régulièrement une copie de tes données.</li>
      </ul>
      <h3>7. Fin du service</h3>
      <p>Tu peux arrêter d'utiliser l'application quand tu veux et demander la suppression de ton compte à ${mail}. Avant, pense à télécharger tes données.</p>
      <h3>8. Modifications et droit applicable</h3>
      <p>Ces conditions peuvent évoluer ; tu seras prévenu en cas de changement important. Elles sont soumises au droit sénégalais.</p>`;
  }
  // Demande de suppression de compte (obligatoire pour le Play Store) : prépare un e-mail à BoromBoutik
  function deleteAccountMail() {
    const u = state.currentUser || {}, shop = (state.commerce && state.commerce.nom) || '';
    const roleTxt = (typeof ROLE_LABEL !== 'undefined' && ROLE_LABEL[u.role]) || u.role || '';
    const subject = 'Suppression de compte ' + LEGAL.app;
    const body = 'Bonjour,\n\nJe demande la suppression de mon compte ' + LEGAL.app + '.\n\nE-mail du compte : ' + (u.email || '') + '\nNom : ' + (u.nom || '') + '\nRôle : ' + roleTxt + '\nBoutique : ' + shop + '\n\nMerci.';
    return { subject, url: 'mailto:' + LEGAL.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) };
  }
  function deleteAccountRequest() {
    const u = state.currentUser || {}, shop = (state.commerce && state.commerce.nom) || '';
    if (!confirm('Demander la suppression de ton compte' + (u.role === 'proprietaire' ? ' ET de toutes les données de la boutique « ' + shop + ' »' : '') + ' ?\n\nUn e-mail de demande va s\'ouvrir : il suffit de l\'envoyer. Pense d\'abord à télécharger une copie de tes données (onglet Données).')) return;
    const m = deleteAccountMail(), st = document.getElementById('delAccStatus');
    if (st) st.innerHTML = 'Si ta messagerie ne s\'ouvre pas, écris à <b>' + escapeHtml(LEGAL.email) + '</b> avec l\'objet « ' + escapeHtml(m.subject) + ' ».';
    window.location.href = m.url;
  }
  (function () { const b = document.getElementById('btnDeleteAccount'); if (b) b.addEventListener('click', deleteAccountRequest); })();
  function openLegal(page) {
    const o = document.getElementById('legalOverlay');
    document.getElementById('legalBody').innerHTML = legalHtml(page);
    document.getElementById('legalBody').scrollTop = 0;
    document.querySelectorAll('[data-legal-tab]').forEach(b => b.classList.toggle('active', b.dataset.legalTab === page));
    o.style.display = 'flex';
  }
  document.addEventListener('click', (e) => {
    const l = e.target.closest('[data-legal]'); if (l) { e.preventDefault(); openLegal(l.dataset.legal); return; }
    const t = e.target.closest('[data-legal-tab]'); if (t) { openLegal(t.dataset.legalTab); return; }
    if (e.target.id === 'legalClose' || e.target.id === 'legalOverlay') document.getElementById('legalOverlay').style.display = 'none';
  });

