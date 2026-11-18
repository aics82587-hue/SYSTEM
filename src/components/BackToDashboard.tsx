import Link from "next/link";
import { FeatureIcon } from "@/components/FeatureIcon";
import type { AppRole } from "@/lib/identity";
import { dashboardPathForRole } from "@/lib/identity";

export function BackToDashboard({ role, compact = false }: { role: AppRole; compact?: boolean }) {
  return (
    <Link
      href={dashboardPathForRole(role)}
      className={`btn btn-ghost btn-sm back-to-dashboard${compact ? " back-to-dashboard-compact" : ""}`}
      aria-label="Back to dashboard"
      title="Back to dashboard"
    >
      <FeatureIcon name="arrow-left" size={17} />{compact ? null : " Dashboard"}
    </Link>
  );
}
