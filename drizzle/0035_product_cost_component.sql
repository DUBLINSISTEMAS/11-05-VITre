CREATE TABLE "product_cost_component" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_in_cents" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_cost_component" ADD CONSTRAINT "product_cost_component_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cost_component" ADD CONSTRAINT "product_cost_component_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_cost_component_store_idx" ON "product_cost_component" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "product_cost_component_product_idx" ON "product_cost_component" USING btree ("product_id");
