/* Flag chicken/tandoori non-veg add-ons as "marinate ahead" so planning
 * surfaces a marinate-the-night-before reminder. Idempotent.
 * Run with: DATABASE_URL=... pnpm tsx scripts/set-marinate-ahead.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/db");
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`
    UPDATE recipes
    SET nonveg_addon = jsonb_set(nonveg_addon, '{marinateAhead}', 'true'),
        updated_at = now()
    WHERE nonveg_addon IS NOT NULL
      AND nonveg_addon->>'name' ~* 'chicken|tandoori|tikka|teriyaki'
      AND nonveg_addon->>'name' !~* 'sausage'
  `);
  const rows = await db.execute(sql`
    SELECT count(*)::int AS n FROM recipes
    WHERE nonveg_addon->>'marinateAhead' = 'true'
  `);
  console.log("marinate-ahead add-ons:", rows.rows?.[0]?.n ?? rows);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
