-- BoromBoutik — Modèles de facture
-- Ajoute UNE colonne à la table commerces : le modèle, la couleur, les numéros Wave / Orange Money et le RCCM
-- choisis dans Données > Mon commerce. Aucune donnée existante n'est modifiée.
-- Sans cette colonne, l'appli garde le choix sur l'appareil seulement (rien ne casse).
alter table public.commerces add column if not exists facture_style jsonb;
