import asyncio

from fastapi import APIRouter, HTTPException

from backend.modules.graph_retriever import answer_with_graph_context
from backend.types import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/{run_id}", response_model=ChatResponse)
async def chat_with_graph(run_id: str, body: ChatRequest) -> ChatResponse:
    query = body.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    return await asyncio.to_thread(
        answer_with_graph_context,
        run_id,
        query,
        body.top_k,
    )
