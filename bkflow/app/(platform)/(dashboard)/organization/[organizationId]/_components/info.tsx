"use client";

import Image from "@/web/shims/next-image";
import Link from "@/web/shims/next-link";
import { GraduationCap, MoreHorizontal, Settings, Sparkles, UserPlus, Users } from "lucide-react";
import { useOrganization, useUser } from "@clerk/react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaceType } from "@/hooks/use-workspace-type";
import { cn } from "@/lib/utils";

export const Info = () => {
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const { user } = useUser();
  const { isPersonalWorkspace, setPersonalOrgId } = useWorkspaceType(organization?.id);

  if (!isOrgLoaded || !organization) {
    return (
      <Info.Skeleton />
    );
  }

  const isPersonal = isPersonalWorkspace(organization.id);

  // In personal space, display student's personal identity instead of technical Clerk org name
  const displayName = isPersonal
    ? (user?.fullName ? `Không gian của ${user.fullName}` : "Không gian cá nhân")
    : organization.name;

  const displayAvatar = isPersonal
    ? (user?.imageUrl || organization.imageUrl)
    : organization.imageUrl;

  // Mỗi user có đúng 1 không gian cá nhân: đặt org này thì org cũ tự thành nhóm
  const onSetPersonal = async () => {
    if (await setPersonalOrgId(organization.id)) {
      toast.success(`Đã đặt "${organization.name}" làm Không gian cá nhân!`);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 p-4 rounded-2xl bg-white border border-neutral-100 shadow-sm">
      <div className="flex items-center gap-x-4">
        <div className={cn(
          "w-14 h-14 relative flex-shrink-0 overflow-hidden",
          isPersonal ? "rounded-full ring-3 ring-violet-200" : "rounded-xl ring-2 ring-neutral-100"
        )}>
          <Image
            fill
            src={displayAvatar}
            alt={displayName}
            className="object-cover"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-x-2.5">
            <h1 className="font-bold text-xl text-neutral-900 leading-tight">
              {displayName}
            </h1>
            {isPersonal ? (
              <Badge variant="violet" className="font-medium text-xs px-2 py-0.5">
                <GraduationCap className="h-3.5 w-3.5 text-violet-600" />
                Cá nhân
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 font-medium text-xs px-2 py-0.5">
                <Users className="h-3.5 w-3.5 text-sky-600" />
                Hội nhóm & Dự án
              </Badge>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            {isPersonal
              ? "Môn học, dự định cá nhân và mọi deadline của bạn ở một nơi"
              : "Không gian làm việc nhóm, chia sẻ bảng dự án và phân công nhiệm vụ"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-x-2 self-end sm:self-center shrink-0">
        {!isPersonal && (
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs font-medium border-neutral-200 text-neutral-700 hover:text-neutral-900"
          >
            <Link href={`/organization/${organization.id}/settings?tab=members`}>
              <UserPlus className="h-3.5 w-3.5 text-sky-600" />
              Thành viên
            </Link>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-neutral-400 hover:text-neutral-600"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Tùy chọn không gian</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!isPersonal && (
              <>
                <DropdownMenuItem onClick={onSetPersonal}>
                  <Sparkles className="h-4 w-4 mr-2 text-violet-600" />
                  Đặt làm Không gian cá nhân
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/organization/${organization.id}/settings`}>
                <Settings className="h-4 w-4 mr-2 text-neutral-500" />
                Cài đặt không gian
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

Info.Skeleton = function SkeletonInfo() {
  return (
    <div className="flex items-center justify-between mb-6 p-4 rounded-2xl bg-white border border-neutral-100">
      <div className="flex items-center gap-x-4">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
  );
};
