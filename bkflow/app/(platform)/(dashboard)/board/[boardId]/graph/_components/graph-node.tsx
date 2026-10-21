"use client";

import { memo } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Lock,
  Plus,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Hint } from "@/components/hint";
import { useBoardCourse } from "@/hooks/use-board-courses";
import { getCourseColor, getCourseShortLabel } from "@/lib/courses/course-colors";
import { cn } from "@/lib/utils";
import type { GraphNode } from "../_types";

type GraphNodeComponentProps = {
  node: GraphNode;
  boardId: string;
  isSelected: boolean;
  isAncestor: boolean;
  isDescendant: boolean;
  isDimmed: boolean;
  /** Thứ tự nên làm (chỉ việc làm được ngay). */
  priorityRank?: number;
  /** Còn chờ việc khác chưa xong. */
  isWaiting?: boolean;
  canEdit?: boolean;
  isConnectingSource?: boolean;
  isConnectingHoverTarget?: boolean;
  isConnectionCandidate?: boolean;
  onClick: (cardId: string) => void;
  onOpenCardModal: (cardId: string) => void;
  onStartConnectDrag?: (e: React.PointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>, node: GraphNode) => void;
  onPortClick?: (e: React.MouseEvent<HTMLButtonElement>, node: GraphNode) => void;
  onMouseEnterTarget?: (node: GraphNode) => void;
  onMouseLeaveTarget?: () => void;
  onSelectTarget?: (node: GraphNode) => void;
};

export const GraphNodeComponent = memo(function GraphNodeComponent({
  node,
  boardId,
  isSelected,
  isAncestor,
  isDescendant,
  isDimmed,
  priorityRank,
  isWaiting = false,
  canEdit = false,
  isConnectingSource = false,
  isConnectingHoverTarget = false,
  isConnectionCandidate = false,
  onClick,
  onOpenCardModal,
  onStartConnectDrag,
  onPortClick,
  onMouseEnterTarget,
  onMouseLeaveTarget,
  onSelectTarget,
}: GraphNodeComponentProps) {
  const { card } = node;
  const course = useBoardCourse(boardId, card.courseId);
  const courseColor = course ? getCourseColor(course.color) : null;

  const blockerCount = card.blockedByDependencies.length;
  const blockingCount = card.blockingDependencies.length;

  return (
    <div
      data-graph-card-id={card.id}
      style={{
        position: "absolute",
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${node.width}px`,
        height: `${node.height}px`,
      }}
      onMouseDown={(e) => {
        // Prevent background canvas pan/connect cancellation when interacting with card
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (isConnectionCandidate && onSelectTarget) {
          onSelectTarget(node);
          return;
        }
        if (isConnectingSource) {
          // If clicked source node itself, do not open detail modal or select
          return;
        }
        onClick(card.id);
      }}
      onMouseEnter={() => {
        if (isConnectionCandidate && onMouseEnterTarget) {
          onMouseEnterTarget(node);
        }
      }}
      onMouseLeave={() => {
        if (isConnectionCandidate && onMouseLeaveTarget) {
          onMouseLeaveTarget();
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpenCardModal(card.id);
      }}
      className={cn(
        "group cursor-pointer rounded-xl border bg-white p-3 shadow-xs transition-[border-color,box-shadow,background-color,opacity,filter,scale] duration-200 select-none",
        "hover:shadow-md hover:border-violet-300",
        // Status border accents
        card.isCompleted && "border-emerald-200 bg-emerald-50/30",
        isWaiting && "border-dashed border-neutral-300 bg-neutral-50/90",
        priorityRank === 1 && "border-violet-300 shadow-md shadow-violet-200/60",
        node.hasConflict && "border-rose-300 bg-rose-50/20 ring-1 ring-rose-200",
        // Interactive Highlights
        isSelected && "ring-2 ring-violet-600 shadow-lg scale-[1.02] z-20 bg-white",
        isAncestor && "ring-2 ring-amber-400 shadow-md z-20 bg-amber-50/30",
        isDescendant && "ring-2 ring-emerald-500 shadow-md z-20 bg-emerald-50/30",
        isDimmed && "opacity-25 grayscale-[30%]",
        // Connecting states
        isConnectingSource && "ring-2 ring-violet-600 shadow-xl scale-[1.03] z-30 bg-violet-50/50 border-violet-400",
        isConnectingHoverTarget && "ring-2 ring-emerald-500 shadow-xl scale-[1.03] z-30 bg-emerald-50/70 border-emerald-400",
        isConnectionCandidate && !isConnectingHoverTarget && "border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/20",
      )}
    >
      {/* Số thứ tự nên làm; số 1 có vòng sáng để mắt tìm thấy ngay */}
      {priorityRank !== undefined && (
        <Hint description={priorityRank === 1 ? "Nên làm việc này trước tiên" : `Thứ tự nên làm: ${priorityRank}`} side="top">
          <span
            className={cn(
              "absolute -left-2.5 -top-2.5 z-30 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums text-white shadow-md ring-2 ring-white",
              priorityRank === 1 ? "bg-violet-600" : priorityRank <= 3 ? "bg-neutral-900" : "bg-neutral-400",
            )}
          >
            {priorityRank === 1 && (
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-violet-500 opacity-60 motion-safe:animate-ping" />
            )}
            <span className="relative">{priorityRank}</span>
          </span>
        </Hint>
      )}

      {/* Top row: tags, course, and modal button */}
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <div className="flex min-w-0 items-center gap-1.5 truncate">
          {course && courseColor && (
            <span
              className={cn(
                "truncate rounded px-1.5 py-0.5 font-semibold ring-1 ring-inset",
                courseColor.chip,
              )}
            >
              {getCourseShortLabel(course)}
            </span>
          )}
          <span className="truncate rounded-md bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600">
            {card.listTitle}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {node.hasConflict && (
            <Hint description="Xung đột hạn chót: Công việc đi sau có hạn sớm hơn công việc chặn!" side="top">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 animate-pulse">
                <AlertTriangle className="h-3 w-3" />
              </span>
            </Hint>
          )}

          <button
            type="button"
            title="Mở chi tiết thẻ"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCardModal(card.id);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-neutral-400 hover:text-violet-600 rounded"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Card Title */}
      <div className="my-1.5 flex items-start gap-1.5">
        {card.isCompleted && (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
        )}
        <h4
          title={card.title}
          className={cn(
            "line-clamp-2 text-xs font-semibold leading-snug text-neutral-800",
            card.isCompleted && "line-through text-neutral-500 font-normal",
          )}
        >
          {card.title}
        </h4>
      </div>

      {/* Bottom meta row: Due date, Assignees, Dependency pill counts */}
      <div className="mt-auto flex items-center justify-between text-[11px] text-neutral-500 pt-0.5">
        <div className="flex items-center gap-1.5">
          {card.dueDate ? (
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                card.isCompleted
                  ? "bg-emerald-50 text-emerald-700"
                  : new Date(card.dueDate) < new Date()
                  ? "bg-rose-50 text-rose-700 font-semibold"
                  : "bg-neutral-100 text-neutral-600",
              )}
            >
              <Calendar className="h-3 w-3 shrink-0" />
              <span>{format(new Date(card.dueDate), "dd/MM", { locale: vi })}</span>
            </div>
          ) : (
            <span className="text-[10px] text-neutral-400 italic">Chưa có hạn</span>
          )}

          {/* Blockers & Blocking badges */}
          {blockerCount > 0 && (
            <Hint description={`Cần ${blockerCount} thẻ hoàn thành trước`} side="bottom">
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200/60">
                <Lock className="h-2.5 w-2.5" />
                {blockerCount}
              </span>
            </Hint>
          )}

          {blockingCount > 0 && (
            <Hint description={`Đang chặn ${blockingCount} thẻ tiếp theo`} side="bottom">
              <span className="inline-flex items-center gap-0.5 rounded bg-sky-50 px-1 py-0.5 text-[10px] font-semibold text-sky-700 border border-sky-200/60">
                <Zap className="h-2.5 w-2.5" />
                {blockingCount}
              </span>
            </Hint>
          )}
        </div>

        {/* Assignees */}
        {card.assignees.length > 0 && (
          <div className="flex -space-x-1.5 overflow-hidden">
            {card.assignees.slice(0, 2).map((assignee) => (
              <Avatar key={assignee.id} className="h-5 w-5 ring-1 ring-white">
                <AvatarImage src={assignee.userImage} alt={assignee.userName} />
                <AvatarFallback className="text-[9px]">
                  {assignee.userName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {card.assignees.length > 2 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-200 text-[9px] font-semibold text-neutral-600 ring-1 ring-white">
                +{card.assignees.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right Connector Port (Source / Output handle: Drag or Click to connect) */}
      {canEdit && (
        <Hint description="Kéo hoặc nhấn để nối công việc tiếp theo" side="right">
          <button
            type="button"
            aria-label="Nối quan hệ phụ thuộc"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartConnectDrag?.(e, node);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPortClick?.(e, node);
            }}
            className={cn(
              "absolute -right-2.5 top-1/2 -translate-y-1/2 z-40 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm ring-2 ring-white cursor-crosshair transition-[opacity,background-color,box-shadow,scale] duration-150",
              "hover:bg-violet-700 hover:shadow-md hover:ring-violet-200",
              isConnectingSource
                ? "scale-125 bg-violet-700 ring-2 ring-violet-300 animate-pulse"
                : "opacity-40 group-hover:opacity-100",
            )}
          >
            <Plus className="h-3 w-3 stroke-[3]" />
          </button>
        </Hint>
      )}
    </div>
  );
});
