import { useEffect, useMemo, useState } from "react";
import type { GraphEdge, GraphNode, GraphSnapshot } from "@socioatlas/shared";
import { useSimulationStore } from "../../store/simulationStore";
import { getGraphSnapshot } from "../../api/client";
import { CoalitionGraphD3 } from "./CoalitionGraphD3";

type ViewMode = "all" | "groups" | "support" | "oppose";
type RenderNode = GraphNode & {
  color: string;
  size: number;
  showLabel?: boolean;
  score?: number;
  contested?: boolean;
  intensity?: 1 | 2 | 3;
  groupId?: string;
  groupLabel?: string;
  reasoning?: string;
  memberCount?: number;
};
type PositionedRenderNode = RenderNode & { x: number; y: number };
type GroupCluster = { group: PositionedRenderNode; members: PositionedRenderNode[] };

function shortenLabel(label: string, maxLength: number) {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}...`;
}

function formatAttrLabel(key: string) {
  return key.replace(/_/g, " ");
}

function stanceColor(score?: number, contested?: boolean) {
  if (contested) return "#a855f7";
  if (score === undefined) return "#9ca3af";
  if (score >= 2) return "#16a34a";
  if (score >= 1) return "#4ade80";
  if (score <= -2) return "#dc2626";
  if (score <= -1) return "#f87171";
  return "#9ca3af";
}

function intensitySize(intensity?: number, selected?: boolean) {
  if (selected) return intensity === 3 ? 14 : 11;
  if (intensity === 3) return 13;
  if (intensity === 1) return 6;
  return 9; // intensity 2 (default)
}

function stanceLabel(score?: number) {
  if (score === undefined) return "Unknown";
  if (score >= 2) return "Strongly support";
  if (score >= 1) return "Support";
  if (score <= -2) return "Strongly oppose";
  if (score <= -1) return "Oppose";
  return "Neutral";
}

function incentiveLabel(value: string | undefined) {
  if (value === "M") return "Material";
  if (value === "S") return "Survival";
  if (value === "I") return "Identity";
  if (value === "N") return "Normative";
  if (value === "P") return "Power";
  return value ?? "Unknown";
}

export function CoalitionMap() {
  const { run, selectAgent, selectedAgentId, activeStage } = useSimulationStore();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [resetToken, setResetToken] = useState(0);
  const completedStageCount = run ? Object.keys(run.timeline).length : 0;

  useEffect(() => {
    if (!run) {
      setSnapshot(null);
      setGraphError(null);
      return;
    }
    if (completedStageCount === 0) {
      setSnapshot(null);
      setGraphError(null);
      return;
    }
    let isMounted = true;
    void (async () => {
      try {
        const next = await getGraphSnapshot(run.run_id);
        if (isMounted) {
          setSnapshot(next);
          setGraphError(null);
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : "Failed to load graph";
          setGraphError(message);
          setSnapshot(null);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [run?.run_id, completedStageCount]);

  const { nodes, edges, nodeById, clusters } = useMemo(() => {
    if (!snapshot) {
      return {
        nodes: [] as PositionedRenderNode[],
        edges: [] as GraphEdge[],
        nodeById: new Map<string, RenderNode>(),
        clusters: [] as GroupCluster[],
      };
    }

    const baseNodeById = new Map(snapshot.nodes.map((node) => [node.id, node] as const));
    const stageEdges = snapshot.edges.filter(
      (edge) =>
        edge.stage === activeStage &&
        edge.edge_type !== "HAS_STAGE" &&
        edge.edge_type !== "HAS_AGENT" &&
        edge.edge_type !== "HAS_GROUP",
    );
    const membershipEdges = stageEdges.filter((edge) => edge.edge_type === "MEMBER_OF");
    const membershipByAgentId = new Map(membershipEdges.map((edge) => [edge.source, edge] as const));

    const allGroupNodes = Array.from(
      new Set(membershipEdges.map((edge) => edge.target)),
    )
      .map((id) => baseNodeById.get(id))
      .filter((node): node is GraphNode => node !== undefined && node.node_type === "group");

    const visibleAgentNodes = Array.from(
      new Set(membershipEdges.map((edge) => edge.source)),
    )
      .map((id) => baseNodeById.get(id))
      .filter((node): node is GraphNode => node !== undefined && node.node_type === "agent")
      .map((node) => {
        const membership = membershipByAgentId.get(node.id);
        const rawIntensity = membership?.attrs.intensity;
        const intensity: 1 | 2 | 3 =
          rawIntensity === 1 || rawIntensity === 2 || rawIntensity === 3 ? rawIntensity : 2;
        return {
          ...node,
          score: typeof membership?.attrs.score === "number" ? membership.attrs.score : undefined,
          contested: membership?.attrs.contested === true,
          intensity,
          groupId: membership?.target,
          groupLabel: baseNodeById.get(membership?.target ?? "")?.label,
          reasoning:
            typeof membership?.attrs.reasoning === "string" ? membership.attrs.reasoning : undefined,
        };
      })
      .filter((node) => {
        if (viewMode === "groups") return false;
        if (viewMode === "support") return (node.score ?? 0) > 0;
        if (viewMode === "oppose") return (node.score ?? 0) < 0;
        return true;
      });

    const visibleAgentIds = new Set(visibleAgentNodes.map((node) => node.id));
    const visibleGroupNodes = allGroupNodes
      .map((groupNode) => {
        const members = membershipEdges.filter(
          (edge) => edge.target === groupNode.id && visibleAgentIds.has(edge.source),
        );
        const avgScore = members.length
          ? members.reduce((sum, edge) => sum + Number(edge.attrs.score ?? 0), 0) / members.length
          : undefined;
        return {
          ...groupNode,
          memberCount: members.length,
          score: avgScore,
        };
      })
      .filter((groupNode) => viewMode === "groups" || (groupNode.memberCount ?? 0) > 0);

    const renderedNodeById = new Map<string, RenderNode>();
    [...visibleGroupNodes, ...visibleAgentNodes].forEach((node) => {
      const isAgent = node.node_type !== "group";
      const intensity = "intensity" in node ? (node.intensity as 1 | 2 | 3 | undefined) : undefined;
      const contested = "contested" in node ? (node.contested as boolean | undefined) : undefined;
      renderedNodeById.set(node.id, {
        ...node,
        color: isAgent ? stanceColor(node.score, contested) : "#eeedfe",
        size: isAgent
          ? intensitySize(intensity, node.id === selectedNodeId)
          : 22 + Math.min(10, (("memberCount" in node ? node.memberCount : 0) ?? 0) * 0.75),
      });
    });

    const membersByGroup = new Map<string, string[]>();
    membershipEdges.forEach((edge) => {
      if (!visibleAgentIds.has(edge.source)) return;
      const members = membersByGroup.get(edge.target) ?? [];
      members.push(edge.source);
      membersByGroup.set(edge.target, members);
    });

    const sortedGroups = [...visibleGroupNodes].sort((left, right) => {
      const leftSize = left.memberCount ?? 0;
      const rightSize = right.memberCount ?? 0;
      return rightSize - leftSize;
    });

    const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(sortedGroups.length))));
    const rows = Math.max(1, Math.ceil(sortedGroups.length / columns));
    const spacingX = 24;
    const spacingY = 18;
    const positionedNodes: PositionedRenderNode[] = [];
    const clustersOut: GroupCluster[] = [];

    sortedGroups.forEach((groupNode, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const groupX = (column - (columns - 1) / 2) * spacingX;
      const groupY = (row - (rows - 1) / 2) * spacingY;
      const renderedGroup = renderedNodeById.get(groupNode.id);
      if (!renderedGroup) return;

      const positionedGroup: PositionedRenderNode = {
        ...renderedGroup,
        showLabel: true,
        x: groupX,
        y: groupY,
      };
      positionedNodes.push(positionedGroup);

      const members = membersByGroup.get(groupNode.id) ?? [];
      const positionedMembers: PositionedRenderNode[] = [];
      members.forEach((agentId, memberIndex) => {
        const renderedAgent = renderedNodeById.get(agentId);
        if (!renderedAgent) return;
        const angle = (memberIndex / Math.max(members.length, 1)) * Math.PI * 2;
        const orbitRadius = 6.8 + Math.min(6.2, members.length * 0.3);
        const labelEvery = members.length > 8 ? 4 : members.length > 4 ? 2 : 1;
        const positionedAgent: PositionedRenderNode = {
          ...renderedAgent,
          showLabel: memberIndex % labelEvery === 0,
          x: groupX + Math.cos(angle) * orbitRadius,
          y: groupY + Math.sin(angle) * orbitRadius,
        };
        positionedNodes.push(positionedAgent);
        positionedMembers.push(positionedAgent);
      });

      clustersOut.push({
        group: positionedGroup,
        members: positionedMembers.sort((left, right) => left.label.localeCompare(right.label)),
      });
    });

    const visibleNodeIds = new Set(renderedNodeById.keys());
    const visibleEdges = stageEdges.filter((edge) => {
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
        return false;
      }
      const sourceNode = renderedNodeById.get(edge.source);
      const targetNode = renderedNodeById.get(edge.target);
      // if (sourceNode?.node_type === "agent" && targetNode?.node_type === "agent") {
      //   return false;
      // }
      if (viewMode === "groups") {
        return edge.edge_type === "COOPERATES_WITH" || edge.edge_type === "COMPETES_WITH";
      }
      return true;
    });

    return {
      nodes: positionedNodes,
      edges: visibleEdges,
      nodeById: renderedNodeById,
      clusters: clustersOut,
    };
  }, [snapshot, activeStage, selectedNodeId, viewMode]);

  const handleNodeSelection = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (!nodeId) {
      selectAgent(null);
      return;
    }
    const selected = nodeById.get(nodeId) ?? null;
    if (selected?.node_type === "agent") {
      const agentId = String(selected.attrs.agent_id ?? "");
      selectAgent(selectedAgentId === agentId ? null : agentId);
      return;
    }
    selectAgent(null);
  };

  if (!run) return null;

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  const selectedCluster = selectedNode
    ? clusters.find(
        (cluster) =>
          cluster.group.id === selectedNode.id ||
          cluster.members.some((member) => member.id === selectedNode.id),
      ) ?? null
    : null;
  const totalAgents = clusters.reduce((sum, cluster) => sum + cluster.members.length, 0);
  const sidebarNode =
    selectedNode?.node_type === "group" ? selectedNode : selectedCluster?.group ?? selectedNode;
  const stancePercent =
    sidebarNode?.score !== undefined
      ? Math.max(0, Math.min(100, ((sidebarNode.score + 2) / 4) * 100))
      : 50;

  const resetView = () => {
    handleNodeSelection(null);
    setResetToken((value) => value + 1);
  };

  return (
    <div className="coalition-map">
      <div className="coalition-layout">
        <div className="coalition-canvas-area">
          <div className="coalition-hud coalition-hud-top">
            <div>
              <span className="coalition-hud-label">Knowledge graph</span>
              <strong>Coalition topology</strong>
            </div>
            <div className="coalition-hud-metrics">
              <span>{clusters.length} groups</span>
            </div>
          </div>

          <div className="coalition-toolbar coalition-toolbar-overlay">
            <button
              type="button"
              className={`coalition-toolbar-btn ${viewMode === "all" ? "active" : ""}`}
              onClick={() => setViewMode("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`coalition-toolbar-btn ${viewMode === "groups" ? "active" : ""}`}
              onClick={() => setViewMode("groups")}
            >
              Groups only
            </button>
            <button
              type="button"
              className={`coalition-toolbar-btn ${viewMode === "support" ? "active" : ""}`}
              onClick={() => setViewMode("support")}
            >
              Support
            </button>
            <button
              type="button"
              className={`coalition-toolbar-btn ${viewMode === "oppose" ? "active" : ""}`}
              onClick={() => setViewMode("oppose")}
            >
              Oppose
            </button>
            <button type="button" className="coalition-toolbar-btn" onClick={resetView}>
              Reset
            </button>
          </div>

          <div className="coalition-legend">
            <div className="coalition-legend-row">
              <span className="coalition-legend-dot coalition-legend-dot-group" />
              <span>Group</span>
            </div>
            <div className="coalition-legend-row">
              <span className="coalition-legend-dot coalition-legend-dot-support" />
              <span>Support agent</span>
            </div>
            <div className="coalition-legend-row">
              <span className="coalition-legend-dot coalition-legend-dot-neutral" />
              <span>Neutral agent</span>
            </div>
            <div className="coalition-legend-row">
              <span className="coalition-legend-dot coalition-legend-dot-oppose" />
              <span>Oppose agent</span>
            </div>
            <div className="coalition-legend-row">
              <span className="coalition-legend-dot" style={{ background: "#a855f7" }} />
              <span>Contested agent</span>
            </div>
          </div>

          {graphError ? (
            <div className="coalition-empty">Graph unavailable: {graphError}</div>
          ) : completedStageCount === 0 ? (
            <div className="coalition-empty">Building coalition map...</div>
          ) : nodes.length === 0 ? (
            <div className="coalition-empty">No nodes available for this view yet.</div>
          ) : (
            <CoalitionGraphD3
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleNodeSelection}
              resetToken={resetToken}
            />
          )}
          <aside className="coalition-detail-float">
            {!selectedNode ? (
              <div className="coalition-hint">
                Click any node to inspect it. Drag to pan. Scroll to zoom.
              </div>
            ) : (
              <div className="coalition-node-detail coalition-node-detail-sidebar">
                <div className="detail-header">
                  <span className="detail-kind">{selectedNode.node_type.toUpperCase()}</span>
                  <span className="detail-title">{selectedNode.label}</span>
                </div>

                <div className="detail-body">
                  {selectedNode.node_type === "group" ? (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Primary incentive</span>
                        <span className="detail-value">
                          {incentiveLabel(String(selectedNode.attrs.primary_incentive ?? ""))}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Avg stance</span>
                        <span className="detail-value" style={{ color: stanceColor(selectedNode.score) }}>
                          {selectedNode.score !== undefined
                            ? `${selectedNode.score > 0 ? "+" : ""}${selectedNode.score.toFixed(1)}`
                            : "Unknown"}
                        </span>
                      </div>
                      <div className="stance-bar">
                        <div
                          className="stance-fill"
                          style={{ width: `${stancePercent}%`, background: stanceColor(selectedNode.score) }}
                        />
                      </div>
                      <div className="detail-block">
                        <span className="detail-label">Description</span>
                        <span className="detail-text">
                          {String(selectedNode.attrs.description ?? "No description available yet.")}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Group</span>
                        <span className="detail-value">
                          <button
                            type="button"
                            className="coalition-member-chip"
                            onClick={() => handleNodeSelection(selectedNode.groupId ?? null)}
                          >
                            {selectedNode.groupLabel ?? "Unknown"}
                          </button>
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Stance</span>
                        <span
                          className="detail-value"
                          style={{ color: stanceColor(selectedNode.score, selectedNode.contested) }}
                        >
                          {selectedNode.contested ? "Contested" : stanceLabel(selectedNode.score)}
                        </span>
                      </div>
                      {selectedNode.contested && (
                        <div className="detail-row">
                          <span className="detail-label">Contested</span>
                          <span className="detail-value" style={{ color: "#a855f7" }}>
                            Internally split
                          </span>
                        </div>
                      )}
                      {selectedNode.intensity !== undefined && (
                        <div className="detail-row">
                          <span className="detail-label">Intensity</span>
                          <span className="detail-value">
                            {selectedNode.intensity === 1
                              ? "Low (background)"
                              : selectedNode.intensity === 3
                                ? "High (loud)"
                                : "Medium"}
                          </span>
                        </div>
                      )}
                      <div className="stance-bar">
                        <div
                          className="stance-fill"
                          style={{
                            width: `${stancePercent}%`,
                            background: stanceColor(selectedNode.score, selectedNode.contested),
                          }}
                        />
                      </div>
                      {selectedNode.reasoning && (
                        <div className="detail-block">
                          <span className="detail-label">Reasoning</span>
                          <span className="detail-text">{selectedNode.reasoning}</span>
                        </div>
                      )}
                      {selectedCluster && (
                        <div className="detail-block">
                          <span className="detail-label">Coalition peers</span>
                          <div className="coalition-member-chips">
                            {selectedCluster.members
                              .filter((member) => member.id !== selectedNode.id)
                              .map((member) => (
                                <button
                                  type="button"
                                  key={member.id}
                                  className="coalition-member-chip"
                                  onClick={() => handleNodeSelection(member.id)}
                                  title={member.label}
                                >
                                  {shortenLabel(member.label, 30)}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {Object.entries(selectedNode.attrs)
                    .filter(([key]) =>
                      !["description", "primary_incentive", "group_id", "agent_id", "persona"].includes(key),
                    )
                    .map(([key, value]) => (
                      <div className="detail-row" key={key}>
                        <span className="detail-label">{formatAttrLabel(key)}</span>
                        <span className="detail-value">{String(value)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
