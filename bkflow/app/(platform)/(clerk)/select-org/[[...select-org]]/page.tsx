"use client";

import { useMemo, useState } from "react";
import Image from "@/web/shims/next-image";
import { useRouter } from "@/web/shims/next-navigation";
import { useOrganizationList, useUser } from "@clerk/react";
import { ArrowRight, GraduationCap, Loader2, Plus, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceType } from "@/hooks/use-workspace-type";

const PRESET_SUGGESTIONS = [
  "BTL Thiết kế Web - Nhóm 3",
  "CLB Tin học Bách Khoa",
  "Đồ án Tốt nghiệp K65",
  "Nhóm ôn thi Giải tích",
];

export default function CreateOrganizationPage() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isLoaded: isOrgLoaded, createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const { personalOrgId, setPersonalOrgId } = useWorkspaceType();

  const [teamName, setTeamName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const memberships = useMemo(() => {
    return userMemberships?.data?.map((m) => m.organization) ?? [];
  }, [userMemberships?.data]);

  // Server đã chọn sẵn không gian cá nhân (lib/workspace.ts); fallback khi org đó không còn
  const effectivePersonalOrg = useMemo(() => {
    if (memberships.length === 0) return null;
    return memberships.find((org) => org.id === personalOrgId) ?? memberships[0];
  }, [memberships, personalOrgId]);

  const teamMemberships = useMemo(() => {
    if (!effectivePersonalOrg) return memberships;
    return memberships.filter((org) => org.id !== effectivePersonalOrg.id);
  }, [memberships, effectivePersonalOrg]);

  const handleGoToPersonal = async () => {
    if (!effectivePersonalOrg || !setActive) return;
    try {
      if (effectivePersonalOrg.id !== personalOrgId) {
        await setPersonalOrgId(effectivePersonalOrg.id);
      }
      await setActive({ organization: effectivePersonalOrg.id });
      router.push(`/organization/${effectivePersonalOrg.id}`);
    } catch {
      router.push(`/organization/${effectivePersonalOrg.id}`);
    }
  };

  const handleSelectTeam = async (orgId: string) => {
    if (!setActive) return;
    try {
      await setActive({ organization: orgId });
      router.push(`/organization/${orgId}`);
    } catch {
      router.push(`/organization/${orgId}`);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) {
      toast.error("Vui lòng nhập tên nhóm / đồ án.");
      return;
    }

    if (!createOrganization || !setActive) {
      toast.error("Dịch vụ chưa sẵn sàng, vui lòng đợi...");
      return;
    }

    setIsCreating(true);
    try {
      const newOrg = await createOrganization({ name: teamName.trim() });
      await setActive({ organization: newOrg.id });
      toast.success(`Đã tạo nhóm "${newOrg.name}" thành công!`);
      router.push(`/organization/${newOrg.id}`);
    } catch (err: unknown) {
      const errorMsg =
        typeof err === "object" && err !== null && "errors" in err
          ? (err as { errors?: Array<{ message?: string }> }).errors?.[0]?.message
          : null;
      toast.error(errorMsg || "Tạo nhóm thất bại. Vui lòng thử lại!");
    } finally {
      setIsCreating(false);
    }
  };

  if (!isUserLoaded || !isOrgLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 text-violet-600 animate-spin" />
        <p className="text-sm text-neutral-500">Đang chuẩn bị không gian học tập...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto p-4 sm:p-6 my-8">
      {/* Header */}
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-violet-100 ring-4 ring-violet-50 text-violet-600 mb-2">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
          Chào mừng đến với HustFlow!
        </h1>
        <p className="text-sm text-neutral-500 max-w-md mx-auto">
          Chọn không gian học tập cá nhân của bạn hoặc vào các nhóm đồ án, câu lạc bộ để bắt đầu.
        </p>
      </div>

      <div className="space-y-4">
        {/* Card 1: Góc học tập cá nhân */}
        {effectivePersonalOrg ? (
          <div className="p-5 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/50 to-white shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-x-3.5">
                <div className="w-12 h-12 relative rounded-full overflow-hidden ring-2 ring-violet-300 shrink-0">
                  <Image
                    fill
                    src={user?.imageUrl || effectivePersonalOrg.imageUrl}
                    alt={user?.fullName || "Sinh viên"}
                    className="object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-base text-neutral-900">
                      {user?.fullName ? `Không gian của ${user.fullName}` : "Không gian cá nhân"}
                    </h2>
                    <Badge variant="violet" className="text-[10px] font-semibold py-0.5">
                      Cá nhân
                    </Badge>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Môn học, dự định cá nhân và deadline của riêng bạn
                  </p>
                </div>
              </div>
              <Button
                onClick={handleGoToPersonal}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 px-4 text-xs font-semibold gap-1.5 shrink-0 shadow-sm"
              >
                Vào không gian
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : null}

        {/* Card 2: Danh sách nhóm sinh viên hoặc Nút tạo nhóm */}
        <div className="p-5 rounded-2xl border border-neutral-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-x-2 text-neutral-800 font-semibold text-sm">
              <Users className="h-4 w-4 text-sky-600" />
              <span>Hội nhóm & Đồ án sinh viên</span>
              {teamMemberships.length > 0 && (
                <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                  {teamMemberships.length}
                </span>
              )}
            </div>
            {!showCreateForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(true)}
                className="h-8 text-xs font-semibold border-sky-200 text-sky-700 hover:bg-sky-50 rounded-lg gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Tạo nhóm mới
              </Button>
            )}
          </div>

          {/* Form tạo nhóm inline nếu bấm tạo nhóm */}
          {showCreateForm ? (
            <form onSubmit={handleCreateTeam} className="p-4 rounded-xl border border-sky-200 bg-sky-50/30 space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="inline-team-name" className="text-xs font-semibold text-neutral-800">
                  Tên nhóm / Đồ án môn học <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="inline-team-name"
                  placeholder="VD: BTL Hệ điều hành - Nhóm 2"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  disabled={isCreating}
                  autoFocus
                  className="bg-white text-sm h-9 rounded-lg"
                />
              </div>

              {/* Gợi ý mẫu */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-neutral-500 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Gợi ý mẫu:
                </span>
                <div className="flex flex-wrap gap-1">
                  {PRESET_SUGGESTIONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTeamName(preset)}
                      className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-600 hover:border-sky-300 hover:text-sky-700 transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                  disabled={isCreating}
                  className="h-8 text-xs text-neutral-500"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreating || !teamName.trim()}
                  className="bg-sky-600 hover:bg-sky-700 text-white h-8 text-xs font-semibold px-3.5 rounded-lg"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    "Tạo nhóm ngay"
                  )}
                </Button>
              </div>
            </form>
          ) : null}

          {/* Danh sách các nhóm đã tham gia */}
          {teamMemberships.length > 0 ? (
            <div className="space-y-2">
              {teamMemberships.map((org) => (
                <div
                  key={org.id}
                  onClick={() => handleSelectTeam(org.id)}
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 hover:border-sky-200 hover:bg-sky-50/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 relative rounded-lg overflow-hidden shrink-0 border border-neutral-100">
                      <Image
                        fill
                        src={org.imageUrl}
                        alt={org.name}
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-neutral-800 group-hover:text-sky-700 transition-colors">
                        {org.name}
                      </p>
                      <p className="text-[11px] text-neutral-400">Không gian nhóm</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs font-medium text-sky-600 group-hover:bg-sky-100/60 rounded-lg"
                  >
                    Mở nhóm
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          ) : !showCreateForm ? (
            <div className="py-6 text-center text-xs text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
              <Users className="h-6 w-6 text-neutral-300 mx-auto mb-1.5" />
              Bạn chưa tham gia hội nhóm nào. Bấm &quot;Tạo nhóm mới&quot; để bắt đầu cộng tác.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}