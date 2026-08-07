CREATE TABLE "flows" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"source_type" text NOT NULL,
	"source_id" integer,
	"target_type" text NOT NULL,
	"target_id" integer,
	"amount" numeric NOT NULL,
	"frequency" text DEFAULT 'monthly' NOT NULL,
	"member_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"color" text DEFAULT '#7c6af5' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "member_id" integer;--> statement-breakpoint
ALTER TABLE "portfolios" ADD COLUMN "member_id" integer;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;