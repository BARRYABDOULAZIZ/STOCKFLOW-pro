-- BoromBoutik — abonnement terminé = lecture seule, contrôlé aussi par le serveur (29/10/2026)
-- Même règle que l'appli : pas d'abonnement enregistré = rien n'est bloqué ; fin + 3 jours de grâce, puis lecture seule.
-- Ventes faites hors connexion : une facture, un paiement, une dépense ou un mouvement daté d'AVANT la fin de la grâce
-- est accepté même s'il arrive plus tard (envoi au retour du réseau). Autres données : 2 jours de marge pour l'envoi.
begin;

create or replace function public.abo_garde() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_fin date;
  v_ref date := current_date - 2;
begin
  select a.actif_jusqua into v_fin from public.abonnements a where a.commerce_id = v_row ->> 'commerce_id';
  if v_fin is not null then
    if tg_op <> 'DELETE' and coalesce(v_row ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}' then
      v_ref := least(current_date, left(v_row ->> 'date', 10)::date);
    end if;
    if v_ref > v_fin + 3 then
      raise exception 'Abonnement terminé : l''appli est en lecture seule. Renouvelle ton abonnement pour enregistrer à nouveau.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function public.abo_garde() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['produits', 'produits_couts', 'factures', 'paiements', 'clients', 'depenses',
                           'fournisseurs', 'commandes_fournisseurs', 'documents', 'mouvements'] loop
    execute format('drop trigger if exists abo_garde on public.%I', t);
    execute format('create trigger abo_garde before insert or update or delete on public.%I for each row execute function public.abo_garde()', t);
  end loop;
end $$;

commit;
