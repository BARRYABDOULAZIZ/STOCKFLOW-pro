-- Sauvegarde quotidienne BoromBoutik (installée le 23/11/2026 dans le SQL Editor).
-- Fonction edge associée : supabase/functions/sauvegarde (Verify JWT désactivé, protégée par la clé Vault).
-- Copies : bucket privé « sauvegardes », dossier AAAA-MM-JJ/, 14 derniers jours conservés.

create extension if not exists pg_cron;
insert into storage.buckets (id, name, public) values ('sauvegardes', 'sauvegardes', false) on conflict (id) do nothing;

-- Clé secrète aléatoire, gardée uniquement dans Vault (jamais dans le code)
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'sauvegarde_cle', 'Cle d appel de la sauvegarde quotidienne')
  where not exists (select 1 from vault.secrets where name = 'sauvegarde_cle');

create or replace function public.sauvegarde_cle_ok(p text) returns boolean
language sql security definer set search_path = '' as $f$
  select exists(select 1 from vault.decrypted_secrets where name = 'sauvegarde_cle' and decrypted_secret = p)
$f$;
revoke all on function public.sauvegarde_cle_ok(text) from public, anon, authenticated;
grant execute on function public.sauvegarde_cle_ok(text) to service_role;

create or replace function public.sauvegarde_tables() returns setof text
language sql security definer set search_path = '' as $f$
  select table_name::text from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' order by 1
$f$;
revoke all on function public.sauvegarde_tables() from public, anon, authenticated;
grant execute on function public.sauvegarde_tables() to service_role;

create or replace function public.lancer_sauvegarde() returns bigint
language sql security definer set search_path = '' as $f$
  select net.http_post(
    url := 'https://mbbgzcnxlngheowutgyg.supabase.co/functions/v1/sauvegarde',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cle', (select decrypted_secret from vault.decrypted_secrets where name = 'sauvegarde_cle')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
$f$;
revoke all on function public.lancer_sauvegarde() from public, anon, authenticated;

-- Tous les jours à 14:00 UTC (= 15h à Madrid/Paris en hiver, 16h en été)
select cron.schedule('sauvegarde-quotidienne', '0 14 * * *', 'select public.lancer_sauvegarde()');
