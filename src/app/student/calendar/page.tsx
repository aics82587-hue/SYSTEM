import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { getPhilippineHolidays, Holiday } from "@/lib/holidays";

interface SlotRow {
  id?: string;
  counselor_id: string;
  slot_date: string; // YYYY-MM-DD
  max_slots: number;
  booked_slots: number;
  is_blocked: boolean;
  block_reason?: string | null;
  is_online_only: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function padZero(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${padZero(month + 1)}-${padZero(day)}`;
}

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function StudentCalendarPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("public_name, avatar_id, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "student" && profile?.role !== "community_member") redirect("/login");
  const role = profile.role as "student" | "community_member";

  // 2. Parse searchParams for month navigation
  const params = await searchParams;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  let viewYear = params.year ? parseInt(params.year, 10) : currentYear;
  let viewMonth = params.month ? parseInt(params.month, 10) : currentMonth;

  if (isNaN(viewYear) || viewYear < 2020 || viewYear > 2050) viewYear = currentYear;
  if (isNaN(viewMonth) || viewMonth < 0 || viewMonth > 11) viewMonth = currentMonth;

  // 3. Fetch Philippine holidays for the view year
  const holidays: Holiday[] = await getPhilippineHolidays(viewYear);
  const holidaysMap = new Map<string, Holiday>();
  holidays.forEach(h => holidaysMap.set(h.date, h));

  // 4. Fetch consultation slots for current & next month range
  const startRange = toDateKey(viewYear, viewMonth, 1);
  const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const daysInNextMonth = new Date(nextMonthYear, nextMonth + 1, 0).getDate();
  const endRange = toDateKey(nextMonthYear, nextMonth, daysInNextMonth);

  const { data: rawSlots } = await supabase
    .from("consultation_slots")
    .select("*")
    .gte("slot_date", startRange)
    .lte("slot_date", endRange);

  const slotsMap = new Map<string, SlotRow>();
  (rawSlots ?? []).forEach((s: SlotRow) => slotsMap.set(s.slot_date, s));

  // Navigation URLs
  const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
  const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextM = viewMonth === 11 ? 0 : viewMonth + 1;

  const prevMonthUrl = `/student/calendar?year=${prevY}&month=${prevM}`;
  const nextMonthUrl = `/student/calendar?year=${nextY}&month=${nextM}`;
  const currentMonthUrl = `/student/calendar?year=${currentYear}&month=${currentMonth}`;

  // 5. Generate Calendar Grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const todayKey = toDateKey(now.getFullYear(), now.getMonth(), now.getDate());

  const calendarCells = [];

  // Leading cells
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const pY = viewMonth === 0 ? viewYear - 1 : viewYear;
    const pM = viewMonth === 0 ? 11 : viewMonth - 1;
    const key = toDateKey(pY, pM, day);
    const dObj = new Date(pY, pM, day);
    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

    calendarCells.push({
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: false,
      isWeekend,
      holiday: holidaysMap.get(key),
      slot: slotsMap.get(key),
      isToday: false,
      isPast: key < todayKey,
    });
  }

  // Current month cells
  for (let day = 1; day <= daysInMonth; day++) {
    const key = toDateKey(viewYear, viewMonth, day);
    const dObj = new Date(viewYear, viewMonth, day);
    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

    calendarCells.push({
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: true,
      isWeekend,
      holiday: holidaysMap.get(key),
      slot: slotsMap.get(key),
      isToday: key === todayKey,
      isPast: key < todayKey,
    });
  }

  // Trailing cells
  const totalCells = calendarCells.length;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let day = 1; day <= remaining; day++) {
    const nY = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nM = viewMonth === 11 ? 0 : viewMonth + 1;
    const key = toDateKey(nY, nM, day);
    const dObj = new Date(nY, nM, day);
    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

    calendarCells.push({
      dateKey: key,
      dayNumber: day,
      isCurrentMonth: false,
      isWeekend,
      holiday: holidaysMap.get(key),
      slot: slotsMap.get(key),
      isToday: false,
      isPast: key < todayKey,
    });
  }

  return (
    <>
      <Navbar role={role} nickname={profile.public_name} avatarId={profile.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role={role} nickname={profile.public_name} avatarId={profile.avatar_id} />
        <main className="dashboard-main">
          {/* Header */}
          <div className="section-header" style={{ marginBottom: "1.5rem" }}>
            <div>
              <h1 className="section-title">Counseling Schedule</h1>
              <p className="text-muted text-sm" style={{ marginTop: "0.25rem" }}>
                Browse available consultation dates. Click any open day to book your counseling session.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Link
                href={currentMonthUrl}
                className="btn btn-secondary btn-sm"
                title="Return to current month"
              >
                Today
              </Link>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                <Link
                  href={prevMonthUrl}
                  className="btn btn-secondary btn-sm"
                  aria-label="Previous Month"
                  title="Previous month"
                >
                  ‹
                </Link>
                <Link
                  href={nextMonthUrl}
                  className="btn btn-secondary btn-sm"
                  aria-label="Next Month"
                  title="Next month"
                >
                  ›
                </Link>
              </div>
            </div>
          </div>

          {/* Month Heading */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
              background: "var(--bg-card)",
              padding: "0.85rem 1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-light)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700 }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <Link
              href="/student/appointments"
              className="btn btn-primary btn-sm"
              title="View my booked appointments"
            >
              My Appointments →
            </Link>
          </div>

          {/* Calendar Grid Container */}
          <div
            className="card"
            style={{
              padding: "1rem",
              marginBottom: "1.5rem",
              overflowX: "auto",
            }}
          >
            {/* Weekday headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(110px, 1fr))",
                gap: "0.5rem",
                textAlign: "center",
                fontWeight: 600,
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                paddingBottom: "0.5rem",
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              {WEEKDAYS.map(day => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Cells Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(110px, 1fr))",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              {calendarCells.map(cell => {
                const slot = cell.slot;
                const isBlocked = slot?.is_blocked ?? false;
                const maxSlots = slot?.max_slots ?? 8;
                const bookedSlots = slot?.booked_slots ?? 0;
                const availableSlots = Math.max(0, maxSlots - bookedSlots);
                const isFull = maxSlots > 0 && availableSlots === 0;

                // Online only if slot says so OR weekend OR holiday
                const isOnlineOnly = slot ? slot.is_online_only : (cell.isWeekend || !!cell.holiday);

                // Clickable ONLY if has available slots, not blocked, not past, and is current month
                const isClickable =
                  cell.isCurrentMonth &&
                  !cell.isPast &&
                  !isBlocked &&
                  availableSlots > 0;

                // Styling logic
                let borderStyle = "var(--border-light)";
                let bgStyle = "rgba(22, 22, 42, 0.4)";
                let badgeClass = "badge-muted";
                let statusLabel = "";

                if (cell.isPast) {
                  statusLabel = "Past Date";
                  borderStyle = "rgba(255, 255, 255, 0.05)";
                  bgStyle = "rgba(15, 15, 26, 0.3)";
                } else if (isBlocked) {
                  statusLabel = slot?.block_reason ? `Blocked (${slot.block_reason})` : "Blocked";
                  badgeClass = "badge-danger";
                  borderStyle = "rgba(248, 113, 113, 0.3)";
                  bgStyle = "rgba(248, 113, 113, 0.06)";
                } else if (isFull) {
                  statusLabel = "No slots available";
                  badgeClass = "badge-warning";
                  borderStyle = "rgba(249, 115, 22, 0.35)";
                  bgStyle = "rgba(249, 115, 22, 0.08)";
                } else if (availableSlots > 0) {
                  statusLabel = `${availableSlots} slot${availableSlots > 1 ? "s" : ""} available`;
                  badgeClass = availableSlots < 3 ? "badge-warning" : "badge-success";
                  borderStyle = "rgba(34, 211, 165, 0.35)";
                  bgStyle = "rgba(34, 211, 165, 0.06)";
                }

                const cellContent = (
                  <div
                    style={{
                      minHeight: 110,
                      padding: "0.6rem",
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${borderStyle}`,
                      background: cell.isCurrentMonth ? bgStyle : "rgba(15, 15, 26, 0.25)",
                      opacity: cell.isCurrentMonth ? (cell.isPast ? 0.45 : 1) : 0.35,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "100%",
                      transition: "all var(--transition)",
                      boxShadow: isClickable ? "0 2px 8px rgba(0,0,0,0.2)" : "none",
                    }}
                  >
                    {/* Top Row: Date & Icons */}
                    <div className="flex items-center justify-between" style={{ width: "100%" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          color: cell.isToday
                            ? "#fff"
                            : cell.isCurrentMonth
                            ? "var(--text-primary)"
                            : "var(--text-muted)",
                          background: cell.isToday ? "var(--brand)" : "transparent",
                          borderRadius: "50%",
                          width: 26,
                          height: 26,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {cell.dayNumber}
                      </span>
                      <div className="flex items-center gap-1">
                        {isOnlineOnly && !cell.isPast && (
                          <span
                            title="Online chat consultation only"
                            style={{ fontSize: "0.8rem" }}
                          >
                            💻
                          </span>
                        )}
                        {cell.holiday && (
                          <span
                            title={`Philippine Public Holiday: ${cell.holiday.name}`}
                            style={{ fontSize: "0.85rem" }}
                          >
                            🇵🇭
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Holiday or Online Notice */}
                    <div style={{ marginTop: "0.2rem", marginBottom: "0.2rem" }}>
                      {cell.holiday && (
                        <p
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--brand-light)",
                            lineHeight: 1.2,
                            margin: 0,
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={cell.holiday.name}
                        >
                          {cell.holiday.name}
                        </p>
                      )}
                      {isOnlineOnly && !cell.holiday && !cell.isPast && (
                        <p
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--text-muted)",
                            margin: 0,
                            lineHeight: 1.2,
                          }}
                        >
                          Online chat only
                        </p>
                      )}
                    </div>

                    {/* Bottom: Availability Status */}
                    <div style={{ marginTop: "auto", paddingTop: "0.25rem" }}>
                      {cell.isPast ? (
                        <span
                          className="badge badge-muted"
                          style={{
                            fontSize: "0.68rem",
                            width: "100%",
                            justifyContent: "center",
                          }}
                        >
                          Past
                        </span>
                      ) : isBlocked ? (
                        <span
                          className="badge badge-danger"
                          style={{
                            fontSize: "0.68rem",
                            width: "100%",
                            justifyContent: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={statusLabel}
                        >
                          ⛔ Blocked
                        </span>
                      ) : isFull ? (
                        <span
                          className="badge badge-warning"
                          style={{
                            fontSize: "0.68rem",
                            width: "100%",
                            justifyContent: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title="No slots available for this day"
                        >
                          🚫 Full
                        </span>
                      ) : (
                        <span
                          className={`badge ${badgeClass}`}
                          style={{
                            fontSize: "0.68rem",
                            width: "100%",
                            justifyContent: "center",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={`Click to book on this date (${statusLabel})`}
                        >
                          🟢 {statusLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );

                if (isClickable) {
                  return (
                    <Link
                      key={cell.dateKey}
                      href={`/student/appointments?date=${cell.dateKey}`}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                      }}
                      title={`Book consultation on ${cell.dateKey} (${availableSlots} slots available)`}
                    >
                      {cellContent}
                    </Link>
                  );
                }

                return (
                  <div
                    key={cell.dateKey}
                    title={
                      cell.isPast
                        ? "Past date"
                        : isBlocked
                        ? "Consultations blocked on this date"
                        : isFull
                        ? "All slots booked on this date"
                        : undefined
                    }
                  >
                    {cellContent}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div
            className="card card-sm"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
              background: "var(--bg-card)",
            }}
          >
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              CALENDAR GUIDE:
            </span>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div className="flex items-center gap-1">
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "var(--success)",
                  }}
                />
                <span className="text-sm">Available (Click to request appointment)</span>
              </div>
              <div className="flex items-center gap-1">
                <span title="Online chat consultation" style={{ fontSize: "0.9rem" }}>
                  💻
                </span>
                <span className="text-sm">Online chat consultation only</span>
              </div>
              <div className="flex items-center gap-1">
                <span title="No slots available" style={{ fontSize: "0.9rem" }}>
                  🚫
                </span>
                <span className="text-sm">Full (No slots available)</span>
              </div>
              <div className="flex items-center gap-1">
                <span title="Blocked" style={{ fontSize: "0.9rem" }}>
                  ⛔
                </span>
                <span className="text-sm">Blocked</span>
              </div>
              <div className="flex items-center gap-1">
                <span title="Philippine Holiday" style={{ fontSize: "0.9rem" }}>
                  🇵🇭
                </span>
                <span className="text-sm">Philippine Public Holiday</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
