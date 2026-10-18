"use client";

import Link from "@/web/shims/next-link";
import Image from "@/web/shims/next-image";
import { usePathname } from "@/web/shims/next-navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus, User, Users } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";
import { useOrganization, useUser } from "@clerk/react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion } from "@/components/ui/accordion";
import { MySidebarNav } from "@/components/my-tasks/my-sidebar-nav";
import { useWorkspaceType } from "@/hooks/use-workspace-type";
import { useCreateTeamModal } from "@/hooks/use-create-team-modal";
import { cn } from "@/lib/utils";

import { NavItem, Organization } from "./nav-item";

interface SidebarProps {
  storageKey?: string;
};

export const Sidebar = ({
  storageKey = "t-sidebar-state",
}: SidebarProps) => {
  const pathname = usePathname();
  const { onOpen: onOpenCreateTeamModal } = useCreateTeamModal();
  const [expanded, setExpanded] = useLocalStorage<Record<string, boolean>>(
    storageKey,
    {}
  );

  const {
    organization: activeOrganization,
    isLoaded: isLoadedOrg
  } = useOrganization();
  const {
    user,
    isLoaded: isLoadedUser,
  } = useUser();

  const { personalOrgId } = useWorkspaceType(activeOrganization?.id);

  const [memberships, setMemberships] = useState<Organization[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(true);

  useEffect(() => {
    if (!isLoadedUser || !user) return;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setIsLoadingMemberships(true);
      }
    });

    user
      .getOrganizationMemberships({ pageSize: 50 })
      .then((result) => {
        if (cancelled) return;
        const orgs = result.data.map((membership) => ({
          id: membership.organization.id,
          slug: membership.organization.slug ?? "",
          imageUrl: membership.organization.imageUrl ?? "",
          name: membership.organization.name,
        }));

        setMemberships(orgs);
        setIsLoadingMemberships(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoadingMemberships(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoadedUser, user]);

  const defaultAccordionValue: string[] = Object.keys(expanded)
    .reduce((acc: string[], key: string) => {
      if (expanded[key]) {
        acc.push(key);
      }
      return acc;
  }, []);

  const onExpand = (id: string) => {
    setExpanded((curr) => ({
      ...curr,
      [id]: !expanded[id],
    }));
  };

  // Partition memberships into Personal vs Teams (personal org do server quyết định)
  const personalWorkspace = useMemo(() => {
    return memberships.find((org) => org.id === personalOrgId) || null;
  }, [memberships, personalOrgId]);

  const teamWorkspaces = useMemo(() => {
    return memberships.filter((org) => org.id !== personalOrgId);
  }, [memberships, personalOrgId]);

  if (!isLoadedOrg || !isLoadedUser || isLoadingMemberships) {
    return (
      <>
        <div className="flex items-center justify-between mb-3 px-1">
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
        <div className="space-y-1.5 mb-6">
          <NavItem.Skeleton />
        </div>
        <div className="flex items-center justify-between mb-3 px-1">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-6 w-6 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <NavItem.Skeleton />
          <NavItem.Skeleton />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. KHỐI CÁ NHÂN */}
      <div>
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="flex items-center gap-x-1.5 text-xs font-bold uppercase tracking-wider text-violet-700">
            <User className="h-4 w-4" />
            <span>Không gian cá nhân</span>
          </div>
        </div>

        {personalWorkspace ? (
          <div className="space-y-0.5">
            <Link
              href="/my/today"
              className={cn(
                "flex items-center gap-x-2.5 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted group",
                pathname === "/my/today" && "border-violet-200"
              )}
            >
              <div className="w-7 h-7 relative shrink-0 rounded-full overflow-hidden ring-2 ring-violet-200">
                <Image
                  fill
                  src={user?.imageUrl || personalWorkspace.imageUrl}
                  alt={user?.fullName || "Sinh viên"}
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-neutral-800 truncate leading-tight">
                  {user?.fullName || "Không gian của tôi"}
                </p>
                <p className="text-[11px] text-violet-600 font-medium">Học tập & cuộc sống</p>
              </div>
            </Link>

            <MySidebarNav />
          </div>
        ) : (
          <div className="px-2 py-3 text-xs text-neutral-400 text-center rounded-lg border border-dashed border-neutral-200">
            Chưa có góc học tập.
            <br />
            <Link href="/select-org" className="text-violet-600 hover:underline mt-1 inline-block font-medium">
              Khởi tạo ngay →
            </Link>
          </div>
        )}
      </div>

      {/* 2. KHỐI HỘI NHÓM & DỰ ÁN */}
      <details className="border-t border-border pt-4" open={teamWorkspaces.some(org => org.id === activeOrganization?.id)}>
        <summary className="mb-3 cursor-pointer px-2 text-xs font-medium text-muted-foreground">Không gian khác</summary>
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="flex items-center gap-x-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
            <Users className="h-4 w-4 text-sky-600" />
            <span>Hội nhóm & Dự án</span>
            {teamWorkspaces.length > 0 && (
              <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded-full font-semibold">
                {teamWorkspaces.length}
              </span>
            )}
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onOpenCreateTeamModal}
            className="h-6 w-6 text-neutral-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer"
            title="Tạo nhóm học tập & đồ án mới"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {teamWorkspaces.length > 0 ? (
          <Accordion
            type="multiple"
            defaultValue={defaultAccordionValue}
            className="space-y-0.5"
          >
            {teamWorkspaces.map((organization) => (
              <NavItem
                key={organization.id}
                isActive={activeOrganization?.id === organization.id}
                isExpanded={expanded[organization.id]}
                organization={organization}
                onExpand={onExpand}
                workspaceType="TEAM"
              />
            ))}
          </Accordion>
        ) : (
          <div className="mx-1 p-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 text-center">
            <Users className="h-5 w-5 mx-auto text-neutral-400 mb-1.5" />
            <p className="text-xs font-medium text-neutral-700">Chưa tham gia nhóm nào</p>
            <p className="text-[11px] text-neutral-400 mt-0.5 mb-2 leading-relaxed">
              Tạo nhóm bài tập lớn hoặc CLB để cộng tác cùng bạn bè
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenCreateTeamModal}
              className="h-7 text-xs border-sky-200 text-sky-700 hover:bg-sky-50 w-full rounded-lg cursor-pointer"
            >
              <Plus className="h-3 w-3 mr-1" />
              Tạo nhóm mới
            </Button>
          </div>
        )}
      </details>
    </div>
  );
};
