CREATE TYPE "public"."product_unit" AS ENUM('un', 'pc', 'kg', 'g', 'm', 'cm', 'ml', 'L', 'm2', 'm3');--> statement-breakpoint
CREATE TYPE "public"."order_price_table" AS ENUM('retail', 'wholesale', 'promo');--> statement-breakpoint
ALTER TYPE "public"."cash_adjustment_type" ADD VALUE 'pay_supplier';--> statement-breakpoint
ALTER TYPE "public"."cash_adjustment_type" ADD VALUE 'pay_bill';--> statement-breakpoint
ALTER TYPE "public"."cash_adjustment_type" ADD VALUE 'other_in';--> statement-breakpoint
ALTER TYPE "public"."cash_adjustment_type" ADD VALUE 'other_out';--> statement-breakpoint
CREATE TABLE "order_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"method" "order_payment_method" NOT NULL,
	"amount_in_cents" integer NOT NULL,
	"cash_received_in_cents" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"product_name_snapshot" text NOT NULL,
	"variant_name_snapshot" text,
	"quantity" integer NOT NULL,
	"unit_cost_in_cents" integer NOT NULL,
	"total_cost_in_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"supplier_id" uuid,
	"invoice_number" text,
	"total_in_cents" integer NOT NULL,
	"paid_at" timestamp,
	"payment_method" "order_payment_method",
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"amount_in_cents" integer NOT NULL,
	"due_date" timestamp,
	"paid_at" timestamp,
	"paid_method" "order_payment_method",
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"phone" text,
	"email" text,
	"address_street" text,
	"address_number" text,
	"address_complement" text,
	"address_neighborhood" text,
	"address_city" text,
	"address_state" text,
	"address_zip" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_store_document_unique" UNIQUE("store_id","document")
);
--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "cost_price_in_cents" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "min_stock_quantity" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "max_stock_quantity" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "gtin" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "unit" "product_unit" DEFAULT 'un' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "internal_code" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "default_commission_bps" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "ncm" text;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "unit_cost_snapshot_in_cents" integer;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "seller_id" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "external_fiscal_doc" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "price_table_used" "order_price_table";--> statement-breakpoint
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payment" ADD CONSTRAINT "order_payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_purchase_id_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_item" ADD CONSTRAINT "purchase_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_payment_store_idx" ON "order_payment" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "order_payment_order_idx" ON "order_payment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "purchase_item_purchase_idx" ON "purchase_item" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "purchase_item_product_idx" ON "purchase_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchase_store_idx" ON "purchase" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "purchase_supplier_idx" ON "purchase" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_store_created_idx" ON "purchase" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "receivable_store_idx" ON "receivable" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "receivable_customer_idx" ON "receivable" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "receivable_order_idx" ON "receivable" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "receivable_store_pending_idx" ON "receivable" USING btree ("store_id","due_date");--> statement-breakpoint
CREATE INDEX "supplier_store_idx" ON "supplier" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "supplier_store_name_idx" ON "supplier" USING btree ("store_id","name");--> statement-breakpoint
CREATE INDEX "supplier_store_created_idx" ON "supplier" USING btree ("store_id","created_at");--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;