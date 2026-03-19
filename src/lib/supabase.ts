import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase not configured");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export async function addRegistration(data: {
  parentName: string;
  email: string;
  phone: string;
  kids: string;
  type: string;
  sessionDetails: string;
  totalParticipants: number;
  bookedDate?: string;
  bookedStartTime?: string;
  bookedEndTime?: string;
  bookedLocation?: string;
}) {
  const supabase = getSupabase();
  const { error } = await supabase.from("registrations").insert({
    parent_name: data.parentName,
    email: data.email,
    phone: data.phone,
    kids: data.kids,
    type: data.type,
    session_details: data.sessionDetails,
    total_participants: data.totalParticipants,
    booked_date: data.bookedDate || null,
    booked_start_time: data.bookedStartTime || null,
    booked_end_time: data.bookedEndTime || null,
    booked_location: data.bookedLocation || null,
  });
  if (error) throw error;
}

export async function getBookedSlots(): Promise<
  { date: string; startTime: string; endTime: string; location: string }[]
> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("registrations")
    .select("booked_date, booked_start_time, booked_end_time, booked_location")
    .not("booked_date", "is", null)
    .in("type", ["private", "group-private"]);

  if (error) throw error;
  return (data || []).map((r) => ({
    date: r.booked_date,
    startTime: r.booked_start_time,
    endTime: r.booked_end_time,
    location: r.booked_location,
  }));
}
