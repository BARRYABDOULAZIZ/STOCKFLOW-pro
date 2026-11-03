-- ============================================================================
-- BoromBoutik — Bénéfice exact : prix d'achat FIGÉ au moment de la vente
-- À lancer UNE fois : Supabase → SQL Editor → coller tout ce fichier → Run.
--
-- Avant : le bénéfice d'une vente passée était calculé avec le prix d'achat
-- ACTUEL du produit. Si le prix d'achat change, tout l'historique changeait.
--
-- Maintenant : quand une facture arrive dans la base, la base note le prix
-- d'achat de chaque ligne à ce moment-là (table facture_couts).
-- Seuls le propriétaire et l'admin peuvent lire cette table : le caissier ne voit
-- toujours pas les prix d'achat. Personne ne peut la modifier depuis l'appli.
-- Les factures déjà existantes gardent l'ancien calcul (prix d'achat actuel).
-- ============================================================================
begin;

create table if not exists public.facture_couts (
  facture_id  text primary key,
  commerce_id text not null,
  couts       jsonb not null,          -- prix d'achat unitaire de chaque ligne, dans l'ordre des lignes (null = inconnu)
  created_at  timestamptz not null default now()
);
create index if not exists facture_couts_commerce on public.facture_couts (commerce_id);

alter table public.facture_couts enable row level security;
drop policy if exists facture_couts_lecture_patron on public.facture_couts;
create policy facture_couts_lecture_patron on public.facture_couts for select to authenticated
  using (commerce_id = public.my_commerce_id()::text
         and coalesce(public.my_role(), '') in ('proprietaire', 'admin'));
revoke all on public.facture_couts from anon;
revoke insert, update, delete, truncate on public.facture_couts from authenticated;
grant select on public.facture_couts to authenticated;

create or replace function public.bb_figer_couts()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_couts jsonb;
begin
  select coalesce(jsonb_agg(pc.prix_achat order by e.ord), '[]'::jsonb) into v_couts
    from jsonb_array_elements(coalesce(new.lignes::jsonb, '[]'::jsonb)) with ordinality as e(l, ord)
    left join produits_couts pc
      on pc.id = e.l->>'productId' and pc.commerce_id::text = new.commerce_id::text;
  insert into facture_couts (facture_id, commerce_id, couts)
  values (new.id::text, new.commerce_id::text, v_couts)
  on conflict (facture_id) do nothing;
  return new;
exception when others then
  return new;   -- ne JAMAIS bloquer une vente à cause de ce calcul
end $$;

drop trigger if exists bb_figer_couts on public.factures;
create trigger bb_figer_couts after insert on public.factures
  for each row execute function public.bb_figer_couts();

commit;

-- Vérification : doit afficher 1 ligne (bb_figer_couts)
select tgname from pg_trigger where tgname = 'bb_figer_couts';
