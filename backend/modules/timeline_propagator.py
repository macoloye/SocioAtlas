import asyncio
from dataclasses import dataclass

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
SELECTION_STAGES = {"T1", "T2", "T3", "T4"}
END_STATE_TIMEOUT_SECONDS = 6


@dataclass
class PendingEndStateChoice:
    stage: str
    event: asyncio.Event
    selected_event_state: str | None = None
    selected_option_id: str | None = None
    selection_source: str | None = None


_pending_end_state_choices: dict[str, PendingEndStateChoice] = {}


def submit_end_state_choice(
    run_id: str,
    stage: str,
    chosen_event_state: str,
    selected_option_id: str | None,
    selection_source: str,
) -> tuple[bool, str]:
    pending = _pending_end_state_choices.get(run_id)
    if not pending:
        return False, "No pending end-state selection"
    if pending.stage != stage:
        return False, f"Pending stage is {pending.stage}, received {stage}"

    chosen = chosen_event_state.strip()
    if not chosen:
        return False, "chosen_event_state is required"

    pending.selected_event_state = chosen
    pending.selected_option_id = selected_option_id
    pending.selection_source = selection_source
    pending.event.set()
    return True, "Selection accepted"


def _resolve_default_option(end_state) -> tuple[str, str | None]:
    options = end_state.event_state_options or []
    if options:
        default_option = next((o for o in options if o.is_default), options[0])
        return default_option.next_event_state, default_option.option_id
    return end_state.new_event_state, None


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

        default_event_state, default_option_id = _resolve_default_option(end_state)
        end_state.new_event_state = default_event_state

        if stage in SELECTION_STAGES and end_state.event_state_options:
            pending = PendingEndStateChoice(stage=stage, event=asyncio.Event())
            _pending_end_state_choices[run_id] = pending

            yield (
                "awaiting_end_state_choice",
                stage,
                {
                    "end_state": end_state.model_dump(),
                    "timeout_seconds": END_STATE_TIMEOUT_SECONDS,
                },
            )

            try:
                await asyncio.wait_for(
                    pending.event.wait(),
                    timeout=END_STATE_TIMEOUT_SECONDS,
                )
                if pending.selected_event_state:
                    end_state.new_event_state = pending.selected_event_state
                    end_state.selected_option_id = pending.selected_option_id
                    end_state.selection_source = pending.selection_source
            except asyncio.TimeoutError:
                end_state.new_event_state = default_event_state
                end_state.selected_option_id = default_option_id
                end_state.selection_source = "default_timeout"
            finally:
                _pending_end_state_choices.pop(run_id, None)

            yield (
                "end_state_selected",
                stage,
                {
                    "new_event_state": end_state.new_event_state,
                    "selected_option_id": end_state.selected_option_id,
                    "selection_source": end_state.selection_source,
                },
            )
        elif stage in SELECTION_STAGES:
            end_state.selection_source = "default_timeout"

        log_end_state(run_id, stage, end_state.social_response_summary, end_state.new_event_state)
        stances.end_state = end_state
        log_stage_done(run_id, stage)

        # Full stage complete
        yield ("stage_done", stage, stances.model_dump())

        previous_event = current_event
        current_event = end_state.new_event_state
        # Build context for the next stage from this stage's persuadable/contested agents
        persuadable_context = build_stage_context(stances.results)

    _pending_end_state_choices.pop(run_id, None)
