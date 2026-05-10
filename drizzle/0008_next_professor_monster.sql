CREATE TYPE "public"."variant_axis" AS ENUM('size', 'color');--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "composition" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "modeling" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "lining" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "washing" text;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "axis" "variant_axis" DEFAULT 'size' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "color_hex" text;