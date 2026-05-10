ALTER TABLE "banner" ADD COLUMN IF NOT EXISTS "kicker" text;--> statement-breakpoint
ALTER TABLE "banner" ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint
ALTER TABLE "banner" ADD COLUMN IF NOT EXISTS "subtitle" text;--> statement-breakpoint
ALTER TABLE "banner" ADD COLUMN IF NOT EXISTS "cta_label" text;--> statement-breakpoint
ALTER TABLE "banner" ADD COLUMN IF NOT EXISTS "image_alt" text;
