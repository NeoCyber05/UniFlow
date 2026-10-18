import type { BoardTimelineCard, BoardTimelineList, BoardTimelineBoardMember } from "@/types";

export type GraphNode = {
  card: BoardTimelineCard;
  level: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isRoot: boolean;
  isLeaf: boolean;
  isIsolated: boolean;
  hasConflict: boolean;
};

export type GraphEdge = {
  key: string;
  dependencyId?: string;
  fromCardId: string;
  toCardId: string;
  fromTitle?: string;
  toTitle?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isCompleted: boolean;
  hasConflict: boolean;
};

export type GraphColumn = {
  level: number;
  title: string;
  x: number;
  width: number;
  nodeCount: number;
};

export type GraphLayoutResult = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  columns: GraphColumn[];
  width: number;
  height: number;
  nodeMap: Map<string, GraphNode>;
  stats: {
    totalCards: number;
    connectedCards: number;
    isolatedCards: number;
    dependencyCount: number;
    conflictCount: number;
    blockedCount: number;
  };
};

export type GraphFilterMode = "all" | "connected_only";
