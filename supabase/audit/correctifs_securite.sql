-- BoromBoutik — correctifs de sécurité Supabase (audit du 29/10/2026)
-- À coller dans Supabase > SQL Editor > New query, puis Run. Tout se fait d'un bloc : si une ligne échoue, rien n'est changé.
-- Rappel Postgres : plusieurs policies « permissive » sur une table s'additionnent (OU). Une restriction de rôle doit donc
-- être « restrictive » (ET) pour vraiment limiter, sinon elle ouvre l'accès au lieu de le fermer.
begin;

-- 1. CRITIQUE — dépenses, fournisseurs, commandes fournisseurs : la policy « role_owner_admin_only » (permissive, sans
--    condition de boutique) donnait à TOUT propriétaire, de n'importe quelle boutique, l'accès aux lignes de TOUTES les
--    boutiques ; et la policy de boutique laissait quand même les caissiers y accéder. On la rend restrictive.
do $$ declare t text; begin
  foreach t in array array['depenses', 'fournisseurs', 'commandes_fournisseurs'] loop
    execute format('drop policy if exists role_owner_admin_only on public.%I', t);
    execute format($p$create policy role_owner_admin_only on public.%I as restrictive for all to authenticated
      using (public.my_role() in ('proprietaire','admin')) with check (public.my_role() in ('proprietaire','admin'))$p$, t);
  end loop;
end $$;

-- 2. ÉLEVÉ — produits : les policies « no_cashier » étaient permissives, donc sans effet (un caissier pouvait créer,
--    modifier et supprimer des produits). On les rend restrictives. Les ventes passent par adjust_stock (non concernée).
drop policy if exists produits_no_cashier_insert on public.produits;
drop policy if exists produits_no_cashier_update on public.produits;
drop policy if exists produits_no_cashier_delete on public.produits;
create policy produits_no_cashier_insert on public.produits as restrictive for insert to authenticated
  with check (public.my_role() in ('proprietaire','admin','employe'));
create policy produits_no_cashier_update on public.produits as restrictive for update to authenticated
  using (public.my_role() in ('proprietaire','admin','employe')) with check (public.my_role() in ('proprietaire','admin','employe'));
create policy produits_no_cashier_delete on public.produits as restrictive for delete to authenticated
  using (public.my_role() in ('proprietaire','admin','employe'));

-- 3. ÉLEVÉ — fraude interne : un caissier pouvait supprimer des factures, des paiements et des mouvements de stock,
--    ou changer le montant et les articles d'une facture déjà faite.
create policy factures_suppression_patron on public.factures as restrictive for delete to authenticated
  using (public.my_role() in ('proprietaire','admin'));
create policy paiements_suppression_patron on public.paiements as restrictive for delete to authenticated
  using (public.my_role() in ('proprietaire','admin'));
create policy mouvements_modif_patron on public.mouvements as restrictive for update to authenticated
  using (public.my_role() in ('proprietaire','admin'));
create policy mouvements_suppression_patron on public.mouvements as restrictive for delete to authenticated
  using (public.my_role() in ('proprietaire','admin'));

create or replace function public.factures_guard_edit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Le caissier peut encore enregistrer un paiement (montant_paye) ; il ne peut plus changer le total ni les articles.
  if coalesce(public.my_role(), '') not in ('proprietaire', 'admin') and (
       new.total is distinct from old.total
    or new.lignes::text is distinct from old.lignes::text
    or new.commerce_id is distinct from old.commerce_id) then
    raise exception 'Seul le propriétaire ou l''admin peut modifier une facture déjà faite';
  end if;
  return new;
end $$;
drop trigger if exists factures_guard_edit on public.factures;
create trigger factures_guard_edit before update on public.factures for each row execute function public.factures_guard_edit();

-- 4. MOYEN — commerces : « update_own_commerce » laissait un caissier modifier la fiche de la boutique.
drop policy if exists update_own_commerce on public.commerces;

-- 5. MOYEN — stock : un caissier ne peut plus AJOUTER du stock (seulement en retirer par une vente).
create or replace function public.adjust_stock(p_product_id text, p_delta numeric)
returns numeric language plpgsql security definer set search_path to 'public', 'extensions' as $function$
declare v_new numeric;
begin
  if p_delta > 0 and coalesce(public.my_role(), '') not in ('proprietaire', 'admin', 'employe') then
    raise exception 'Ajout de stock réservé au propriétaire, à l''admin ou à l''employé';
  end if;
  update produits set stock = stock + p_delta
   where id::text = p_product_id and commerce_id = my_commerce_id() and (p_delta >= 0 or stock + p_delta >= 0)
  returning stock into v_new;
  if not found then raise exception 'Stock insuffisant ou produit introuvable'; end if;
  return v_new;
end $function$;

-- 6. FAIBLE (prudence) — droits inutiles : le visiteur non connecté n'a besoin d'aucune table ;
--    TRUNCATE contourne la RLS et ne doit être donné à personne.
revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

commit;

-- Vérification : doit afficher « restrictive » pour les policies corrigées.
select tablename, policyname, permissive, cmd from pg_policies
where schemaname = 'public' and (policyname like 'role_owner%' or policyname like 'produits_no_cashier%' or policyname like '%patron')
order by 1, 2;

-- 7. Appliqué aussi le 29/10 : droits par défaut des futures tables et fonctions internes
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;
alter default privileges in schema public revoke execute on functions from anon;
revoke execute on function public.new_invite_code(), public.factures_guard_edit(), public.factures_guard_cancel() from public, anon, authenticated;
revoke execute on function public.est_admin_plateforme() from public, anon;
grant execute on function public.est_admin_plateforme() to authenticated;
-- Réglage Auth (tableau de bord) : longueur minimale du mot de passe passée de 6 à 8.
-- 8. Appliqué le 29/10 : suppression de devis/bons réservée au propriétaire et à l'admin (la policy était permissive)
drop policy if exists documents_delete_owner_admin on public.documents;
create policy documents_delete_owner_admin on public.documents as restrictive for delete to authenticated
  using (public.my_role() in ('proprietaire','admin'));
