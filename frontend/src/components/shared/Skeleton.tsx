interface SkeletonProps {
  height?: number | string;
  width?: number | string;
  className?: string;
}

export function Skeleton({ height = 16, width = "100%", className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded-md ${className}`}
      style={{ height, width }}
    />
  );
}
