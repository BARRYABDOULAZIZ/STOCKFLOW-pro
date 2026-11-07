-- ============================================================================
-- BoromBoutik — Anciennes factures (AF-001, AF-002…) : numérotation à part
-- À lancer UNE fois : Supabase → SQL Editor → coller tout ce fichier → Run.
--
-- Les anciennes factures recopiées du carnet sont rangées avec un numéro NÉGATIF
-- (-1 = AF-001, -2 = AF-002…) pour ne jamais prendre un numéro de vraie facture.
-- Ce correctif apprend à la base à donner le numéro libre suivant VERS LE BAS
-- quand deux anciennes factures arrivent avec le même numéro (sinon elle leur
-- donnerait un numéro de vraie facture). Les factures existantes ne changent pas.
-- ============================================================================
create or replace function public.bb_numero_facture()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform pg_advisory_xact_lock(hashtext('bb_fac:' || coalesce(new.commerce_id::text, '')));
  if new.num is not null and new.num < 0 then
    -- Ancienne facture : prochain numéro libre vers le bas
    if exists (select 1 from factures f
                where f.commerce_id is not distinct from new.commerce_id
                  and f.num = new.num and f.id::text <> new.id::text) then
      select least(coalesce(min(f.num), 0), 0) - 1 into new.num
        from factures f where f.commerce_id is not distinct from new.commerce_id;
    end if;
    return new;
  end if;
  if new.num is null or exists (
       select 1 from factures f
        where f.commerce_id is not distinct from new.commerce_id
          and f.num = new.num and f.id::text <> new.id::text) then
    select greatest(coalesce(max(f.num), 0), 0) + 1 into new.num
      from factures f where f.commerce_id is not distinct from new.commerce_id;
  end if;
  return new;
end $$;

-- Vérification : doit afficher « ok »
select 'ok' as resultat where exists (select 1 from pg_trigger where tgname = 'bb_numero_facture');
