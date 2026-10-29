-- BoromBoutik — audit de sécurité (LECTURE SEULE : ne modifie rien)
-- À coller dans Supabase > SQL Editor > New query, puis Run. Copier le résultat (bouton Copy / Export CSV).
with
t as (
  select c.relname as nom, c.relrowsecurity as rls, c.relforcerowsecurity as rls_force
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
pol as (
  select tablename, string_agg(format('%s [%s] roles=%s USING(%s) CHECK(%s)', policyname, cmd, roles::text,
         coalesce(qual, '-'), coalesce(with_check, '-')), E'\n' order by policyname) as policies
  from pg_policies where schemaname = 'public' group by tablename
),
gr as (
  select table_name, string_agg(distinct grantee || ':' || privilege_type, ', ') as grants
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated') group by table_name
),
fn as (
  select p.proname, p.prosecdef as security_definer, coalesce(array_to_string(p.proconfig, ','), '') as config,
         has_function_privilege('anon', p.oid, 'execute') as anon_exec, pg_get_functiondef(p.oid) as def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
)
select 'TABLE' as type, t.nom as objet,
       format('RLS=%s FORCE=%s | grants: %s', t.rls, t.rls_force, coalesce(gr.grants, '-')) as resume,
       coalesce(pol.policies, 'AUCUNE POLICY') as detail
from t left join pol on pol.tablename = t.nom left join gr on gr.table_name = t.nom
union all
select 'FONCTION', proname, format('security_definer=%s config=%s anon_peut_executer=%s', security_definer, config, anon_exec), def from fn
union all
select 'BUCKET', id, format('public=%s taille_max=%s types=%s', public, file_size_limit, allowed_mime_types), '' from storage.buckets
union all
select 'TRIGGER', event_object_schema || '.' || event_object_table, trigger_name, action_statement
from information_schema.triggers where event_object_schema in ('public', 'auth')
order by 1, 2;
