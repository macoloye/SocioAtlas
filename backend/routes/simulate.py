from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json
import asyncio
import os

from backend.types import (
    SimulateRequest,
    SimulateResponse,
    GetSimulationResponse,
    ListSimulationsResponse,
    SimulationRunSummary,
    SimulationRun,
    Agent,
    EndStateSelectionRequest,
    EndStateSelectionResponse,
)
from backend.modules.timeline_propagator import propagate_timeline, submit_end_state_choice
from backend.modules.output_formatter import format_run
from backend.modules.relationship_builder import build_formal_graph_snapshot
from backend.utils.persona_sampler import sample_personas
from backend.utils.sim_logger import log_run_start, log_run_done, log_error
from backend.utils.simulation_db import upsert_run, get_run, list_runs
from backend.utils.graph_db import upsert_graph_snapshot

router = APIRouter()

# In-memory run cache (swap for a DB in prod)
_run_cache: dict[str, SimulationRun] = {}

SAMPLE_SIZE = int(os.getenv("SAMPLE_SIZE", "15"))


@router.post("")
async def simulate(body: SimulateRequest):
    event = body.event.strip()
    if not event:
        raise HTTPException(status_code=400, detail="event is required")

    async def event_generator():
        run = None
        try:
            effective_sample_size = body.sample_size or SAMPLE_SIZE
            raw_personas = sample_personas(effective_sample_size)
            agents = [Agent(id=p.id, persona=p.persona) for p in raw_personas]

            # Start off the cache with empty timeline
            run = format_run(event, agents, {})
            _run_cache[run.run_id] = run
            upsert_run(run, status="running")
            log_run_start(run.run_id, event, len(agents))

            # Emit initial packet (run_id + agents)
            yield f"data: {json.dumps({'type': 'init', 'run': run.model_dump()})}\n\n"
            await asyncio.sleep(0)

            # Stream sub-stage events as each LLM call completes
            async for event_type, stage, payload in propagate_timeline(event, agents, run_id=run.run_id):

                if event_type == "stage_done":
                    # Update the cached run with the completed stage
                    from backend.types import StageOutput
                    run.timeline[stage] = StageOutput(**payload)
                    graph_snapshot = build_formal_graph_snapshot(
                        run_id=run.run_id,
                        agents=run.agents,
                        stage_output=run.timeline[stage],
                    )
                    try:
                        upsert_graph_snapshot(graph_snapshot)
                    except Exception as graph_error:
                        # Keep simulation stream resilient even if graph DB is temporarily locked.
                        log_error(run.run_id, stage, f"graph_persist_failed: {graph_error}")
                    upsert_run(run, status="running")

                chunk = {"type": event_type, "stage": stage, **payload}
                yield f"data: {json.dumps(chunk)}\n\n"
                await asyncio.sleep(0)

            # Done
            upsert_run(run, status="done")
            log_run_done(run.run_id)
            yield f"data: {json.dumps({'type': 'done', 'run_id': run.run_id})}\n\n"
            await asyncio.sleep(0)

        except Exception as exc:
            import traceback
            traceback.print_exc()
            run_id = run.run_id if run else "unknown"
            if run:
                upsert_run(run, status="error")
            log_error(run_id, "unknown", str(exc))
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)})}\n\n"
            await asyncio.sleep(0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        },
    )


@router.get("/{run_id}", response_model=GetSimulationResponse)
async def get_simulation(run_id: str) -> GetSimulationResponse:
    run = _run_cache.get(run_id)
    if not run:
        run = get_run(run_id)
        if run:
            _run_cache[run_id] = run
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return GetSimulationResponse(run=run)


@router.get("", response_model=ListSimulationsResponse)
async def list_simulations(limit: int = 25) -> ListSimulationsResponse:
    records = list_runs(limit=limit)
    return ListSimulationsResponse(
        runs=[SimulationRunSummary(**record) for record in records]
    )


@router.post("/{run_id}/select-end-state", response_model=EndStateSelectionResponse)
async def select_end_state(run_id: str, body: EndStateSelectionRequest) -> EndStateSelectionResponse:
    ok, message = submit_end_state_choice(
        run_id=run_id,
        stage=body.stage,
        chosen_event_state=body.chosen_event_state,
        selected_option_id=body.selected_option_id,
        selection_source=body.selection_source,
    )
    if not ok:
        raise HTTPException(status_code=409, detail=message)
    return EndStateSelectionResponse(accepted=True, message=message)
