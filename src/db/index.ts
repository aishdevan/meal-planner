import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Neon in production (Vercel integration), plain Postgres locally (Docker).
const isNeon = url.includes("neon.tech");

// Both drivers expose the same query API; pin the union to one driver's type
// so method overloads (insert().returning() etc.) don't collapse.
export const db = (
  isNeon
    ? drizzleNeon(neon(url), { schema })
    : drizzlePg(new Pool({ connectionString: url }), { schema })
) as ReturnType<typeof drizzlePg<typeof schema>>;

export type Db = typeof db;
export * as tables from "./schema";
