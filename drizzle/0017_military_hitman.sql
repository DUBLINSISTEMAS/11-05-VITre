CREATE TYPE "public"."stock_movement_type" AS ENUM('initial', 'manual_in', 'manual_out', 'sale', 'return', 'adjustment');--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"movement_type" "stock_movement_type" NOT NULL,
	"quantity_delta" integer NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movement_product_idx" ON "stock_movement" USING btree ("store_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movement_store_created_idx" ON "stock_movement" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movement_reference_idx" ON "stock_movement" USING btree ("reference_type","reference_id");