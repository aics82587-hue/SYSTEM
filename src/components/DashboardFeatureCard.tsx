import Link from "next/link";
import { FeatureIcon, type FeatureIconName } from "@/components/FeatureIcon";

interface DashboardFeatureCardProps {
  href: string;
  icon: FeatureIconName;
  title: string;
  description: string;
  value?: string | number;
}

export function DashboardFeatureCard({
  href,
  icon,
  title,
  description,
  value,
}: DashboardFeatureCardProps) {
  return (
    <Link href={href} className="feature-card">
      <span className="feature-card-icon"><FeatureIcon name={icon} /></span>
      <span className="feature-card-content">
        <span className="feature-card-title">{title}</span>
        <span className="feature-card-description">{description}</span>
      </span>
      {value !== undefined && <span className="feature-card-value">{value}</span>}
      <span className="feature-card-arrow" aria-hidden="true">→</span>
    </Link>
  );
}
