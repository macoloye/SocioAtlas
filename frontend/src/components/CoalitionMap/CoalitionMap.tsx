import { useRef, useMemo, useState } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import type { Agent, Group } from "@socioatlas/shared";
import { useSimulationStore } from "../../store/simulationStore";

interface GraphNode {
  id: string;
  kind: "group" | "agent";
  label: string;
  description?: string;
  stancePosture?: string;
  primaryIncentive?: string;
  persona?: string;
  stance?: string;
  score?: number;
  incentiveActive?: string | null;
  reasoning?: string;
  groupId?: string;
  color: string;
  size: number;
}

interface GraphLink {
  source: string;
  target: string;
  color: string;
}

const GROUP_COLORS = [
  "#60a5fa", "#a78bfa", "#34d399", "#f59e0b",
  "#f472b6", "#22d3ee", "#fb923c",
];

export function CoalitionMap() {
  const { run, selectAgent, selectedAgentId, activeStage } = useSimulationStore();
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { nodes, links, nodeById } = useMemo(() => {
    if (!run) return { nodes: [], links: [], nodeById: new Map<string, GraphNode>() };

    const stageOutput = run.timeline[activeStage];
    const groups: Group[] = stageOutput?.groups ?? [];
    const agents: Agent[] = run.agents;

    const colorMap = new Map<string, string>();
    groups.forEach((g: Group, i: number) => {
      colorMap.set(g.group_id, GROUP_COLORS[i % GROUP_COLORS.length]);
    });

    const resultByAgent = new Map(
      (stageOutput?.results ?? []).map((r) => [r.agent_id, r])
    );

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeById = new Map<string, GraphNode>();

    groups.forEach((group) => {
      const groupNode: GraphNode = {
        id: `group:${group.group_id}`,
        kind: "group",
        label: group.name,
        description: group.description,
        stancePosture: group.stance_posture,
        primaryIncentive: group.primary_incentive,
        groupId: group.group_id,
        color: colorMap.get(group.group_id) ?? "#888",
        size: 10,
      };
      nodes.push(groupNode);
      nodeById.set(groupNode.id, groupNode);
    });

    agents.forEach((agent) => {
      const result = resultByAgent.get(agent.id);
      const groupId = result?.assigned_group_id;
      const group = groups.find((g) => g.group_id === groupId);
      const groupColor = groupId ? colorMap.get(groupId) ?? "#888" : "#888";
      const node: GraphNode = {
        id: agent.id,
        kind: "agent",
        label: agent.persona,
        persona: agent.persona,
        reasoning: result?.reasoning ?? "No stage reasoning available.",
        stance: result?.stance,
        score: result?.score,
        incentiveActive: result?.incentive_active,
        groupId,
        color: groupColor,
        size: 5,
      };
      nodes.push(node);
      nodeById.set(node.id, node);

      if (groupId && group) {
        links.push({
          source: `group:${group.group_id}`,
          target: agent.id,
          color: groupColor,
        });
      }
    });

    return { nodes, links, nodeById };
  }, [run, activeStage]);

  if (!run) return null;

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;

  return (
    <div className="coalition-map">
      <div className="coalition-header">
        <span className="coalition-title">Coalition Map</span>
        <div className="coalition-legend">
          <span className="legend-item alliance">— Group to member</span>
        </div>
      </div>
      <ForceGraph2D
        ref={fgRef}
        graphData={{ nodes, links }}
        width={560}
        height={340}
        backgroundColor="#0d0d0d"
        nodeLabel={(node) => {
          const n = node as GraphNode;
          return n.kind === "group" ? `${n.label} (Group)` : n.label;
        }}
        nodeRelSize={4}
        nodeColor={(node) =>
          (node as GraphNode).id === selectedNodeId
            ? "#facc15"
            : (node as GraphNode).color
        }
        nodeVal={(node) => (node as GraphNode).size}
        linkColor={(link) => (link as GraphLink).color}
        linkWidth={1.5}
        onNodeClick={(node) => {
          const n = node as GraphNode;
          const id = n.id;
          setSelectedNodeId(selectedNodeId === id ? null : id);

          if (n.kind === "agent") {
            selectAgent(selectedAgentId === id ? null : id);
          } else {
            selectAgent(null);
          }
        }}
        cooldownTicks={80}
      />
      {selectedNode && (
        <div className="coalition-node-detail">
          <div className="detail-header">
            <span className="detail-kind">{selectedNode.kind === "group" ? "GROUP" : "AGENT"}</span>
            <span className="detail-title">{selectedNode.label}</span>
          </div>
          
          <div className="detail-body">
            {selectedNode.kind === "group" ? (
              <>
                <div className="detail-block">
                  <span className="detail-label">Description</span>
                  <p className="detail-text">{selectedNode.description}</p>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Stance:</span>
                  <span className="detail-value">{selectedNode.stancePosture}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Incentive:</span>
                  <span className="detail-value">{selectedNode.primaryIncentive}</span>
                </div>
              </>
            ) : (
              <>
                <div className="detail-row">
                  <span className="detail-label">Stance:</span>
                  <span className="detail-value">{selectedNode.stance} (Score: {selectedNode.score})</span>
                </div>
                <div className="detail-block">
                  <span className="detail-label">Reasoning</span>
                  <p className="detail-text">{selectedNode.reasoning}</p>
                </div>
                 {selectedNode.incentiveActive && (
                  <div className="detail-row">
                    <span className="detail-label">Active Incentive:</span>
                    <span className="detail-value">{selectedNode.incentiveActive}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
