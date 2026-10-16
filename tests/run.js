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
    eq(r, { login: true, panels: 14, title: 'BoromBoutik' }, 'page de départ');
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

  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const ko = results.filter((r) => !r[0]);
  console.log('\n' + (ko.length ? '✗ ' + ko.length + ' test(s) en échec sur ' + results.length : '✓ Les ' + results.length + ' tests sont réussis'));
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
