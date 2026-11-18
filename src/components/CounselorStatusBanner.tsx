"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Props {
  initialStatus?: string | null;
  initialReason?: string | null;
  initialQueueCount?: number;
}

type CounselorStatus = "available" | "in_consultation" | "away" | "not_in_office" | "online_only";

export function CounselorStatusBanner({
  initialStatus,
  initialReason,
  initialQueueCount = 0,
}: Props) {
  const [status, setStatus] = useState<CounselorStatus>(
    (initialStatus as CounselorStatus) || "available"
  );
  const [reason, setReason] = useState<string | null>(initialReason ?? null);
  const [waitingCount, setWaitingCount] = useState<number>(initialQueueCount);
  const [activeCount, setActiveCount] = useState<number>(0);

  useEffect(() => {
    const supabase = createClient();

    // Fetch initial queue counts
    const fetchQueueCounts = async () => {
      try {
        const { count: waiting } = await supabase
          .from("consultation_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "waiting");
        if (typeof waiting === "number") {
          setWaitingCount(waiting);
        }

        const { count: active } = await supabase
          .from("consultation_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "active");
        if (typeof active === "number") {
          setActiveCount(active);
        }
      } catch {
        // Silently catch network or permission errors
      }
    };

    fetchQueueCounts();

    // Subscribe to counselor status changes
    const statusChannel = supabase
      .channel("counselor_status_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "counselor_status" },
        (payload) => {
          if (payload.new && typeof payload.new === "object") {
            const data = payload.new as { status?: CounselorStatus; reason?: string | null };
            if (data.status) {
              setStatus(data.status);
            }
            setReason(data.reason ?? null);
          }
        }
      )
      .subscribe();

    // Subscribe to consultation queue changes to keep waiting & active counts live
    const queueChannel = supabase
      .channel("consultation_queue_banner_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "consultation_queue" },
        () => {
          fetchQueueCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(queueChannel);
    };
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case "available":
        return {
          badgeClass: "badge-success",
          icon: "🟢",
          label: "Available",
          headline: "Guidance Counselor is Available",
          description: "Counselor is currently in the office and ready for walk-in or online consultation.",
          bgStyle: "rgba(34, 211, 165, 0.08)",
          borderStyle: "rgba(34, 211, 165, 0.28)",
          accentColor: "var(--success)",
        };
      case "in_consultation":
        return {
          badgeClass: "badge-danger",
          icon: "🔴",
          label: "In Consultation",
          headline: "Currently in a Counseling Session",
          description: `${activeCount > 0 ? activeCount : 1} student(s) currently being assisted. Send a message to request support.`,
          bgStyle: "rgba(248, 113, 113, 0.08)",
          borderStyle: "rgba(248, 113, 113, 0.3)",
          accentColor: "var(--danger)",
        };
      case "away":
        return {
          badgeClass: "badge-warning",
          icon: "🟡",
          label: "Away",
          headline: "Temporarily Away",
          description: reason ? `Away: ${reason}` : "The counselor stepped away and will be back shortly.",
          bgStyle: "rgba(251, 191, 36, 0.08)",
          borderStyle: "rgba(251, 191, 36, 0.3)",
          accentColor: "var(--warning)",
        };
      case "not_in_office":
        return {
          badgeClass: "badge-muted",
          icon: "⚫",
          label: "Not in Office",
          headline: "Not in Office Today",
          description: "Not available today in person. You may leave an online message or schedule an appointment.",
          bgStyle: "rgba(94, 91, 128, 0.12)",
          borderStyle: "rgba(94, 91, 128, 0.3)",
          accentColor: "var(--text-muted)",
        };
      case "online_only":
        return {
          badgeClass: "badge-brand",
          icon: "🔵",
          label: "Online Only",
          headline: "Online Consultation Only",
          description: "Online consultation only today. Send a private message to reach the counselor directly.",
          bgStyle: "rgba(var(--brand-rgb), 0.12)",
          borderStyle: "rgba(var(--brand-rgb), 0.3)",
          accentColor: "var(--brand-light)",
        };
      default:
        return {
          badgeClass: "badge-brand",
          icon: "🟢",
          label: "Available",
          headline: "Guidance Counselor Status",
          description: "Status is active. You may reach out anytime.",
          bgStyle: "rgba(var(--brand-rgb), 0.08)",
          borderStyle: "rgba(var(--brand-rgb), 0.2)",
          accentColor: "var(--brand)",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <aside
      role="banner"
      aria-label="Counselor Availability and Message Status"
      className="card"
      style={{
        background: `linear-gradient(135deg, ${config.bgStyle}, var(--bg-card))`,
        borderColor: config.borderStyle,
        marginBottom: "1.5rem",
        padding: "1.25rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{ fontSize: "1.4rem" }}
            title={`Status icon: ${config.label}`}
            aria-hidden="true"
          >
            {config.icon}
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h2
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {config.headline}
              </h2>
              <span className={`badge ${config.badgeClass}`}>{config.label}</span>
            </div>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--text-secondary)",
                margin: "0.2rem 0 0",
              }}
            >
              {config.description}
            </p>
          </div>
        </div>

        {/* Waiting count and quick action */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            background: "var(--bg-elevated)",
            padding: "0.5rem 0.9rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
          }}
        >
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "block",
              }}
            >
              Waiting Messages
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: waitingCount > 0 ? "var(--warning)" : "var(--success)",
              }}
            >
              {waitingCount === 0
                ? "No students waiting"
                : `${waitingCount} student${waitingCount === 1 ? "" : "s"} waiting`}
            </span>
          </div>

          <Link
            href="/student/messages"
            className="btn btn-primary btn-sm"
            title="Open private messages with guidance counselor"
          >
            Message
          </Link>
        </div>
      </div>
    </aside>
  );
}
