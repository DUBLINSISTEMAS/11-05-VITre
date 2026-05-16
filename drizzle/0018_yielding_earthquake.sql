CREATE TYPE "public"."order_channel" AS ENUM('whatsapp', 'balcao');--> statement-breakpoint
CREATE TYPE "public"."order_payment_method" AS ENUM('cash', 'pix', 'debit', 'credit', 'other');--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "customer_phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "channel" "order_channel" DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "payment_method" "order_payment_method";--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "discount_in_cents" integer;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "cash_received_in_cents" integer;