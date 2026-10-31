import { useEffect, useState } from "react";

import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ViewSkeletonVariant = "columns" | "rows" | "grid" | "panels" | "canvas" | "doc";

const Block = ({ className }: { className?: string }) => <div className={cn("rounded-md bg-muted", className)} />;

const repeat = (count: number, className: string) =>
  Array.from({ length: count }, (_, index) => <Block key={index} className={className} />);

const SHAPES: Record<ViewSkeletonVariant, React.ReactNode> = {
  columns: (
    <div className="flex h-full flex-col gap-4">
      <Block className="h-16 rounded-2xl" />
      <div className="flex min-h-0 flex-1 gap-x-3 overflow-hidden">
        {[4, 2, 3, 1].map((cards, index) => (
          <div key={index} className="flex h-fit w-[272px] shrink-0 flex-col gap-2 rounded-xl bg-muted/70 p-2">
            <Block className="mb-1 h-5 w-24 bg-muted-foreground/15" />
            {repeat(cards, "h-16 bg-background/80")}
          </div>
        ))}
      </div>
    </div>
  ),
  rows: (
    <div className="flex flex-col gap-3">
      <Block className="mb-2 h-9 w-56" />
      {repeat(6, "h-12")}
    </div>
  ),
  grid: (
    <div className="flex h-full flex-col gap-3">
      <Block className="h-10" />
      <div className="grid min-h-80 flex-1 grid-cols-7 grid-rows-5 gap-1">{repeat(35, "rounded-sm")}</div>
    </div>
  ),
  panels: (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{repeat(4, "h-24 rounded-xl")}</div>
      <div className="grid gap-4 md:grid-cols-2">{repeat(2, "h-72 rounded-xl")}</div>
    </div>
  ),
  canvas: <Block className="h-full min-h-64 rounded-xl" />,
  doc: (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 py-6">
      <Block className="mb-4 h-9 w-2/3" />
      {["w-full", "w-11/12", "w-4/5", "w-full", "w-3/5"].map((width, index) => <Block key={index} className={cn("h-4", width)} />)}
    </div>
  ),
};

const BOARD_VIEW_SKELETONS: [string, ViewSkeletonVariant][] = [["/calendar", "grid"], ["/graph", "canvas"], ["/analytics", "panels"], ["/list", "rows"], ["/timeline", "rows"]];

// The shape the route will end up showing, so outer layouts load with the same skeleton as the view inside.
export const skeletonForPath = (pathname: string): ViewSkeletonVariant => {
  if (pathname.startsWith("/pages/")) return "doc";
  if (!pathname.startsWith("/board/")) return "rows";
  return BOARD_VIEW_SKELETONS.find(([tab]) => pathname.endsWith(tab))?.[1] ?? "columns";
};

// Skeletons mounted right now. One that replaces another (layout -> view, Suspense -> route) skips the fade-in, or it would blink.
let mountedSkeletons = 0;

// Shaped like the view it stands in for, so content lands without a jump. Hidden for the first 150ms so
// fast loads never flash it, and one pulse drives the whole shape instead of one animation per block.
export const ViewSkeleton = ({ variant, label = tr("common.loading"), className }: { variant: ViewSkeletonVariant; label?: string; className?: string }) => {
  const [replacesAnother] = useState(() => mountedSkeletons > 0);
  useEffect(() => {
    mountedSkeletons += 1;
    return () => {
      mountedSkeletons -= 1;
    };
  }, []);

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("h-full p-4", !replacesAnother && "animate-in fade-in-0 duration-300 delay-150 fill-mode-backwards", className)}
    >
      <div aria-hidden="true" className="h-full animate-pulse">{SHAPES[variant]}</div>
    </div>
  );
};
