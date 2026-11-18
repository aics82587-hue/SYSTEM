import Link from "next/link";

export function ReferralButton({ studentId, className = "btn btn-secondary btn-sm" }: { studentId: string; className?: string }) {
  return (
    <Link href={`/counselor/referrals?student=${encodeURIComponent(studentId)}`} className={className}>
      Refer Student
    </Link>
  );
}
