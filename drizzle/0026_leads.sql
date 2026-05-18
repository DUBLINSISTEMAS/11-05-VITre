CREATE TYPE "public"."lead_source" AS ENUM('pdp_button', 'list_button', 'cart_button', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'converted', 'lost');--> statement-breakpoint
CREATE TABLE "lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid,
	"customer_name" text,
	"customer_phone" text,
	"product_snapshot" jsonb,
	"source" "lead_source" DEFAULT 'pdp_button' NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"customer_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_store_idx" ON "lead" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "lead_store_created_idx" ON "lead" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_store_status_idx" ON "lead" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "lead_product_idx" ON "lead" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "lead_customer_idx" ON "lead" USING btree ("customer_id");