import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Group, StanceResult, StageOutput } from "@socioatlas/shared";
import { useSimulationStore } from "../../store/simulationStore";
import {
  scoreToColor,
  scoreToIcon,
  stanceLabelToScore,
} from "../../utils/stanceHelpers";

interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

function StanceCell({
  result,
  onHover,
}: {
  result: StanceResult | undefined;
  onHover: (e: React.MouseEvent, text: string) => void;
}) {
  if (!result) return <span className="stance-cell stance-missing">—</span>;

  const score = stanceLabelToScore(result.stance);
  const color = scoreToColor(score);
  const icon = scoreToIcon(score);

  return (
    <span
      className="stance-cell"
      style={{ color }}
      onMouseEnter={(e) =>
        onHover(e, `${result.stance}\n\n${result.reasoning}`)
      }
      onMouseLeave={() => onHover({ clientX: 0, clientY: 0 } as React.MouseEvent, "")}
    >
      <span className="stance-icon">{icon}</span>
      <span className="stance-label">{result.stance}</span>
    </span>
  );
}

export function StanceMatrix() {
  const { run, activeStage, selectAgent, selectedAgentId, pinInsight } =
    useSimulationStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    text: "",
    x: 0,
    y: 0,
  });
  const PREVIEW_AGENT_COUNT = 3;

  if (!run) return null;

  const stageOutput: StageOutput | undefined = run.timeline[activeStage];
  const groups: Group[] = stageOutput?.groups ?? [];
  const agents = run.agents;

  const resultByAgent = new Map<string, StanceResult>(
    stageOutput?.results.map((r) => [r.agent_id, r]) ?? []
  );

  // Group agents by their assigned_group_id from the stance results
  const agentsByGroup = new Map<string, typeof agents>();
  groups.forEach((g) => agentsByGroup.set(g.group_id, []));
  agents.forEach((agent) => {
    const result = resultByAgent.get(agent.id);
    const groupId = result?.assigned_group_id;
    if (groupId && agentsByGroup.has(groupId)) {
      agentsByGroup.get(groupId)!.push(agent);
    }
  });

  const handleHover = (e: React.MouseEvent, text: string) => {
    if (!text) {
      setTooltip((t) => ({ ...t, visible: false }));
      return;
    }
    setTooltip({ visible: true, text, x: e.clientX + 12, y: e.clientY + 12 });
  };

  const toggleGroup = (groupId: string) =>
    setCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

  const showAllAgents = (groupId: string) =>
    setExpandedGroups((prev) => ({ ...prev, [groupId]: true }));

  return (
    <div className="stance-matrix">
      {/* Stage label — stage is now controlled globally from the timeline strip */}
      <div className="panel-stage-badge">{activeStage}</div>

      {/* Groups stream in one by one */}
      <AnimatePresence>
        {groups.map((group: Group, idx: number) => {
          const isCollapsed = collapsed[group.group_id];
          const groupAgents = agentsByGroup.get(group.group_id) ?? [];
          const isExpanded = expandedGroups[group.group_id] === true;
          const visibleAgents = isExpanded
            ? groupAgents
            : groupAgents.slice(0, PREVIEW_AGENT_COUNT);
          const hiddenAgentCount = Math.max(0, groupAgents.length - visibleAgents.length);
          return (
            <motion.div
              key={group.group_id}
              className="group-section"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, ease: "easeOut" }}
            >
              <div className="group-header-row">
                <button
                  className="group-header"
                  onClick={() => toggleGroup(group.group_id)}
                >
                  <span className="group-chevron">{isCollapsed ? "▶" : "▼"}</span>
                  <span className="group-name">{group.name}</span>
                  <span className="group-incentive">{group.primary_incentive}</span>
                </button>
                <button
                  type="button"
                  className="matrix-pin-btn"
                  onClick={() => {
                    pinInsight({
                      type: "group",
                      stage: activeStage,
                      title: `${group.name} (${activeStage})`,
                      detail: `Primary incentive: ${group.primary_incentive}. Members in matrix: ${groupAgents.length}.`,
                    });
                  }}
                >
                  📌
                </button>
              </div>

              {!isCollapsed && (
                <div className="agent-list">
                  {visibleAgents.map((agent) => {
                    const result = resultByAgent.get(agent.id);
                    const isSelected = selectedAgentId === agent.id;
                    return (
                      <div
                        key={agent.id}
                        className={`agent-row ${isSelected ? "selected" : ""}`}
                        onClick={() =>
                          selectAgent(isSelected ? null : agent.id)
                        }
                      >
                        <span className="agent-persona">{agent.persona}</span>
                        <StanceCell result={result} onHover={handleHover} />
                        {result && (
                          <button
                            type="button"
                            className="matrix-pin-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              pinInsight({
                                type: "agent",
                                stage: activeStage,
                                title: `${agent.persona.slice(0, 42)}${agent.persona.length > 42 ? "…" : ""}`,
                                detail: `${result.stance}: ${result.reasoning}`,
                              });
                            }}
                          >
                            📌
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {hiddenAgentCount > 0 && (
                    <button
                      type="button"
                      className="matrix-load-more-btn"
                      onClick={() => showAllAgents(group.group_id)}
                    >
                      <span className="matrix-load-more-ellipsis">...</span>
                      <span>Load {hiddenAgentCount} more agents</span>
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Reasoning tooltip */}
      <AnimatePresence>
        {tooltip.visible && (
          <motion.div
            className="reasoning-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            {tooltip.text.split("\n\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
