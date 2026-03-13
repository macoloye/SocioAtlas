from __future__ import annotations

from collections import defaultdict
from itertools import combinations

from backend.types import Agent, GraphEdge, GraphNode, GraphSnapshot, Group, StageOutput


def _to_stage_id(run_id: str, stage: str) -> str:
    return f"stage:{run_id}:{stage}"


def _to_agent_node_id(run_id: str, agent_id: str) -> str:
    return f"agent:{run_id}:{agent_id}"


def _to_group_node_id(run_id: str, group_id: str) -> str:
    return f"group:{run_id}:{group_id}"


def _safe_round(value: float) -> float:
    return round(value, 4)


def _norm_distance(a: int, b: int) -> float:
    return abs(a - b) / 4.0


def build_formal_graph_snapshot(
    run_id: str,
    agents: list[Agent],
    stage_output: StageOutput,
) -> GraphSnapshot:
    stage = stage_output.stage
    groups = stage_output.groups
    results = stage_output.results

    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []

    run_node_id = f"run:{run_id}"
    stage_node_id = _to_stage_id(run_id, stage)

    nodes.append(
        GraphNode(
            id=run_node_id,
            node_type="run",
            label=f"Run {run_id[:8]}",
            run_id=run_id,
            stage=None,
            attrs={"kind": "simulation_run"},
        )
    )
    nodes.append(
        GraphNode(
            id=stage_node_id,
            node_type="stage",
            label=stage,
            run_id=run_id,
            stage=stage,
            attrs={"kind": "timeline_stage"},
        )
    )
    edges.append(
        GraphEdge(
            id=f"edge:{run_id}:{stage}:HAS_STAGE",
            edge_type="HAS_STAGE",
            source=run_node_id,
            target=stage_node_id,
            run_id=run_id,
            stage=stage,
            weight=1.0,
            attrs={},
        )
    )

    group_by_id: dict[str, Group] = {group.group_id: group for group in groups}

    for agent in agents:
        agent_node_id = _to_agent_node_id(run_id, agent.id)
        nodes.append(
            GraphNode(
                id=agent_node_id,
                node_type="agent",
                label=agent.persona,
                run_id=run_id,
                stage=stage,
                attrs={"agent_id": agent.id, "persona": agent.persona},
            )
        )
        edges.append(
            GraphEdge(
                id=f"edge:{run_id}:{stage}:HAS_AGENT:{agent.id}",
                edge_type="HAS_AGENT",
                source=stage_node_id,
                target=agent_node_id,
                run_id=run_id,
                stage=stage,
                weight=1.0,
                attrs={},
            )
        )

    for group in groups:
        group_node_id = _to_group_node_id(run_id, group.group_id)
        nodes.append(
            GraphNode(
                id=group_node_id,
                node_type="group",
                label=group.name,
                run_id=run_id,
                stage=stage,
                attrs={
                    "group_id": group.group_id,
                    "description": group.description,
                    "stance_posture": group.stance_posture,
                    "primary_incentive": group.primary_incentive,
                },
            )
        )
        edges.append(
            GraphEdge(
                id=f"edge:{run_id}:{stage}:HAS_GROUP:{group.group_id}",
                edge_type="HAS_GROUP",
                source=stage_node_id,
                target=group_node_id,
                run_id=run_id,
                stage=stage,
                weight=1.0,
                attrs={},
            )
        )

    # Agent -> group membership for this stage.
    for result in results:
        group = group_by_id.get(result.assigned_group_id)
        if not group:
            continue
        source = _to_agent_node_id(run_id, result.agent_id)
        target = _to_group_node_id(run_id, group.group_id)
        edges.append(
            GraphEdge(
                id=f"edge:{run_id}:{stage}:MEMBER_OF:{result.agent_id}:{group.group_id}",
                edge_type="MEMBER_OF",
                source=source,
                target=target,
                run_id=run_id,
                stage=stage,
                weight=1.0,
                attrs={
                    "stance": result.stance,
                    "score": result.score,
                    "contested": result.contested,
                    "incentive_active": result.incentive_active,
                    "intensity": result.intensity,
                    "visibility": result.visibility,
                    "flip_risk": result.flip_risk,
                    "reasoning": result.reasoning,
                },
            )
        )

    # Deterministic agent-agent relationships.
    for left, right in combinations(results, 2):
        stance_distance = _norm_distance(left.score, right.score)
        stance_similarity = 1.0 - stance_distance
        same_group = int(
            bool(left.assigned_group_id) and left.assigned_group_id == right.assigned_group_id
        )
        same_incentive = int(
            bool(left.incentive_active) and left.incentive_active == right.incentive_active
        )
        opposite_sign = left.score * right.score < 0

        align_strength = 0.7 * stance_similarity + 0.2 * same_group + 0.1 * same_incentive
        conflict_strength = 0.8 * stance_distance + 0.2 * (1.0 - same_incentive)
        if opposite_sign:
            conflict_strength = min(1.0, conflict_strength + 0.1)

        source = _to_agent_node_id(run_id, left.agent_id)
        target = _to_agent_node_id(run_id, right.agent_id)
        stable_pair = sorted([left.agent_id, right.agent_id])

        if align_strength >= 0.62 and not opposite_sign:
            edges.append(
                GraphEdge(
                    id=f"edge:{run_id}:{stage}:ALIGNS_WITH:{stable_pair[0]}:{stable_pair[1]}",
                    edge_type="ALIGNS_WITH",
                    source=source,
                    target=target,
                    run_id=run_id,
                    stage=stage,
                    weight=_safe_round(align_strength),
                    attrs={
                        "stance_distance": _safe_round(stance_distance),
                        "same_group": bool(same_group),
                        "same_incentive": bool(same_incentive),
                    },
                )
            )
        elif conflict_strength >= 0.64:
            edges.append(
                GraphEdge(
                    id=f"edge:{run_id}:{stage}:CONFLICTS_WITH:{stable_pair[0]}:{stable_pair[1]}",
                    edge_type="CONFLICTS_WITH",
                    source=source,
                    target=target,
                    run_id=run_id,
                    stage=stage,
                    weight=_safe_round(conflict_strength),
                    attrs={
                        "stance_distance": _safe_round(stance_distance),
                        "opposite_sign": opposite_sign,
                        "same_incentive": bool(same_incentive),
                    },
                )
            )

    # Deterministic group-group relationships.
    member_scores: dict[str, list[int]] = defaultdict(list)
    member_incentives: dict[str, set[str]] = defaultdict(set)
    for result in results:
        if not result.assigned_group_id:
            continue
        member_scores[result.assigned_group_id].append(result.score)
        if result.incentive_active:
            member_incentives[result.assigned_group_id].add(result.incentive_active)

    for left, right in combinations(groups, 2):
        left_scores = member_scores.get(left.group_id, [])
        right_scores = member_scores.get(right.group_id, [])
        left_avg = (sum(left_scores) / len(left_scores)) if left_scores else 0.0
        right_avg = (sum(right_scores) / len(right_scores)) if right_scores else 0.0
        stance_distance = abs(left_avg - right_avg) / 4.0

        incentives_left = member_incentives.get(left.group_id, set())
        incentives_right = member_incentives.get(right.group_id, set())
        union = incentives_left.union(incentives_right)
        overlap = (
            len(incentives_left.intersection(incentives_right)) / len(union) if union else 0.0
        )
        posture_match = int(left.stance_posture == right.stance_posture)

        cooperate_strength = 0.7 * (1.0 - stance_distance) + 0.2 * overlap + 0.1 * posture_match
        compete_strength = 0.8 * stance_distance + 0.2 * (1.0 - overlap)

        source = _to_group_node_id(run_id, left.group_id)
        target = _to_group_node_id(run_id, right.group_id)
        stable_pair = sorted([left.group_id, right.group_id])

        if cooperate_strength >= 0.58:
            edges.append(
                GraphEdge(
                    id=f"edge:{run_id}:{stage}:COOPERATES_WITH:{stable_pair[0]}:{stable_pair[1]}",
                    edge_type="COOPERATES_WITH",
                    source=source,
                    target=target,
                    run_id=run_id,
                    stage=stage,
                    weight=_safe_round(cooperate_strength),
                    attrs={
                        "stance_distance": _safe_round(stance_distance),
                        "incentive_overlap": _safe_round(overlap),
                    },
                )
            )
        elif compete_strength >= 0.66:
            edges.append(
                GraphEdge(
                    id=f"edge:{run_id}:{stage}:COMPETES_WITH:{stable_pair[0]}:{stable_pair[1]}",
                    edge_type="COMPETES_WITH",
                    source=source,
                    target=target,
                    run_id=run_id,
                    stage=stage,
                    weight=_safe_round(compete_strength),
                    attrs={
                        "stance_distance": _safe_round(stance_distance),
                        "incentive_overlap": _safe_round(overlap),
                    },
                )
            )

    return GraphSnapshot(run_id=run_id, nodes=nodes, edges=edges)
