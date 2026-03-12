import uuid
from datetime import datetime, timezone

from backend.types import Agent, SimulationRun, StageOutput


def format_run(
    initial_event: str,
    agents: list[Agent],
    timeline: dict[str, StageOutput],
) -> SimulationRun:
    return SimulationRun(
        run_id=str(uuid.uuid4()),
        initial_event=initial_event,
        created_at=datetime.now(timezone.utc).isoformat(),
        agents=agents,
        timeline=timeline,
    )
