# BoromBoutik

Gestion de stock, ventes et factures pour les boutiques d'Afrique de l'Ouest (Sénégal, Guinée, Gambie, Mauritanie).
Application web installable (PWA), en ligne sur **https://boromboutik.com**.

## Comment le code est rangé

L'appli publiée est **un seul fichier**, `index.html`, que Vercel met en ligne tel quel (aucune étape de compilation chez Vercel).
Mais on ne modifie **jamais** `index.html` à la main : il est **assemblé** à partir des morceaux du dossier `src/`.

```
src/
  index.html                  squelette de la page : lignes  <!-- @inclure chemin -->
  css/                        les styles (couleurs, mise en page, tickets…)
  html/                       en-tête, connexion, page de Bel, menu, impression
  html/onglets/               un fichier par onglet (Accueil, Produits, Ventes, Caisse…)
  js/                         le programme, un fichier par fonction de l'appli
    00-etat.js                  données en mémoire
    01-devise.js                FCFA, franc guinéen, dalasi, ouguiya
    02 → 04                     langues de l'écran (français, anglais, arabe) et traductions
    05-utilisateur-commerce.js  compte, rôle, réglages du commerce, logo
    11-connexion.js             connexion, inscription, mot de passe oublié
    12-bel.js                   Bel, l'assistant IA (questions, voix, micro)
    13-session.js               ouverture de session, mode hors connexion
    18-factures-ticket.js       factures
    19-montant-en-lettres.js    montant en lettres, ticket, impression de la facture
    20-ventes.js                écran de vente
    23-saisie-photo.js          stock par photo (IA)
    24-point-patron.js          le point du patron
    25-vente-voix.js            vente à la voix (en pause)
    36-base-de-donnees.js       Supabase + copie locale (IndexedDB) + file d'attente hors connexion
    37-demarrage.js             démarrage de l'appli
    menu-bas.js                 barre de menu du bas (téléphone)
build.js                      recolle les morceaux dans index.html
tests/run.js                  tests automatiques
supabase/functions/ask-ai/    fonction serveur de l'IA (Bel, photo, voix) — déployée à part sur Supabase
sw.js, manifest.json          fonctionnement hors connexion et installation sur le téléphone
```

Les fichiers de `src/js/` sont des morceaux d'**un seul programme** : ils sont recollés dans l'ordre des numéros
et partagent les mêmes variables. L'ordre compte : on ne renumérote pas un fichier sans raison.

## Faire une modification

1. Modifier le bon fichier dans `src/`.
2. Assembler : `node build.js`
   (vérifie aussi qu'il n'y a pas de faute de syntaxe, et indique le fichier et la ligne en cas d'erreur)
3. Tester : `node tests/run.js`
4. Envoyer sur GitHub **les fichiers de `src/` et le nouvel `index.html`** ensemble.

`node build.js --check` vérifie seulement que `index.html` correspond bien à `src/` (rien n'est écrit).

## Les tests

`tests/run.js` ouvre l'appli dans un navigateur sans écran, **sans internet** (rien ne touche la vraie base ni un vrai compte),
avec des données inventées, et vérifie : le démarrage, les 3 langues, tous les onglets, le montant en lettres,
les factures et tickets (3 langues, 3 monnaies), le calcul d'une vente, la saisie par photo, le point du patron,
la vente à la voix.

Il faut Node.js et Playwright : `npm i -g playwright` puis `npx playwright install chromium`.

## Règles importantes

- Le compte de Siradji Sow est un **vrai** client : ne jamais l'utiliser pour des tests.
- Les fonctions IA (Bel, photo, point du patron, voix) sont réservées pour l'instant au compte de test (`aiAskOk`).
