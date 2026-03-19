"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";

interface WeeklySession {
  group: string;
  day: string;
  startTime: string;
  endTime: string;
  location: string;
  maxSpots: number;
}

interface Camp {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  time: string;
  location: string;
  maxSpots: number;
  currentEnrolled: number;
  price: string;
  description: string;
}

interface PrivateSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  available: boolean;
}

type BookingType = "weekly" | "camp" | "private" | "group-private";

// Parse "4:00 PM" → minutes since midnight
function parseTime(t: string): number {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const mins = parseInt(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + mins;
}

function getSessionDuration(startTime: string, endTime: string): number {
  return parseTime(endTime) - parseTime(startTime);
}

function getPrivatePrice(durationMin: number, kidCount: number): number {
  const ratio = durationMin / 60;
  const basePrice = kidCount >= 4 ? 250 : 150;
  return Math.round(basePrice * ratio * 100) / 100;
}

function formatPrice(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

interface BookingModal {
  open: boolean;
  type: BookingType;
  sessionIndex: number;
  sessionDetails: string;
  selectedSlotIndices: number[];
}

// Group weekly sessions by group name for display
function groupByGroup(sessions: WeeklySession[]) {
  const groups: Record<string, WeeklySession[]> = {};
  sessions.forEach((s) => {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  });
  return groups;
}

// Group private slots by date + location for multi-select
function groupSlotsByDay(slots: PrivateSlot[]) {
  const groups: { key: string; date: string; location: string; slots: { slot: PrivateSlot; globalIndex: number }[] }[] = [];
  const map: Record<string, typeof groups[number]> = {};
  slots.forEach((slot, i) => {
    const key = `${slot.date}|${slot.location}`;
    if (!map[key]) {
      map[key] = { key, date: slot.date, location: slot.location, slots: [] };
      groups.push(map[key]);
    }
    map[key].slots.push({ slot, globalIndex: i });
  });
  return groups;
}

// Check if selected slots are consecutive (no gaps)
function areSlotsConsecutive(slots: PrivateSlot[]): boolean {
  if (slots.length <= 1) return true;
  const sorted = [...slots].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (parseTime(sorted[i].startTime) !== parseTime(sorted[i - 1].endTime)) {
      return false;
    }
  }
  return true;
}

function getCombinedTimeRange(slots: PrivateSlot[]): { start: string; end: string; duration: number } {
  const sorted = [...slots].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  const start = sorted[0].startTime;
  const end = sorted[sorted.length - 1].endTime;
  return { start, end, duration: getSessionDuration(start, end) };
}

export default function Home() {
  const [schedule, setSchedule] = useState<WeeklySession[]>([]);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [privateSlots, setPrivateSlots] = useState<PrivateSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());

  const [modal, setModal] = useState<BookingModal>({
    open: false,
    type: "weekly",
    sessionIndex: 0,
    sessionDetails: "",
    selectedSlotIndices: [],
  });

  // Form state
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [kids, setKids] = useState([{ name: "", dob: "", grade: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSchedule(data.weeklySchedule || []);
          setCamps(data.camps || []);
          setPrivateSlots(data.privateSlots || []);
        }
      })
      .catch(() => setError("Failed to load schedule"))
      .finally(() => setLoading(false));
  }, []);

  const slotGroups = useMemo(() => groupSlotsByDay(privateSlots), [privateSlots]);

  // Validate current selection
  const selectedSlotObjects = useMemo(() => {
    return Array.from(selectedSlots).map((i) => privateSlots[i]).filter(Boolean);
  }, [selectedSlots, privateSlots]);

  const selectionValid = useMemo(() => {
    if (selectedSlotObjects.length === 0) return false;
    // All must be same date + location
    const date = selectedSlotObjects[0].date;
    const loc = selectedSlotObjects[0].location;
    const sameGroup = selectedSlotObjects.every((s) => s.date === date && s.location === loc);
    return sameGroup && areSlotsConsecutive(selectedSlotObjects);
  }, [selectedSlotObjects]);

  const selectionSummary = useMemo(() => {
    if (!selectionValid || selectedSlotObjects.length === 0) return null;
    const { start, end, duration } = getCombinedTimeRange(selectedSlotObjects);
    const price = getPrivatePrice(duration, 1);
    return {
      date: selectedSlotObjects[0].date,
      location: selectedSlotObjects[0].location,
      start,
      end,
      duration,
      price,
    };
  }, [selectionValid, selectedSlotObjects]);

  function toggleSlot(globalIndex: number) {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(globalIndex)) {
        next.delete(globalIndex);
      } else {
        // Check if adding this slot would mix dates/locations
        const newSlot = privateSlots[globalIndex];
        const existing = Array.from(next).map((i) => privateSlots[i]).filter(Boolean);
        if (existing.length > 0) {
          const sameGroup = existing[0].date === newSlot.date && existing[0].location === newSlot.location;
          if (!sameGroup) {
            // Clear previous selection and start fresh
            return new Set([globalIndex]);
          }
        }
        next.add(globalIndex);
      }
      return next;
    });
  }

  function openPrivateModal() {
    if (!selectionSummary) return;
    const indices = Array.from(selectedSlots);
    const details = `Private Session — ${selectionSummary.date} ${selectionSummary.start}-${selectionSummary.end} (${selectionSummary.duration} min) at ${selectionSummary.location}`;
    setModal({
      open: true,
      type: "private",
      sessionIndex: indices[0],
      sessionDetails: details,
      selectedSlotIndices: indices,
    });
    setSubmitResult(null);
    setParentName("");
    setEmail("");
    setPhone("");
    setKids([{ name: "", dob: "", grade: "" }]);
  }

  function openModal(
    type: BookingType,
    sessionIndex: number,
    details: string
  ) {
    setModal({ open: true, type, sessionIndex, sessionDetails: details, selectedSlotIndices: [] });
    setSubmitResult(null);
    setParentName("");
    setEmail("");
    setPhone("");
    setKids([{ name: "", dob: "", grade: "" }]);
  }

  function closeModal() {
    setModal((m) => ({ ...m, open: false }));
  }

  function addKid() {
    setKids((k) => [...k, { name: "", dob: "", grade: "" }]);
  }

  function removeKid(i: number) {
    setKids((k) => k.filter((_, idx) => idx !== i));
  }

  function updateKid(i: number, field: "name" | "dob" | "grade", value: string) {
    setKids((k) => k.map((kid, idx) => (idx === i ? { ...kid, [field]: value } : kid)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);

    const totalParticipants = kids.length;
    let bookingType = modal.type;

    // Auto-determine private vs group-private
    if (bookingType === "private" || bookingType === "group-private") {
      bookingType = totalParticipants >= 4 ? "group-private" : "private";
    }

    const kidsStr = kids.map((k) => `${k.name} (DOB: ${k.dob}, Grade: ${k.grade})`).join(", ");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName,
          email,
          phone,
          kids: kidsStr,
          type: bookingType,
          sessionDetails: modal.sessionDetails,
          sessionIndex: modal.sessionIndex,
          totalParticipants,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitResult({
          success: true,
          message: "Registration confirmed! Check your email for details.",
        });
        setSelectedSlots(new Set());
        // Refresh schedule data
        const fresh = await fetch("/api/schedule").then((r) => r.json());
        setSchedule(fresh.weeklySchedule || []);
        setCamps(fresh.camps || []);
        setPrivateSlots(fresh.privateSlots || []);
      } else {
        setSubmitResult({ success: false, message: data.error });
      }
    } catch {
      setSubmitResult({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const priceLabel = (() => {
    if (modal.type !== "private" && modal.type !== "group-private") return null;
    // Use combined duration from selected slots
    if (modal.selectedSlotIndices.length > 0) {
      const slots = modal.selectedSlotIndices.map((i) => privateSlots[i]).filter(Boolean);
      if (slots.length === 0) return null;
      const { duration } = getCombinedTimeRange(slots);
      const price = getPrivatePrice(duration, kids.length);
      const tier = kids.length >= 4 ? "Group Private — 4+ participants" : "Private — up to 3 participants";
      const timeNote = duration !== 60 ? ` (${duration} min session)` : "";
      return `${formatPrice(price)} (${tier})${timeNote}`;
    }
    const slot = privateSlots[modal.sessionIndex];
    if (!slot) return null;
    const duration = getSessionDuration(slot.startTime, slot.endTime);
    const price = getPrivatePrice(duration, kids.length);
    const tier = kids.length >= 4 ? "Group Private — 4+ participants" : "Private — up to 3 participants";
    const timeNote = duration !== 60 ? ` (${duration} min session)` : "";
    return `${formatPrice(price)} (${tier})${timeNote}`;
  })();

  const grouped = groupByGroup(schedule);

  return (
    <div className="min-h-screen bg-mesa-dark text-white">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-mesa-dark via-brown-900 to-brown-800">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
              MESA BASKETBALL TRAINING
            </h1>
            <p className="mt-4 text-lg text-brown-300 md:text-xl">
              With Former Division I Player{" "}
              <span className="font-semibold text-mesa-accent">
                Artemios Gavalas
              </span>
            </p>
            <p className="mt-2 text-brown-400">
              St. John&apos;s &bull; Butler &bull; Professional (Greece)
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <a
                href="#schedule"
                className="rounded-lg bg-mesa-accent px-6 py-3 font-semibold text-white transition hover:bg-amber-600"
              >
                Group Schedule
              </a>
              <a
                href="#camps"
                className="rounded-lg border border-brown-500 px-6 py-3 font-semibold text-brown-200 transition hover:bg-brown-800"
              >
                Mini Camps
              </a>
              <a
                href="#private"
                className="rounded-lg border border-brown-500 px-6 py-3 font-semibold text-brown-200 transition hover:bg-brown-800"
              >
                Book Private Session
              </a>
            </div>
          </div>
        </div>
        {/* Photo row */}
        <div className="mx-auto flex max-w-5xl justify-center gap-4 px-6 pb-12">
          <div className="relative h-48 w-1/3 overflow-hidden rounded-xl md:h-64">
            <Image
              src="/photo1.jpg"
              alt="Artemios Gavalas training"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div className="relative h-48 w-1/3 overflow-hidden rounded-xl md:h-64">
            <Image
              src="/photo2.jpg"
              alt="Artemios Gavalas playing"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
      </header>

      {/* What to Expect */}
      <section className="bg-brown-900/50 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold">What to Expect</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl bg-brown-800/60 p-6">
              <div className="mb-3 text-3xl">🏀</div>
              <h3 className="font-semibold text-mesa-accent">
                Skill Development
              </h3>
              <p className="mt-2 text-sm text-brown-300">
                Expert guidance on shooting, dribbling, ball handling & more
              </p>
            </div>
            <div className="rounded-xl bg-brown-800/60 p-6">
              <div className="mb-3 text-3xl">💪</div>
              <h3 className="font-semibold text-mesa-accent">
                High Energy Drills
              </h3>
              <p className="mt-2 text-sm text-brown-300">
                Build confidence, skill, and game IQ through competitive drills
              </p>
            </div>
            <div className="rounded-xl bg-brown-800/60 p-6">
              <div className="mb-3 text-3xl">🎓</div>
              <h3 className="font-semibold text-mesa-accent">
                D1 Experience
              </h3>
              <p className="mt-2 text-sm text-brown-300">
                Knowledge from playing at St. John&apos;s, Butler, and
                professionally in Greece
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Weekly Schedule */}
      <section id="schedule" className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold">Weekly Schedule</h2>
          <p className="mt-2 text-center text-brown-400">
            Group training sessions — spots are limited to 12 per session
          </p>

          {loading && (
            <p className="mt-8 text-center text-brown-400">
              Loading schedule...
            </p>
          )}
          {error && (
            <p className="mt-8 text-center text-red-400">{error}</p>
          )}

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {Object.entries(grouped).map(([group, sessions]) => (
              <div
                key={group}
                className="rounded-xl border border-brown-700 bg-brown-900/40 p-6"
              >
                <h3 className="mb-4 text-lg font-bold text-mesa-accent">
                  {group}
                </h3>
                <div className="space-y-3">
                  {sessions.map((s, i) => {
                    const globalIndex = schedule.indexOf(s);
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-brown-800/50 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">
                            {s.day} {s.startTime} - {s.endTime}
                          </p>
                          <p className="text-sm text-brown-400">{s.location}</p>
                        </div>
                        <button
                          onClick={() =>
                            openModal(
                              "weekly",
                              globalIndex,
                              `${group} — ${s.day} ${s.startTime}-${s.endTime} at ${s.location}`
                            )
                          }
                          className="rounded bg-mesa-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-600"
                        >
                          Register
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mini Camps */}
      <section id="camps" className="bg-brown-900/30 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold">Mini Camps</h2>
          <p className="mt-2 text-center text-brown-400">
            Summer &amp; break camps — register early, spots fill fast (max 20
            per camp)
          </p>

          {camps.length === 0 && !loading && (
            <p className="mt-8 text-center text-brown-500">
              No upcoming camps scheduled. Check back soon!
            </p>
          )}

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {camps.map((camp, i) => {
              const spotsLeft = camp.maxSpots - camp.currentEnrolled;
              const full = spotsLeft <= 0;
              return (
                <div
                  key={camp.id}
                  className="rounded-xl border border-brown-700 bg-brown-900/40 p-6"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-mesa-accent">
                        {camp.name}
                      </h3>
                      <p className="text-sm text-brown-300">
                        {camp.startDate} — {camp.endDate}
                      </p>
                    </div>
                    <span className="rounded-full bg-brown-800 px-3 py-1 text-sm font-semibold text-mesa-accent">
                      {camp.price}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-brown-400">
                    {camp.time} &bull; {camp.location}
                  </p>
                  {camp.description && (
                    <p className="mt-2 text-sm text-brown-300">
                      {camp.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={`text-sm font-medium ${full ? "text-red-400" : spotsLeft <= 5 ? "text-yellow-400" : "text-green-400"}`}
                    >
                      {full
                        ? "FULL"
                        : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
                    </span>
                    {!full && (
                      <button
                        onClick={() =>
                          openModal(
                            "camp",
                            i,
                            `${camp.name} (${camp.startDate} — ${camp.endDate}) at ${camp.location}`
                          )
                        }
                        className="rounded bg-mesa-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                      >
                        Register
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Private Sessions */}
      <section id="private" className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold">Private Sessions</h2>
          <div className="mt-4 flex flex-wrap justify-center gap-6">
            <div className="rounded-lg bg-brown-800/60 px-4 py-2 text-center">
              <p className="text-lg font-bold text-mesa-accent">$150 / 60 min</p>
              <p className="text-xs text-brown-400">Up to 3 participants</p>
            </div>
            <div className="rounded-lg bg-brown-800/60 px-4 py-2 text-center">
              <p className="text-lg font-bold text-mesa-accent">$250 / 60 min</p>
              <p className="text-xs text-brown-400">Group Private (4+ kids)</p>
            </div>
          </div>
          <p className="mt-2 text-center text-sm text-brown-500">
            Prorated for shorter sessions &bull; Payment in person — Cash, Venmo, or Zelle
          </p>
          <p className="mt-1 text-center text-sm text-brown-500">
            Select one or more consecutive time slots to combine them
          </p>

          {privateSlots.length === 0 && !loading && (
            <p className="mt-8 text-center text-brown-500">
              No available slots right now. Check back soon or contact Artemios
              directly.
            </p>
          )}

          {/* Selection summary bar */}
          {selectionSummary && (
            <div className="sticky top-0 z-40 mt-6 flex items-center justify-between rounded-xl bg-mesa-accent/20 border border-mesa-accent/40 px-5 py-3">
              <div>
                <p className="font-semibold text-mesa-accent">
                  {selectionSummary.date} &bull; {selectionSummary.start} - {selectionSummary.end} ({selectionSummary.duration} min)
                </p>
                <p className="text-sm text-brown-300">
                  {selectionSummary.location} &bull; From {formatPrice(selectionSummary.price)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSlots(new Set())}
                  className="rounded bg-brown-700 px-3 py-2 text-sm text-brown-300 hover:bg-brown-600"
                >
                  Clear
                </button>
                <button
                  onClick={openPrivateModal}
                  className="rounded bg-mesa-accent px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Book Selected
                </button>
              </div>
            </div>
          )}

          {selectedSlots.size > 0 && !selectionValid && (
            <p className="mt-4 text-center text-sm text-yellow-400">
              Selected slots must be consecutive. Deselect non-adjacent slots.
            </p>
          )}

          <div className="mt-6 space-y-6">
            {slotGroups.map((group) => (
              <div key={group.key} className="rounded-xl border border-brown-700 bg-brown-900/40 p-5">
                <h3 className="mb-3 font-semibold text-brown-200">
                  {group.date} <span className="text-sm font-normal text-brown-500">&bull; {group.location}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {group.slots.map(({ slot, globalIndex }) => {
                    const isSelected = selectedSlots.has(globalIndex);
                    const duration = getSessionDuration(slot.startTime, slot.endTime);
                    return (
                      <button
                        key={slot.id}
                        onClick={() => toggleSlot(globalIndex)}
                        className={`rounded-lg border px-4 py-2 text-left text-sm transition ${
                          isSelected
                            ? "border-mesa-accent bg-mesa-accent/20 text-white"
                            : "border-brown-700 bg-brown-800/50 text-brown-300 hover:border-brown-500"
                        }`}
                      >
                        <span className="font-medium">{slot.startTime} - {slot.endTime}</span>
                        <span className="ml-1 text-xs text-brown-500">({duration}m)</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Footer */}
      <footer className="border-t border-brown-800 bg-mesa-dark py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold">Get in Touch</h2>
          <div className="mt-4 space-y-1 text-brown-300">
            <p>
              <span className="font-semibold text-white">Call / Text:</span>{" "}
              <a href="tel:6315991280" className="hover:text-mesa-accent">
                (631) 599-1280
              </a>
            </p>
            <p>
              <span className="font-semibold text-white">Email:</span>{" "}
              <a
                href="mailto:artemios@mesabasketballtraining.com"
                className="hover:text-mesa-accent"
              >
                artemios@mesabasketballtraining.com
              </a>
            </p>
          </div>
          <p className="mt-8 text-sm text-brown-600">
            &copy; {new Date().getFullYear()} Mesa Basketball Training. All
            rights reserved.
          </p>
        </div>
      </footer>

      {/* Registration Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-brown-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {modal.type === "camp"
                  ? "Camp Registration"
                  : modal.type === "weekly"
                    ? "Session Registration"
                    : "Book Private Session"}
              </h3>
              <button
                onClick={closeModal}
                className="text-2xl text-brown-400 hover:text-white"
              >
                &times;
              </button>
            </div>
            <p className="mt-1 text-sm text-brown-400">
              {modal.sessionDetails}
            </p>

            {submitResult?.success ? (
              <div className="mt-6 rounded-lg bg-green-900/50 p-4 text-center">
                <p className="text-lg font-semibold text-green-400">
                  {submitResult.message}
                </p>
                <button
                  onClick={closeModal}
                  className="mt-4 rounded bg-brown-700 px-4 py-2 text-sm hover:bg-brown-600"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-brown-300">
                    Parent / Guardian Name
                  </label>
                  <input
                    type="text"
                    required
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="w-full rounded-lg border border-brown-700 bg-brown-800 px-3 py-2 text-white placeholder-brown-500 focus:border-mesa-accent focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-brown-300">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-brown-700 bg-brown-800 px-3 py-2 text-white placeholder-brown-500 focus:border-mesa-accent focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-brown-300">
                      Phone
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-lg border border-brown-700 bg-brown-800 px-3 py-2 text-white placeholder-brown-500 focus:border-mesa-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-brown-300">
                      Kid(s)
                    </label>
                    <button
                      type="button"
                      onClick={addKid}
                      className="text-sm text-mesa-accent hover:text-amber-400"
                    >
                      + Add another kid
                    </button>
                  </div>
                  {kids.map((kid, i) => (
                    <div key={i} className="mb-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Name"
                        required
                        value={kid.name}
                        onChange={(e) => updateKid(i, "name", e.target.value)}
                        className="flex-1 rounded-lg border border-brown-700 bg-brown-800 px-3 py-2 text-white placeholder-brown-500 focus:border-mesa-accent focus:outline-none"
                      />
                      <input
                        type="date"
                        required
                        value={kid.dob}
                        onChange={(e) => updateKid(i, "dob", e.target.value)}
                        className="w-36 rounded-lg border border-brown-700 bg-brown-800 px-3 py-2 text-white placeholder-brown-500 focus:border-mesa-accent focus:outline-none"
                        title="Date of Birth"
                      />
                      <input
                        type="text"
                        placeholder="Grade"
                        required
                        value={kid.grade}
                        onChange={(e) => updateKid(i, "grade", e.target.value)}
                        className="w-20 rounded-lg border border-brown-700 bg-brown-800 px-3 py-2 text-white placeholder-brown-500 focus:border-mesa-accent focus:outline-none"
                      />
                      {kids.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeKid(i)}
                          className="text-brown-500 hover:text-red-400"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {priceLabel && (
                  <p className="rounded-lg bg-brown-800 px-3 py-2 text-sm text-mesa-accent">
                    {priceLabel}
                  </p>
                )}

                {submitResult && !submitResult.success && (
                  <p className="text-sm text-red-400">{submitResult.message}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-mesa-accent py-3 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Confirm Registration"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
