import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { db, tables } from "@/db";
import { eq } from "drizzle-orm";
import { todayString } from "@/lib/dates";

export const CLAUDE_MODEL = "claude-sonnet-5";
const DAILY_CALL_CAP = 20;

export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MOCK_CLAUDE !== "1";
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/** Trivial daily cap so a bug can't loop us into a Claude bill. */
export async function checkAndCountApiCall(): Promise<void> {
  const day = todayString();
  const [row] = await db
    .select()
    .from(tables.apiUsage)
    .where(eq(tables.apiUsage.day, day));
  if (row && row.calls >= DAILY_CALL_CAP) {
    throw new Error(
      `Daily Claude call limit (${DAILY_CALL_CAP}) reached — try again tomorrow.`,
    );
  }
  if (row) {
    await db
      .update(tables.apiUsage)
      .set({ calls: row.calls + 1 })
      .where(eq(tables.apiUsage.id, row.id));
  } else {
    await db.insert(tables.apiUsage).values({ day, calls: 1 });
  }
}

/**
 * One structured-output call. The caller supplies the Zod schema; the SDK
 * validates the response against it (client.messages.parse retries schema
 * plumbing internally; we add one semantic retry at the planner level).
 */
export async function structuredCall<T extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  await checkAndCountApiCall();
  const response = await client().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: {
      format: zodOutputFormat(opts.schema),
    },
  });
  if (response.parsed_output == null) {
    throw new Error("Claude returned no parseable output");
  }
  return response.parsed_output;
}
