import asyncio

from backend.types import Agent, StageOutput
from backend.modules.group_generator import generate_groups
from backend.modules.stance_runner import run_stances
from backend.modules.end_state_generator import generate_end_state
from backend.utils.sim_logger import (
    log_stage_start, log_groups_done,
    log_stances_done, log_end_state, log_stage_done,
)
from backend.utils.prompts import build_stage_context

SIMULATED_STAGES = ["T1", "T2", "T3", "T4", "T5"]


async def propagate_timeline(
    initial_event: str, agents: list[Agent], run_id: str = "unknown"
):
    """
    Async generator yielding sub-stage events so the UI can update after
    each individual LLM call, not just when the whole stage is complete.

    Yields tuples: (event_type, stage, payload_dict)
      - "stage_start"  → {"current_event": str}
      - "groups"       → {"groups": list[dict]}
      - "stances"      → {"results": list[dict]}
      - "stage_done"   → full StageOutput dict (groups + results + end_state)
    """
    current_event = initial_event
    groups = None
    previous_event = None
    persuadable_context = ""

    for stageidx, stage in enumerate(SIMULATED_STAGES):
        log_stage_start(run_id, stage, current_event)

        # ── Sub-event 1: stage starting ───────────────────────────────────
        yield ("stage_start", stage, {"current_event": current_event})

        # ── LLM call 1: generate groups ───────────────────────────────────
        yield ("transition", stage, {"step": "groups", "message": "Generating groups"})
        if stageidx == 0:
            groups = await generate_groups(current_event, previous_event, groups)
        else:
            groups = groups
        log_groups_done(run_id, stage, groups)
        yield ("groups", stage, {"groups": [g.model_dump() for g in groups]})

        # ── LLM call 2: run stances ───────────────────────────────────────
        yield ("transition", stage, {"step": "stances", "message": "Running stances"})
        stances = await asyncio.to_thread(run_stances, current_event, stage, groups, agents, persuadable_context)
        log_stances_done(run_id, stage, len(stances.results))
        yield ("stances", stage, {"results": [r.model_dump() for r in stances.results]})

        # ── LLM call 3: generate end state ────────────────────────────────
        yield ("transition", stage, {"step": "end_state", "message": "Writing end state"})
        end_state = await generate_end_state(current_event, stage, groups, stances)
        log_end_state(run_id, stage, end_state.social_response_summary, end_state.new_event_state)
        stances.end_state = end_state
        log_stage_done(run_id, stage)

        # Full stage complete
        yield ("stage_done", stage, stances.model_dump())

        current_event = end_state.new_event_state
        previous_event = current_event
        # Build context for the next stage from this stage's persuadable/contested agents
        persuadable_context = build_stage_context(stances.results)
