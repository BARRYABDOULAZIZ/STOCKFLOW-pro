  // ================= Paramètres : compte + équipe =================
  document.getElementById('btnChangePass').addEventListener('click', async () => {
    const statusEl = document.getElementById('pmPassStatus');
    const p1 = document.getElementById('pm-pass1').value;
    const p2 = document.getElementById('pm-pass2').value;
    statusEl.textContent = '';
    if (p1.length < 8) { statusEl.textContent = 'Le mot de passe doit faire au moins 8 caractères.'; return; }
    if (p1 !== p2) { statusEl.textContent = 'Les deux mots de passe ne correspondent pas.'; return; }
    try {
      const { error } = await supabaseClient.auth.updateUser({ password: p1 });
      if (error) throw error;
      document.getElementById('pm-pass1').value = '';
      document.getElementById('pm-pass2').value = '';
      statusEl.textContent = '✅ Mot de passe changé.';
      toast('Mot de passe mis à jour.');
    } catch (err) {
      statusEl.textContent = 'Erreur : ' + (err.message || err);
    }
  });

  async function loadTeam() {
    document.getElementById('pm-email').textContent = (state.currentUser && state.currentUser.email) || '—';
    const body = document.getElementById('pmTeamBody');
    const empty = document.getElementById('pmTeamEmpty');
    empty.style.display = 'block';
    empty.textContent = 'Chargement…';
    body.innerHTML = '';
    try {
      const { data, error } = await supabaseClient.from('profiles').select('*').eq('commerce_id', CURRENT_COMMERCE_ID);
      if (error) throw error;
      if (!data || data.length === 0) { empty.textContent = 'Aucun membre trouvé.'; return; }
      empty.style.display = 'none';
      const meId = state.currentUser.id;
      body.innerHTML = data.map(m => {
        const isSelf = m.id === meId;
        const isProprio = m.role === 'proprietaire';
        const roleCell = (isProprio)
          ? `<strong>${ROLE_LABEL.proprietaire}</strong>`
          : `<select data-role-for="${m.id}" ${isSelf ? 'disabled' : ''}>
               <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option>
               <option value="caissier" ${m.role === 'caissier' ? 'selected' : ''}>Caissier</option>
               <option value="employe" ${m.role === 'employe' ? 'selected' : ''}>Employé</option>
             </select>`;
        const myRole = state.currentUser.role;
        const canReset = !isSelf && !isProprio && (myRole === 'proprietaire' || (myRole === 'admin' && (m.role === 'caissier' || m.role === 'employe')));
        const resetBtn = canReset ? `<button class="icon-btn" data-reset-member="${m.id}" data-reset-name="${escapeHtml(m.nom || '')}" title="Définir un nouveau mot de passe" style="margin-right:6px;">🔑</button>` : '';
        const actionCell = (isProprio || isSelf) ? (isSelf ? '<span class="muted">(toi)</span>' : '') : `${resetBtn}<button class="icon-btn" data-remove-member="${m.id}" title="Retirer l'accès">✕</button>`;
        return `<tr><td>${escapeHtml(m.nom || '—')}</td><td>${roleCell}</td><td class="num-cell">${actionCell}</td></tr>`;
      }).join('');

      body.querySelectorAll('[data-role-for]').forEach(sel => {
        sel.addEventListener('change', async () => {
          const userId = sel.dataset.roleFor;
          if (!needOnline('changer un rôle')) return;
          try {
            const { error: rErr } = await supabaseClient.rpc('update_team_role', { p_user_id: userId, p_role: sel.value });
            if (rErr) throw rErr;
            toast('Rôle mis à jour.');
          } catch (err) {
            toast('Erreur : ' + (err.message || err));
            loadTeam();
          }
        });
      });
      body.querySelectorAll('[data-reset-member]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const nom = btn.dataset.resetName || 'cette personne';
          const pwd = prompt(`Nouveau mot de passe pour ${nom} (8 caractères minimum) :`);
          if (pwd === null) return;
          if (pwd.length < 8) { toast('Mot de passe trop court : 8 caractères minimum.'); return; }
          if (!confirm(`Changer le mot de passe de ${nom} ? Cette personne sera déconnectée de ses appareils.`)) return;
          if (!needOnline('changer un mot de passe')) return;
          try {
            const { error: rErr } = await supabaseClient.rpc('reset_team_password', { p_user_id: btn.dataset.resetMember, p_new_password: pwd });
            if (rErr) throw rErr;
            toast(`Mot de passe de ${nom} modifié. Donne-le lui en main propre.`);
          } catch (err) {
            toast('Erreur : ' + (err.message || err));
          }
        });
      });
      body.querySelectorAll('[data-remove-member]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm("Retirer l'accès de cette personne à ton commerce ?")) return;
          if (!needOnline('retirer un membre')) return;
          try {
            const { error: rErr } = await supabaseClient.rpc('remove_team_member', { p_user_id: btn.dataset.removeMember });
            if (rErr) throw rErr;
            toast('Membre retiré.');
            loadTeam();
          } catch (err) {
            toast('Erreur : ' + (err.message || err));
          }
        });
      });
    } catch (err) {
      empty.textContent = 'Erreur de chargement : ' + (err.message || err);
    }
  }
  document.getElementById('btnRefreshTeam').addEventListener('click', loadTeam);

