  // ================= Clôture de caisse =================
  const CL_DENOMS = [['b10000', 'Billet 10 000', 10000], ['b5000', 'Billet 5 000', 5000], ['b2000', 'Billet 2 000', 2000], ['b1000', 'Billet 1 000', 1000], ['b500', 'Billet 500', 500],
    ['p500', 'Pièce 500', 500], ['p250', 'Pièce 250', 250], ['p200', 'Pièce 200', 200], ['p100', 'Pièce 100', 100], ['p50', 'Pièce 50', 50], ['p25', 'Pièce 25', 25], ['p10', 'Pièce 10', 10], ['p5', 'Pièce 5', 5]];
  const clKey = () => 'sf_cl_counts_' + todayStr();
  const clLoad = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const clStore = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let clBuilt = false, clLastState = '';
  function clBuild() {
    const counts = clLoad(clKey(), {});
    document.getElementById('clDenoms').innerHTML = CL_DENOMS.map(([k, lab]) => `<div class="cl-den" data-row="${k}"><span>${lab}</span><input type="number" min="0" step="1" inputmode="numeric" data-k="${k}" placeholder="0" value="${counts[k] || ''}"><span class="cl-sub" id="cls-${k}">0</span></div>`).join('');
    document.getElementById('clFond').value = clLoad('sf_cl_fond', '') || '';
    clBuilt = true;
  }
  function clToday() {
    const byId = {}; (state.invoices || []).forEach(i => { byId[i.id] = i; });
    const pays = (state.paiements || []).filter(p => { const inv = byId[p.factureId]; return !(inv && inv.annulee) && p.date === todayStr(); });
    const esp = pays.filter(p => p.mode === 'Espèces'), autres = pays.filter(p => p.mode !== 'Espèces');
    const sum = (a) => a.reduce((t, p) => t + (Number(p.montant) || 0), 0);
    const dep = (state.depenses || []).filter(d => d.date === todayStr());
    return { pays, esp, autres, espSum: sum(esp), autresSum: sum(autres), nb: new Set(pays.map(p => p.factureId)).size, dep, depSum: dep.reduce((t, d) => t + (Number(d.montant) || 0), 0), byId };
  }
  function clCounts() { const c = {}; document.querySelectorAll('#clDenoms input').forEach(i => { const n = Math.max(0, Math.floor(Number(i.value) || 0)); if (n) c[i.dataset.k] = n; }); return c; }
  function renderCloture() {
    if (!document.getElementById('clotureCard')) return;
    const boss = state.currentUser && (state.currentUser.role === 'proprietaire' || state.currentUser.role === 'admin');
    document.getElementById('clotureCard').style.display = boss ? '' : 'none';
    if (!boss) return;
    if (!clBuilt) clBuild();
    const T = clToday();
    document.getElementById('clDate').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const depEl = document.getElementById('clDep');
    if (!depEl.dataset.touched) depEl.value = T.depSum || '';
    const fond = Number(document.getElementById('clFond').value) || 0, dep = Number(depEl.value) || 0;
    const attendu = fond + T.espSum - dep;
    const counts = clCounts();
    let compte = 0;
    CL_DENOMS.forEach(([k, , v]) => { const n = counts[k] || 0; compte += n * v; const sub = document.getElementById('cls-' + k); if (sub) sub.textContent = n ? (n * v).toLocaleString('fr-FR') : '0'; const row = document.querySelector(`[data-row="${k}"]`); if (row) row.classList.toggle('has', n > 0); });
    const set = (id, txt) => { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; };
    set('clEsp', euros(T.espSum)); set('clAttendu', euros(attendu)); set('clAutres', euros(T.autresSum)); set('clNb', String(T.nb)); set('clCompte', euros(compte));
    const diff = compte - attendu, any = Object.keys(counts).length > 0;
    const V = document.getElementById('clVerdict');
    let st = 'idle', title = 'Compte les billets et les pièces pour voir l\'écart.', ecart = '', hint = '';
    if (any) {
      if (diff === 0) { st = 'ok'; title = '✓ Caisse juste, bravo !'; ecart = euros(0); }
      else if (diff > 0) { st = 'plus'; title = 'Il y a un excédent dans le tiroir'; ecart = '+' + euros(diff); }
      else { st = 'moins'; title = 'Il manque de l\'argent dans le tiroir'; ecart = '−' + euros(-diff); }
      const a = Math.abs(diff);
      if (diff < 0) {
        const m = T.esp.find(p => Math.round(Number(p.montant)) === a);
        const dm = T.dep.find(d => Math.round(Number(d.montant)) === a);
        const inv = m && T.byId[m.factureId];
        if (m) hint = `💡 L'écart est exactement le montant ${inv ? 'de la vente FAC-' + String(inv.num).padStart(4, '0') : 'd\'un paiement'} (${euros(a)}) : a-t-il vraiment été encaissé en espèces ?`;
        else if (dm) hint = `💡 L'écart est exactement une dépense (${escapeHtml(dm.categorie || '')} ${euros(a)}) : vérifie qu'elle n'est pas comptée deux fois.`;
        else hint = '💡 Vérifie : ventes non enregistrées, dépenses payées en espèces non notées, ou monnaie mal rendue.';
      } else if (diff > 0) {
        const dm = T.dep.find(d => Math.round(Number(d.montant)) === a);
        hint = dm ? `💡 L'excédent est exactement une dépense (${escapeHtml(dm.categorie || '')} ${euros(a)}) : a-t-elle été payée autrement qu'en espèces ?` : '💡 Vérifie : une vente encaissée mais non enregistrée, ou un fond de caisse oublié.';
      }
    }
    set('clVerdictTitle', title); set('clVerdictHint', hint);
    const ecEl = document.getElementById('clEcart'); if (ecEl.textContent !== ecart) ecEl.textContent = ecart;
    V.dataset.state = st;
    if (clLastState !== st && st !== 'idle') { V.classList.remove('pop'); void V.offsetWidth; V.classList.add('pop'); }
    clLastState = st;
    renderClHistory();
  }
  function renderClHistory() {
    const h = clLoad('sf_clotures', []);
    const el = document.getElementById('clHistory');
    const sig = JSON.stringify(h); if (el._sig === sig) return; el._sig = sig;
    el.innerHTML = h.length ? '<h3 class="cl-h" style="margin:10px 0 4px;">Dernières clôtures (sur cet appareil)</h3>' + h.slice(0, 7).map(c => `<div class="cl-h-row"><span>${escapeHtml(c.date.split('-').reverse().join('/'))} · ${escapeHtml(c.by || '')}</span><span>attendu ${euros(c.attendu)} · compté ${euros(c.compte)}</span><span class="cl-chip ${c.ecart === 0 ? 'ok' : c.ecart > 0 ? 'plus' : 'moins'}">${c.ecart > 0 ? '+' : c.ecart < 0 ? '−' : ''}${euros(Math.abs(c.ecart))}</span></div>`).join('') : '';
  }
  document.getElementById('clDenoms').addEventListener('input', () => { clStore(clKey(), clCounts()); renderCloture(); });
  document.getElementById('clFond').addEventListener('input', () => { clStore('sf_cl_fond', document.getElementById('clFond').value); renderCloture(); });
  document.getElementById('clDep').addEventListener('input', () => { document.getElementById('clDep').dataset.touched = '1'; renderCloture(); });
  document.getElementById('clReset').addEventListener('click', () => {
    if (!confirm('Remettre tout le comptage à zéro ?')) return;
    document.querySelectorAll('#clDenoms input').forEach(i => { i.value = ''; });
    clStore(clKey(), {}); renderCloture();
  });
  function clSnapshot() {
    const T = clToday(), counts = clCounts();
    const fond = Number(document.getElementById('clFond').value) || 0, dep = Number(document.getElementById('clDep').value) || 0;
    const attendu = fond + T.espSum - dep; let compte = 0; CL_DENOMS.forEach(([k, , v]) => { compte += (counts[k] || 0) * v; });
    const modes = {}; T.pays.forEach(p => { modes[p.mode || 'Autre'] = (modes[p.mode || 'Autre'] || 0) + (Number(p.montant) || 0); });
    return { T, counts, fond, dep, attendu, compte, ecart: compte - attendu, modes, by: state.currentUser ? state.currentUser.nom : '' };
  }
  document.getElementById('clSave').addEventListener('click', () => {
    const S = clSnapshot();
    if (!Object.keys(S.counts).length) { toast('⚠ Compte d\'abord les billets et les pièces.'); return; }
    const h = clLoad('sf_clotures', []).filter(c => c.date !== todayStr());
    h.unshift({ date: todayStr(), attendu: S.attendu, compte: S.compte, ecart: S.ecart, by: S.by });
    clStore('sf_clotures', h.slice(0, 30)); clStore('sf_last_close', todayStr());
    try { localStorage.setItem('sf_last_close', todayStr()); } catch (e) {}
    // Aussi notée dans le Journal des actions (en base) : visible par le propriétaire depuis n'importe quel appareil
    try {
      const n0 = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
      const ec = S.ecart === 0 ? 'caisse juste' : 'écart ' + (S.ecart > 0 ? '+' : '−') + n0(Math.abs(S.ecart)) + ' ' + curSym();
      logAction('CLOTURE_CAISSE', `Clôture du ${todayStr().split('-').reverse().join('/')} : attendu ${n0(S.attendu)} · compté ${n0(S.compte)} · ${ec} (${S.T.nb} vente(s))`);
    } catch (e) { console.error(e); }
    toast(S.ecart === 0 ? 'Clôture enregistrée : caisse juste ✓' : `Clôture enregistrée (écart ${S.ecart > 0 ? '+' : '−'}${euros(Math.abs(S.ecart))}).`);
    renderCloture();
  });
  document.getElementById('clPrint').addEventListener('click', () => {
    const S = clSnapshot(), c = state.commerce || {}, n0 = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
    const den = CL_DENOMS.filter(([k]) => S.counts[k]).map(([k, lab, v]) => `<div class="tk-row"><span>${lab} × ${S.counts[k]}</span><span>${n0(S.counts[k] * v)}</span></div>`).join('');
    const totalAll = S.T.espSum + S.T.autresSum;
    const html = `
      <div class="tk-center"><div class="tk-shop">${escapeHtml(c.nom || 'BoromBoutik')}</div><div class="tk-thanks">CLÔTURE DE CAISSE</div></div>
      <div class="tk-sep"></div>
      <div class="tk-row"><span>Date</span><span>${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div>Clôturée par : ${escapeHtml(S.by)}</div>
      <div class="tk-sep"></div>
      <div class="tk-row"><span>Ventes encaissées</span><span>${S.T.nb}</span></div>
      ${Object.entries(S.modes).map(([m, v]) => `<div class="tk-row"><span>${escapeHtml(m)}</span><span>${n0(v)}</span></div>`).join('')}
      <div class="tk-row tk-total"><span>TOTAL</span><span>${n0(totalAll)}</span></div>
      <div class="tk-sep"></div>
      <div class="tk-row"><span>Fond de caisse</span><span>${n0(S.fond)}</span></div>
      <div class="tk-row"><span>+ Espèces encaissées</span><span>${n0(S.T.espSum)}</span></div>
      <div class="tk-row"><span>- Dépenses espèces</span><span>${n0(S.dep)}</span></div>
      <div class="tk-row"><b>= Attendu</b><b>${n0(S.attendu)}</b></div>
      <div class="tk-row"><b>Compté</b><b>${n0(S.compte)}</b></div>
      <div class="tk-row tk-total"><span>ÉCART</span><span>${S.ecart > 0 ? '+' : ''}${n0(S.ecart)}</span></div>
      ${den ? '<div class="tk-sep"></div><div class="tk-small">Détail du comptage :</div>' + den : ''}
      <div class="tk-sep"></div>
      <div style="margin-top:8mm;">Signature caissier : ______________</div>
      <div style="margin-top:8mm;">Signature responsable : ___________</div>
      <div class="tk-cut">.</div>`;
    document.getElementById('printTicket').innerHTML = html;
    document.getElementById('printTicket').className = 'tk-w80';
    const page = document.createElement('style'); page.id = 'ticket-page'; page.textContent = '@page { size: 80mm auto; margin: 0; }'; document.head.appendChild(page);
    document.body.classList.add('print-ticket');
    const cleanup = () => { document.body.classList.remove('print-ticket'); const x = document.getElementById('ticket-page'); if (x) x.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 350);
  });

