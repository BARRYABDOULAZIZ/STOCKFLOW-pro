-- BoromBoutik — limite par jour de l'IA (photo de facture)
-- À lancer UNE fois dans Supabase → SQL Editor → New query → coller → Run.
-- Sans danger : crée une petite table de compteurs et 2 fonctions ; aucune donnée existante n'est modifiée.
-- On peut le relancer sans risque.

-- Un compteur par commerce, par jour (heure de Dakar) et par type d'usage (« photo »…)
create table if not exists public.ia_usage (
  commerce_id text not null,
  jour date not null,
  type text not null,
  nb integer not null default 0,
  primary key (commerce_id, jour, type)
);
-- Personne ne lit ni n'écrit la table directement : seulement via les 2 fonctions ci-dessous
alter table public.ia_usage enable row level security;
revoke all on public.ia_usage from anon, authenticated;

-- Combien de fois aujourd'hui pour MON commerce
create or replace function public.ia_usage_get(p_type text)
returns integer language sql security definer set search_path = public stable as $$
  select coalesce((
    select u.nb from public.ia_usage u
    join public.profiles p on p.id = auth.uid()
    where u.commerce_id = p.commerce_id::text
      and u.jour = (now() at time zone 'Africa/Dakar')::date
      and u.type = p_type
  ), 0);
$$;

-- +1 pour MON commerce aujourd'hui ; renvoie le nouveau total
create or replace function public.ia_usage_add(p_type text)
returns integer language plpgsql security definer set search_path = public as $$
declare cid text; n integer;
begin
  select commerce_id::text into cid from public.profiles where id = auth.uid();
  if cid is null then return 0; end if;
  insert into public.ia_usage (commerce_id, jour, type, nb)
  values (cid, (now() at time zone 'Africa/Dakar')::date, p_type, 1)
  on conflict (commerce_id, jour, type) do update set nb = public.ia_usage.nb + 1
  returning nb into n;
  return n;
end $$;

revoke all on function public.ia_usage_get(text) from public, anon;
revoke all on function public.ia_usage_add(text) from public, anon;
grant execute on function public.ia_usage_get(text) to authenticated;
grant execute on function public.ia_usage_add(text) to authenticated;

-- Vérification : doit afficher « ok »
select 'ok' as limite_ia_installee;
