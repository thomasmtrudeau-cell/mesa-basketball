import { NextResponse } from "next/server";
import { getWeeklySchedule, getCamps, getPrivateSlots } from "@/lib/sheets";
import { getBookedSlots, getGroupSessionEnrollment } from "@/lib/supabase";

function safeGetBookedSlots() {
  try {
    return getBookedSlots();
  } catch {
    return Promise.resolve([]);
  }
}

function safeGetGroupEnrollment() {
  try {
    return getGroupSessionEnrollment();
  } catch {
    return Promise.resolve({});
  }
}

import {
  demoWeeklySchedule,
  demoCamps,
  demoPrivateSlots,
} from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasSheets =
    process.env.SHEET_CSV_WEEKLY_SCHEDULE ||
    process.env.SHEET_CSV_CAMPS ||
    process.env.SHEET_CSV_PRIVATE_SLOTS;

  if (!hasSheets) {
    return NextResponse.json({
      weeklySchedule: demoWeeklySchedule,
      camps: demoCamps,
      privateSlots: demoPrivateSlots,
      bookedSlots: [],
      groupEnrollment: {},
      demo: true,
    });
  }

  try {
    const [weeklySchedule, camps, privateSlots, bookedSlots, groupEnrollment] =
      await Promise.all([
        getWeeklySchedule(),
        getCamps(),
        getPrivateSlots(),
        safeGetBookedSlots().catch(() => []),
        safeGetGroupEnrollment().catch(() => ({})),
      ]);

    return NextResponse.json({
      weeklySchedule,
      camps,
      privateSlots: privateSlots.filter((s) => s.available),
      bookedSlots,
      groupEnrollment,
    });
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json({
      weeklySchedule: demoWeeklySchedule,
      camps: demoCamps,
      privateSlots: demoPrivateSlots,
      bookedSlots: [],
      groupEnrollment: {},
      demo: true,
    });
  }
}
