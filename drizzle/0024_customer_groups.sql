CREATE TABLE "customer_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"discount_bps" integer DEFAULT 0 NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_group_store_name_unique" UNIQUE("store_id","name")
);
--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_group" ADD CONSTRAINT "customer_group_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_group_store_idx" ON "customer_group" USING btree ("store_id");--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_group_id_customer_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."customer_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_group_idx" ON "customer" USING btree ("group_id");