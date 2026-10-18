import { BoardMemberRole } from "@/types";
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/web/shims/next-navigation";

import { toast } from "sonner";
import { toPng } from "html-to-image";
import { Info, Network, Sparkles, X } from "lucide-react";

import { useCardModal } from "@/hooks/use-card-modal";
import { useAction } from "@/hooks/use-action";
import { createCardDependency } from "@/actions/dependencies/create-card-dependency";
import { deleteCardDependency } from "@/actions/dependencies/delete-card-dependency";
import { buildBoardExportFileName } from "@/lib/exports/filename";
import { cn } from "@/lib/utils";
import type { BoardTimelineBoardMember, BoardTimelineList } from "@/types";

import type { GraphEdge, GraphFilterMode, GraphNode } from "../_types";
import { computeGraphLayout, getConnectedChain } from "../_lib/graph-layout";
import { GraphNodeComponent } from "./graph-node";
import { GraphEdges } from "./graph-edges";
import { GraphToolbar } from "./graph-toolbar";
import { GraphLegend } from "./graph-legend";
import { AutoChainDialog } from "./auto-chain-dialog";

type BoardGraphViewProps = {
  boardId: string;
  boardTitle: string;
  lists: BoardTimelineList[];
  boardMembers: BoardTimelineBoardMember[];
  currentUserId: string;
  currentBoardMemberId: string;
  currentMemberRole: BoardMemberRole;
};

export const BoardGraphView = ({
  boardId,
  boardTitle,
  lists,
  currentMemberRole,
}: BoardGraphViewProps) => {
  const router = useRouter();
  const cardModal = useCardModal();
  const canEdit = currentMemberRole !== BoardMemberRole.VIEWER;

  // Extract all cards
  const allCards = useMemo(() => lists.flatMap((list) => list.cards), [lists]);

  // Check initial connected cards
  const hasAnyConnections = useMemo(() => {
    return allCards.some(
      (c) => c.blockedByDependencies.length > 0 || c.blockingDependencies.length > 0,
    );
  }, [allCards]);

  const [filterMode, setFilterMode] = useState<GraphFilterMode>(
    hasAnyConnections ? "connected_only" : "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Connecting line state (Drag & Drop or Click-to-Connect)
  const [connectingSourceNode, setConnectingSourceNode] = useState<GraphNode | null>(null);
  const [connectingMousePos, setConnectingMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingConnect, setIsDraggingConnect] = useState(false);
  const [hoverTargetNode, setHoverTargetNode] = useState<GraphNode | null>(null);
  const [isAutoChainOpen, setIsAutoChainOpen] = useState(false);

  // Server actions for dependencies
  const { execute: executeCreateDependency } = useAction(createCardDependency, {
    onSuccess: () => {
      toast.success("Đã thiết lập liên kết phụ thuộc thành công!");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeDeleteDependency } = useAction(deleteCardDependency, {
    onSuccess: () => {
      toast.success("Đã xóa liên kết phụ thuộc!");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Compute Layout
  const layout = useMemo(() => {
    return computeGraphLayout(allCards, filterMode);
  }, [allCards, filterMode]);

  // Chain selection
  const chain = useMemo(() => {
    if (!activeCardId) {
      return {
        ancestorIds: new Set<string>(),
        descendantIds: new Set<string>(),
        connectedEdgeKeys: new Set<string>(),
      };
    }
    return getConnectedChain(activeCardId, layout.nodes);
  }, [activeCardId, layout.nodes]);

  // Fit view calculation
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (layout.width === 0 || layout.height === 0) return;

    const scaleX = (clientWidth - 80) / layout.width;
    const scaleY = (clientHeight - 120) / layout.height;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.45), 1.1);

    const nextPanX = Math.max(20, (clientWidth - layout.width * nextZoom) / 2);
    const nextPanY = Math.max(20, (clientHeight - layout.height * nextZoom) / 2);

    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: Math.round(nextPanX), y: Math.round(nextPanY) });
  }, [layout.width, layout.height]);

  // Run initial fit view on mount or layout change if cards loaded
  useEffect(() => {
    if (allCards.length > 0) {
      handleFitView();
    }
  }, [handleFitView, allCards.length]);

  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.15).toFixed(2)), 1.8));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.15).toFixed(2)), 0.4));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 40, y: 30 });
  };

  // Helper to convert mouse client coordinates to canvas coordinates
  const getCanvasCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const canvasX = (clientX - rect.left - pan.x) / zoom;
      const canvasY = (clientY - rect.top - pan.y) / zoom;
      return { x: canvasX, y: canvasY };
    },
    [pan.x, pan.y, zoom],
  );

  // Keep refs for active connecting state so global event handlers always access the latest values
  const connectingSourceNodeRef = useRef<GraphNode | null>(null);
  connectingSourceNodeRef.current = connectingSourceNode;

  const isDraggingConnectRef = useRef(false);
  isDraggingConnectRef.current = isDraggingConnect;

  const hoverTargetNodeRef = useRef<GraphNode | null>(null);
  hoverTargetNodeRef.current = hoverTargetNode;

  // Handle ESC key to cancel connection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConnectingSourceNode(null);
        setIsDraggingConnect(false);
        setConnectingMousePos(null);
        setHoverTargetNode(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Connection Handlers
  const handleStartConnectDrag = useCallback(
    (
      e: React.PointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>,
      node: GraphNode,
    ) => {
      if (!canEdit) return;
      setConnectingSourceNode(node);
      setIsDraggingConnect(true);
      connectingSourceNodeRef.current = node;
      isDraggingConnectRef.current = true;
      hoverTargetNodeRef.current = null;
      setHoverTargetNode(null);
      const coords = getCanvasCoords(e.clientX, e.clientY);
      setConnectingMousePos(coords);
    },
    [canEdit, getCanvasCoords],
  );

  const handlePortClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, node: GraphNode) => {
      if (!canEdit) return;
      if (connectingSourceNode?.card.id === node.card.id) {
        // Toggle off if clicking the same node port
        setConnectingSourceNode(null);
        setConnectingMousePos(null);
        setHoverTargetNode(null);
        setIsDraggingConnect(false);
      } else {
        setConnectingSourceNode(node);
        setIsDraggingConnect(false);
        const coords = getCanvasCoords(e.clientX, e.clientY);
        setConnectingMousePos(coords);
        toast.info(
          `Đã chọn "${node.card.title}". Nhấn vào công việc tiếp theo để hoàn tất nối (Esc để hủy).`,
        );
      }
    },
    [canEdit, connectingSourceNode, getCanvasCoords],
  );

  const handleSelectTarget = useCallback(
    (targetNode: GraphNode) => {
      const source = connectingSourceNodeRef.current || connectingSourceNode;
      if (!canEdit || !source) return;

      if (source.card.id === targetNode.card.id) {
        toast.error("Một công việc không thể phụ thuộc vào chính nó!");
        setConnectingSourceNode(null);
        setIsDraggingConnect(false);
        setConnectingMousePos(null);
        setHoverTargetNode(null);
        return;
      }

      // Check if dependency already exists
      const alreadyConnected = targetNode.card.blockedByDependencies.some(
        (d) => d.cardId === source.card.id,
      );
      if (alreadyConnected) {
        toast.info("Liên kết phụ thuộc giữa 2 công việc này đã tồn tại.");
        setConnectingSourceNode(null);
        setIsDraggingConnect(false);
        setConnectingMousePos(null);
        setHoverTargetNode(null);
        return;
      }

      // Execute create dependency
      executeCreateDependency({
        boardId,
        blockerCardId: source.card.id,
        blockedCardId: targetNode.card.id,
      });

      // Reset connecting state
      setConnectingSourceNode(null);
      setIsDraggingConnect(false);
      setConnectingMousePos(null);
      setHoverTargetNode(null);
    },
    [boardId, canEdit, connectingSourceNode, executeCreateDependency],
  );

  // Global window pointer listener for ultra-smooth Drag-to-Connect
  useEffect(() => {
    if (!isDraggingConnect) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      // 1. Update cursor canvas coords for live curve
      const coords = getCanvasCoords(e.clientX, e.clientY);
      setConnectingMousePos(coords);

      const source = connectingSourceNodeRef.current;
      if (!source) return;

      // 2. Identify target card directly under the cursor
      const targetElem = document.elementFromPoint(e.clientX, e.clientY);
      const cardContainer = targetElem?.closest("[data-graph-card-id]");
      const cardId = cardContainer?.getAttribute("data-graph-card-id");

      if (cardId && cardId !== source.card.id) {
        const targetNode = layout.nodeMap.get(cardId);
        setHoverTargetNode(targetNode || null);
        hoverTargetNodeRef.current = targetNode || null;
      } else {
        setHoverTargetNode(null);
        hoverTargetNodeRef.current = null;
      }
    };

    const handleWindowPointerUp = () => {
      const source = connectingSourceNodeRef.current;
      const target = hoverTargetNodeRef.current;

      if (source && target && source.card.id !== target.card.id) {
        // Complete connection!
        handleSelectTarget(target);
      } else {
        // Released on empty canvas
        setConnectingSourceNode(null);
        setConnectingMousePos(null);
        setHoverTargetNode(null);
      }

      setIsDraggingConnect(false);
      isDraggingConnectRef.current = false;
      connectingSourceNodeRef.current = null;
      hoverTargetNodeRef.current = null;
    };

    window.addEventListener("pointermove", handleWindowPointerMove, { passive: true });
    window.addEventListener("pointerup", handleWindowPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [isDraggingConnect, getCanvasCoords, handleSelectTarget, layout.nodeMap]);

  const handleDeleteEdge = useCallback(
    (edge: GraphEdge) => {
      if (!canEdit || !edge.dependencyId) return;
      executeDeleteDependency({
        boardId,
        dependencyId: edge.dependencyId,
      });
    },
    [boardId, canEdit, executeDeleteDependency],
  );

  // Compute live connecting line coordinates
  const connectingLine = useMemo(() => {
    if (!connectingSourceNode || !connectingMousePos) return null;
    const x1 = connectingSourceNode.x + connectingSourceNode.width;
    const y1 = connectingSourceNode.y + connectingSourceNode.height / 2;
    const x2 = hoverTargetNode ? hoverTargetNode.x : connectingMousePos.x;
    const y2 = hoverTargetNode
      ? hoverTargetNode.y + hoverTargetNode.height / 2
      : connectingMousePos.y;
    return { x1, y1, x2, y2 };
  }, [connectingSourceNode, connectingMousePos, hoverTargetNode]);

  // Mouse pan & connect handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan on left click on canvas background when not connecting
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.("[data-graph-card-id]")) {
      // Do not process canvas click/pan if user clicked on a card
      return;
    }
    if (connectingSourceNode && !isDraggingConnect) {
      // Clicking on empty canvas while in click-to-connect mode cancels it
      setConnectingSourceNode(null);
      setConnectingMousePos(null);
      setHoverTargetNode(null);
      return;
    }
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (connectingSourceNode && !isDraggingConnect) {
      // Follow cursor in click-to-connect mode
      const coords = getCanvasCoords(e.clientX, e.clientY);
      setConnectingMousePos(coords);
    }
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Native wheel listener on container with passive: false to prevent browser page zoom on touchpad pinch
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // Prevent browser full page zoom and outer page scroll
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      if (e.ctrlKey) {
        // Touchpad pinch-to-zoom OR Ctrl + Wheel
        // Negative deltaY means zooming in, positive means zooming out
        const zoomFactor = -e.deltaY * 0.01;
        setZoom((prevZoom) => {
          const nextZoom = Math.min(
            Math.max(Number((prevZoom * Math.exp(zoomFactor)).toFixed(2)), 0.35),
            2.2,
          );

          // Zoom toward mouse pointer position
          setPan((prevPan) => {
            const canvasX = (mouseX - prevPan.x) / prevZoom;
            const canvasY = (mouseY - prevPan.y) / prevZoom;
            const nextPanX = mouseX - canvasX * nextZoom;
            const nextPanY = mouseY - canvasY * nextZoom;
            return { x: Math.round(nextPanX), y: Math.round(nextPanY) };
          });

          return nextZoom;
        });
      } else {
        // Touchpad 2-finger scroll / mouse wheel: Pan the canvas smoothly
        setPan((prevPan) => ({
          x: Math.round(prevPan.x - e.deltaX),
          y: Math.round(prevPan.y - e.deltaY),
        }));
      }
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
    };
  }, []);

  // Export PNG
  const handleExportPng = async () => {
    if (!canvasRef.current || isExporting) return;
    setIsExporting(true);

    try {
      const toastId = toast.loading("Đang chuẩn bị ảnh sơ đồ...");
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        backgroundColor: "#f8fafc",
      });

      const fileName = buildBoardExportFileName(boardTitle, "graph", "png");
      const link = document.createElement("a");
      link.download = fileName;
      link.href = dataUrl;
      link.click();

      toast.success("Đã xuất ảnh sơ đồ thành công!", { id: toastId });
    } catch {
      toast.error("Không thể xuất ảnh sơ đồ. Vui lòng thử lại!");
    } finally {
      setIsExporting(false);
    }
  };

  const activeCard = activeCardId ? layout.nodeMap.get(activeCardId)?.card : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-neutral-900/10 shadow-lg backdrop-blur-md">
      {/* Top Controls Toolbar */}
      <GraphToolbar
        filterMode={filterMode}
        onFilterModeChange={setFilterMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitView={handleFitView}
        onExportPng={handleExportPng}
        isExporting={isExporting}
        totalCardsCount={layout.stats.totalCards}
        connectedCardsCount={layout.stats.connectedCards}
        canEdit={canEdit}
        onOpenAutoChain={() => setIsAutoChainOpen(true)}
      />

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest?.("[data-graph-card-id]")) {
            return;
          }
          setActiveCardId(null);
        }}
        className={cn(
          "relative flex-1 overflow-hidden bg-slate-50/90 select-none",
          connectingSourceNode
            ? "cursor-crosshair"
            : isPanning
            ? "cursor-grabbing"
            : "cursor-grab",
        )}
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(148, 163, 184, 0.25) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* Connection Active Top HUD Banner */}
        {connectingSourceNode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 rounded-full border border-violet-300 bg-white/95 px-4 py-2 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-600" />
            </span>
            <div className="text-xs">
              <span className="text-neutral-500">Đang nối từ: </span>
              <span className="font-bold text-violet-900">{connectingSourceNode.card.title}</span>
              <span className="text-neutral-500"> ➔ Nhấn hoặc thả vào thẻ tiếp theo</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setConnectingSourceNode(null);
                setIsDraggingConnect(false);
                setConnectingMousePos(null);
                setHoverTargetNode(null);
              }}
              className="ml-1 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition cursor-pointer"
              title="Hủy kết nối (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Empty State warning if connected_only but 0 connections */}
        {layout.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 shadow-sm mb-4">
              <Network className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-neutral-800">
              {filterMode === "connected_only"
                ? "Chưa có công việc nào được gán quan hệ phụ thuộc"
                : "Bảng chưa có công việc nào"}
            </h3>
            <p className="mt-1.5 max-w-md text-xs text-neutral-500">
              {filterMode === "connected_only"
                ? "Bạn có thể mở bất kỳ thẻ nào, cuộn xuống mục 'Phụ thuộc' để liên kết thẻ trước/thẻ sau, hoặc chuyển sang chế độ xem tất cả thẻ."
                : "Hãy tạo công việc mới trên bảng để bắt đầu vẽ sơ đồ mạng lưới phụ thuộc."}
            </p>
            {filterMode === "connected_only" && (
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Hiển thị tất cả công việc ({layout.stats.totalCards})</span>
              </button>
            )}
          </div>
        )}

        {/* Zoomable & Pannable Canvas */}
        <div
          ref={canvasRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: `${layout.width}px`,
            height: `${layout.height}px`,
          }}
          className="relative transition-transform duration-75"
        >
          {/* SVG Edges */}
          <GraphEdges
            edges={layout.edges}
            width={layout.width}
            height={layout.height}
            selectedEdgeKeys={chain.connectedEdgeKeys}
            hasSelection={Boolean(activeCardId)}
            canEdit={canEdit}
            isConnectingActive={Boolean(connectingSourceNode)}
            connectingLine={connectingLine}
            onDeleteEdge={handleDeleteEdge}
          />

          {/* Graph Nodes */}
          {layout.nodes.map((node) => {
            const isSelected = activeCardId === node.card.id;
            const isAncestor = chain.ancestorIds.has(node.card.id);
            const isDescendant = chain.descendantIds.has(node.card.id);
            const isMatchedBySearch =
              searchQuery.trim().length > 0 &&
              node.card.title.toLowerCase().includes(searchQuery.toLowerCase());

            const isDimmed =
              Boolean(activeCardId) && !isSelected && !isAncestor && !isDescendant;

            return (
              <div
                key={node.card.id}
                className={cn(
                  isMatchedBySearch && "ring-4 ring-amber-400 rounded-xl animate-bounce",
                )}
              >
                <GraphNodeComponent
                  node={node}
                  boardId={boardId}
                  isSelected={isSelected}
                  isAncestor={isAncestor}
                  isDescendant={isDescendant}
                  isDimmed={isDimmed}
                  canEdit={canEdit}
                  isConnectingSource={connectingSourceNode?.card.id === node.card.id}
                  isConnectingHoverTarget={hoverTargetNode?.card.id === node.card.id}
                  isConnectionCandidate={Boolean(
                    connectingSourceNode && connectingSourceNode.card.id !== node.card.id,
                  )}
                  onClick={(cardId) => setActiveCardId(cardId)}
                  onOpenCardModal={(cardId) => cardModal.onOpen(cardId)}
                  onStartConnectDrag={handleStartConnectDrag}
                  onPortClick={handlePortClick}
                  onMouseEnterTarget={(n) => setHoverTargetNode(n)}
                  onMouseLeaveTarget={() => setHoverTargetNode(null)}
                  onSelectTarget={handleSelectTarget}
                />
              </div>
            );
          })}
        </div>

        {/* Selected Card Chain HUD Info Banner */}
        {activeCard && (
          <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-xl border border-violet-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
            <Info className="h-4 w-4 text-violet-600 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-neutral-900 line-clamp-1">
                {activeCard.title}
              </span>
              <div className="flex items-center gap-2 text-neutral-500 text-[11px] mt-0.5">
                <span className="text-amber-700 font-medium">
                  {chain.ancestorIds.size} thẻ làm trước
                </span>
                <span>•</span>
                <span className="text-emerald-700 font-medium">
                  {chain.descendantIds.size} thẻ mở khóa sau
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveCardId(null)}
              className="ml-2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
              title="Đóng chi tiết chuỗi"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Summary Legend */}
      <GraphLegend stats={layout.stats} />

      {/* Auto Chain Dialog */}
      <AutoChainDialog
        isOpen={isAutoChainOpen}
        onClose={() => setIsAutoChainOpen(false)}
        boardId={boardId}
        lists={lists}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
};
