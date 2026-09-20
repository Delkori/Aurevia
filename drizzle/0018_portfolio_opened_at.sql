-- La date d'ouverture réelle d'une planète : un PEA de 2019, une assurance-vie
-- de 2016. Ce n'est pas la date de saisie dans l'app (`created_at`), c'est
-- depuis quand on la tient — ce qui compte pour l'ancienneté, et pour la
-- découverte « Longue vue ».
ALTER TABLE "portfolios" ADD COLUMN IF NOT EXISTS "opened_at" date;
