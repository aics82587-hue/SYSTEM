interface SkeletonProps {
  width?: string;
  height?: string;
  circle?: boolean;
}

export function Skeleton({ width = "100%", height = "1rem", circle = false }: SkeletonProps) {
  return (
    <span
      className={`skeleton${circle ? " skeleton-circle" : ""}`}
      aria-hidden="true"
      style={{ width, height }}
    />
  );
}
