from backend.types import Agent, Coalition, StageOutput


def _score_to_direction(score: int) -> str:
    if score > 0:
        return "support"
    if score < 0:
        return "oppose"
    return "neutral"


def detect_coalitions(
    stage_output: StageOutput, agents: list[Agent]
) -> list[Coalition]:
    agent_ids = {a.id for a in agents}
    coalitions: list[Coalition] = []

    active = [
        r for r in stage_output.results
        if r.incentive_active is not None
        and _score_to_direction(r.score) != "neutral"
        and r.agent_id in agent_ids
    ]

    for i in range(len(active)):
        for j in range(i + 1, len(active)):
            a, b = active[i], active[j]

            if a.incentive_active != b.incentive_active:
                continue

            dir_a = _score_to_direction(a.score)
            dir_b = _score_to_direction(b.score)

            coalition_type = "alliance" if dir_a == dir_b else "rivalry"

            coalitions.append(Coalition(
                type=coalition_type,                    # type: ignore[arg-type]
                agent_ids=(a.agent_id, b.agent_id),
                incentive_type=a.incentive_active,      # type: ignore[arg-type]
                direction=dir_a,                        # type: ignore[arg-type]
            ))

    return coalitions
