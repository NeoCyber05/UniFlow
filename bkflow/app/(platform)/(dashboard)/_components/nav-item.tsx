"use client";

import { useRouter, usePathname } from "@/web/shims/next-navigation";
import Image from "@/web/shims/next-image";
import Link from "@/web/shims/next-link";
import {
  Activity,
  Layout,
  LayoutDashboard,
  Plus,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormPopover } from "@/components/form/form-popover";
import { useTeamOverview } from "@/hooks/use-team-overview";

export type Organization = {
  id: string;
  slug: string;
  imageUrl: string;
  name: string;
};

interface NavItemProps {
  isExpanded: boolean;
  isActive: boolean;
  organization: Organization;
  onExpand: (id: string) => void;
  workspaceType?: "PERSONAL" | "TEAM";
};

export const NavItem = ({
  isExpanded,
  isActive,
  organization,
  onExpand,
  workspaceType = "TEAM",
}: NavItemProps) => {
  const router = useRouter();
  const pathname = usePathname();

  const routes = workspaceType === "PERSONAL"
    ? [
        {
          label: "Tổng quan",
          icon: <Layout className="h-4 w-4" />,
          href: `/organization/${organization.id}`,
        },
        {
          label: "Nhật ký hoạt động",
          icon: <Activity className="h-4 w-4" />,
          href: `/organization/${organization.id}/activity`,
        },
      ]
    : [
        {
          label: "Tổng quan nhóm",
          icon: <LayoutDashboard className="h-4 w-4" />,
          href: `/organization/${organization.id}`,
        },
      ];

  const teamFooterRoutes = workspaceType === "TEAM"
    ? [
        {
          label: "Thành viên nhóm",
          icon: <Users className="h-4 w-4" />,
          href: `/organization/${organization.id}/settings?tab=members`,
        },
        {
          label: "Cài đặt nhóm",
          icon: <Settings className="h-4 w-4" />,
          href: `/organization/${organization.id}/settings`,
        },
        {
          label: "Nhật ký hoạt động",
          icon: <Activity className="h-4 w-4" />,
          href: `/organization/${organization.id}/activity`,
        },
      ]
    : [];

  const onClick = (href: string) => {
    router.push(href);
  };

  const renderRoute = (route: { label: string; icon: React.ReactNode; href: string }) => {
    const isRoutActive = pathname === route.href;
    return (
      <Button
        key={route.href}
        size="sm"
        onClick={() => onClick(route.href)}
        className={cn(
          "w-full font-normal justify-start pl-9 mb-0.5 gap-x-2.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg transition-colors",
          isRoutActive && "bg-violet-50 text-violet-700 hover:bg-violet-50 font-medium"
        )}
        variant="ghost"
      >
        {route.icon}
        {route.label}
      </Button>
    );
  };

  return (
    <AccordionItem
      value={organization.id}
      className="border-none"
    >
      <AccordionTrigger
        onClick={() => onExpand(organization.id)}
        className={cn(
          "flex items-center gap-x-2 p-2 text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors text-start no-underline hover:no-underline group w-full min-w-0",
          isActive && !isExpanded && "bg-violet-50 text-violet-700 hover:bg-violet-50/80"
        )}
      >
        <div className="flex items-center gap-x-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 relative flex-shrink-0">
            <Image
              fill
              src={organization.imageUrl}
              alt={organization.name}
              className="rounded-md object-cover"
            />
          </div>
          <span className="font-medium text-sm truncate">
            {organization.name}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-1 pb-0">
        {routes.map(renderRoute)}
        {workspaceType === "TEAM" && (
          <TeamBoardLinks orgId={organization.id} canCreate={isActive} />
        )}
        {teamFooterRoutes.map(renderRoute)}
      </AccordionContent>
    </AccordionItem>
  );
};

const TeamBoardLinks = ({ orgId, canCreate }: { orgId: string; canCreate: boolean }) => {
  const pathname = usePathname();
  const { data, isLoading } = useTeamOverview(orgId);

  if (isLoading) {
    return (
      <div className="space-y-1 py-1 pl-9 pr-2">
        <Skeleton className="h-5 w-full rounded-md" />
        <Skeleton className="h-5 w-4/5 rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <p className="pl-9 pt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Bảng dự án</p>
      {(data?.boards ?? []).map((board) => {
        const href = `/board/${board.id}`;

        return (
          <Link
            key={board.id}
            href={href}
            className={cn(
              "flex items-center gap-x-2 rounded-lg py-1.5 pl-9 pr-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
              pathname.startsWith(href) && "bg-sky-50 font-medium text-sky-700",
            )}
          >
            <span className="h-2 w-2 shrink-0 rounded-sm bg-sky-400" />
            <span className="min-w-0 flex-1 truncate">{board.title}</span>
            {board.openCount > 0 && (
              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                {board.openCount}
              </span>
            )}
          </Link>
        );
      })}
      {canCreate && (
        <FormPopover side="right" sideOffset={10}>
          <button
            type="button"
            className="flex w-full items-center gap-x-2 rounded-lg py-1.5 pl-9 pr-2 text-sm text-neutral-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Bảng mới
          </button>
        </FormPopover>
      )}
    </div>
  );
};

NavItem.Skeleton = function SkeletonNavItem() {
  return (
    <div className="flex items-center gap-x-2 p-2">
      <div className="w-7 h-7 relative shrink-0">
        <Skeleton className="h-full w-full rounded-md" />
      </div>
      <Skeleton className="h-5 w-full rounded-md" />
    </div>
  );
};
