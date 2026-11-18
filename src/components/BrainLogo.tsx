import { FeatureIcon } from "@/components/FeatureIcon";

export function BrainLogo({ size = 36 }: { size?: number }) {
  return (
    <span className="brain-logo" aria-hidden="true">
      <FeatureIcon name="brain" size={size} />
    </span>
  );
}
