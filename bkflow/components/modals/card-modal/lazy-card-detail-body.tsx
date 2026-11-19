import { lazy } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { tr } from "@/lib/i18n";

export const loadCardDetailBody = () => import("./card-detail-body").then(({ CardDetailBody }) => ({ default: CardDetailBody }));

export const LazyCardDetailBody = lazy(loadCardDetailBody);

export const CardDetailFallback = () => (
  <div role="status" className="space-y-4 p-5">
    <span className="sr-only">{tr("common.loading")}</span>
    <Skeleton className="h-7 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-24 w-full" />
  </div>
);
