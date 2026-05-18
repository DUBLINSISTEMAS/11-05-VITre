CREATE TYPE "public"."coupon_discount_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TABLE "coupon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"code" text NOT NULL,
	"discount_type" "coupon_discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_store_code_unique" UNIQUE("store_id","code")
);
--> statement-breakpoint
ALTER TABLE "coupon" ADD CONSTRAINT "coupon_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupon_store_idx" ON "coupon" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "coupon_active_idx" ON "coupon" USING btree ("store_id","is_active");