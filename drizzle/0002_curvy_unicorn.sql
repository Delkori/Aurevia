CREATE TABLE "loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"asset_id" integer,
	"principal" numeric NOT NULL,
	"remaining_balance" numeric NOT NULL,
	"interest_rate" numeric,
	"monthly_payment" numeric,
	"start_date" date,
	"end_date" date,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_categories" ALTER COLUMN "color" SET DEFAULT '#999999';--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "color" SET DEFAULT '#8a5cf5';--> statement-breakpoint
ALTER TABLE "portfolios" ALTER COLUMN "color" SET DEFAULT '#8a5cf5';--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;