  // ================= Journal des actions (audit) =================
  // Enregistre une action sensible. Le journal est stocké en base, lisible seulement par propriétaire/admin, non modifiable.
  function logAction(type, details) {
    if (!supabaseClient || !state.currentUser) return;
    const row = { user_nom: state.currentUser.nom || state.currentUser.email || '', type, details };
    if (state.db && state.db.logAudit) { state.db.logAudit(row); return; }
    supabaseClient.from('audit_logs').insert(row)
      .then(({ error }) => { if (error) console.error('Journal :', error.message); });
  }

  async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogsTbody');
    if (!tbody || !supabaseClient) return;
    const { data, error } = await supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) { tbody.innerHTML = '<tr><td colspan="4" style="padding:12px; text-align:center;" class="muted">Journal indisponible.</td></tr>'; return; }
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="4" style="padding:12px; text-align:center;" class="muted">Aucune action enregistrée.</td></tr>'; return; }
    const colors = { ANNULATION_FACTURE: '#dc2626', TENTATIVE_ANNULATION: '#b91c1c', PERTE_STOCK: '#d97706', SUPPRESSION_PRODUIT: '#d97706', SUPPRESSION_DOCUMENT: '#d97706', REINITIALISATION_MDP: '#2563eb', INVENTAIRE: '#7c3aed', CLOTURE_CAISSE: '#059669' };
    const labels = { CLOTURE_CAISSE: 'Clôture de caisse', ANNULATION_FACTURE: 'Annulation facture', TENTATIVE_ANNULATION: 'Tentative refusée', PERTE_STOCK: 'Perte / casse', SUPPRESSION_PRODUIT: 'Produit supprimé', SUPPRESSION_DOCUMENT: 'Document supprimé', REINITIALISATION_MDP: 'Mot de passe réinitialisé', INVENTAIRE: 'Inventaire validé' };
    tbody.innerHTML = data.map(l => `
      <tr style="border-bottom:1px solid var(--line);">
        <td style="padding:8px; white-space:nowrap;">${escapeHtml(new Date(l.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))}</td>
        <td style="padding:8px;"><strong>${escapeHtml(l.user_nom || '')}</strong> <small class="muted">(${escapeHtml(l.role || '')})</small></td>
        <td style="padding:8px;"><span style="background:${colors[l.type] || '#4b5563'}; color:#fff; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold; white-space:nowrap;">${escapeHtml(labels[l.type] || l.type)}</span></td>
        <td style="padding:8px;">${escapeHtml(l.details || '')}</td>
      </tr>`).join('');
  }
  document.getElementById('btnRefreshAudit').addEventListener('click', loadAuditLogs);

  async function deleteProduct(id) {
    if (!state.db) return;
    if (!confirm('Supprimer ce produit du catalogue ?')) return;
    const delProd = state.products.find(p => p.id === id);
    try {
      await state.db.doc('produits/' + id).delete();
      logAction('SUPPRESSION_PRODUIT', `Produit supprimé : ${delProd ? delProd.nom + ' (' + (delProd.ref || '') + ')' : id}`);
      if (editingId === id) resetProductForm();
      toast('Produit supprimé.');
    } catch (err) { console.error(err); toast('Erreur lors de la suppression.'); }
  }

