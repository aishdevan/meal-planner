import { NextRequest, NextResponse } from "next/server";
import { generatePlan } from "@/lib/planner";
import { mondayOf } from "@/lib/dates";
import { SlotSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const date: string | undefined = body.date;
  const slot = SlotSchema.safeParse(body.slot);
  if (!date || !slot.success) {
    return NextResponse.json({ error: "date and slot required" }, { status: 400 });
  }
  try {
    const result = await generatePlan({
      weekStart: mondayOf(date),
      dates: [date],
      onlySlot: slot.data,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "swap failed" },
      { status: 500 },
    );
  }
}
