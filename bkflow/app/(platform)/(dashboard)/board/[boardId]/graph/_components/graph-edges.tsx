"use client";

import { memo } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import type { GraphEdge } from "../_types";

type GraphEdgesProps = {
  edges: GraphEdge[];
  width: number;
  height: number;
  selectedEdgeKeys: Set<string>;
  /** Cạnh trên chuỗi dài nhất còn lại: vẽ dòng chảy để thấy đường đi chính. */
  criticalEdgeKeys?: Set<string>;
  hasSelection: boolean;
  canEdit?: boolean;
  isConnectingActive?: boolean;
  connectingLine?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
  onDeleteEdge?: (edge: GraphEdge) => void;
};

export const GraphEdges = memo(function GraphEdges({
  edges,
  width,
  height,
  selectedEdgeKeys,
  criticalEdgeKeys,
  hasSelection,
  canEdit,
  isConnectingActive = false,
  connectingLine,
  onDeleteEdge,
}: GraphEdgesProps) {
  const reduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        {/* Normal Arrow */}
        <marker
          id="graph-arrow-normal"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
        </marker>

        {/* Completed Arrow */}
        <marker
          id="graph-arrow-completed"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
        </marker>

        {/* Conflict Arrow */}
        <marker
          id="graph-arrow-conflict"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#f43f5e" />
        </marker>

        {/* Highlighted Arrow */}
        <marker
          id="graph-arrow-highlight"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#7c3aed" />
        </marker>
      </defs>

      {/* Render Existing Edges */}
      {edges.map((edge) => {
        const isSelected = selectedEdgeKeys.has(edge.key);
        const isCritical = !hasSelection && Boolean(criticalEdgeKeys?.has(edge.key));
        const isDimmed = hasSelection && !isSelected;

        const dx = Math.max(48, Math.abs(edge.x2 - edge.x1) * 0.45);
        const path = `M ${edge.x1} ${edge.y1} C ${edge.x1 + dx} ${edge.y1}, ${edge.x2 - dx} ${edge.y2}, ${edge.x2} ${edge.y2}`;

        // Midpoint for delete button
        const midX = (edge.x1 + edge.x2) / 2;
        const midY = (edge.y1 + edge.y2) / 2;

        let strokeColor = "#94a3b8";
        let markerId = "graph-arrow-normal";
        let strokeWidth = 1.75;

        if (edge.hasConflict) {
          strokeColor = "#f43f5e";
          markerId = "graph-arrow-conflict";
          strokeWidth = 2.25;
        } else if (edge.isCompleted) {
          strokeColor = "#10b981";
          markerId = "graph-arrow-completed";
          strokeWidth = 2;
        }

        if (isCritical && !edge.hasConflict) {
          strokeColor = "#7c3aed";
          markerId = "graph-arrow-highlight";
          strokeWidth = 2.5;
        }

        if (isSelected) {
          strokeColor = edge.hasConflict ? "#f43f5e" : "#7c3aed";
          markerId = edge.hasConflict ? "graph-arrow-conflict" : "graph-arrow-highlight";
          strokeWidth = 3;
        }

        return (
          <g
            key={edge.key}
            className={cn(
              "group/edge",
              isDimmed ? "opacity-15 transition-opacity" : "transition-opacity",
            )}
          >
            {/* Wider transparent hit-area for easier hover / delete access */}
            {canEdit && !isConnectingActive && edge.dependencyId && (
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={24}
                className="pointer-events-auto cursor-pointer"
              />
            )}

            {/* Visual Edge Path */}
            <path
              d={path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={isSelected || isCritical ? "6 3" : undefined}
              markerEnd={`url(#${markerId})`}
              strokeLinecap="round"
              className="transition-colors group-hover/edge:stroke-violet-600"
            >
              {(isSelected || isCritical) && !reduceMotion && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="18"
                  to="0"
                  dur="1s"
                  repeatCount="indefinite"
                />
              )}
            </path>

            {/* Delete button directly on edge midpoint (stable hover without transform flicker) */}
            {canEdit && !isConnectingActive && edge.dependencyId && onDeleteEdge && (
              <g
                transform={`translate(${midX}, ${midY})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteEdge(edge);
                }}
                className="pointer-events-auto cursor-pointer opacity-0 transition-opacity duration-150 group-hover/edge:opacity-100"
              >
                {/* 32px diameter invisible hitbox prevents hover loss */}
                <circle r="16" fill="transparent" />

                {/* Visible button badge */}
                <circle
                  r="10"
                  fill="#ffffff"
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  className="filter drop-shadow-xs transition-colors hover:fill-rose-100 hover:stroke-rose-600"
                />
                <path
                  d="M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5"
                  stroke="#e11d48"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* Render Dynamic Live Connecting Line during drag or click connection */}
      {connectingLine && (
        <g className="pointer-events-none">
          {(() => {
            const { x1, y1, x2, y2 } = connectingLine;
            const dx = Math.max(36, Math.abs(x2 - x1) * 0.45);
            const livePath = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            return (
              <>
                {/* Glow underlay */}
                <path
                  d={livePath}
                  fill="none"
                  stroke="#c4b5fd"
                  strokeWidth={5}
                  strokeLinecap="round"
                  className="opacity-60"
                />
                {/* Main animated connecting dashed line */}
                <path
                  d={livePath}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  strokeDasharray="6 4"
                  markerEnd="url(#graph-arrow-highlight)"
                  strokeLinecap="round"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="20"
                    to="0"
                    dur="0.6s"
                    repeatCount="indefinite"
                  />
                </path>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
});
