DROP INDEX "plan_entries_date_slot_idx";--> statement-breakpoint
CREATE INDEX "plan_entries_date_slot_idx" ON "plan_entries" USING btree ("date","slot");