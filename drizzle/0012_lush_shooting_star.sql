CREATE TABLE "flow_occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"flow_id" integer NOT NULL,
	"due_date" date NOT NULL,
	"expected_amount" numeric NOT NULL,
	"actual_amount" numeric,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "flow_occurrences_flow_due_unique" UNIQUE("flow_id","due_date")
);
--> statement-breakpoint
ALTER TABLE "flow_occurrences" ADD CONSTRAINT "flow_occurrences_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flow_occurrences_due_date_idx" ON "flow_occurrences" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "flow_occurrences_status_idx" ON "flow_occurrences" USING btree ("status");