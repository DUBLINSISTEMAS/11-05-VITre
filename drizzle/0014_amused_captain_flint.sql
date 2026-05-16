CREATE TYPE "public"."installment_base_price" AS ENUM('base', 'effective');--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "installments_override" integer;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "accepts_card" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "card_max_installments" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "card_interest_rate_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "installment_base_price" "installment_base_price" DEFAULT 'base' NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "show_installments_on_pdp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "cash_discount_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "payment_methods_note" text;