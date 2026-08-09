CREATE TABLE "grocery_regulars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"pantry_key" text NOT NULL,
	"store" "store" DEFAULT 'whole_foods' NOT NULL,
	"category" text DEFAULT 'produce' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "grocery_regulars_key_idx" ON "grocery_regulars" USING btree ("pantry_key");