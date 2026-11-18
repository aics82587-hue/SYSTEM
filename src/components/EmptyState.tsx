import type { ReactNode } from "react";
import { FeatureIcon, type FeatureIconName } from "@/components/FeatureIcon";

interface EmptyStateProps {
  icon?: FeatureIconName;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon = "heart", title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon"><FeatureIcon name={icon} size={30} /></span>
      <h3>{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action}
    </div>
  );
}
