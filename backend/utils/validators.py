import json
import re
from typing import Any

from types import MappingProxyType

from backend.types import (
    Group, Agent, StanceResult, StageOutput, StageEndState,
    IncentiveType, StanceLabel, Stage, ActivationStage, StancePosture,
)

VALID_INCENTIVES = frozenset({"M", "P", "I", "S", "N"})
VALID_STAGES = frozenset({"T1", "T2", "T3", "T4", "T5"})
VALID_STANCE_POSTURES = frozenset({"supportive", "opposing", "ambiguous", "neutral"})
VALID_STANCE_LABELS = frozenset({
    "Strongly Support", "Support", "Neutral",
    "Oppose", "Strongly Oppose", "Contested",
})
VALID_SCORES = frozenset({-2, -1, 0, 1, 2})
VALID_INTENSITIES = frozenset({1, 2, 3})
VALID_VISIBILITIES = frozenset({"low", "mid", "high"})


def _score_to_stance_label(score: int) -> str:
    if score >= 2:
        return "Strongly Support"
    if score >= 1:
        return "Support"
    if score <= -2:
        return "Strongly Oppose"
    if score <= -1:
        return "Oppose"
    return "Neutral"


class ValidationError(ValueError):
    pass


def _extract_json(raw: str) -> Any:
    """Strip markdown fences and parse JSON using json_repair."""
    import json_repair
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    json_str = fence_match.group(1) if fence_match else raw
    try:
        return json_repair.loads(json_str.strip())
    except Exception as e:
        raise ValidationError(f"Failed to parse LLM output: {str(e)}\nRaw length: {len(raw)}\nStart: {raw[:300]}") from e


def parse_groups_response(raw: str) -> list[Group]:
    parsed = _extract_json(raw)

    if not isinstance(parsed, dict) or "groups" not in parsed:
        raise ValidationError('Expected {"groups": [...]} from LLM')

    groups: list[Group] = []
    for i, g in enumerate(parsed["groups"]):
        if not isinstance(g, dict):
            raise ValidationError(f"Group {i} is not an object")

        group_id = g.get("group_id")
        if not isinstance(group_id, str) or not group_id:
            raise ValidationError(f"Group {i}: missing group_id")

        name = g.get("name")
        if not isinstance(name, str) or not name:
            raise ValidationError(f"Group {i}: missing name")

        description = g.get("description", "")
        primary_incentive = g.get("primary_incentive")
        if primary_incentive not in VALID_INCENTIVES:
            raise ValidationError(f"Group {i}: invalid primary_incentive '{primary_incentive}'")

        stance_posture = g.get("stance_posture", "ambiguous")
        if stance_posture not in VALID_STANCE_POSTURES:
            stance_posture = "ambiguous"

        groups.append(Group(
            group_id=group_id,
            name=name,
            description=description,
            stance_posture=stance_posture,          # type: ignore[arg-type]
            primary_incentive=primary_incentive,    # type: ignore[arg-type]
        ))

    return groups


def parse_stance_response(raw: str) -> StageOutput:
    parsed = _extract_json(raw)

    if not isinstance(parsed, dict):
        raise ValidationError("Expected object from LLM stance response")

    stage = parsed.get("stage")
    if stage not in VALID_STAGES:
        raise ValidationError(f"Invalid stage '{stage}'")

    raw_results = parsed.get("results")
    if not isinstance(raw_results, list):
        raise ValidationError('Expected {"results": [...]} from LLM')

    results: list[StanceResult] = []
    for i, r in enumerate(raw_results):
        if not isinstance(r, dict):
            raise ValidationError(f"Result {i} is not an object")

        agent_id = r.get("agent_id", "")

        raw_score = r.get("score")
        score = int(raw_score) if isinstance(raw_score, (int, float)) and int(raw_score) in VALID_SCORES else 0

        contested = bool(r.get("contested", False))

        # Derive stance label from score + contested; ignore any "stance" field the LLM sends
        stance = "Contested" if contested else _score_to_stance_label(score)

        raw_incentive = r.get("incentive_active")
        incentive_active = raw_incentive if raw_incentive in VALID_INCENTIVES else None

        raw_intensity = r.get("intensity")
        intensity = int(raw_intensity) if isinstance(raw_intensity, (int, float)) and int(raw_intensity) in VALID_INTENSITIES else 2

        raw_visibility = r.get("visibility", "mid")
        visibility = raw_visibility if raw_visibility in VALID_VISIBILITIES else "mid"

        raw_flip_risk = r.get("flip_risk", 0.0)
        flip_risk = float(raw_flip_risk) if isinstance(raw_flip_risk, (int, float)) else 0.0
        flip_risk = max(0.0, min(1.0, flip_risk))

        # Auto-elevate contested agents to high flip_risk if LLM didn't signal it
        if contested and flip_risk < 0.5:
            flip_risk = max(flip_risk, 0.7)

        assigned_group_id = r.get("assigned_group_id", "")

        results.append(StanceResult(
            agent_id=agent_id,
            assigned_group_id=assigned_group_id,
            stance=stance,                      # type: ignore[arg-type]
            score=score,
            contested=contested,
            incentive_active=incentive_active,  # type: ignore[arg-type]
            intensity=intensity,
            visibility=visibility,
            flip_risk=flip_risk,
            reasoning=r.get("reasoning", ""),
        ))

    return StageOutput(stage=stage, groups=[], results=results, end_state=StageEndState(social_response_summary="", new_event_state=""))  # type: ignore[arg-type]

def parse_end_state_response(raw: str) -> StageEndState:
    parsed = _extract_json(raw)

    if not isinstance(parsed, dict):
        raise ValidationError("Expected object from LLM end state response")

    social_response_summary = parsed.get("social_response_summary")
    new_event_state = parsed.get("new_event_state")

    if not isinstance(social_response_summary, str) or not social_response_summary:
        raise ValidationError("missing or invalid social_response_summary")

    if not isinstance(new_event_state, str) or not new_event_state:
        raise ValidationError("missing or invalid new_event_state")

    return StageEndState(
        social_response_summary=social_response_summary,
        new_event_state=new_event_state,
    )
