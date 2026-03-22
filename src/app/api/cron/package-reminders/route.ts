import { NextRequest, NextResponse } from "next/server";
import { getPackagesNeedingReminder, markReminderSent } from "@/lib/supabase";
import { sendPackageReminder } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Last day of current month
  const lastDay = new Date(year, month + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();

  if (daysLeft !== 3) {
    return NextResponse.json({ sent: 0, message: `daysLeft=${daysLeft}, skipping` });
  }

  const monthYear = `${year}-${String(month + 1).padStart(2, "0")}`;
  const packages = await getPackagesNeedingReminder(monthYear);

  let sent = 0;
  for (const pkg of packages) {
    try {
      await sendPackageReminder({
        parentName: pkg.parent_name,
        email: pkg.email,
        packageType: pkg.package_type,
        sessionsUsed: pkg.sessions_used,
        monthYear: pkg.month_year,
      });
      await markReminderSent(pkg.id);
      sent++;
    } catch (err) {
      console.error(`Failed to send reminder for package ${pkg.id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
