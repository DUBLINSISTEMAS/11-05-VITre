CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address_street" text,
	"address_number" text,
	"address_complement" text,
	"address_neighborhood" text,
	"address_city" text,
	"address_state" text,
	"address_zip" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_store_phone_unique" UNIQUE("store_id","phone")
);
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_store_name_idx" ON "customer" USING btree ("store_id","name");--> statement-breakpoint
CREATE INDEX "customer_store_created_idx" ON "customer" USING btree ("store_id","created_at");--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;