import { NextRequest, NextResponse } from "next/server";
import { generatePlan } from "@/lib/planner";
import { mondayOf, todayString } from "@/lib/dates";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const weekStart: string = body.weekStart ?? mondayOf(todayString());
  const dates: string[] | undefined = body.dates;
  try {
    const result = await generatePlan({ weekStart, dates });
    return NextResponse.json({ weekStart, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "generation failed" },
      { status: 500 },
    );
  }
}
