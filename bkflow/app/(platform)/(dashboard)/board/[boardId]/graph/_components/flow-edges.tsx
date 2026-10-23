"use client";

import { useLayoutEffect, useState } from "react";
import { useShouldReduceMotion } from "@animate-ui/react/utils/motion";

import { cn } from "@/lib/utils";

type FlowNode = { id: string; lane: string };
type Edge = { key: string; d: string; isNow: boolean };

// Thẻ đang trượt (layout animation) sau khi tick: đo lại mỗi khung hình trong khoảng này
const FOLLOW_MS = 700;

const buildEdges = (container: HTMLElement, nodes: FlowNode[]): Edge[] => {
  const origin = container.getBoundingClientRect();
  const rects = new Map<string, DOMRect>();
  container.querySelectorAll<HTMLElement>("[data-flow-id]").forEach((element) => {
    rects.set(element.dataset.flowId!, element.getBoundingClientRect());
  });

  return nodes.slice(1).flatMap((node, index) => {
    const prev = nodes[index];
    const a = rects.get(prev.id);
    const b = rects.get(node.id);
    if (!a || !b) return [];
    const x = (value: number) => value - origin.left;
    const y = (value: number) => value - origin.top;
    let d: string;
    if (prev.lane === node.lane && b.top >= a.bottom) {
      // Cùng cột: đáy thẻ trước → đỉnh thẻ sau
      const x1 = x(a.left + a.width / 2), y1 = y(a.bottom), x2 = x(b.left + b.width / 2), y2 = y(b.top);
      const dy = Math.max(12, (y2 - y1) * 0.5);
      d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
    } else {
      // Sang thẻ/cột kế: cạnh phải → cạnh trái
      const x1 = x(a.right), y1 = y(a.top + Math.min(a.height / 2, 40)), x2 = x(b.left), y2 = y(b.top + Math.min(b.height / 2, 40));
      const dx = Math.max(20, Math.abs(x2 - x1) * 0.5);
      d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    }
    return [{ key: `${prev.id}->${node.id}`, d, isNow: index === 0 }];
  });
};

/** Lớp SVG vẽ đường cong có mũi tên nối bước n → n+1 theo vị trí thật của các thẻ `[data-flow-id]`. */
export const FlowEdges = ({ containerRef, nodes }: { containerRef: React.RefObject<HTMLElement | null>; nodes: FlowNode[] }) => {
  const reduceMotion = useShouldReduceMotion();
  const [edges, setEdges] = useState<Edge[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const signature = nodes.map((node) => `${node.lane}:${node.id}`).join("|");

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      setSize({ width: container.scrollWidth, height: container.scrollHeight });
      setEdges(buildEdges(container, nodes));
    };
    measure();
    const started = performance.now();
    let frame = requestAnimationFrame(function follow() {
      measure();
      if (performance.now() - started < FOLLOW_MS) frame = requestAnimationFrame(follow);
    });
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // signature đại diện cho nodes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, signature]);

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={size.width} height={size.height}>
      <defs>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" className="fill-violet-400" />
        </marker>
        <marker id="flow-arrow-now" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" className="fill-violet-600" />
        </marker>
      </defs>
      {edges.map((edge) => (
        <g key={edge.key}>
          {/* Viền mờ phía dưới cho đường nổi trên nền */}
          <path d={edge.d} fill="none" strokeWidth={6} strokeLinecap="round" className={cn(edge.isNow ? "stroke-violet-200" : "stroke-violet-100")} />
          <path
            d={edge.d}
            fill="none"
            strokeWidth={edge.isNow ? 2.5 : 2}
            strokeLinecap="round"
            strokeDasharray="6 4"
            markerEnd={`url(#${edge.isNow ? "flow-arrow-now" : "flow-arrow"})`}
            className={edge.isNow ? "stroke-violet-600" : "stroke-violet-400"}
          >
            {/* Dòng chảy chạy theo chiều mũi tên; tắt khi giảm chuyển động */}
            {!reduceMotion && <animate attributeName="stroke-dashoffset" from="20" to="0" dur={edge.isNow ? "0.8s" : "1.4s"} repeatCount="indefinite" />}
          </path>
        </g>
      ))}
    </svg>
  );
};
