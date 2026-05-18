CREATE TYPE "public"."customer_type" AS ENUM('individual', 'company');--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "type" "customer_type" DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "document" text;