-- Aurevia — script de remise à zéro complète du schéma.
-- Sûr à exécuter même si certaines tables existent déjà ou sont dans un état
-- incohérent : il supprime tout puis recrée proprement (CASCADE gère les
-- dépendances). À utiliser dans le SQL Editor de Neon.
--
-- ⚠️ Ceci efface toutes les données existantes dans ces tables.

DROP TABLE IF EXISTS budget_entries CASCADE;
DROP TABLE IF EXISTS budget_categories CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS net_worth_snapshots CASCADE;
DROP TABLE IF EXISTS portfolios CASCADE;

CREATE TABLE "portfolios" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#8a5cf5' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"ticker" text,
	"quantity" numeric,
	"avg_buy_price" numeric,
	"manual_value" numeric,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"portfolio_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assets_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id")
		REFERENCES "public"."portfolios"("id") ON DELETE SET NULL
);

CREATE TABLE "budget_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"monthly_target" numeric,
	"color" text DEFAULT '#999999' NOT NULL
);

CREATE TABLE "budget_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"amount" numeric NOT NULL,
	"note" text,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "budget_entries_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id")
		REFERENCES "public"."budget_categories"("id") ON DELETE CASCADE
);

CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"target_amount" numeric NOT NULL,
	"target_date" date,
	"color" text DEFAULT '#8a5cf5' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "net_worth_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"total_value" numeric NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
