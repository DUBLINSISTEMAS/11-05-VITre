CREATE TABLE "storefront_collection_item" (
	"collection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "storefront_collection_item_collection_id_product_id_pk" PRIMARY KEY("collection_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "storefront_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"show_in_home" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "storefront_collection_store_slug_unique" UNIQUE("store_id","slug")
);
--> statement-breakpoint
ALTER TABLE "storefront_collection_item" ADD CONSTRAINT "storefront_collection_item_collection_id_storefront_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."storefront_collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_collection_item" ADD CONSTRAINT "storefront_collection_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_collection_item" ADD CONSTRAINT "storefront_collection_item_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_collection" ADD CONSTRAINT "storefront_collection_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storefront_collection_item_store_idx" ON "storefront_collection_item" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "storefront_collection_item_collection_idx" ON "storefront_collection_item" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "storefront_collection_item_product_idx" ON "storefront_collection_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "storefront_collection_store_idx" ON "storefront_collection" USING btree ("store_id");