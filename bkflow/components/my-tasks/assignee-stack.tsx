import Image from "@/web/shims/next-image";

import type { MyTask } from "@/lib/my-tasks/types";

const MAX_VISIBLE = 3;

export const AssigneeStack = ({ assignees }: { assignees: MyTask["assignees"] }) => {
  if (assignees.length === 0) return null;

  const visible = assignees.slice(0, MAX_VISIBLE);
  const hidden = assignees.length - visible.length;

  return (
    <div className="flex shrink-0 -space-x-1.5" title={assignees.map((item) => item.userName).join(", ")}>
      {visible.map((assignee) => (
        <div key={assignee.userId} className="relative h-6 w-6 overflow-hidden rounded-full ring-2 ring-white">
          <Image fill src={assignee.userImage} alt={assignee.userName} className="object-cover" />
        </div>
      ))}
      {hidden > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600 ring-2 ring-white">
          +{hidden}
        </div>
      )}
    </div>
  );
};
