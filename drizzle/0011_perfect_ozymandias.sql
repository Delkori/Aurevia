CREATE TABLE "price_cache" (
	"ticker" text PRIMARY KEY NOT NULL,
	"price" numeric NOT NULL,
	"currency" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
