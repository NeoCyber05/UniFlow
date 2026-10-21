import type { BoardTimelineCard } from "@/types";
import type { GraphColumn, GraphEdge, GraphLayoutResult, GraphNode, GraphFilterMode } from "../_types";

export const NODE_WIDTH = 270;
export const NODE_HEIGHT = 118;
export const GAP_X = 140;
export const GAP_Y = 32;
export const PAD_X = 60;
export const PAD_Y = 40;

const getLevelTitle = (level: number, maxLevel: number): string => {
  if (maxLevel === 0) return "Tất cả công việc";
  if (level === 0) return "Bước 1 · làm trước";
  if (level === maxLevel) return `Bước ${level + 1} · cuối`;
  return `Bước ${level + 1}`;
};

export const computeGraphLayout = (
  cards: BoardTimelineCard[],
  filterMode: GraphFilterMode = "all",
): GraphLayoutResult => {
  const cardMap = new Map<string, BoardTimelineCard>();
  for (const card of cards) {
    cardMap.set(card.id, card);
  }

  // Pre-calculate valid in-board dependencies
  const blockersByCardId = new Map<string, string[]>();
  const blockeesByCardId = new Map<string, string[]>();

  let totalDependencyCount = 0;
  let conflictCount = 0;
  let blockedCount = 0;

  for (const card of cards) {
    const validBlockers = card.blockedByDependencies
      .map((d) => d.cardId)
      .filter((id) => cardMap.has(id));
    const validBlockees = card.blockingDependencies
      .map((d) => d.cardId)
      .filter((id) => cardMap.has(id));

    blockersByCardId.set(card.id, validBlockers);
    blockeesByCardId.set(card.id, validBlockees);

    totalDependencyCount += validBlockers.length;
    if (validBlockers.some((id) => !cardMap.get(id)?.isCompleted)) {
      blockedCount += 1;
    }
  }

  // Filter cards based on filterMode
  const targetCards = cards.filter((card) => {
    const blockers = blockersByCardId.get(card.id) ?? [];
    const blockees = blockeesByCardId.get(card.id) ?? [];
    const hasAnyDependency = blockers.length > 0 || blockees.length > 0;

    if (filterMode === "connected_only") {
      return hasAnyDependency;
    }
    return true;
  });

  const targetCardIds = new Set(targetCards.map((c) => c.id));

  // Compute levels using memoized DFS with cycle detection
  const levelMemo = new Map<string, number>();
  const visiting = new Set<string>();

  const getCardLevel = (cardId: string): number => {
    if (levelMemo.has(cardId)) {
      return levelMemo.get(cardId)!;
    }
    if (visiting.has(cardId)) {
      // Cycle detected, break cycle
      return 0;
    }

    visiting.add(cardId);
    const blockers = (blockersByCardId.get(cardId) ?? []).filter((id) => targetCardIds.has(id));

    let maxBlockerLevel = -1;
    for (const blockerId of blockers) {
      const bLevel = getCardLevel(blockerId);
      if (bLevel > maxBlockerLevel) {
        maxBlockerLevel = bLevel;
      }
    }

    visiting.delete(cardId);

    const result = Math.min(maxBlockerLevel + 1, 15);
    levelMemo.set(cardId, result);
    return result;
  };

  for (const card of targetCards) {
    getCardLevel(card.id);
  }

  // Group by level
  const levelGroups = new Map<number, BoardTimelineCard[]>();
  let maxLevel = 0;

  for (const card of targetCards) {
    const level = levelMemo.get(card.id) ?? 0;
    if (level > maxLevel) maxLevel = level;

    const group = levelGroups.get(level) ?? [];
    group.push(card);
    levelGroups.set(level, group);
  }

  // Sort cards inside each level for optimal visual flow
  for (const [level, group] of levelGroups.entries()) {
    group.sort((a, b) => {
      // Completed cards sorted towards bottom
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      // Sort by list order if different
      if (a.listOrder !== b.listOrder) {
        return a.listOrder - b.listOrder;
      }
      return a.order - b.order;
    });
    levelGroups.set(level, group);
  }

  // Layout Nodes
  const nodes: GraphNode[] = [];
  const nodeMap = new Map<string, GraphNode>();

  let maxCanvasY = PAD_Y;

  for (let l = 0; l <= maxLevel; l += 1) {
    const group = levelGroups.get(l) ?? [];
    const colX = PAD_X + l * (NODE_WIDTH + GAP_X);

    group.forEach((card, idx) => {
      const blockers = (blockersByCardId.get(card.id) ?? []).filter((id) => targetCardIds.has(id));
      const blockees = (blockeesByCardId.get(card.id) ?? []).filter((id) => targetCardIds.has(id));

      const isIsolated = blockers.length === 0 && blockees.length === 0;
      const isRoot = blockers.length === 0 && blockees.length > 0;
      const isLeaf = blockers.length > 0 && blockees.length === 0;

      // Check conflict
      let hasConflict = false;
      for (const blockerId of blockers) {
        const blockerCard = cardMap.get(blockerId);
        if (blockerCard?.dueDate && (card.startDate || card.dueDate)) {
          const targetDateStr = card.startDate || card.dueDate!;
          if (new Date(blockerCard.dueDate) > new Date(targetDateStr)) {
            hasConflict = true;
            break;
          }
        }
      }

      const nodeY = PAD_Y + idx * (NODE_HEIGHT + GAP_Y);
      if (nodeY + NODE_HEIGHT > maxCanvasY) {
        maxCanvasY = nodeY + NODE_HEIGHT;
      }

      const node: GraphNode = {
        card,
        level: l,
        x: colX,
        y: nodeY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        isRoot,
        isLeaf,
        isIsolated,
        hasConflict,
      };

      nodes.push(node);
      nodeMap.set(card.id, node);
    });
  }

  // Layout Edges
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  for (const blockedNode of nodes) {
    const blockers = (blockersByCardId.get(blockedNode.card.id) ?? []).filter((id) => targetCardIds.has(id));

    for (const blockerId of blockers) {
      const blockerNode = nodeMap.get(blockerId);
      if (!blockerNode) continue;

      const edgeKey = `${blockerId}->${blockedNode.card.id}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);

      // Conflict check
      let hasConflict = false;
      if (blockerNode.card.dueDate && (blockedNode.card.startDate || blockedNode.card.dueDate)) {
        const targetDateStr = blockedNode.card.startDate || blockedNode.card.dueDate!;
        if (new Date(blockerNode.card.dueDate) > new Date(targetDateStr)) {
          hasConflict = true;
          conflictCount += 1;
        }
      }

      const dep = blockedNode.card.blockedByDependencies.find((d) => d.cardId === blockerId);

      edges.push({
        key: edgeKey,
        dependencyId: dep?.id,
        fromCardId: blockerId,
        toCardId: blockedNode.card.id,
        fromTitle: blockerNode.card.title,
        toTitle: blockedNode.card.title,
        x1: blockerNode.x + blockerNode.width,
        y1: blockerNode.y + blockerNode.height / 2,
        x2: blockedNode.x,
        y2: blockedNode.y + blockedNode.height / 2,
        isCompleted: blockerNode.card.isCompleted,
        hasConflict,
      });
    }
  }

  // Layout Columns headers
  const columns: GraphColumn[] = [];
  for (let l = 0; l <= maxLevel; l += 1) {
    const group = levelGroups.get(l) ?? [];
    columns.push({
      level: l,
      title: getLevelTitle(l, maxLevel),
      x: PAD_X + l * (NODE_WIDTH + GAP_X),
      width: NODE_WIDTH,
      nodeCount: group.length,
    });
  }

  const canvasWidth = Math.max(1200, PAD_X * 2 + (maxLevel + 1) * NODE_WIDTH + maxLevel * GAP_X);
  const canvasHeight = Math.max(700, maxCanvasY + PAD_Y);

  const connectedCardsCount = cards.filter((c) => {
    const b = blockersByCardId.get(c.id) ?? [];
    const k = blockeesByCardId.get(c.id) ?? [];
    return b.length > 0 || k.length > 0;
  }).length;

  return {
    nodes,
    edges,
    columns,
    width: canvasWidth,
    height: canvasHeight,
    nodeMap,
    stats: {
      totalCards: cards.length,
      connectedCards: connectedCardsCount,
      isolatedCards: cards.length - connectedCardsCount,
      dependencyCount: totalDependencyCount,
      conflictCount,
      blockedCount,
    },
  };
};

/**
 * Finds all ancestors (blockers) and descendants (blockees) for a given card ID
 */
export const getConnectedChain = (
  cardId: string,
  nodes: GraphNode[],
): {
  ancestorIds: Set<string>;
  descendantIds: Set<string>;
  connectedEdgeKeys: Set<string>;
} => {
  const ancestorIds = new Set<string>();
  const descendantIds = new Set<string>();
  const connectedEdgeKeys = new Set<string>();

  const nodeMap = new Map(nodes.map((n) => [n.card.id, n]));

  // Traverse upstream (ancestors / blockers)
  const traverseUp = (currId: string, visited: Set<string>) => {
    if (visited.has(currId)) return;
    visited.add(currId);

    const node = nodeMap.get(currId);
    if (!node) return;

    for (const dep of node.card.blockedByDependencies) {
      ancestorIds.add(dep.cardId);
      connectedEdgeKeys.add(`${dep.cardId}->${currId}`);
      traverseUp(dep.cardId, visited);
    }
  };

  // Traverse downstream (descendants / blockees)
  const traverseDown = (currId: string, visited: Set<string>) => {
    if (visited.has(currId)) return;
    visited.add(currId);

    const node = nodeMap.get(currId);
    if (!node) return;

    for (const dep of node.card.blockingDependencies) {
      descendantIds.add(dep.cardId);
      connectedEdgeKeys.add(`${currId}->${dep.cardId}`);
      traverseDown(dep.cardId, visited);
    }
  };

  traverseUp(cardId, new Set<string>());
  traverseDown(cardId, new Set<string>());

  return {
    ancestorIds,
    descendantIds,
    connectedEdgeKeys,
  };
};
