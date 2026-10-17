#!/usr/bin/env node
/*
  BoromBoutik — tests automatiques.

  Ouvre l'appli dans un vrai navigateur (Chromium, sans écran), SANS internet : toutes les requêtes réseau
  sont bloquées, donc aucun test ne touche à la vraie base de données ni à un vrai compte.
  Les données utilisées sont inventées pour le test.

  Lancer :   node build.js && node tests/run.js
  Il faut Node.js et Playwright (npm i -g playwright  puis  npx playwright install chromium).
  Un autre Chromium peut être indiqué avec la variable CHROMIUM_PATH.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const ANCHOR = '  (async () => {\n    await boot();';
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
if (!src.includes(ANCHOR)) { console.error('✗ Point d\'accroche des tests introuvable (fin de src/js/37-demarrage.js)'); process.exit(1); }
// Petite porte d'entrée réservée aux tests : permet d'appeler les fonctions internes de l'appli
const page = src.replace(ANCHOR, '  window.__app = (code) => eval(code);\n' + ANCHOR);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'borom-test-'));
const file = path.join(tmp, 'index.html');
fs.writeFileSync(file, page);

const results = [];
const NET = /fetch|network|supabase|Failed to load|ERR_|ZXing|XLSX|is not defined: supabase/i;

function day(k) { const x = new Date(Date.now() - k * 864e5); return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 420, height: 900 }, locale: opts.locale || 'fr-FR' });
  await ctx.route(/^https?:/, (r) => r.abort());
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => { if (!NET.test(e.message)) p.errors.push(e.message); });
  if (opts.lang) await ctx.addInitScript((l) => { try { localStorage.setItem('sf_ui_lang', l); } catch (e) {} }, opts.lang);
  await p.goto('file://' + file, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  p.app = (code) => p.evaluate((c) => window.__app(c), code);
  p.close2 = () => ctx.close();
  return p;
}

async function test(name, fn) {
  try { await fn(); results.push([true, name]); console.log('  ✓ ' + name); }
  catch (e) { results.push([false, name, e.message]); console.log('  ✗ ' + name + '\n      ' + e.message); }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg + ' — attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }

(async () => {
  const browser = await chromium.launch({ args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  console.log('BoromBoutik — tests (hors ligne, données inventées)\n');

  await test('L\'appli démarre sans erreur et montre la connexion', async () => {
    const p = await open(browser);
    const r = await p.evaluate(() => ({ login: !!document.getElementById('loginOverlay'), panels: document.querySelectorAll('section.panel').length, title: document.title }));
    eq(r, { login: true, panels: 15, title: 'BoromBoutik' }, 'page de départ');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Langue de l\'écran : français, anglais, arabe (de droite à gauche)', async () => {
    for (const [lang, word, dir] of [['fr', 'Se connecter', 'ltr'], ['en', 'Sign in', 'ltr'], ['ar', '', 'rtl']]) {
      const p = await open(browser, { lang });
      const r = await p.evaluate(() => ({ t: document.getElementById('authTabLogin').textContent.trim(), dir: document.documentElement.dir || 'ltr', lang: document.documentElement.lang }));
      eq(r.dir, dir, 'sens d\'écriture ' + lang);
      eq(r.lang, lang, 'langue de la page');
      if (word) expect(r.t.includes(word), 'bouton connexion en ' + lang + ' : « ' + r.t + ' »');
      else expect(/[؀-ۿ]/.test(r.t), 'bouton connexion en arabe : « ' + r.t + ' »');
      eq(p.errors, [], 'erreurs ' + lang);
      await p.close2();
    }
  });

  await test('Chaque onglet du menu s\'ouvre', async () => {
    const p = await open(browser, { viewport: { width: 1280, height: 900 } });
    const r = await p.evaluate(async () => {
      document.getElementById('loginOverlay').style.display = 'none';
      const bad = [];
      for (const b of document.querySelectorAll('nav.tabs button[data-tab]')) {
        b.click(); await new Promise((r) => setTimeout(r, 30));
        const panel = document.getElementById('panel-' + b.dataset.tab);
        if (!panel || !panel.classList.contains('active')) bad.push(b.dataset.tab);
      }
      return { n: document.querySelectorAll('nav.tabs button[data-tab]').length, bad };
    });
    expect(r.n >= 10, 'trop peu d\'onglets : ' + r.n);
    eq(r.bad, [], 'onglets qui ne s\'ouvrent pas');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Montant en lettres (français, anglais, arabe)', async () => {
    const p = await open(browser);
    const r = await p.app(`[montantEnLettres(51600, 'fr'), montantEnLettres(1250, 'en'), montantEnLettres(300, 'ar')]`);
    expect(/cinquante et un mille six cents/i.test(r[0]), 'français : ' + r[0]);
    expect(/one thousand two hundred (and )?fifty/i.test(r[1]), 'anglais : ' + r[1]);
    expect(/ثلاثمائة/.test(r[2]), 'arabe : ' + r[2]);
    await p.close2();
  });

  await test('Facture et ticket dans 3 langues et 3 monnaies', async () => {
    const p = await open(browser, { viewport: { width: 820, height: 1100 } });
    const inv = { num: 12, date: '2026-10-16', client: 'Client Test', lignes: [{ ref: 'R1', nom: 'Riz 25 kg', qte: 2, unite: 'sac', prix: 16500 }, { ref: 'H2', nom: 'Huile 5 L', qte: 3, unite: 'bidon', prix: 6200 }], total: 51600, montantPaye: 20000, echeance: '2026-10-30', remise: 0 };
    for (const [lg, dv, cur] of [['fr', 'GNF', 'GNF'], ['en', 'GMD', 'D'], ['ar', 'MRU', 'MRU']]) {
      const r = await p.app(`(() => { window.print = () => {}; state.commerce = { id: 'x', nom: 'Boutique Test', adresse: 'Rue 1', telephone: '00 00 00', devise: '${dv}', langueFacture: '${lg}' };
        const inv = ${JSON.stringify(inv)}; printInvoice(inv, 'facture');
        return { total: document.getElementById('pi-total').textContent, lettres: document.getElementById('pi-lettres').textContent, client: document.getElementById('pi-client').textContent, ticket: ticketText(inv) }; })()`);
      expect(r.client.includes('Client Test'), lg + ' : client absent');
      expect(r.total.replace(/\D/g, '').includes('51600'), lg + ' : total « ' + r.total + ' »');
      expect(r.total.includes(cur) || r.ticket.includes(cur), lg + ' : monnaie ' + cur + ' absente (« ' + r.total + ' »)');
      expect(r.lettres.trim().length > 10, lg + ' : montant en lettres vide');
      expect(r.ticket.includes('Riz 25 kg'), lg + ' : ticket incomplet');
    }
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Vente : les lignes et le total se calculent', async () => {
    const p = await open(browser);
    const r = await p.app(`(() => { document.getElementById('loginOverlay').style.display = 'none';
      document.querySelector('[data-tab="ventes"]').click();
      state.products = [{ ref: 'R1', nom: 'Riz 25 kg', prixVente: 17500, stock: 9, unite: 'sac' }];
      invoiceLines = [{ ref: 'R1', nom: 'Riz 25 kg', qte: 2, prix: 17500, unite: 'sac', matched: true }, { ref: '', nom: 'Bonbons', qte: 3, prix: 50, unite: '', matched: false }];
      renderInvoiceLines(); updateGrandTotal();
      return document.getElementById('invGrandTotal').textContent; })()`);
    eq(r.replace(/\D/g, ''), '35150', 'total de la vente');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Saisie par photo : facture fournisseur → stock (IA simulée)', async () => {
    const p = await open(browser);
    const r = await p.app(`(async () => {
      document.getElementById('loginOverlay').style.display = 'none';
      document.querySelector('[data-tab="produits"]').click();
      document.getElementById('photoFillCard').style.display = '';
      const writes = [];
      state.db = { doc: (path) => ({ set: async (v) => writes.push(['set', path, v]), update: async (v) => writes.push(['update', path, v]) }) };
      state.products = [{ id: 'p-riz', ref: 'RIZ25', nom: 'Riz parfumé sac 25 kg', stock: 4, unite: 'sac', prixVente: 17500, prixAchat: 16000 }];
      window.logAction = () => {};
      supabaseClient = { functions: { invoke: async () => ({ data: { resultat: { fournisseur: 'Grossiste', total: 101000, lignes: [
        { nom: 'Riz parfumé sac 25 kg', quantite: 5, unite: 'sac', prix_achat: 16200, total: 81000 },
        { nom: 'Huile Dinor 1 L', quantite: 10, unite: 'bidon', prix_achat: 2000, total: 20000 }] } }, error: null }) } };
      const blob = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob();
      pfMode = 'facture'; await pfAnalyse([new File([blob], 'f.png', { type: 'image/png' })]);
      const rows = pfRows.map(r => [r.nom, r.quantite, r.matchId || null]);
      document.getElementById('pfSave').click();
      await new Promise(r => setTimeout(r, 300));
      const prods = writes.filter(w => w[1].startsWith('produits'));
      return { rows, riz: (prods.find(w => (w[2].nom || '').startsWith('Riz') || w[1].includes('p-riz')) || [])[2], nNew: prods.filter(w => w[0] === 'set').length };
    })()`);
    eq(r.rows, [['Riz parfumé sac 25 kg', 5, 'p-riz'], ['Huile Dinor 1 L', 10, null]], 'lignes lues');
    expect(r.riz && Number(r.riz.stock) === 9, 'stock du riz après la facture (4 + 5) : ' + JSON.stringify(r.riz));
    expect(r.nNew >= 1, 'le nouveau produit (huile) n\'a pas été créé');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Le point du patron : chiffres et alertes anti-vol', async () => {
    const p = await open(browser, { viewport: { width: 420, height: 1100 } });
    const night = new Date(); night.setHours(23, 10, 0, 0);
    const t = day(0);
    const data = {
      commerce: { nom: 'Boutique Test' },
      products: [{ ref: 'R1', nom: 'Riz 25 kg', prixAchat: 16000, prixVente: 17500, stock: 2, seuil: 5, unite: 'sac' }, { ref: 'H1', nom: 'Huile 1 L', prixAchat: 2000, prixVente: 2300, stock: -1, seuil: 3, unite: 'bidon' }],
      invoices: [
        { num: 1, date: t, total: 37300, montantPaye: 20000, operateur: 'Awa (Caissier)', createdAt: Date.now(), lignes: [{ ref: 'R1', nom: 'Riz 25 kg', qte: 2, prix: 17500 }, { ref: 'H1', nom: 'Huile 1 L', qte: 1, prix: 2300 }] },
        { num: 2, date: t, total: 8500, sousTotal: 10000, remise: 1500, montantPaye: 8500, operateur: 'Awa (Caissier)', createdAt: night.getTime(), lignes: [{ ref: 'H1', nom: 'Huile 1 L', qte: 4, prix: 2500 }] },
        { num: 3, date: t, total: 17500, annulee: true, operateur: 'Awa (Caissier)', lignes: [] },
        { num: 4, date: day(2), total: 30000, lignes: [] }],
      paiements: [{ date: t, montant: 20000, mode: 'Espèces' }, { date: t, montant: 8500, mode: 'Mobile Money' }],
      depenses: [{ date: t, montant: 2000 }],
      movements: [{ date: t, source: 'perte', quantite: -2, unite: 'bidon', nom: 'Huile 1 L', raison: 'Casse' }],
    };
    const r = await p.app(`(() => { document.getElementById('loginOverlay').style.display = 'none'; Object.assign(state, ${JSON.stringify(data)});
      document.getElementById('bossCard').style.display = ''; bossRender();
      const B = bossCompute(0); return { ventes: B.ventes, benef: B.benefice, n: B.nbVentes, alertes: (B.alertes || []).length, txt: bossText(B, false) }; })()`);
    expect(/45\s?800/.test(r.txt), 'ventes du jour (45 800) absentes du résumé');
    expect(/3\s?800/.test(r.txt), 'bénéfice estimé (3 800) absent du résumé');
    expect(/annul/i.test(r.txt) && /remise/i.test(r.txt) && /(nuit|22|23)/i.test(r.txt), 'alertes manquantes dans le résumé');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Vente à la voix (en pause) : la phrase remplit la facture (IA simulée)', async () => {
    const p = await open(browser);
    const r = await p.app(`(async () => {
      document.getElementById('loginOverlay').style.display = 'none';
      document.querySelector('[data-tab="ventes"]').click();
      state.products = [{ id: 'p-riz', ref: 'RIZ25', nom: 'Riz parfumé sac 25 kg', stock: 9, unite: 'sac', prixVente: 17500 }, { id: 'p-huile', ref: 'HUI1', nom: 'Huile Dinor 1 L', stock: 10, unite: 'bidon', prixVente: 2300 }];
      state.clients = [{ id: 'c1', nom: 'Moussa Diop' }];
      supabaseClient = { functions: { invoke: async () => ({ data: { resultat: { client: 'Moussa Diop', credit: true, mode: 'Espèces', paye: 5000, compris: true, lignes: [
        { id: 'p-riz', nom: 'riz', quantite: 2, prix: null }, { id: 'p-huile', nom: 'huile', quantite: 1, prix: null }, { id: null, nom: 'Bonbons', quantite: 3, prix: 50 }] } }, error: null }) } };
      await vsParse('2 sacs de riz, 1 huile et 3 bonbons à 50 pour Moussa à crédit');
      return { client: document.getElementById('f-client').value, total: document.getElementById('invGrandTotal').textContent, n: invoiceLines.filter(l => l.nom).length };
    })()`);
    eq(r.client, 'Moussa Diop', 'client');
    eq(r.n, 3, 'nombre de lignes');
    eq(r.total.replace(/\D/g, ''), '37450', 'total');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  // Données d'une boutique inventée, sur 10 jours, pour les fonctions « intelligentes »
  const smartData = () => {
    const invoices = [];
    for (let k = 0; k < 10; k++) invoices.push({ num: k + 1, date: day(k), total: 35000 + 2300, montantPaye: 37300, lignes: [{ ref: 'R1', nom: 'Riz 25 kg', qte: 2, prix: 17500 }, { ref: 'S1', nom: 'Savon', qte: 1, prix: 300 }] });
    invoices.push({ num: 20, date: day(20), total: 25000, montantPaye: 5000, client: 'Moussa Diop', clientId: 'c1', lignes: [{ ref: 'S1', nom: 'Savon', qte: 1, prix: 300 }] });
    return {
      commerce: { nom: 'Boutique Test' },
      products: [
        { id: 'p1', ref: 'R1', nom: 'Riz 25 kg', stock: 5, seuil: 2, unite: 'sac', prixAchat: 16000, prixVente: 17500, fournisseur: 'Grossiste Ndiaye' },
        { id: 'p2', ref: 'S1', nom: 'Savon', stock: 100, seuil: 5, unite: 'pièce', prixAchat: 200, prixVente: 300 },
        { id: 'p3', ref: 'U1', nom: 'Sucre 1 kg', stock: 2, seuil: 5, unite: 'kg', prixAchat: 700, prixVente: 650, fournisseur: 'grossiste ndiaye' }],
      fournisseurs: [{ id: 'f1', nom: 'Grossiste Ndiaye', telephone: '77 000 00 00' }],
      clients: [{ id: 'c1', nom: 'Moussa Diop', telephone: '' }],
      invoices, paiements: [], depenses: [], movements: [],
    };
  };

  await test('À commander : prévision de rupture et quantité pour 2 semaines', async () => {
    const p = await open(browser);
    const r = await p.app(`(() => { document.getElementById('loginOverlay').style.display = 'none'; Object.assign(state, ${JSON.stringify(smartData())}); smartOk = true;
      const F = smartForecast(); smartOrderRender();
      return { list: F.list.map(o => [o.p.nom, o.days === null ? null : Math.round(o.days * 10) / 10, o.qty]), groups: F.groups.map(g => [g.nom, g.items.length]),
        txt: smartOrderText(F.groups[0]), shown: document.getElementById('smartOrderCard').style.display, rows: document.querySelectorAll('#smartOrderBody .so-row').length }; })()`);
    eq(r.list, [['Riz 25 kg', 3.2, 18], ['Sucre 1 kg', null, 8]], 'produits à commander [nom, jours restants, quantité]');
    eq(r.groups, [['Grossiste Ndiaye', 2]], 'regroupement par fournisseur');
    expect(r.txt.includes('- 18 sac Riz 25 kg') && r.txt.includes('- 8 kg Sucre 1 kg'), 'message de commande : ' + r.txt);
    eq([r.shown, r.rows], ['', 2], 'carte affichée');
    const hidden = await p.app(`(() => { smartOk = false; smartOrderRender(); return document.getElementById('smartOrderCard').style.display; })()`);
    eq(hidden, 'none', 'carte cachée quand la fonction est fermée');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Anti-erreur à la caisse : vente à perte, prix à 0, zéro en trop', async () => {
    const p = await open(browser);
    const r = await p.app(`(async () => { document.getElementById('loginOverlay').style.display = 'none'; document.querySelector('[data-tab="ventes"]').click();
      Object.assign(state, ${JSON.stringify(smartData())}); smartOk = true;
      const L = (prix, qte = 1) => ({ ref: 'R1', nom: 'Riz 25 kg', qte, prix, unite: 'sac', matched: true });
      const kinds = (lines) => saleGuardIssues(lines).map(i => i.k);
      const res = { ok: kinds([L(17500)]), perte: kinds([L(15000, 2)]), cher: kinds([L(175000)]), zero: kinds([{ nom: 'Sachet', qte: 1, prix: 0 }]), bas: kinds([{ ...L(8000), ref: 'S1', nom: 'x' }]) };
      // Vente à perte : la 1re tentative est arrêtée, la vente passe après « Oui, je confirme »
      const writes = []; window.logAction = () => {};
      state.db = { queueStock: async () => 0, doc: (path) => ({ set: async (v) => writes.push(path), update: async () => {} }), collection: (c) => ({ doc: (id) => ({ set: async () => writes.push(c + '/' + id) }) }) };
      invoiceLines = [L(15000)]; renderInvoiceLines();
      await finalizeInvoice();
      res.blocked = writes.length; res.ask = !!document.getElementById('sgYes');
      document.getElementById('sgYes').click(); await new Promise(r => setTimeout(r, 300));
      res.saved = writes.filter(w => w.startsWith('factures/')).length;
      // Compte qui n'est pas de test : aucun blocage (comme avant)
      smartOk = false; invoiceLines = [L(15000)]; renderInvoiceLines(); writes.length = 0;
      await finalizeInvoice(); res.free = writes.filter(w => w.startsWith('factures/')).length;
      return res; })()`);
    eq([r.ok, r.perte, r.cher, r.zero], [[], ['perte'], ['cher'], ['zero']], 'anomalies détectées');
    eq([r.blocked, r.ask, r.saved, r.free], [0, true, 1, 1], '[écritures avant confirmation, bouton de confirmation, vente après confirmation, vente sans test]');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Mes 3 actions du jour : les plus utiles d\'abord', async () => {
    const p = await open(browser);
    const r = await p.app(`(() => { document.getElementById('loginOverlay').style.display = 'none'; Object.assign(state, ${JSON.stringify(smartData())}); smartOk = true;
      try { localStorage.removeItem('sf_actions_faites_' + todayStr()); } catch (e) {}
      smartActionsRender();
      const titles = () => [...document.querySelectorAll('#smartActionsBody .sa-tx b')].map(b => b.textContent);
      const before = titles();
      document.querySelector('#smartActionsBody [data-sadone]').click();
      return { before, done: document.querySelectorAll('#smartActionsBody .sa-item.done').length, shown: document.getElementById('smartActionsCard').style.display }; })()`);
    eq(r.before, ['💸 Corriger le prix de Sucre 1 kg', '🙋 Relancer Moussa Diop', '🛒 Commander chez Grossiste Ndiaye'], 'les 3 actions');
    eq([r.done, r.shown], [1, ''], 'cocher « fait »');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  // Faux serveur Supabase pour les abonnements (aucune requête ne sort)
  const aboSetup = (row, opts = {}) => `(() => {
    document.getElementById('loginOverlay').style.display = 'none';
    window.__calls = [];
    const tables = { abonnements: ${JSON.stringify(row)}, plateforme_config: ${JSON.stringify(opts.cfg || [])}, paiements_abonnement: [] };
    const rpcs = { est_admin_plateforme: () => ${opts.admin ? 'true' : 'false'}, admin_boutiques: () => ${JSON.stringify(opts.boutiques || [])}, admin_prolonger: () => '2026-12-31', admin_paiements: () => [] };
    const res = (t) => Promise.resolve({ data: tables[t], error: null });
    supabaseClient = { from: (t) => { const q = { select: () => q, eq: () => q, order: () => q, limit: () => res(t), maybeSingle: () => res(t), then: (a, b) => res(t).then(a, b) }; return q; },
      rpc: async (fn, args) => { window.__calls.push([fn, args]); return rpcs[fn] ? { data: rpcs[fn](args), error: null } : { data: null, error: { message: 'absent' } }; },
      functions: { invoke: async () => ({ data: null, error: { message: 'hors ligne' } }) } };
    CURRENT_COMMERCE_ID = 'c-test'; state.currentUser = { id: 'u1', nom: 'Abdoul Test', role: 'proprietaire', commerceId: 'c-test' }; state.commerce = { nom: 'Boutique Test', devise: 'XOF' };
    try { localStorage.removeItem('sf_abo:c-test'); } catch (e) {}
  })()`;
  const plusJours = (k) => day(-k);

  await test('Fonctions intelligentes ouvertes à tous les patrons, l\'IA reste réservée au compte de test', async () => {
    const p = await open(browser);
    const r = await p.app(`(() => { document.getElementById('loginOverlay').style.display = 'none'; Object.assign(state, ${JSON.stringify(smartData())});
      const vis = (id) => document.getElementById(id).style.display;
      const snap = () => ({ smart: smartOk, ordre: vis('smartOrderCard'), actions: vis('smartActionsCard'), patron: vis('bossCard'), ecouter: vis('bossListen'), photo: vis('photoFillCard'), bel: vis('aiAsk') });
      aiAskOk = false; state.currentUser = { id: 'u1', nom: 'Patron', role: 'proprietaire' }; smartInit(); const patron = snap();
      state.currentUser = { id: 'u2', nom: 'Caissier', role: 'caissier' }; smartInit(); const caissier = snap();
      return { patron, caissier }; })()`);
    eq(r.patron, { smart: true, ordre: '', actions: '', patron: '', ecouter: 'none', photo: 'none', bel: 'none' }, 'patron sans IA');
    eq(r.caissier, { smart: false, ordre: 'none', actions: 'none', patron: 'none', ecouter: 'none', photo: 'none', bel: 'none' }, 'caissier');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  // Sans abonnement : aucun blocage, mais le patron voit la carte « Mon abonnement » (tarifs + comment payer)
  await test('Abonnement : sans abonnement enregistré, rien ne change (aucun blocage)', async () => {
    const p = await open(browser);
    await p.app(aboSetup(null));
    const r = await p.app(`(async () => { await aboLoad(); const writes = [];
      state.db = { queueStock: async () => 0, doc: (path) => ({ set: async () => writes.push(path), update: async () => {} }), collection: (c) => ({ doc: (id) => ({ set: async () => writes.push(c + '/' + id) }) }) };
      document.querySelector('[data-tab="ventes"]').click(); invoiceLines = [{ ref: '', nom: 'Bonbons', qte: 2, prix: 50, unite: '', matched: false }]; renderInvoiceLines(); await finalizeInvoice();
      return { mode: aboStatus().mode, ro: aboReadOnly(), banner: document.getElementById('aboBanner').style.display, card: document.getElementById('aboCard').style.display,
        admin: document.querySelector('[data-tab="admin"]').style.display, saved: writes.filter(w => w.startsWith('factures/')).length }; })()`);
    eq(r, { mode: 'none', ro: false, banner: 'none', card: '', admin: 'none', saved: 1 }, 'boutique sans abonnement');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Abonnement : rappel avant la fin, délai de grâce, puis lecture seule', async () => {
    const p = await open(browser);
    const out = {};
    for (const [k, d] of [['actif', 20], ['bientot', 3], ['grace', -2], ['lecture', -5]]) {
      await p.app(aboSetup({ commerce_id: 'c-test', actif_jusqua: plusJours(d), essai: false }));
      out[k] = await p.app(`(async () => { await aboLoad(); return [aboStatus().mode, aboReadOnly(), document.getElementById('aboBanner').style.display === 'none' ? '' : document.getElementById('aboBanner').className.replace('abo-banner', '').trim()]; })()`);
    }
    eq(out, { actif: ['actif', false, ''], bientot: ['bientot', false, 'warn'], grace: ['grace', false, 'bad'], lecture: ['lecture', true, 'bad'] }, '[état, lecture seule, bandeau]');
    // En lecture seule : la vente est refusée et rien n'est écrit, même en appelant la base directement
    const r = await p.app(`(async () => { const writes = [];
      document.querySelector('[data-tab="ventes"]').click(); invoiceLines = [{ ref: '', nom: 'Bonbons', qte: 2, prix: 50, unite: '', matched: false }]; renderInvoiceLines();
      state.db = { queueStock: async () => 0, doc: (path) => ({ set: async () => writes.push(path) }), collection: (c) => ({ doc: (id) => ({ set: async () => writes.push(c + '/' + id) }) }) };
      await finalizeInvoice();
      return { writes: writes.length, onParams: document.getElementById('panel-parametres').classList.contains('active'), card: document.getElementById('aboCard').style.display }; })()`);
    eq(r, { writes: 0, onParams: true, card: '' }, 'vente bloquée et redirection vers « Mon abonnement »');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Mon abonnement : tarifs, économie sur 12 mois, comment payer', async () => {
    const p = await open(browser);
    await p.app(aboSetup({ commerce_id: 'c-test', actif_jusqua: plusJours(10) }, { cfg: [{ cle: 'tarifs', valeur: { XOF: { m1: 5000, m3: 14000, m12: 50000 } } }, { cle: 'paiement', valeur: { wave: '77 000 00 00', whatsapp: '77 000 00 00' } }] }));
    const r = await p.app(`(async () => { await aboLoad(); const b = document.getElementById('aboBody'); return { prix: [...b.querySelectorAll('.abo-p b')].map(x => x.textContent), eco: [...b.querySelectorAll('.abo-p em')].map(x => x.textContent), wave: b.textContent.includes('77 000 00 00'), paid: !!document.getElementById('aboPaid') }; })()`);
    eq(r.prix.map(x => x.replace(/\D/g, '')), ['5000', '14000', '50000'], 'prix');
    expect(r.eco.length === 2 && /1\s?000/.test(r.eco[0]) && /10\s?000/.test(r.eco[1]), 'économies : ' + JSON.stringify(r.eco));
    eq([r.wave, r.paid], [true, true], 'numéro Wave et bouton « J\'ai payé »');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await test('Page Admin : visible pour l\'admin seulement, +1 mois enregistre le paiement', async () => {
    const p = await open(browser, { viewport: { width: 1280, height: 900 } });
    const boutiques = [{ commerce_id: 'c1', nom: 'Boutique Siradji', devise: 'XOF', telephone: '77 1', proprietaire: 'Siradji', email: 's@x', nb_factures: 120, derniere_vente: day(0), actif_jusqua: null, essai: false },
      { commerce_id: 'c2', nom: 'Chez Moussa', devise: 'GNF', telephone: '', proprietaire: 'Moussa', email: 'm@x', nb_factures: 3, derniere_vente: day(1), actif_jusqua: plusJours(2), essai: true }];
    await p.app(aboSetup(null, { admin: true, boutiques, cfg: [{ cle: 'tarifs', valeur: { XOF: { m1: 5000 } } }] }));
    const r = await p.app(`(async () => { await aboLoad();
      const tab = document.querySelector('[data-tab="admin"]'); const vis = tab.style.display; tab.click(); await new Promise(r => setTimeout(r, 50));
      const rows = [...document.querySelectorAll('.adm-row')].map(x => x.querySelector('.adm-id b').textContent);
      const relancer = document.querySelector('[data-adf="relancer"]').textContent;
      const row = document.querySelector('.adm-row[data-adr="c1"]'); row.querySelector('[data-adadd="1"]').click();
      const montant = row.querySelector('[data-adm-montant]').value; row.querySelector('[data-adm-ref]').value = 'TX42';
      row.querySelector('[data-adok="1"]').click(); await new Promise(r => setTimeout(r, 100));
      const call = window.__calls.find(c => c[0] === 'admin_prolonger');
      return { vis, rows, relancer, montant, call: call && [call[1].p_commerce, call[1].p_mois, call[1].p_montant, call[1].p_moyen, call[1].p_reference] }; })()`);
    eq(r.vis, '', 'onglet Admin visible');
    expect(r.rows.length === 2 && /\(1\)/.test(r.relancer), 'boutiques à relancer : ' + r.relancer);
    eq(r.montant, '5000', 'montant pré-rempli avec le tarif');
    eq(r.call, ['c1', 1, 5000, 'Wave', 'TX42'], 'paiement envoyé à la base');
    eq(p.errors, [], 'erreurs');
    await p.close2();
  });

  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const ko = results.filter((r) => !r[0]);
  console.log('\n' + (ko.length ? '✗ ' + ko.length + ' test(s) en échec sur ' + results.length : '✓ Les ' + results.length + ' tests sont réussis'));
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
