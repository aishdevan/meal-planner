# Devan Family Meals 🍛

A private meal-planning PWA for Aish, Rahul & Elai: weekly plans for breakfast /
lunch / dinner plus Elai's nut-free, no-reheat school lunchbox, a grocery list
organized by store (Whole Foods · Farmers Market · Indian Store), simple pantry
tracking, Instagram recipe bookmarking, vacation-aware replanning, and
Claude-powered "surprise us" suggestions.

## How it works

- **Dual-diet dinners** — every dinner has a vegetarian base (Aish) plus an
  optional non-veg add-on cooked alongside (Rahul & Elai). One cooking session,
  two diets, extra protein.
- **Hard constraints are code, not AI** — school lunches must be nut-free and
  fine without reheating; weekday dinners ≤ 30 min; veg base unless Aish is
  away. Claude proposes, the server re-validates ([src/lib/constraints.ts](src/lib/constraints.ts)).
- **Check-off simplicity** — grocery list = week's plan minus pantry `have`
  items. Checking off an item marks it `have`; cooking a meal marks its fresh
  ingredients `out`. No quantity math.
- **Mock mode** — with no `ANTHROPIC_API_KEY` (or `MOCK_CLAUDE=1`) a
  deterministic planner rotates the recipe library with the same constraints,
  so the app is fully usable before connecting Claude.

## Local development

```bash
docker start meal-planner-db   # local Postgres 16 on :5433 (created via docker run)
pnpm install
pnpm drizzle-kit migrate       # apply schema
pnpm tsx scripts/seed.ts       # members + 50 recipes + pantry staples (idempotent)
pnpm dev                       # http://localhost:3000, passcode from .env.local
pnpm vitest run                # logic tests (grocery derivation, constraints)
```

`.env.local` keys: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `MOCK_CLAUDE`,
`AUTH_SECRET` (rotating logs out all devices), `HOUSEHOLD_PASSCODE`,
`SHORTCUT_TOKEN` (Apple Shortcut bearer token),
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
(web push — `npx web-push generate-vapid-keys`), `CRON_SECRET` (protects the
Sunday-nudge cron endpoint; Vercel sends it automatically).

## Deploying (one-time)

1. **Vercel**: import this repo (or `vercel link && vercel --prod`).
2. **Neon**: add the Neon Postgres integration from the Vercel marketplace —
   it injects `DATABASE_URL`. Run `pnpm drizzle-kit migrate` and
   `pnpm tsx scripts/seed.ts` locally with `DATABASE_URL` pointed at Neon.
3. **Env vars on Vercel**: `ANTHROPIC_API_KEY` (console.anthropic.com),
   `AUTH_SECRET`, `HOUSEHOLD_PASSCODE`, `SHORTCUT_TOKEN` (generate fresh:
   `openssl rand -hex 16`), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:you@example.com`),
   `CRON_SECRET` (any random string), and remove/leave `MOCK_CLAUDE` unset.
   The Sunday-4pm-UTC cron in `vercel.json` sends the "plan your week" push
   to every phone that enabled the reminder in Settings.
4. **Phones**: open the URL in Safari → Share → **Add to Home Screen** on both
   phones, enter the passcode once each.
5. **Instagram sharing**: follow the Shortcut guide inside the app under
   **Settings** (Recipes tab → ⚙️).

Weekly Claude cost is well under $1/month (one plan generation ≈ $0.06–0.08 at
Sonnet pricing); a per-day API call cap is enforced in
[src/lib/claude.ts](src/lib/claude.ts).

## Key files

| Path | What it is |
| --- | --- |
| `src/db/schema.ts` | Drizzle schema (recipes, plan, pantry, grocery, ratings, bookmarks, absences, suggestions) |
| `src/lib/schemas.ts` | Zod source of truth shared by DB, UI, and Claude structured outputs |
| `src/lib/planner.ts` | Plan generation: context assembly, Claude call + mock fallback, validation, persistence |
| `src/lib/grocery.ts` | Deterministic grocery derivation + mark-cooked pantry logic |
| `src/lib/constraints.ts` | The hard rules Claude is never trusted to enforce |
| `src/data/seed-recipes.ts` | 50 starter recipes matched to the family's tastes |
| `scripts/seed.ts` | One-shot DB seeder |
| `public/sw.js` | Service worker: grocery list readable offline |
