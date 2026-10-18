import Image from "@/web/shims/next-image";
import { UserX } from "lucide-react";

import type { WorkloadRow } from "@/lib/team-tasks/workload";
import { cn } from "@/lib/utils";

type TeamMemberCardProps = {
  row: WorkloadRow;
  onSelect: (userId: string) => void;
};

export const TeamMemberCard = ({ row, onSelect }: TeamMemberCardProps) => {
  const percent = Math.round(row.load * 100);

  return (
    <button
      type="button"
      onClick={() => onSelect(row.userId)}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-200 hover:shadow-md"
    >
      <div className="flex items-center gap-2.5">
        {row.imageUrl ? (
          <div className="relative h-9 w-9 overflow-hidden rounded-full">
            <Image fill src={row.imageUrl} alt={row.name} className="object-cover" />
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <UserX className="h-4 w-4" />
          </div>
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800">{row.name}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-neutral-900">{row.open}</p>
          <p className="text-[10px] text-neutral-500">Đang mở</p>
        </div>
        <div>
          <p className={cn("text-lg font-bold", row.overdue > 0 ? "text-rose-600" : "text-neutral-900")}>
            {row.overdue}
          </p>
          <p className="text-[10px] text-neutral-500">Quá hạn</p>
        </div>
        <div>
          <p className="text-lg font-bold text-emerald-600">{row.doneLast7Days}</p>
          <p className="text-[10px] text-neutral-500">Xong 7 ngày</p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100" title={`Tải ${percent}%`}>
        <div
          className={cn("h-full rounded-full", percent >= 80 ? "bg-rose-500" : percent >= 50 ? "bg-amber-500" : "bg-sky-500")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </button>
  );
};
