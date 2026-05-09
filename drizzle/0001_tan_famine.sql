ALTER TABLE "category" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
CREATE INDEX "category_parent_idx" ON "category" USING btree ("parent_id");