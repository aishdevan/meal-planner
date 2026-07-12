ALTER TABLE "plan_entries" ADD COLUMN "rejected_recipe_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "nutrition" jsonb;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "source_name" text;