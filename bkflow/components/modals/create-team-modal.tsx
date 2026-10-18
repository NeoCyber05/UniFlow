"use client";

import { useState } from "react";
import { useRouter } from "@/web/shims/next-navigation";
import { useOrganizationList } from "@clerk/react";
import { Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTeamModal } from "@/hooks/use-create-team-modal";

const PRESET_SUGGESTIONS = [
  "BTL Thiết kế Web - Nhóm 3",
  "CLB Tin học Bách Khoa",
  "Đồ án Tốt nghiệp K65",
  "Nhóm ôn thi Giải tích & Đại số",
];

export const CreateTeamModal = () => {
  const router = useRouter();
  const { isOpen, onClose } = useCreateTeamModal();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();

  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Vui lòng nhập tên nhóm / đồ án.");
      return;
    }

    if (!isLoaded || !createOrganization || !setActive) {
      toast.error("Dịch vụ chưa sẵn sàng, vui lòng đợi trong giây lát.");
      return;
    }

    setIsSubmitting(true);

    try {
      const organization = await createOrganization({ name: name.trim() });
      await setActive({ organization: organization.id });

      toast.success(`Đã tạo nhóm "${organization.name}" thành công!`);
      setName("");
      onClose();
      router.push(`/organization/${organization.id}`);
    } catch (err: unknown) {
      const errorMsg =
        typeof err === "object" && err !== null && "errors" in err
          ? (err as { errors?: Array<{ message?: string }> }).errors?.[0]?.message
          : null;

      toast.error(errorMsg || "Tạo nhóm thất bại. Vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-x-2 text-sky-600">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-200">
              <Users className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-neutral-900">
              Tạo nhóm học tập & Đồ án mới
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-neutral-500 leading-relaxed">
            Không gian làm việc chung dành cho bài tập lớn, đồ án nhóm hoặc hoạt động câu lạc bộ sinh viên. Bạn có thể mời bạn bè tham gia sau khi tạo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="team-name" className="text-xs font-semibold text-neutral-700">
              Tên nhóm / Đồ án <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="team-name"
              placeholder="VD: Nhóm BTL Hệ điều hành - Nhóm 4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className="text-sm h-10 rounded-xl"
            />
          </div>

          {/* Gợi ý mẫu tên nhóm cho sinh viên */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-500">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Gợi ý mẫu tên:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SUGGESTIONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setName(preset)}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition-colors cursor-pointer text-left"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-x-2 pt-2 border-t border-neutral-100">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-medium text-neutral-600 rounded-lg h-9"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg h-9 px-4 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Đang tạo...
                </>
              ) : (
                "Tạo nhóm ngay"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
