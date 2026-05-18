CREATE TYPE "public"."attribute_type" AS ENUM('color', 'size', 'text');--> statement-breakpoint
CREATE TABLE "attribute" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "attribute_type" DEFAULT 'text' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attribute_store_name_unique" UNIQUE("store_id","name")
);
--> statement-breakpoint
CREATE TABLE "attribute_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"label" text NOT NULL,
	"color_hex" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attribute_value_attribute_label_unique" UNIQUE("attribute_id","label")
);
--> statement-breakpoint
CREATE TABLE "product_attribute_value" (
	"product_id" uuid NOT NULL,
	"attribute_value_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_attribute_value_product_id_attribute_value_id_pk" PRIMARY KEY("product_id","attribute_value_id")
);
--> statement-breakpoint
ALTER TABLE "attribute" ADD CONSTRAINT "attribute_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_value" ADD CONSTRAINT "attribute_value_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_value" ADD CONSTRAINT "attribute_value_attribute_id_attribute_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_value" ADD CONSTRAINT "product_attribute_value_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_value" ADD CONSTRAINT "product_attribute_value_attribute_value_id_attribute_value_id_fk" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."attribute_value"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_value" ADD CONSTRAINT "product_attribute_value_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attribute_store_idx" ON "attribute" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "attribute_value_attribute_idx" ON "attribute_value" USING btree ("attribute_id");--> statement-breakpoint
CREATE INDEX "attribute_value_store_idx" ON "attribute_value" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "product_attribute_value_product_idx" ON "product_attribute_value" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_attribute_value_value_idx" ON "product_attribute_value" USING btree ("attribute_value_id");--> statement-breakpoint
CREATE INDEX "product_attribute_value_store_idx" ON "product_attribute_value" USING btree ("store_id");