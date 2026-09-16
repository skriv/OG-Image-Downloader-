import { Skeleton, Spinner, Typography } from "@heroui/react";

export function LoadingSkeleton({ message }) {
  return (
    <section
      className="skeleton--shimmer flex flex-col gap-3"
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton animationType="none" className="og-preview-frame w-full rounded-xl" />

      <div className="flex flex-col gap-0.5">
        <Skeleton animationType="none" className="h-3.5 w-[88%] rounded-md" />
        <Skeleton animationType="none" className="h-3 w-[72%] rounded-md" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton animationType="none" className="h-8 w-[88px] rounded-md opacity-70" />
        <Skeleton animationType="none" className="h-8 w-[88px] rounded-md opacity-70" />
        <Skeleton animationType="none" className="h-8 w-[68px] rounded-md opacity-70" />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Spinner size="sm" />
        <Typography.Paragraph color="muted" size="sm">
          {message}
        </Typography.Paragraph>
      </div>
    </section>
  );
}
