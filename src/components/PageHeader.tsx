import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="page-heading">
      <div className="page-heading-copy">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1 className="section-title">{title}</h1>
        {description && <p className="page-heading-description">{description}</p>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}
