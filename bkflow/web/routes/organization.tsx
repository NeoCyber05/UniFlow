import { Suspense } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { AlertCircle } from "lucide-react";

import type { loadOrganization } from "@/server/views/organization";
import { Separator } from "@/components/ui/separator";
import { TeamOverview } from "@/components/team/team-overview";
import { Info } from "@/app/(platform)/(dashboard)/organization/[organizationId]/_components/info";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadOrganization>>;

export default function OrganizationRoute() {
  const { organizationId = "" } = useParams<{ organizationId: string }>();
  const error = useSearchParams()[0].get("error") ?? undefined;
  const { data } = useView<View>(
    `/organization/${organizationId}${error ? `?error=${encodeURIComponent(error)}` : ""}`,
  );

  if (!data) return null;
  if (data.redirect) return <Navigate to={data.redirect} replace />;

  return (
    <div className="w-full mb-20">
      <Info />
      {error && (
        // Bị chặn khi mở bảng → quay về đây kèm lý do
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <Separator className="my-4" />
      <div className="w-full">
        <Suspense>
          <TeamOverview orgId={organizationId} />
        </Suspense>
      </div>
    </div>
  );
}
