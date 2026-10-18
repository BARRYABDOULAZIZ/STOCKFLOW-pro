#!/usr/bin/env node
/*
  BoromBoutik — assemblage de l'application.

  Le code est rangé par morceaux dans le dossier src/ :
    src/index.html      le squelette de la page (avec des lignes  <!-- @inclure chemin -->)
    src/css/            les styles
    src/html/           les morceaux de page (en-tête, connexion, un fichier par onglet…)
    src/js/             le programme, un fichier par fonction de l'appli (factures, ventes, Bel…)

  Ce script recolle tous les morceaux dans index.html, le seul fichier que Vercel met en ligne.
  On modifie TOUJOURS les fichiers de src/, puis on lance :

    node build.js           → refabrique index.html
    node build.js --check   → vérifie seulement que index.html est bien à jour (rien n'est écrit)

  Aucune dépendance à installer : Node.js suffit.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');
const INCLUDE = /^<!-- @inclure (\S+) -->$/;
const NOTE = '<!-- Fichier assemblé par build.js à partir du dossier src/ : modifier les fichiers de src/, jamais celui-ci directement. -->';

// Renvoie les lignes assemblées, chacune avec son fichier et son numéro d'origine (pour des messages d'erreur précis)
function assemble(file, seen) {
  const text = fs.readFileSync(file, 'utf8').replace(/\n$/, file.endsWith('index.html') ? '\n' : '');
  const out = [];
  text.split('\n').forEach((line, i) => {
    const m = line.match(INCLUDE);
    if (!m) { out.push({ text: line, file, line: i + 1 }); return; }
    const part = path.join(SRC, m[1]);
    if (!part.startsWith(SRC + path.sep)) throw new Error('Chemin interdit : ' + m[1]);
    if (!fs.existsSync(part)) throw new Error('Morceau introuvable : src/' + m[1]);
    if (seen.has(part)) throw new Error('Morceau inclus deux fois : src/' + m[1]);
    seen.add(part);
    out.push(...assemble(part, seen));
  });
  return out;
}

function build() {
  const seen = new Set();
  const rows = assemble(path.join(SRC, 'index.html'), seen);
  const at = rows.findIndex((r) => r.text === '<meta charset="UTF-8">');
  rows.splice(at + 1, 0, { text: NOTE, file: OUT, line: 0 });
  const html = rows.map((r) => r.text).join('\n');

  // Morceaux oubliés (présents dans src/ mais jamais inclus) : sûrement une erreur
  const all = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : all.push(p); } })(SRC);
  const orphans = all.filter((p) => p !== path.join(SRC, 'index.html') && !seen.has(p));
  if (orphans.length) throw new Error('Fichiers jamais inclus dans src/index.html :\n  ' + orphans.map((p) => path.relative(ROOT, p)).join('\n  '));

  // Vérifie la syntaxe de chaque programme (sans l'exécuter) : une faute de frappe est bloquée ici, pas chez le client
  const scripts = [...html.matchAll(/<script>\n([\s\S]*?)<\/script>/g)];
  scripts.forEach((m) => {
    const first = html.slice(0, m.index).split('\n').length; // ligne de <script> dans index.html
    try { new vm.Script(m[1], { filename: 'programme' }); }
    catch (e) {
      const n = Number(((e.stack || '').match(/programme:(\d+)/) || [])[1] || 0);
      const r = rows[first + n - 1];
      const where = r ? path.relative(ROOT, r.file) + ', ligne ' + r.line : 'programme';
      throw new Error('Erreur de syntaxe dans ' + where + ' : ' + e.message);
    }
  });
  return { html, files: seen.size, scripts: scripts.length };
}

// Pages publiques (lien demandé par le Play Store) : confidentialité, conditions, suppression de compte.
// Le texte vient de src/js/27-pages-legales.js : une seule source, l'appli et le site disent la même chose.
function publicPages() {
  const src = fs.readFileSync(path.join(SRC, 'js', '27-pages-legales.js'), 'utf8');
  const start = src.indexOf('const LEGAL'), end = src.indexOf('  // Demande de suppression de compte');
  if (start < 0 || end < 0) throw new Error('Pages légales : repères introuvables dans src/js/27-pages-legales.js');
  const ctx = { escapeHtml: (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
  vm.runInNewContext(src.slice(start, end) + '\nthis.LEGAL = LEGAL; this.legalHtml = legalHtml;', ctx);
  const pages = { 'confidentialite.html': ['confidentialite', 'Politique de confidentialité'], 'conditions.html': ['cgu', "Conditions d'utilisation"], 'supprimer-compte.html': ['suppression', 'Supprimer mon compte'] };
  const out = {};
  for (const [file, [key, title]] of Object.entries(pages)) {
    const body = ctx.legalHtml(key).replace(/href="#" data-legal="confidentialite"/g, 'href="confidentialite.html"').replace(/href="#" data-legal="cgu"/g, 'href="conditions.html"');
    out[file] = `<!DOCTYPE html>
<!-- Page publique fabriquée par build.js à partir de src/js/27-pages-legales.js : ne pas modifier ici. -->
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${ctx.LEGAL.app}</title>
<meta name="theme-color" content="#5b3df5">
<link rel="icon" href="boromboutik-logo-192.png">
<style>
  body { margin:0; background:#f3f5ff; color:#1b1440; font:16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  header { background:linear-gradient(135deg,#5b3df5,#e2387e); color:#fff; padding:18px 20px; display:flex; align-items:center; gap:12px; }
  header img { width:40px; height:40px; border-radius:10px; }
  header b { font-size:20px; }
  main { max-width:760px; margin:24px auto; background:#fff; border-radius:16px; padding:24px 28px; box-shadow:0 4px 24px rgba(27,20,64,.08); }
  h2 { font-size:26px; line-height:1.25; } h3 { margin-top:28px; color:#5b3df5; }
  .muted { color:#6b6790; font-size:14px; } a { color:#5b3df5; }
  footer { text-align:center; padding:8px 16px 32px; font-size:14px; }
  @media (max-width:600px) { main { margin:0; border-radius:0; padding:20px 16px; } }
</style>
</head>
<body>
<header><img src="boromboutik-logo-192.png" alt=""><b>${ctx.LEGAL.app}</b></header>
<main>${body}
</main>
<footer><a href="confidentialite.html">Confidentialité</a> · <a href="conditions.html">Conditions d'utilisation</a> · <a href="supprimer-compte.html">Supprimer mon compte</a> · <a href="./">Ouvrir ${ctx.LEGAL.app}</a></footer>
</body>
</html>
`;
  }
  return out;
}

try {
  const { html, files, scripts } = build();
  const pages = publicPages();
  const check = process.argv.includes('--check');
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (check) {
    if (current !== html) { console.error('✗ index.html n\'est PAS à jour : lancer  node build.js'); process.exit(1); }
    for (const [f, txt] of Object.entries(pages)) {
      const cur = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '';
      if (cur !== txt) { console.error('✗ ' + f + ' n\'est PAS à jour : lancer  node build.js'); process.exit(1); }
    }
    console.log('✓ index.html est à jour (' + files + ' morceaux, ' + scripts + ' programmes vérifiés)');
  } else {
    fs.writeFileSync(OUT, html);
    for (const [f, txt] of Object.entries(pages)) fs.writeFileSync(path.join(ROOT, f), txt);
    console.log('✓ index.html assemblé : ' + files + ' morceaux, ' + scripts + ' programmes vérifiés, ' + Math.round(html.length / 1024) + ' Ko');
  }
} catch (e) {
  console.error('✗ ' + e.message);
  process.exit(1);
}
