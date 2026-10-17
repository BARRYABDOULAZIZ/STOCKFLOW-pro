-- =====================================================================================
-- BoromBoutik — Abonnements (étape 1 : paiement manuel Wave / Orange Money)
--
-- À lancer UNE fois dans Supabase : SQL Editor → New query → coller tout → Run.
-- Ce script peut être relancé sans danger (il ne supprime aucune donnée existante).
--
-- Il AJOUTE seulement :
--   • plateforme_admins       : les emails qui ont accès à la page Admin (toi)
--   • plateforme_config       : tarifs et numéros de paiement (modifiables depuis la page Admin)
--   • abonnements             : pour chaque boutique, « actif jusqu'au … »
--   • paiements_abonnement    : l'historique des paiements reçus
--   • des fonctions sécurisées utilisables seulement par un admin de la plateforme
--
-- Il ne modifie AUCUNE table existante (commerces, profiles, factures, produits…).
-- Une boutique SANS ligne dans « abonnements » continue de marcher exactement comme avant.
-- =====================================================================================

-- 1) Admins de la plateforme -----------------------------------------------------------
create table if not exists public.plateforme_admins (
  email text primary key
);
alter table public.plateforme_admins enable row level security;
-- (aucune règle de lecture : la liste n'est lisible par personne depuis l'appli)

create or replace function public.est_admin_plateforme()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.plateforme_admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 2) Configuration : tarifs, numéros de paiement ---------------------------------------
create table if not exists public.plateforme_config (
  cle        text primary key,
  valeur     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.plateforme_config enable row level security;
drop policy if exists "config lisible par les connectes" on public.plateforme_config;
create policy "config lisible par les connectes" on public.plateforme_config
  for select to authenticated using (true);

-- 3) Abonnements ---------------------------------------------------------------------
create table if not exists public.abonnements (
  commerce_id  text primary key,
  formule      text not null default 'standard',
  actif_jusqua date,
  essai        boolean not null default false,
  note         text,
  updated_at   timestamptz not null default now()
);
alter table public.abonnements enable row level security;
drop policy if exists "abonnement de mon commerce" on public.abonnements;
create policy "abonnement de mon commerce" on public.abonnements
  for select to authenticated
  using (commerce_id = (select p.commerce_id::text from public.profiles p where p.id = auth.uid()));

-- 4) Historique des paiements ------------------------------------------------------------
create table if not exists public.paiements_abonnement (
  id           bigserial primary key,
  commerce_id  text not null,
  mois         integer not null default 0,
  jours        integer not null default 0,
  montant      numeric not null default 0,
  devise       text,
  moyen        text,
  reference    text,
  note         text,
  essai        boolean not null default false,
  actif_jusqua date,
  par_email    text,
  created_at   timestamptz not null default now()
);
alter table public.paiements_abonnement enable row level security;
drop policy if exists "paiements de mon commerce" on public.paiements_abonnement;
create policy "paiements de mon commerce" on public.paiements_abonnement
  for select to authenticated
  using (commerce_id = (select p.commerce_id::text from public.profiles p where p.id = auth.uid()));

-- 5) Fonctions réservées à l'admin de la plateforme ---------------------------------------

-- Liste de toutes les boutiques avec leur abonnement
create or replace function public.admin_boutiques()
returns table (
  commerce_id text, nom text, devise text, telephone text,
  proprietaire text, email text, nb_factures bigint, derniere_vente text,
  actif_jusqua date, essai boolean, formule text, note text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.est_admin_plateforme() then raise exception 'Accès refusé'; end if;
  return query
  select c.id::text,
         coalesce(to_jsonb(c) ->> 'nom', ''),
         coalesce(to_jsonb(c) ->> 'devise', 'XOF'),
         coalesce(to_jsonb(c) ->> 'telephone', ''),
         (select coalesce(to_jsonb(p) ->> 'nom', '') from public.profiles p
            where p.commerce_id::text = c.id::text and to_jsonb(p) ->> 'role' = 'proprietaire' limit 1),
         (select u.email::text from public.profiles p join auth.users u on u.id = p.id
            where p.commerce_id::text = c.id::text and to_jsonb(p) ->> 'role' = 'proprietaire' limit 1),
         (select count(*) from public.factures f where f.commerce_id::text = c.id::text),
         (select max(to_jsonb(f) ->> 'date') from public.factures f where f.commerce_id::text = c.id::text),
         a.actif_jusqua, coalesce(a.essai, false), a.formule, a.note
  from public.commerces c
  left join public.abonnements a on a.commerce_id = c.id::text
  order by a.actif_jusqua nulls last, 2;
end;
$$;

-- Ajoute des mois (paiement reçu) ou des jours (essai gratuit). Renvoie la nouvelle date de fin.
-- Si l'abonnement court encore, on prolonge à partir de sa date de fin ; sinon à partir d'aujourd'hui.
create or replace function public.admin_prolonger(
  p_commerce text, p_mois integer default 0, p_jours integer default 0,
  p_montant numeric default 0, p_devise text default null, p_moyen text default null,
  p_reference text default null, p_note text default null, p_essai boolean default false
)
returns date
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_depart date;
  v_fin date;
begin
  if not public.est_admin_plateforme() then raise exception 'Accès refusé'; end if;
  if coalesce(p_mois, 0) < 0 or coalesce(p_jours, 0) < 0 or (coalesce(p_mois, 0) = 0 and coalesce(p_jours, 0) = 0) then
    raise exception 'Durée invalide';
  end if;
  if not exists (select 1 from public.commerces c where c.id::text = p_commerce) then raise exception 'Boutique introuvable'; end if;
  select greatest(coalesce(a.actif_jusqua, current_date - 1), current_date - 1) into v_depart
    from public.abonnements a where a.commerce_id = p_commerce;
  v_depart := coalesce(v_depart, current_date - 1);
  v_fin := (v_depart + make_interval(months => coalesce(p_mois, 0)))::date + coalesce(p_jours, 0);
  insert into public.abonnements (commerce_id, actif_jusqua, essai, updated_at)
    values (p_commerce, v_fin, coalesce(p_essai, false), now())
  on conflict (commerce_id) do update
    set actif_jusqua = excluded.actif_jusqua, essai = excluded.essai, updated_at = now();
  insert into public.paiements_abonnement (commerce_id, mois, jours, montant, devise, moyen, reference, note, essai, actif_jusqua, par_email)
    values (p_commerce, coalesce(p_mois, 0), coalesce(p_jours, 0), coalesce(p_montant, 0), p_devise, p_moyen, p_reference, p_note,
            coalesce(p_essai, false), v_fin, auth.jwt() ->> 'email');
  return v_fin;
end;
$$;

-- Corrige la date de fin à la main (erreur de saisie, geste commercial…). p_date null = retirer l'abonnement (retour à « sans abonnement »).
create or replace function public.admin_fixer_date(p_commerce text, p_date date, p_note text default null)
returns date
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.est_admin_plateforme() then raise exception 'Accès refusé'; end if;
  if p_date is null then
    delete from public.abonnements where commerce_id = p_commerce;
  else
    insert into public.abonnements (commerce_id, actif_jusqua, updated_at, note) values (p_commerce, p_date, now(), p_note)
    on conflict (commerce_id) do update set actif_jusqua = excluded.actif_jusqua, updated_at = now(), note = coalesce(excluded.note, public.abonnements.note);
  end if;
  insert into public.paiements_abonnement (commerce_id, note, actif_jusqua, par_email)
    values (p_commerce, coalesce(p_note, 'Date corrigée à la main'), p_date, auth.jwt() ->> 'email');
  return p_date;
end;
$$;

-- Historique des paiements d'une boutique
create or replace function public.admin_paiements(p_commerce text)
returns setof public.paiements_abonnement
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.est_admin_plateforme() then raise exception 'Accès refusé'; end if;
  return query select * from public.paiements_abonnement where commerce_id = p_commerce order by created_at desc limit 50;
end;
$$;

-- Enregistre les tarifs / numéros de paiement
create or replace function public.admin_config(p_cle text, p_valeur jsonb)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.est_admin_plateforme() then raise exception 'Accès refusé'; end if;
  insert into public.plateforme_config (cle, valeur, updated_at) values (p_cle, coalesce(p_valeur, '{}'::jsonb), now())
  on conflict (cle) do update set valeur = excluded.valeur, updated_at = now();
end;
$$;

-- Droits : ces fonctions sont appelables par un utilisateur connecté, mais refusent tout le monde sauf l'admin
revoke all on function public.admin_boutiques() from public, anon;
revoke all on function public.admin_prolonger(text, integer, integer, numeric, text, text, text, text, boolean) from public, anon;
revoke all on function public.admin_fixer_date(text, date, text) from public, anon;
revoke all on function public.admin_paiements(text) from public, anon;
revoke all on function public.admin_config(text, jsonb) from public, anon;
grant execute on function public.est_admin_plateforme() to authenticated;
grant execute on function public.admin_boutiques() to authenticated;
grant execute on function public.admin_prolonger(text, integer, integer, numeric, text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_fixer_date(text, date, text) to authenticated;
grant execute on function public.admin_paiements(text) to authenticated;
grant execute on function public.admin_config(text, jsonb) to authenticated;
grant select on public.abonnements, public.paiements_abonnement, public.plateforme_config to authenticated;

-- 6) TON email d'admin -------------------------------------------------------------------
-- ⚠️ Remplace l'adresse ci-dessous par l'email de TON compte (celui avec lequel tu te connectes à BoromBoutik),
--    en gardant les apostrophes. Exemple : values ('moi@gmail.com')
insert into public.plateforme_admins (email) values ('REMPLACE-PAR-TON-EMAIL@exemple.com')
  on conflict (email) do nothing;
