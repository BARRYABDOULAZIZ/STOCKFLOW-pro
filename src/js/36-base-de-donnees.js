  // ================= Connexion Supabase (base de données réelle) =================
  const SUPABASE_URL = 'https://mbbgzcnxlngheowutgyg.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_WNNY1ROVip5Vf4h_RtVvXw_-7_jSS_S';
  let supabaseClient = null;

  // ---- Stockage local durable (IndexedDB) : copie des données + file d'attente des opérations hors connexion ----
  const sfStore = (function () {
    let dbp = null; const mem = new Map();
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((res) => {
        try {
          const r = indexedDB.open('stockflow-pro', 1);
          r.onupgradeneeded = () => { try { r.result.createObjectStore('kv'); } catch (e) {} };
          r.onsuccess = () => res(r.result);
          r.onerror = () => res(null);
          r.onblocked = () => res(null);
        } catch (e) { res(null); }
      });
      return dbp;
    }
    async function get(k) {
      const db = await open();
      if (!db) return mem.get(k);
      return new Promise((res) => {
        try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); } catch (e) { res(undefined); }
      });
    }
    async function set(k, v) {
      const db = await open();
      if (!db) { mem.set(k, v); return true; }
      return new Promise((res) => {
        try { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); tx.onabort = () => res(false); } catch (e) { res(false); }
      });
    }
    async function del(k) {
      const db = await open();
      if (!db) { mem.delete(k); return true; }
      return new Promise((res) => {
        try { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(true); tx.onerror = () => res(false); tx.onabort = () => res(false); } catch (e) { res(false); }
      });
    }
    return { get, set, del };
  })();

  // Toute requête réseau a un délai maximum : sur une connexion très lente on bascule en « file d'attente » au lieu de bloquer.
  function sfFetch(input, init) {
    init = init || {};
    const method = String(init.method || (input && input.method) || 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : ((input && input.url) || '');
    const ms = method === 'GET' ? 25000 : (/adjust_stock/.test(url) ? 120000 : 60000);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    if (init.signal) { if (init.signal.aborted) ctl.abort(); else init.signal.addEventListener('abort', () => ctl.abort(), { once: true }); }
    return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer));
  }
  // Une erreur « pas de réseau / réseau trop lent » (≠ refus du serveur)
  function isNetErr(e) {
    if (!e) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    if (e.name === 'AuthRetryableFetchError') return true;
    const msg = String(e.message || e);
    const code = e.code;
    if (code && !/^(ECONN|ETIMEDOUT|ENOTFOUND)/.test(String(code))) return false;
    return /failed to fetch|networkerror|network request|load failed|abort|timeout|timed out|econn|offline|gateway|service unavailable|fetch/i.test(msg);
  }
  function isAuthErr(e) {
    if (!e) return false;
    const msg = String(e.message || '');
    if (/issued at future/i.test(msg)) return false;
    return e.code === 'PGRST301' || e.code === 'PGRST303' || /jwt|not authenticated|invalid.*token/i.test(msg) || e.status === 401;
  }
  try { supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { global: { fetch: sfFetch } }); } catch (e) { console.error(e); }

  // Table où chaque ligne appartient à UN commerce précis (isolation multi-tenant)
  const activePolls = new Set();
  function stopAllPolling() { [...activePolls].forEach(stop => stop()); }
  const TENANT_TABLES = new Set(['produits', 'factures', 'mouvements', 'fournisseurs', 'commandes_fournisseurs', 'clients', 'paiements', 'depenses', 'documents']);
  let CURRENT_COMMERCE_ID = null;
  let CURRENT_USER_ID = null;

  // Les tables Postgres utilisent des noms en snake_case ; l'app utilise du camelCase.
  // Ces tables font la conversion dans les deux sens.
  const FIELD_MAPS = {
    produits: { codeBarre: 'code_barre', prixAchat: 'prix_achat', prixVente: 'prix_vente', createdAt: 'created_at' },
    factures: { createdAt: 'created_at', clientId: 'client_id', montantPaye: 'montant_paye', sousTotal: 'sous_total', tvaTaux: 'tva_taux', tvaMode: 'tva_mode', tvaMontant: 'tva_montant' },
    documents: { createdAt: 'created_at', clientId: 'client_id', factureId: 'facture_id', sourceId: 'source_id', sousTotal: 'sous_total', tvaTaux: 'tva_taux', tvaMode: 'tva_mode', tvaMontant: 'tva_montant' },
    mouvements: { productId: 'product_id', ancienStock: 'ancien_stock', nouveauStock: 'nouveau_stock', createdAt: 'created_at' },
    fournisseurs: { createdAt: 'created_at' },
    commandes_fournisseurs: { fournisseurId: 'fournisseur_id', fournisseurNom: 'fournisseur_nom', montantCommande: 'montant_commande', montantPaye: 'montant_paye', createdAt: 'created_at' },
    commerces: { logoUrl: 'logo_url', signatureUrl: 'signature_url', messageFacture: 'message_facture', numeroFiscal: 'numero_fiscal', inviteCode: 'invite_code', createdAt: 'created_at', langueFacture: 'langue_facture' },
    clients: { createdAt: 'created_at' },
    paiements: { factureId: 'facture_id', clientId: 'client_id', createdAt: 'created_at' },
    depenses: { createdAt: 'created_at' },
  };

  function toDbRow(table, obj) {
    const map = FIELD_MAPS[table] || {};
    const row = {};
    for (const [k, v] of Object.entries(obj)) row[map[k] || k] = v;
    return row;
  }
  function fromDbRow(table, row) {
    const map = FIELD_MAPS[table] || {};
    const inverse = {};
    for (const [k, v] of Object.entries(map)) inverse[v] = k;
    const obj = {};
    for (const [k, v] of Object.entries(row)) obj[inverse[k] || k] = v;
    return obj;
  }

  // Imite l'interface utilisée par le reste du code (collection/doc/onSnapshot),
  // mais parle en vrai à la base Postgres de Supabase — en filtrant automatiquement
  // par commerce_id pour que chaque commerce ne voie jamais les données d'un autre.
  function createSupabaseDb(client) {
    const T = {};                    // état par table : { server:Map, listeners:Set, version, ready, loaded, emitQ, cacheTimer }
    let outbox = [];                 // opérations en attente d'envoi (gardées sur l'appareil)
    let outLoaded = false, outLoading = null;
    let failed = [];                 // opérations refusées par le serveur (à montrer à l'utilisateur)
    let flushing = false, inflight = null, paused = null, retryTimer = null, retryDelay = 5000;
    const waiters = new Map(), late = new Set();
    const net = { fails: 0, lastMs: 0 };
    let slowUntil = 0;
    const GRACE = 1500;              // on attend au plus 1,5 s la réponse du serveur avant de laisser la file d'attente continuer seule
    const refreshers = {}; const kickTimers = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const ts = (table) => T[table] || (T[table] = { server: new Map(), listeners: new Set(), version: 0, ready: false, loaded: false, emitQ: false, cacheTimer: null });
    const cacheKey = (t) => 'cache:' + CURRENT_USER_ID + ':' + CURRENT_COMMERCE_ID + ':' + t;
    const outKey = () => 'outbox:' + CURRENT_USER_ID;
    const failKey = () => 'failed:' + CURRENT_USER_ID;
    const notify = () => { try { netBarUpdate(); } catch (e) {} };
    function netOk(ms) { net.fails = 0; if (ms) net.lastMs = ms; notify(); }
    function netFail() { net.fails++; notify(); }

    function kick(table) {
      clearTimeout(kickTimers[table]);
      kickTimers[table] = setTimeout(() => { (refreshers[table] || []).forEach(f => f()); }, 250);
    }
    // Fréquence de vérification du serveur (chaque vérification = une ligne de log facturée par Supabase au-delà de 1 Go/mois).
    // Pas besoin de plus : on revérifie aussi tout de suite quand on revient sur l'appli et après chaque écriture.
    const POLL_MS = { produits: 30000, factures: 30000, paiements: 60000, clients: 120000, depenses: 120000, fournisseurs: 300000, commandes_fournisseurs: 300000, documents: 300000, mouvements: 300000 };
    function canSeeCosts() {
      return !!(state.currentUser && (state.currentUser.role === 'proprietaire' || state.currentUser.role === 'admin'));
    }
    async function saveCost(productId, prixAchat) {
      if (!canSeeCosts()) return;
      const { error } = await client.from('produits_couts').upsert({ id: String(productId), commerce_id: CURRENT_COMMERCE_ID, prix_achat: Number(prixAchat) || 0 }, { onConflict: 'id' });
      if (error) throw error;
    }

    // ---------- Vue = données du serveur + opérations en attente (appliquées localement) ----------
    function applyOp(m, o) {
      const id = String(o.id);
      if (o.k === 'set') m.set(id, { ...(m.get(id) || {}), ...o.data, id });
      else if (o.k === 'update') { const cur = m.get(id); if (cur) m.set(id, { ...cur, ...o.data }); }
      else if (o.k === 'delete') m.delete(id);
      else if (o.k === 'stock') { const cur = m.get(id); if (cur) m.set(id, { ...cur, stock: (Number(cur.stock) || 0) + o.delta }); }
    }
    const pendingFor = (table) => outbox.filter(o => o.table === table);
    // Compte ce que l'utilisateur a fait (1 vente = 1), pas chaque morceau technique (stock, facture, paiement…)
    function pendingText() {
      if (!outbox.length) return '';
      const facIds = new Set(outbox.filter(o => o.table === 'factures' && o.k === 'set').map(o => String(o.id)));
      const ventes = facIds.size;
      const autres = outbox.filter(o => {
        if (o.silent) return false;
        if (o.table === 'factures' && o.k === 'set') return false;
        if (o.data && o.data.factureId && facIds.has(String(o.data.factureId))) return false;
        if (o.k === 'stock' && ventes) return false;
        if (o.table === 'clients' && o.k === 'set' && ventes) return false;
        return true;
      }).length;
      const parts = [];
      if (ventes) parts.push(ventes + (ventes > 1 ? ' ventes' : ' vente'));
      if (autres) parts.push(autres + (autres > 1 ? ' modifications' : ' modification'));
      return parts.length ? parts.join(' et ') : '1 modification';
    }
    function view(table) {
      const t = ts(table); const pend = pendingFor(table);
      if (!pend.length) return [...t.server.values()];
      const m = new Map(t.server);
      pend.forEach(o => applyOp(m, o));
      return [...m.values()];
    }
    function viewGet(table, id) {
      const t = ts(table); id = String(id);
      const m = new Map(); if (t.server.has(id)) m.set(id, t.server.get(id));
      outbox.forEach(o => { if (o.table === table && String(o.id) === id) applyOp(m, o); });
      return m.get(id);
    }
    function emit(table) {
      const t = ts(table);
      if (t.emitQ) return; t.emitQ = true;
      Promise.resolve().then(() => {
        t.emitQ = false;
        if (!t.ready) return;
        const docs = view(table).map(obj => ({ id: obj.id, data: () => obj }));
        t.listeners.forEach(fn => { try { fn({ docs }); } catch (e) { console.error(e); } });
      });
    }
    function scheduleCache(table) {
      const t = ts(table); clearTimeout(t.cacheTimer);
      t.cacheTimer = setTimeout(() => {
        if (!CURRENT_USER_ID || !CURRENT_COMMERCE_ID) return;
        const run = () => sfStore.set(cacheKey(table), [...t.server.values()]);
        if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 8000 }); else run();
      }, 1500);
    }

    // ---------- File d'attente (outbox) ----------
    let persistChain = Promise.resolve();
    function persistOutbox() {
      if (!CURRENT_USER_ID) return Promise.resolve();
      const snap = clone(outbox), key = outKey();
      persistChain = persistChain.then(() => sfStore.set(key, snap));
      return persistChain;
    }
    function persistFailed() { if (CURRENT_USER_ID) sfStore.set(failKey(), clone(failed.slice(-50))); }
    function ensureOutbox() {
      if (outLoaded) return Promise.resolve();
      if (outLoading) return outLoading;
      outLoading = (async () => {
        const saved = (await sfStore.get(outKey())) || [];
        const f = (await sfStore.get(failKey())) || [];
        outbox = saved.concat(outbox.filter(o => !saved.some(s => s.qid === o.qid)));
        failed = f; outLoaded = true; outLoading = null;
        const tables = new Set(outbox.map(o => o.table)); tables.forEach(emit);
        notify();
        if (outbox.length) scheduleFlush(800);
      })();
      return outLoading;
    }
    async function enqueue(op, opts) {
      opts = opts || {};
      // Abonnement terminé (après le délai de grâce) : lecture seule, aucune nouvelle saisie (le journal reste écrit)
      if (!(op.k === 'insert' && op.table === 'audit_logs') && aboReadOnly()) throw new Error(ABO_RO_MSG);
      await ensureOutbox();
      op.qid = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      op.cid = CURRENT_COMMERCE_ID; op.ts = Date.now();
      if (opts.silent) op.silent = true;
      let waitP = null;
      if (!opts.nowait) waitP = new Promise(res => waiters.set(op.qid, res));
      outbox.push(op);
      await persistOutbox();
      if (op.table && T[op.table]) emit(op.table);
      notify();
      scheduleFlush(0);
      if (!waitP) return;
      // Hors connexion ou connexion lente : on n'attend pas, l'opération part toute seule plus tard.
      if (navigator.onLine === false || Date.now() < slowUntil || paused) { waiters.delete(op.qid); return; }
      const r = await Promise.race([waitP, sleep(GRACE).then(() => 'timeout')]);
      if (r === 'timeout') { late.add(op.qid); waiters.delete(op.qid); slowUntil = Date.now() + 15000; return; }
      if (r && r.err) throw r.err;
      return r;
    }
    function resolveWait(op, result) { const w = waiters.get(op.qid); if (w) { waiters.delete(op.qid); w(result); } late.delete(op.qid); }
    function scheduleFlush(ms) { clearTimeout(retryTimer); retryTimer = setTimeout(flush, ms); }
    function scheduleRetry() { scheduleFlush(retryDelay); retryDelay = Math.min(60000, retryDelay * 2); }

    async function ensureSession(force) {
      try {
        const r = await client.auth.getSession();
        const sess = r && r.data && r.data.session;
        if (sess) {
          if (!force) return 'ok';
          const rr = await client.auth.refreshSession();
          if (rr && rr.data && rr.data.session) return 'ok';
          return (rr && rr.error && isNetErr(rr.error)) ? 'net' : 'auth';
        }
        return (r && r.error && isNetErr(r.error)) ? 'net' : 'auth';
      } catch (e) { return isNetErr(e) ? 'net' : 'auth'; }
    }

    async function sendOp(op) {
      const table = op.table;
      if (op.k === 'stock') {
        const { data, error } = await client.rpc('adjust_stock', { p_product_id: op.id, p_delta: op.delta });
        return { error, data };
      }
      if (op.k === 'insert') { const { error } = await client.from(table).insert(op.row); return { error }; }
      const tenant = TENANT_TABLES.has(table);
      const cid = op.cid || CURRENT_COMMERCE_ID;
      if (op.k === 'set') {
        let data = op.data, cost;
        if (table === 'produits') { const { prixAchat, ...rest } = data; cost = prixAchat; data = rest; }
        const row = toDbRow(table, { ...data, id: op.id });
        if (tenant) row.commerce_id = cid;
        const { error } = await client.from(table).upsert(row, { onConflict: 'id' });
        if (error) return { error };
        if (table === 'produits' && cost !== undefined) { try { await saveCost(op.id, cost); } catch (e) { return { error: e }; } }
        return {};
      }
      if (op.k === 'update') {
        let data = op.data, cost;
        if (table === 'produits') { const { prixAchat, ...rest } = data; cost = prixAchat; data = rest; }
        const row = toDbRow(table, data);
        if (Object.keys(row).length > 0) {
          let q = client.from(table).update(row).eq('id', op.id);
          if (tenant) q = q.eq('commerce_id', cid);
          const { error } = await q;
          if (error) return { error };
        }
        if (table === 'produits' && cost !== undefined) { try { await saveCost(op.id, cost); } catch (e) { return { error: e }; } }
        return {};
      }
      if (op.k === 'delete') {
        let q = client.from(table).delete().eq('id', op.id);
        if (tenant) q = q.eq('commerce_id', cid);
        const { error } = await q;
        if (error) return { error };
        if (table === 'produits' && canSeeCosts()) { try { await client.from('produits_couts').delete().eq('id', String(op.id)); } catch (e) { console.error(e); } }
        return {};
      }
      return {};
    }

    function completeOp(op, r) {
      const i = outbox.findIndex(o => o.qid === op.qid);
      if (i >= 0) outbox.splice(i, 1);
      if (op.table && T[op.table]) {
        const t = T[op.table];
        applyOp(t.server, op);
        if (op.k === 'stock' && r && r.data != null && !isNaN(Number(r.data))) { const cur = t.server.get(String(op.id)); if (cur) t.server.set(String(op.id), { ...cur, stock: Number(r.data) }); }
        t.version++; scheduleCache(op.table); kick(op.table);
      }
      resolveWait(op, { ok: true, data: r && r.data });
    }
    function dropOp(op) { const i = outbox.findIndex(o => o.qid === op.qid); if (i >= 0) outbox.splice(i, 1); if (op.table && T[op.table]) { T[op.table].version++; emit(op.table); kick(op.table); } }
    function addFailed(op, msg) {
      if (op.silent) return;
      failed.push({ at: Date.now(), table: op.table, k: op.k, id: op.id, msg, label: opLabel(op) });
      persistFailed();
      try { toast('⚠ Une opération n\'a pas pu être enregistrée : ' + opLabel(op) + '. Touche la bannière en bas pour voir.'); } catch (e) {}
    }
    function opLabel(op) {
      const n = { produits: 'produit', factures: 'facture', paiements: 'paiement', clients: 'client', depenses: 'dépense', fournisseurs: 'fournisseur', commandes_fournisseurs: 'commande', documents: 'document', mouvements: 'mouvement de stock' }[op.table] || op.table;
      if (op.k === 'stock') { const p = (T.produits && T.produits.server.get(String(op.id))); return 'stock de ' + (p ? p.nom : 'un produit'); }
      if (op.table === 'factures' && op.data && op.data.num) return 'facture FAC-' + String(op.data.num).padStart(4, '0');
      const nm = op.data && (op.data.nom || op.data.ref); return n + (nm ? ' « ' + nm + ' »' : '');
    }

    async function handleRefusal(op, e) {
      const msg = (e && e.message) || String(e);
      // Deux appareils ont vendu pareil : le numéro de facture existe déjà → on prend le suivant
      if (op.table === 'factures' && op.k === 'set' && e.code === '23505' && (op.tries || 0) < 4) {
        op.tries = (op.tries || 0) + 1;
        try {
          const r = await client.from('factures').select('num').eq('commerce_id', op.cid || CURRENT_COMMERCE_ID).order('num', { ascending: false }).limit(1);
          const max = (r.data && r.data[0] && Number(r.data[0].num)) || 0;
          const mine = outbox.filter(o => o.table === 'factures' && o.k === 'set' && o.data && o.data.num).reduce((m, o) => Math.max(m, Number(o.data.num) || 0), 0);
          const old = op.data.num; op.data.num = Math.max(max, mine) + 1;
          persistOutbox();
          try { toast('Facture FAC-' + String(old).padStart(4, '0') + ' renumérotée FAC-' + String(op.data.num).padStart(4, '0') + ' (numéro déjà pris).'); } catch (x) {}
          return 'retry';
        } catch (x) { return isNetErr(x) ? 'net' : 'drop'; }
      }
      if (op.k === 'stock') {
        // Quelqu'un est présent et la connexion répond vite : on refuse comme avant (« stock insuffisant »).
        if (!late.has(op.qid) && waiters.has(op.qid)) { dropOp(op); resolveWait(op, { err: e }); return 'done'; }
        // Sinon la vente a déjà eu lieu (souvent hors connexion) : on ramène le stock à 0 au lieu de bloquer.
        try {
          const r = await client.from('produits').select('stock').eq('id', op.id).eq('commerce_id', op.cid || CURRENT_COMMERCE_ID).single();
          if (r.error) { if (isNetErr(r.error)) return 'net'; throw r.error; }
          const cur = Number(r.data.stock) || 0;
          const target = Math.max(0, cur + op.delta);
          const u = await client.from('produits').update({ stock: target }).eq('id', op.id).eq('commerce_id', op.cid || CURRENT_COMMERCE_ID);
          if (u.error) { if (isNetErr(u.error)) return 'net'; throw u.error; }
          completeOp(op, { data: target });
          const p = T.produits && T.produits.server.get(String(op.id));
          try { toast('⚠ Stock de « ' + (p ? p.nom : 'un produit') + ' » insuffisant au moment de l\'envoi : ramené à 0. Vérifie ton inventaire.'); } catch (x) {}
          return 'done';
        } catch (x) {
          dropOp(op); addFailed(op, (x && x.message) || msg); resolveWait(op, { ok: false }); return 'done';
        }
      }
      // Refus définitif
      dropOp(op);
      const wasLate = late.has(op.qid);
      if (!wasLate && waiters.has(op.qid)) { resolveWait(op, { err: e }); }
      else { resolveWait(op, { ok: false }); addFailed(op, msg); }
      if (op.table === 'factures' && op.k === 'set') {
        // La facture n'a pas pu être créée : on remet en stock et on retire ce qui en dépendait
        (op.data.lignes || []).forEach(l => { if (l.matched && l.productId) outbox.push({ k: 'stock', table: 'produits', id: String(l.productId), delta: Number(l.qte) || 0, qid: 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), cid: op.cid, ts: Date.now(), silent: true }); });
        outbox.filter(o => o.data && String(o.data.factureId) === String(op.id)).forEach(o => { dropOp(o); resolveWait(o, { ok: false }); });
        emit('produits');
      }
      return 'done';
    }

    async function flush() {
      if (flushing || paused) return;
      await ensureOutbox();
      if (!outbox.length || !CURRENT_USER_ID) { notify(); return; }
      if (navigator.onLine === false) { notify(); return; }
      flushing = true; notify();
      try {
        const s = await ensureSession(false);
        if (s === 'net') { netFail(); scheduleRetry(); return; }
        if (s === 'auth') { paused = 'auth'; return; }
        let guard = 0;
        while (outbox.length && guard++ < 5000) {
          const op = outbox[0];
          if (op.cid && CURRENT_COMMERCE_ID && op.cid !== CURRENT_COMMERCE_ID) break;
          inflight = op;
          let r;
          try { r = await sendOp(op); } catch (e) { r = { error: e }; }
          inflight = null;
          if (!r.error) { completeOp(op, r); netOk(); retryDelay = 5000; persistOutbox(); notify(); continue; }
          const e = r.error;
          if (isNetErr(e)) { netFail(); scheduleRetry(); return; }
          if (isAuthErr(e)) {
            const s2 = await ensureSession(true);
            if (s2 === 'net') { netFail(); scheduleRetry(); return; }
            if (s2 === 'auth') { paused = 'auth'; return; }
            op.authTries = (op.authTries || 0) + 1;
            if (op.authTries < 3) continue;
          }
          const act = await handleRefusal(op, e);
          persistOutbox();
          if (act === 'net') { scheduleRetry(); return; }
        }
        persistOutbox();
        retryDelay = 5000;
      } finally { flushing = false; inflight = null; notify(); }
    }

    // ---------- Écritures : appliquées tout de suite sur l'appareil, envoyées dès que possible ----------
    function docRef(table, id) {
      id = String(id);
      return {
        set(data) { return enqueue({ k: 'set', table, id, data: clone(data) }); },
        update(data) { return enqueue({ k: 'update', table, id, data: clone(data) }); },
        delete() { return enqueue({ k: 'delete', table, id }); },
      };
    }
    function collectionRef(table) {
      const tenant = TENANT_TABLES.has(table);
      return {
        doc(id) { return docRef(table, id); },
        onSnapshot(onNext, onError) {
          const t = ts(table);
          let stopped = false, busy = false, again = false, lastSig = null;
          t.listeners.add(onNext);
          async function fetchAll() {
            if (stopped) return;
            if (busy) { again = true; return; }
            busy = true;
            try { await fetchOnce(); } finally { busy = false; }
            if (again) { again = false; fetchAll(); }
          }
          async function fetchOnce() {
            if (navigator.onLine === false) { notify(); return; }
            const t0 = performance.now();
            try { await fetchBody(); } catch (e) { if (isNetErr(e)) netFail(); else console.error(e); } finally { sfTimings[table] = Math.round(performance.now() - t0); showTimings(); }
          }
          async function fetchBody() {
            if (tenant && !CURRENT_COMMERCE_ID) return;
            const v0 = t.version, tStart = performance.now();
            const PAGE = 1000;
            let data = [], error = null;
            for (let from = 0; ; from += PAGE) {
              let q = client.from(table).select('*');
              if (tenant) q = q.eq('commerce_id', CURRENT_COMMERCE_ID);
              const res = await q.order('id', { ascending: true }).range(from, from + PAGE - 1);
              if (res.error) { error = res.error; break; }
              data = data.concat(res.data);
              if (res.data.length < PAGE) break;
            }
            if (stopped) return;
            if (error) { if (isNetErr(error)) { netFail(); return; } if (isAuthErr(error)) { return; } if (onError) onError(error); return; }
            if (table === 'produits') {
              const costMap = {};
              if (canSeeCosts()) {
                for (let from = 0; ; from += PAGE) {
                  const cr = await client.from('produits_couts').select('id, prix_achat').eq('commerce_id', CURRENT_COMMERCE_ID).order('id', { ascending: true }).range(from, from + PAGE - 1);
                  if (cr.error) { if (isNetErr(cr.error)) { netFail(); return; } if (onError) onError(cr.error); return; }
                  cr.data.forEach(c => { costMap[c.id] = c.prix_achat; });
                  if (cr.data.length < PAGE) break;
                }
                if (stopped) return;
              }
              data = data.map(r => ({ ...r, prix_achat: costMap[String(r.id)] ?? 0 }));
            }
            netOk(Math.round(performance.now() - tStart));
            // Une écriture est partie ou en cours pendant qu'on téléchargeait : ces données sont peut-être périmées, on recommence.
            if (t.version !== v0 || (inflight && inflight.table === table) || (inflight && inflight.k === 'stock' && table === 'produits')) { kick(table); return; }
            const sig = JSON.stringify(data);
            if (sig === lastSig && t.ready) return;
            lastSig = sig;
            const m = new Map();
            data.forEach(row => { const o = fromDbRow(table, row); m.set(String(o.id), o); });
            t.server = m; t.ready = true;
            scheduleCache(table);
            emit(table);
            if (outbox.length && !flushing && !paused) scheduleFlush(300);
          }
          (refreshers[table] = refreshers[table] || new Set()).add(fetchAll);
          // Démarrage instantané : on affiche d'abord la copie gardée sur l'appareil, puis on met à jour avec le serveur.
          (async () => {
            await ensureOutbox();
            if (!t.loaded) {
              t.loaded = true;
              const c = await sfStore.get(cacheKey(table));
              if (Array.isArray(c) && !t.ready) { t.server = new Map(c.map(o => [String(o.id), o])); t.ready = true; }
            }
            if (t.ready) emit(table);
            fetchAll();
          })();
          const interval = setInterval(() => { if (!document.hidden) fetchAll(); }, (POLL_MS[table] || 60000) + Math.floor(Math.random() * 3000));
          const onVisible = () => { if (!document.hidden) fetchAll(); };
          document.addEventListener('visibilitychange', onVisible);
          const stop = () => { stopped = true; t.listeners.delete(onNext); clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); refreshers[table].delete(fetchAll); activePolls.delete(stop); };
          activePolls.add(stop);
          return stop;
        },
      };
    }
    const api = {
      refresh(...tables) { tables.forEach(kick); },
      collection(name) { return collectionRef(name); },
      doc(path) { const idx = path.indexOf('/'); return docRef(path.slice(0, idx), path.slice(idx + 1)); },
      // Change le stock d'un produit (vente = négatif). Vérifié sur l'appareil, envoyé de façon atomique dès que possible.
      async queueStock(productId, delta) {
        const cur = viewGet('produits', productId);
        if (cur && delta < 0 && (Number(cur.stock) || 0) + delta < 0) throw new Error('Stock insuffisant');
        await enqueue({ k: 'stock', table: 'produits', id: String(productId), delta: Number(delta) });
        const now = viewGet('produits', productId);
        return now ? Number(now.stock) || 0 : 0;
      },
      logAudit(row) { return enqueue({ k: 'insert', table: 'audit_logs', id: 'a', row: clone(row) }, { silent: true, nowait: true }); },
      pendingCount() { return outbox.length; },
      status() { return { pend: outbox.length, pendTxt: pendingText(), flushing, failed: failed.length, paused, fails: net.fails, lastMs: net.lastMs }; },
      failedList() { return failed.slice(); },
      clearFailed() { failed = []; persistFailed(); notify(); },
      retryNow() { paused = null; retryDelay = 5000; scheduleFlush(0); Object.keys(refreshers).forEach(kick); },
      resumeAuth() { paused = null; scheduleFlush(300); },
      async wipe(userId, commerceId) {
        const tabs = [...TENANT_TABLES];
        for (const tb of tabs) await sfStore.del('cache:' + userId + ':' + commerceId + ':' + tb);
        await sfStore.del('identity:' + userId);
      },
      checkSession() { return ensureSession(true); },
      reset() { Object.keys(T).forEach(k => { clearTimeout(T[k].cacheTimer); delete T[k]; }); outbox = []; failed = []; outLoaded = false; outLoading = null; paused = null; flushing = false; inflight = null; clearTimeout(retryTimer); waiters.clear(); late.clear(); net.fails = 0; },
    };
    window.addEventListener('online', () => { retryDelay = 5000; if (paused !== 'auth') scheduleFlush(300); Object.keys(refreshers).forEach(kick); notify(); });
    window.addEventListener('offline', notify);
    return api;
  }

