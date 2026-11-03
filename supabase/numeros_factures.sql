-- ============================================================================
-- BoromBoutik — Numéros de facture / devis / bons SANS DOUBLON
-- À lancer UNE fois : Supabase → SQL Editor → coller tout ce fichier → Run.
--
-- Pourquoi : l'appli choisit le numéro (le plus grand + 1) sur le téléphone.
-- Si deux caissiers valident une vente à la même seconde (ou si une vente faite
-- hors connexion arrive plus tard), deux factures pouvaient avoir le même numéro.
--
-- Ce que ça fait : au moment où la facture arrive dans la base, la base vérifie
-- le numéro. S'il est déjà pris dans ce commerce, elle donne le suivant libre.
-- Les factures sont traitées une par une par commerce (verrou), donc plus de doublon.
-- Les factures déjà existantes ne sont PAS renumérotées.
-- ============================================================================
begin;

create or replace function public.bb_numero_facture()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  -- une seule facture à la fois par commerce
  perform pg_advisory_xact_lock(hashtext('bb_fac:' || coalesce(new.commerce_id::text, '')));
  if new.num is null or exists (
       select 1 from factures f
        where f.commerce_id is not distinct from new.commerce_id
          and f.num = new.num and f.id::text <> new.id::text) then
    select coalesce(max(f.num), 0) + 1 into new.num
      from factures f where f.commerce_id is not distinct from new.commerce_id;
  end if;
  return new;
end $$;

drop trigger if exists bb_numero_facture on public.factures;
create trigger bb_numero_facture before insert on public.factures
  for each row execute function public.bb_numero_facture();

-- Devis, bons de commande, bons de livraison : un compteur par type de document
create or replace function public.bb_numero_document()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform pg_advisory_xact_lock(hashtext('bb_doc:' || coalesce(new.commerce_id::text, '') || ':' || coalesce(new.type, '')));
  if new.num is null or exists (
       select 1 from documents d
        where d.commerce_id is not distinct from new.commerce_id
          and d.type is not distinct from new.type
          and d.num = new.num and d.id::text <> new.id::text) then
    select coalesce(max(d.num), 0) + 1 into new.num
      from documents d
     where d.commerce_id is not distinct from new.commerce_id
       and d.type is not distinct from new.type;
  end if;
  return new;
end $$;

drop trigger if exists bb_numero_document on public.documents;
create trigger bb_numero_document before insert on public.documents
  for each row execute function public.bb_numero_document();

commit;

-- Vérification : doit afficher 2 lignes (bb_numero_facture et bb_numero_document)
select tgname, tgrelid::regclass as table_concernee
  from pg_trigger where tgname in ('bb_numero_facture', 'bb_numero_document');

-- Pour info : doublons déjà présents avant ce correctif (aucune ligne = parfait)
select commerce_id, num, count(*) as nb from factures group by 1, 2 having count(*) > 1;
