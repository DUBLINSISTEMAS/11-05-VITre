CREATE TYPE "public"."cash_adjustment_type" AS ENUM('sangria', 'reinforcement');--> statement-breakpoint
CREATE TABLE "cash_adjustment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cash_session_id" uuid NOT NULL,
	"type" "cash_adjustment_type" NOT NULL,
	"amount_in_cents" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"opened_by_user_id" text NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"opening_amount_in_cents" integer NOT NULL,
	"closed_by_user_id" text,
	"closed_at" timestamp,
	"closing_expected_in_cents" integer,
	"closing_actual_in_cents" integer,
	"closing_notes" text
);
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "cash_session_id" uuid;--> statement-breakpoint
ALTER TABLE "cash_adjustment" ADD CONSTRAINT "cash_adjustment_cash_session_id_cash_session_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_adjustment" ADD CONSTRAINT "cash_adjustment_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_opened_by_user_id_user_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_session" ADD CONSTRAINT "cash_session_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_adjustment_session_created_idx" ON "cash_adjustment" USING btree ("cash_session_id","created_at");--> statement-breakpoint
CREATE INDEX "cash_session_store_opened_idx" ON "cash_session" USING btree ("store_id","opened_at");--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_cash_session_id_cash_session_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_session"("id") ON DELETE set null ON UPDATE no action;