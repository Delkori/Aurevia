-- L'ancien POST /api/snapshot faisait DELETE puis INSERT sans contrainte
-- d'unicité : deux onglets lancés en même temps pouvaient laisser deux lignes
-- pour la même date. On ne garde que la plus récente avant de poser la
-- contrainte, sinon l'ALTER TABLE plus bas échoue sur une base existante.
DELETE FROM "net_worth_snapshots" a
USING "net_worth_snapshots" b
WHERE a."date" = b."date" AND a."id" < b."id";
--> statement-breakpoint
CREATE TABLE "auth_throttle" (
	"ip" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assets_portfolio_id_idx" ON "assets" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "budget_entries_category_id_idx" ON "budget_entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "goal_links_goal_id_idx" ON "goal_links" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goal_links_portfolio_id_idx" ON "goal_links" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "loans_asset_id_idx" ON "loans" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "portfolio_ownerships_portfolio_id_idx" ON "portfolio_ownerships" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "portfolios_member_id_idx" ON "portfolios" USING btree ("member_id");--> statement-breakpoint
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_date_unique" UNIQUE("date");