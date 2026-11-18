"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastProvider";
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

export default function CounselorCalendarPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [counselorId, setCounselorId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ public_name?: string; avatar_id?: string; role?: string }>({});
  const [loading, setLoading] = useState(true);

  // Calendar navigation state (defaults to today)
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Data
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Selected day for settings modal
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [modalMaxSlots, setModalMaxSlots] = useState<number>(8);
  const [modalIsBlocked, setModalIsBlocked] = useState<boolean>(false);
  const [modalBlockReason, setModalBlockReason] = useState<string>("");
  const [modalIsOnlineOnly, setModalIsOnlineOnly] = useState<boolean>(false);
  const [savingSlot, setSavingSlot] = useState<boolean>(false);

  // Auth check
  useEffect(() => {
    async function initAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("public_name, avatar_id, role")
        .eq("id", user.id)
        .single();

      if (prof?.role !== "counselor") {
        router.push("/login");
        return;
      }

      setCounselorId(user.id);
      setProfile(prof);
    }

    initAuth();
  }, [router]);

  // Load Philippine holidays when year changes
  useEffect(() => {
    let cancelled = false;
    async function loadHolidays() {
      const data = await getPhilippineHolidays(viewYear);
      if (!cancelled) {
        setHolidays(data);
      }
    }
    loadHolidays();
    return () => {
      cancelled = true;
    };
  }, [viewYear]);

  // Fetch consultation slots for current & adjacent months
  const loadSlots = useCallback(async () => {
    if (!counselorId) return;
    setLoading(true);

    try {
      const supabase = createClient();

      // Range covering current view month + next month
      const startRange = toDateKey(viewYear, viewMonth, 1);
      const nextMonthYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const daysInNextMonth = new Date(nextMonthYear, nextMonth + 1, 0).getDate();
      const endRange = toDateKey(nextMonthYear, nextMonth, daysInNextMonth);

      const { data, error } = await supabase
        .from("consultation_slots")
        .select("*")
        .eq("counselor_id", counselorId)
        .gte("slot_date", startRange)
        .lte("slot_date", endRange);

      if (error) throw error;
      setSlots(data ?? []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to load consultation slots", "error");
    } finally {
      setLoading(false);
    }
  }, [counselorId, viewYear, viewMonth, showToast]);

  useEffect(() => {
    if (counselorId) {
      loadSlots();
    }
  }, [counselorId, loadSlots]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  // Map slots & holidays by date string for O(1) lookup
  const slotsMap = useMemo(() => {
    const map = new Map<string, SlotRow>();
    slots.forEach(s => map.set(s.slot_date, s));
    return map;
  }, [slots]);

  const holidaysMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach(h => map.set(h.date, h));
    return map;
  }, [holidays]);

  // Calendar cells generation for viewMonth
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // 0 = Mon, 6 = Sun

  // Days array: leading blanks + days of month
  const calendarCells = useMemo(() => {
    const cells: Array<{
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      holiday?: Holiday;
      slot?: SlotRow;
      isToday: boolean;
    }> = [];

    // Leading empty slots from previous month for grid alignment
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const key = toDateKey(prevY, prevM, day);
      const dObj = new Date(prevY, prevM, day);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

      cells.push({
        dateKey: key,
        dayNumber: day,
        isCurrentMonth: false,
        isWeekend,
        holiday: holidaysMap.get(key),
        slot: slotsMap.get(key),
        isToday: false,
      });
    }

    // Days in current month
    const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    for (let day = 1; day <= daysInMonth; day++) {
      const key = toDateKey(viewYear, viewMonth, day);
      const dObj = new Date(viewYear, viewMonth, day);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

      cells.push({
        dateKey: key,
        dayNumber: day,
        isCurrentMonth: true,
        isWeekend,
        holiday: holidaysMap.get(key),
        slot: slotsMap.get(key),
        isToday: key === todayKey,
      });
    }

    // Trailing cells to fill remaining grid to full weeks (multiples of 7)
    const totalCells = cells.length;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const key = toDateKey(nextY, nextM, day);
      const dObj = new Date(nextY, nextM, day);
      const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;

      cells.push({
        dateKey: key,
        dayNumber: day,
        isCurrentMonth: false,
        isWeekend,
        holiday: holidaysMap.get(key),
        slot: slotsMap.get(key),
        isToday: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth, daysInMonth, firstDayWeekday, holidaysMap, slotsMap, today]);

  // Open day settings modal
  const openDaySettings = (dateKey: string) => {
    const dParts = dateKey.split("-").map(Number);
    const dObj = new Date(dParts[0], dParts[1] - 1, dParts[2]);
    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
    const holiday = holidaysMap.get(dateKey);
    const existing = slotsMap.get(dateKey);

    setSelectedDayKey(dateKey);
    setModalMaxSlots(existing?.max_slots ?? 8);
    setModalIsBlocked(existing?.is_blocked ?? false);
    setModalBlockReason(existing?.block_reason ?? "");

    // Weekends and holidays default to online-only
    const defaultOnlineOnly = isWeekend || !!holiday;
    setModalIsOnlineOnly(existing ? existing.is_online_only : defaultOnlineOnly);
  };

  const closeDaySettings = () => {
    setSelectedDayKey(null);
    setSavingSlot(false);
  };

  // Save day settings (Upsert)
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counselorId || !selectedDayKey) return;

    setSavingSlot(true);
    try {
      const supabase = createClient();
      const existing = slotsMap.get(selectedDayKey);

      const payload: SlotRow = {
        counselor_id: counselorId,
        slot_date: selectedDayKey,
        max_slots: Math.max(0, modalMaxSlots),
        booked_slots: existing?.booked_slots ?? 0,
        is_blocked: modalIsBlocked,
        block_reason: modalIsBlocked && modalBlockReason.trim() ? modalBlockReason.trim() : null,
        is_online_only: modalIsOnlineOnly,
      };

      const { data, error } = await supabase
        .from("consultation_slots")
        .upsert(payload, { onConflict: "counselor_id, slot_date" })
        .select()
        .single();

      if (error) throw error;

      // Update state immediately
      setSlots(prev => {
        const idx = prev.findIndex(s => s.slot_date === selectedDayKey);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data as SlotRow;
          return next;
        }
        return [...prev, data as SlotRow];
      });

      showToast(`Settings updated for ${selectedDayKey}`, "success");
      closeDaySettings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to save slot settings", "error");
    } finally {
      setSavingSlot(false);
    }
  };

  // Compute status details for each cell
  const getCellStatus = (cell: (typeof calendarCells)[0]) => {
    const slot = cell.slot;
    const isBlocked = slot?.is_blocked;
    const isOnlineOnly = slot ? slot.is_online_only : (cell.isWeekend || !!cell.holiday);
    const maxSlots = slot?.max_slots ?? 8;
    const bookedSlots = slot?.booked_slots ?? 0;

    if (isBlocked) {
      return {
        label: slot?.block_reason ? `Blocked: ${slot.block_reason}` : "Blocked",
        shortLabel: "Blocked",
        badgeClass: "badge-danger",
        borderStyle: "rgba(248, 113, 113, 0.4)",
        bgStyle: "rgba(248, 113, 113, 0.08)",
        textColor: "var(--danger)",
      };
    }

    if (cell.holiday) {
      return {
        label: `Holiday: ${cell.holiday.name}`,
        shortLabel: "Holiday",
        badgeClass: "badge-brand",
        borderStyle: "rgba(157, 151, 255, 0.4)",
        bgStyle: "rgba(var(--brand-rgb), 0.12)",
        textColor: "var(--brand-light)",
        isOnlineOnly: true,
      };
    }

    if (cell.isWeekend) {
      return {
        label: bookedSlots > 0 ? `${bookedSlots}/${maxSlots} slots` : "Weekend - Online Only",
        shortLabel: "Weekend - Online Only",
        badgeClass: "badge-muted",
        borderStyle: "rgba(255, 255, 255, 0.12)",
        bgStyle: "rgba(255, 255, 255, 0.03)",
        textColor: "var(--text-secondary)",
        isOnlineOnly: true,
      };
    }

    if (maxSlots > 0 && bookedSlots >= maxSlots) {
      return {
        label: `Full (${bookedSlots}/${maxSlots})`,
        shortLabel: "Full",
        badgeClass: "badge-warning",
        borderStyle: "rgba(249, 115, 22, 0.45)",
        bgStyle: "rgba(249, 115, 22, 0.1)",
        textColor: "#FB923C",
      };
    }

    if (bookedSlots > 0 && bookedSlots < maxSlots) {
      return {
        label: `${bookedSlots}/${maxSlots} slots`,
        shortLabel: `${bookedSlots}/${maxSlots} slots`,
        badgeClass: "badge-warning",
        borderStyle: "rgba(251, 191, 36, 0.4)",
        bgStyle: "rgba(251, 191, 36, 0.08)",
        textColor: "var(--warning)",
        isOnlineOnly,
      };
    }

    return {
      label: `${bookedSlots}/${maxSlots} slots`,
      shortLabel: `${bookedSlots}/${maxSlots} slots`,
      badgeClass: "badge-success",
      borderStyle: "rgba(34, 211, 165, 0.35)",
      bgStyle: "rgba(34, 211, 165, 0.06)",
      textColor: "var(--success)",
      isOnlineOnly,
    };
  };

  const selectedCellInfo = useMemo(() => {
    if (!selectedDayKey) return null;
    const parts = selectedDayKey.split("-").map(Number);
    const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
    const holiday = holidaysMap.get(selectedDayKey);
    const existing = slotsMap.get(selectedDayKey);

    return {
      formattedDate: dObj.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      isWeekend,
      holiday,
      existing,
    };
  }, [selectedDayKey, holidaysMap, slotsMap]);

  return (
    <>
      <Navbar role="counselor" nickname={profile.public_name} avatarId={profile.avatar_id} />
      <div className="dashboard-layout">
        <Sidebar role="counselor" nickname={profile.public_name} avatarId={profile.avatar_id} />
        <main className="dashboard-main">
          {/* Header & Controls */}
          <div className="section-header" style={{ marginBottom: "1.5rem" }}>
            <div>
              <h1 className="section-title">Consultation Calendar</h1>
              <p className="text-muted text-sm" style={{ marginTop: "0.25rem" }}>
                Manage daily slots, block unavailable days, and oversee online consultation settings.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleToday}
                title="Jump to current month"
              >
                Today
              </button>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  title="Previous month"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  title="Next month"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Month & Year Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem",
              background: "var(--bg-card)",
              padding: "0.75rem 1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-light)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700 }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {loading && (
                <span className="flex items-center gap-1 text-muted text-sm">
                  <span className="spinner" style={{ width: 14, height: 14 }} /> Syncing…
                </span>
              )}
            </div>
          </div>

          {/* Calendar Grid */}
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

            {/* Day Cells Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(110px, 1fr))",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              {calendarCells.map(cell => {
                const status = getCellStatus(cell);
                const isSelected = selectedDayKey === cell.dateKey;

                return (
                  <div
                    key={cell.dateKey}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDaySettings(cell.dateKey)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDaySettings(cell.dateKey);
                      }
                    }}
                    title={`Click to manage settings for ${cell.dateKey}`}
                    style={{
                      minHeight: 105,
                      padding: "0.6rem",
                      borderRadius: "var(--radius-md)",
                      border: isSelected
                        ? "2px solid var(--brand)"
                        : `1px solid ${status.borderStyle}`,
                      background: cell.isCurrentMonth
                        ? status.bgStyle
                        : "rgba(15, 15, 26, 0.4)",
                      opacity: cell.isCurrentMonth ? 1 : 0.45,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "transform var(--transition), box-shadow var(--transition)",
                      outline: "none",
                    }}
                  >
                    {/* Top Row: Day Number + Today / Online Indicators */}
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
                        {status.isOnlineOnly && (
                          <span
                            title="Online consultation only"
                            style={{ fontSize: "0.8rem" }}
                          >
                            💻
                          </span>
                        )}
                        {cell.holiday && (
                          <span
                            title={`Philippine Holiday: ${cell.holiday.name}`}
                            style={{ fontSize: "0.85rem" }}
                          >
                            🇵🇭
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Holiday or Blocked Note */}
                    {cell.holiday && (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--brand-light)",
                          lineHeight: 1.2,
                          marginTop: "0.2rem",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={cell.holiday.name}
                      >
                        {cell.holiday.name}
                      </div>
                    )}

                    {/* Bottom: Slots Indicator / Badge */}
                    <div style={{ marginTop: "auto", paddingTop: "0.4rem" }}>
                      <span
                        className={`badge ${status.badgeClass}`}
                        style={{
                          fontSize: "0.7rem",
                          padding: "0.15rem 0.45rem",
                          width: "100%",
                          justifyContent: "center",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={status.label}
                      >
                        {status.shortLabel}
                      </span>
                    </div>
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
              CALENDAR LEGEND:
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
                <span className="text-sm">Available (Green)</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "var(--warning)",
                  }}
                />
                <span className="text-sm">Partial (Yellow)</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "#FB923C",
                  }}
                />
                <span className="text-sm">Full (Orange)</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "var(--danger)",
                  }}
                />
                <span className="text-sm">Blocked (Red)</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "var(--brand-light)",
                  }}
                />
                <span className="text-sm">Holiday 🇵🇭</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "var(--text-muted)",
                  }}
                />
                <span className="text-sm">Weekend 💻 (Online Only)</span>
              </div>
            </div>
          </div>

          {/* Day Settings Modal */}
          {selectedDayKey && selectedCellInfo && (
            <div
              className="modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Day Settings"
              onClick={closeDaySettings}
            >
              <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: 500 }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: "1rem" }}>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0 }}>
                      Manage Day Settings
                    </h3>
                    <p className="text-muted text-sm" style={{ marginTop: "0.2rem" }}>
                      {selectedCellInfo.formattedDate}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={closeDaySettings}
                    title="Close settings"
                  >
                    ✕
                  </button>
                </div>

                {/* Holiday / Weekend Notice */}
                {selectedCellInfo.holiday && (
                  <div className="notice notice-brand" style={{ marginBottom: "1rem" }}>
                    <strong>🇵🇭 Philippine Public Holiday:</strong> {selectedCellInfo.holiday.name} ({selectedCellInfo.holiday.localName}). Automatically set to online-only.
                  </div>
                )}
                {selectedCellInfo.isWeekend && !selectedCellInfo.holiday && (
                  <div className="notice" style={{ marginBottom: "1rem" }}>
                    <strong>📅 Weekend:</strong> Standard campus counseling hours are closed; weekend consultations are automatically marked as online only.
                  </div>
                )}

                <form onSubmit={handleSaveSlot} aria-label="Day Settings Form">
                  {/* Max Slots */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="day-max-slots">
                      Max Appointment Slots for this Day
                    </label>
                    <input
                      id="day-max-slots"
                      type="number"
                      min={0}
                      max={40}
                      className="form-input"
                      value={modalMaxSlots}
                      onChange={e => setModalMaxSlots(Number(e.target.value))}
                      required
                    />
                    <span className="form-hint">
                      Currently booked: {selectedCellInfo.existing?.booked_slots ?? 0} slots
                    </span>
                  </div>

                  {/* Block Day Toggle */}
                  <div className="checkbox-group" style={{ marginTop: "1rem" }}>
                    <input
                      id="day-block-toggle"
                      type="checkbox"
                      checked={modalIsBlocked}
                      onChange={e => setModalIsBlocked(e.target.checked)}
                    />
                    <label htmlFor="day-block-toggle">
                      <strong>Block this day</strong>
                      <p className="text-muted text-sm" style={{ margin: 0 }}>
                        Mark day as completely unavailable for all appointment requests.
                      </p>
                    </label>
                  </div>

                  {/* Block Reason (Conditional) */}
                  {modalIsBlocked && (
                    <div className="form-group" style={{ marginLeft: "1.75rem", marginTop: "0.5rem" }}>
                      <label className="form-label" htmlFor="day-block-reason">
                        Reason for Blocking (Optional)
                      </label>
                      <input
                        id="day-block-reason"
                        type="text"
                        className="form-input"
                        placeholder="e.g. Faculty conference, Personal leave, Retreat"
                        value={modalBlockReason}
                        onChange={e => setModalBlockReason(e.target.value)}
                        maxLength={120}
                      />
                    </div>
                  )}

                  {/* Online Only Toggle */}
                  <div className="checkbox-group" style={{ marginTop: "1rem" }}>
                    <input
                      id="day-online-toggle"
                      type="checkbox"
                      checked={modalIsOnlineOnly}
                      onChange={e => setModalIsOnlineOnly(e.target.checked)}
                    />
                    <label htmlFor="day-online-toggle">
                      <strong>Online Only Consultation 💻</strong>
                      <p className="text-muted text-sm" style={{ margin: 0 }}>
                        In-person office visits disabled. Sessions will take place via online chat only.
                      </p>
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={closeDaySettings}
                      disabled={savingSlot}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingSlot}
                    >
                      {savingSlot ? (
                        <>
                          <span className="spinner" style={{ width: 16, height: 16 }} /> Saving…
                        </>
                      ) : (
                        "Save Day Settings"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
