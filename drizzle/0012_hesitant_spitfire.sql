CREATE TABLE "product_related" (
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"related_product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_related_product_id_related_product_id_pk" PRIMARY KEY("product_id","related_product_id")
);
--> statement-breakpoint
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_related_product_id_product_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_related_store_idx" ON "product_related" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "product_related_product_idx" ON "product_related" USING btree ("product_id","position");