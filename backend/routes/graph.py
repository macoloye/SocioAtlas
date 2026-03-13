from fastapi import APIRouter, HTTPException

from backend.modules.relationship_builder import build_formal_graph_snapshot
from backend.modules.graph_retriever import retrieve_graph_evidence
from backend.types import GraphRetrieveRequest, GraphRetrieveResponse, GraphSnapshot
from backend.utils.graph_db import get_graph_snapshot, upsert_graph_snapshot
from backend.utils.simulation_db import get_run

router = APIRouter()


def _ensure_graph_materialized(run_id: str) -> GraphSnapshot:
    snapshot = get_graph_snapshot(run_id)
    if snapshot.nodes:
        return snapshot

    run = get_run(run_id)
    if not run:
        return snapshot

    for stage_output in run.timeline.values():
        rebuilt = build_formal_graph_snapshot(
            run_id=run.run_id,
            agents=run.agents,
            stage_output=stage_output,
        )
        upsert_graph_snapshot(rebuilt)

    return get_graph_snapshot(run_id)


@router.get("/{run_id}", response_model=GraphSnapshot)
async def get_graph(run_id: str) -> GraphSnapshot:
    snapshot = _ensure_graph_materialized(run_id)
    if not snapshot.nodes:
        raise HTTPException(status_code=404, detail="Graph not found for run")
    return snapshot


@router.post("/{run_id}/retrieve", response_model=GraphRetrieveResponse)
async def retrieve_graph(run_id: str, body: GraphRetrieveRequest) -> GraphRetrieveResponse:
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    snapshot = _ensure_graph_materialized(run_id)
    if not snapshot.nodes:
        raise HTTPException(status_code=404, detail="Graph not found for run")
    return retrieve_graph_evidence(
        run_id=run_id,
        query=query,
        stage=body.stage,
        top_k=body.top_k,
    )
