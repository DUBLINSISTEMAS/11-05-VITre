CREATE TYPE "public"."membership_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'staff', 'viewer');--> statement-breakpoint
CREATE TABLE "store_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" text,
	"invited_email" text NOT NULL,
	"role" "team_role" DEFAULT 'staff' NOT NULL,
	"status" "membership_status" DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_membership_store_email_unique" UNIQUE("store_id","invited_email")
);
--> statement-breakpoint
ALTER TABLE "store_membership" ADD CONSTRAINT "store_membership_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_membership" ADD CONSTRAINT "store_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_membership" ADD CONSTRAINT "store_membership_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_membership_store_idx" ON "store_membership" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "store_membership_user_idx" ON "store_membership" USING btree ("user_id");