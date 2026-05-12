ALTER TABLE "store" ADD COLUMN "category_shape" text DEFAULT 'rounded' NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "product_card_style" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "hero_style" text DEFAULT 'cover' NOT NULL;