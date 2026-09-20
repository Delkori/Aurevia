-- Le plafond d'une planète : la valeur que la personne vise pour elle.
--
-- La galaxie en tire une barre de vie en dix segments au-dessus de la sphère.
-- Le plafond est fixé par la personne, jamais deviné : une planète sans
-- plafond n'a pas de barre, et c'est voulu.
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "target_amount" numeric;
