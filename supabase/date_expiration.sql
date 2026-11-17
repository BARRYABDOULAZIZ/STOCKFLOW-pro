-- BoromBoutik — date d'expiration (péremption) des produits
-- À lancer UNE fois dans Supabase → SQL Editor → New query → coller → Run.
-- Sans danger : ajoute seulement une colonne vide (facultative) ; aucune donnée existante n'est modifiée.
-- On peut le relancer sans risque (« if not exists »).

alter table public.produits
  add column if not exists date_expiration date;

comment on column public.produits.date_expiration is
  'Date d''expiration du lot qui expire le plus tôt (facultatif).';

-- Vérification : doit afficher une ligne « date_expiration | date »
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'produits' and column_name = 'date_expiration';
