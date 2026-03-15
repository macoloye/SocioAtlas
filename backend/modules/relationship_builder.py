from __future__ import annotations

from collections import defaultdict
from itertools import combinations

from backend.types import Agent, GraphEdge, GraphNode, GraphSnapshot, Group, StageOutput


ALIGN_THRESHOLD = 0.62
CONFLICT_THRESHOLD = 0.64
COOPERATE_THRESHOLD = 0.58
COMPETE_THRESHOLD = 0.66


def _relationship_band(strength: float, threshold: float) -> str:
    margin = strength - threshold
    if margin >= 0.12:
        return "strong"
    if margin >= 0.04:
        return "stable"
    return "borderline"


def _relationship_attrs(
    *,
    score: float,
    threshold: float,
    components: dict[str, float],
    extra: dict[str, bool | float | str],
) -> dict[str, bool | float | str | dict[str, float]]:
    margin = score - threshold
    band = _relationship_band(score, threshold)
    flattened_components = {
        f"component_{key}": _safe_round(value) for key, value in components.items()
    }
    return {
        "derivation_mode": "deterministic_v2",
        "confidence": _safe_round(score),
        "threshold": threshold,
        "threshold_margin": _safe_round(margin),
        "classification_band": band,
        "llm_review_suggested": band == "borderline",
        **flattened_components,
        **extra,
    }


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


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _normalize_intensity(value: int) -> float:
    return _clamp01((value - 1) / 2.0)


def _normalize_visibility(value: str) -> float:
    if value == "high":
        return 1.0
    if value == "mid":
        return 0.55
    return 0.2


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
        intensity_gap = abs(_normalize_intensity(left.intensity) - _normalize_intensity(right.intensity))
        visibility_gap = abs(_normalize_visibility(left.visibility) - _normalize_visibility(right.visibility))
        engagement_sync = 1.0 - ((0.65 * intensity_gap) + (0.35 * visibility_gap))
        average_flip_risk = _clamp01((left.flip_risk + right.flip_risk) / 2)
        stability = 1.0 - average_flip_risk
        contested_any = left.contested or right.contested
        contested_split = left.contested != right.contested

        align_strength = (
            0.45 * stance_similarity
            + 0.12 * same_group
            + 0.08 * same_incentive
            + 0.15 * engagement_sync
            + 0.10 * stability
            - (0.10 if contested_any else 0.0)
        )
        conflict_strength = (
            0.45 * stance_distance
            + 0.10 * (1.0 - same_incentive)
            + 0.12 * ((left.intensity + right.intensity) / 6.0)
            + 0.10 * ((_normalize_visibility(left.visibility) + _normalize_visibility(right.visibility)) / 2)
            + 0.08 * average_flip_risk
            + (0.10 if contested_split else 0.0)
            + (0.15 if opposite_sign else 0.0)
        )
        align_strength = _clamp01(align_strength)
        conflict_strength = _clamp01(conflict_strength)
        if opposite_sign:
            conflict_strength = min(1.0, conflict_strength + 0.1)

        source = _to_agent_node_id(run_id, left.agent_id)
        target = _to_agent_node_id(run_id, right.agent_id)
        stable_pair = sorted([left.agent_id, right.agent_id])

        if align_strength >= ALIGN_THRESHOLD and not opposite_sign:
            edges.append(
                GraphEdge(
                    id=f"edge:{run_id}:{stage}:ALIGNS_WITH:{stable_pair[0]}:{stable_pair[1]}",
                    edge_type="ALIGNS_WITH",
                    source=source,
                    target=target,
                    run_id=run_id,
                    stage=stage,
                    weight=_safe_round(align_strength),
                    attrs=_relationship_attrs(
                        score=align_strength,
                        threshold=ALIGN_THRESHOLD,
                        components={
                            "stance_similarity": 0.45 * stance_similarity,
                            "same_group": 0.12 * same_group,
                            "same_incentive": 0.08 * same_incentive,
                            "engagement_sync": 0.15 * engagement_sync,
                            "stability": 0.10 * stability,
                            "contested_penalty": -0.10 if contested_any else 0.0,
                        },
                        extra={
                            "stance_distance": _safe_round(stance_distance),
                            "same_group": bool(same_group),
                            "same_incentive": bool(same_incentive),
                            "engagement_sync": _safe_round(engagement_sync),
                            "avg_flip_risk": _safe_round(average_flip_risk),
                            "contested_any": contested_any,
                            "opposite_sign": opposite_sign,
                        },
                    ),
                )
            )
        elif conflict_strength >= CONFLICT_THRESHOLD:
            edges.append(
                GraphEdge(
                    id=f"edge:{run_id}:{stage}:CONFLICTS_WITH:{stable_pair[0]}:{stable_pair[1]}",
                    edge_type="CONFLICTS_WITH",
                    source=source,
                    target=target,
                    run_id=run_id,
                    stage=stage,
                    weight=_safe_round(conflict_strength),
                    attrs=_relationship_attrs(
                        score=conflict_strength,
                        threshold=CONFLICT_THRESHOLD,
                        components={
                            "stance_distance": 0.45 * stance_distance,
                            "incentive_divergence": 0.10 * (1.0 - same_incentive),
                            "intensity_pressure": 0.12 * ((left.intensity + right.intensity) / 6.0),
                            "visibility_pressure": 0.10 * ((_normalize_visibility(left.visibility) + _normalize_visibility(right.visibility)) / 2),
                            "instability": 0.08 * average_flip_risk,
                            "contested_split_bonus": 0.10 if contested_split else 0.0,
                            "opposite_sign_bonus": 0.15 if opposite_sign else 0.0,
                        },
                        extra={
                            "stance_distance": _safe_round(stance_distance),
                            "avg_flip_risk": _safe_round(average_flip_risk),
                            "opposite_sign": opposite_sign,
                            "same_incentive": bool(same_incentive),
                            "contested_split": contested_split,
                        },
                    ),
                )
            )

    # Deterministic group-group relationships.
    member_scores: dict[str, list[int]] = defaultdict(list)
    member_incentives: dict[str, set[str]] = defaultdict(set)
    member_flip_risks: dict[str, list[float]] = defaultdict(list)
    contested_counts: dict[str, int] = defaultdict(int)
    visibility_totals: dict[str, float] = defaultdict(float)
    for result in results:
        if not result.assigned_group_id:
            continue
        member_scores[result.assigned_group_id].append(result.score)
        if result.incentive_active:
            member_incentives[result.assigned_group_id].add(result.incentive_active)
        member_flip_risks[result.assigned_group_id].append(_clamp01(result.flip_risk))
        visibility_totals[result.assigned_group_id] += _normalize_visibility(result.visibility)
        if result.contested:
            contested_counts[result.assigned_group_id] += 1

    for left, right in combinations(groups, 2):
        left_scores = member_scores.get(left.group_id, [])
        right_scores = member_scores.get(right.group_id, [])
        left_avg = (sum(left_scores) / len(left_scores)) if left_scores else 0.0
        right_avg = (sum(right_scores) / len(right_scores)) if right_scores else 0.0
        stance_distance = abs(left_avg - right_avg) / 4.0

        left_flip = member_flip_risks.get(left.group_id, [])
        right_flip = member_flip_risks.get(right.group_id, [])
        left_volatility = (sum(left_flip) / len(left_flip)) if left_flip else 0.0
        right_volatility = (sum(right_flip) / len(right_flip)) if right_flip else 0.0
        volatility_gap = abs(left_volatility - right_volatility)

        left_contested_share = (contested_counts.get(left.group_id, 0) / len(left_scores)) if left_scores else 0.0
        right_contested_share = (contested_counts.get(right.group_id, 0) / len(right_scores)) if right_scores else 0.0
        contested_gap = abs(left_contested_share - right_contested_share)

        left_visibility = (visibility_totals.get(left.group_id, 0.0) / len(left_scores)) if left_scores else 0.0
        right_visibility = (visibility_totals.get(right.group_id, 0.0) / len(right_scores)) if right_scores else 0.0
        visibility_pressure = (left_visibility + right_visibility) / 2

        incentives_left = member_incentives.get(left.group_id, set())
        incentives_right = member_incentives.get(right.group_id, set())
        union = incentives_left.union(incentives_right)
        overlap = (
            len(incentives_left.intersection(incentives_right)) / len(union) if union else 0.0
        )
        posture_match = int(left.stance_posture == right.stance_posture)
        posture_divergence = 1 - posture_match

        cooperate_strength = (
            0.46 * (1.0 - stance_distance)
            + 0.20 * overlap
            + 0.12 * posture_match
            + 0.12 * (1.0 - volatility_gap)
            + 0.10 * (1.0 - contested_gap)
        )
        compete_strength = (
            0.50 * stance_distance
            + 0.18 * (1.0 - overlap)
            + 0.14 * posture_divergence
            + 0.10 * visibility_pressure
            + 0.08 * volatility_gap
        )
        cooperate_strength = _clamp01(cooperate_strength)
        compete_strength = _clamp01(compete_strength)

        source = _to_group_node_id(run_id, left.group_id)
        target = _to_group_node_id(run_id, right.group_id)
        stable_pair = sorted([left.group_id, right.group_id])

        if cooperate_strength >= COOPERATE_THRESHOLD:
            edges.append(
                GraphEdge(
                    id=f"edge:{run_id}:{stage}:COOPERATES_WITH:{stable_pair[0]}:{stable_pair[1]}",
                    edge_type="COOPERATES_WITH",
                    source=source,
                    target=target,
                    run_id=run_id,
                    stage=stage,
                    weight=_safe_round(cooperate_strength),
                    attrs=_relationship_attrs(
                        score=cooperate_strength,
                        threshold=COOPERATE_THRESHOLD,
                        components={
                            "stance_alignment": 0.46 * (1.0 - stance_distance),
                            "incentive_overlap": 0.20 * overlap,
                            "posture_match": 0.12 * posture_match,
                            "volatility_alignment": 0.12 * (1.0 - volatility_gap),
                            "contested_alignment": 0.10 * (1.0 - contested_gap),
                        },
                        extra={
                            "stance_distance": _safe_round(stance_distance),
                            "incentive_overlap": _safe_round(overlap),
                            "posture_match": bool(posture_match),
                            "volatility_gap": _safe_round(volatility_gap),
                            "contested_gap": _safe_round(contested_gap),
                        },
                    ),
                )
            )
        elif compete_strength >= COMPETE_THRESHOLD:
            edges.append(
                GraphEdge(
                    id=f"edge:{run_id}:{stage}:COMPETES_WITH:{stable_pair[0]}:{stable_pair[1]}",
                    edge_type="COMPETES_WITH",
                    source=source,
                    target=target,
                    run_id=run_id,
                    stage=stage,
                    weight=_safe_round(compete_strength),
                    attrs=_relationship_attrs(
                        score=compete_strength,
                        threshold=COMPETE_THRESHOLD,
                        components={
                            "stance_distance": 0.50 * stance_distance,
                            "incentive_divergence": 0.18 * (1.0 - overlap),
                            "posture_divergence": 0.14 * posture_divergence,
                            "visibility_pressure": 0.10 * visibility_pressure,
                            "volatility_gap": 0.08 * volatility_gap,
                        },
                        extra={
                            "stance_distance": _safe_round(stance_distance),
                            "incentive_overlap": _safe_round(overlap),
                            "visibility_pressure": _safe_round(visibility_pressure),
                            "volatility_gap": _safe_round(volatility_gap),
                        },
                    ),
                )
            )

    return GraphSnapshot(run_id=run_id, nodes=nodes, edges=edges)
