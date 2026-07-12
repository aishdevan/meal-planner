CREATE TYPE "public"."absence_type" AS ENUM('vacation', 'travel', 'school_break');--> statement-breakpoint
CREATE TYPE "public"."bookmark_status" AS ENUM('saved', 'ingested', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."diet" AS ENUM('vegetarian', 'omnivore');--> statement-breakpoint
CREATE TYPE "public"."generated_by" AS ENUM('claude', 'manual');--> statement-breakpoint
CREATE TYPE "public"."grocery_source" AS ENUM('plan', 'staple', 'manual');--> statement-breakpoint
CREATE TYPE "public"."pantry_state" AS ENUM('have', 'low', 'out');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('planned', 'cooked', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."recipe_source" AS ENUM('seed', 'user', 'ai', 'imported');--> statement-breakpoint
CREATE TYPE "public"."slot" AS ENUM('breakfast', 'lunch', 'dinner', 'school_lunch');--> statement-breakpoint
CREATE TYPE "public"."store" AS ENUM('whole_foods', 'farmers_market', 'indian_store');--> statement-breakpoint
CREATE TYPE "public"."suggestion_status" AS ENUM('proposed', 'accepted', 'dismissed', 'cooked');--> statement-breakpoint
CREATE TABLE "absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"type" "absence_type" DEFAULT 'travel' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"thumbnail" text,
	"og_text" text,
	"pasted_text" text,
	"status" "bookmark_status" DEFAULT 'saved' NOT NULL,
	"recipe_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grocery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"name" text NOT NULL,
	"pantry_key" text NOT NULL,
	"qty_text" text,
	"store" "store" DEFAULT 'whole_foods' NOT NULL,
	"category" text DEFAULT 'pantry' NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"source" "grocery_source" DEFAULT 'plan' NOT NULL,
	"recipe_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"diet" "diet" NOT NULL,
	"is_child" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pantry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"pantry_key" text NOT NULL,
	"store" "store" DEFAULT 'whole_foods' NOT NULL,
	"category" text DEFAULT 'pantry' NOT NULL,
	"state" "pantry_state" DEFAULT 'have' NOT NULL,
	"staple" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"slot" "slot" NOT NULL,
	"recipe_id" uuid NOT NULL,
	"include_addon" boolean DEFAULT false NOT NULL,
	"status" "plan_status" DEFAULT 'planned' NOT NULL,
	"generated_by" "generated_by" DEFAULT 'manual' NOT NULL,
	"why" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"ate_it" boolean,
	"comment" text,
	"cooked_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cuisine" text NOT NULL,
	"source" "recipe_source" DEFAULT 'user' NOT NULL,
	"source_url" text,
	"meal_types" text[] NOT NULL,
	"is_vegetarian_base" boolean DEFAULT true NOT NULL,
	"is_nut_free" boolean DEFAULT true NOT NULL,
	"no_reheat_ok" boolean DEFAULT false NOT NULL,
	"kid_friendly" boolean DEFAULT false NOT NULL,
	"total_time_minutes" integer NOT NULL,
	"appliances" text[] DEFAULT '{}' NOT NULL,
	"protein_g_base" integer NOT NULL,
	"protein_g_with_addon" integer,
	"ingredients" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"nonveg_addon" jsonb,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"avg_rating" numeric(3, 2),
	"times_cooked" integer DEFAULT 0 NOT NULL,
	"last_cooked_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_snapshot" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" "suggestion_status" DEFAULT 'proposed' NOT NULL,
	"recipe_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_entries" ADD CONSTRAINT "plan_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_usage_day_idx" ON "api_usage" USING btree ("day");--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_items_key_idx" ON "pantry_items" USING btree ("pantry_key");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_entries_date_slot_idx" ON "plan_entries" USING btree ("date","slot");