from __future__ import annotations

import re
from typing import Iterable

from backend.types import (
    ChatResponse,
    GraphEdge,
    GraphEvidence,
    GraphNode,
    GraphRetrieveResponse,
    Stage,
)
from backend.utils.graph_db import get_graph_snapshot
from backend.utils.llm_client import call_llm_sync


def _tokens(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-zA-Z0-9_]+", text.lower()) if len(token) > 1}


def _score(query_tokens: set[str], text: str) -> float:
    if not query_tokens:
        return 0.0
    corpus_tokens = _tokens(text)
    if not corpus_tokens:
        return 0.0
    overlap = len(query_tokens.intersection(corpus_tokens))
    return overlap / max(len(query_tokens), 1)


def _node_text(node: GraphNode) -> str:
    attrs = " ".join(str(value) for value in node.attrs.values() if value is not None)
    return f"{node.node_type} {node.label} {attrs}"


def _edge_text(edge: GraphEdge) -> str:
    attrs = " ".join(str(value) for value in edge.attrs.values() if value is not None)
    return f"{edge.edge_type} {edge.source} {edge.target} {attrs}"


def _format_node_details(node: GraphNode) -> str:
    attrs = ", ".join(
        f"{key}={value}" for key, value in node.attrs.items() if value is not None and value != ""
    )
    return f"{node.node_type} {node.label}" + (f" ({attrs})" if attrs else "")


def _format_edge_details(edge: GraphEdge) -> str:
    attrs = ", ".join(
        f"{key}={value}" for key, value in edge.attrs.items() if value is not None and value != ""
    )
    details = f"{edge.edge_type} {edge.source} -> {edge.target}"
    if attrs:
        details = f"{details} ({attrs})"
    return details


def retrieve_graph_evidence(
    run_id: str,
    query: str,
    stage: Stage | None = None,
    top_k: int = 12,
) -> GraphRetrieveResponse:
    snapshot = get_graph_snapshot(run_id)
    q_tokens = _tokens(query)
    safe_top_k = max(1, min(top_k, 30))

    evidence: list[GraphEvidence] = []
    for node in snapshot.nodes:
        if stage and node.stage and node.stage != stage:
            continue
        score = _score(q_tokens, _node_text(node))
        if score <= 0:
            continue
        evidence.append(
            GraphEvidence(
                id=node.id,
                kind="node",
                label=node.label,
                score=round(score, 4),
                stage=node.stage,
                details=_format_node_details(node),
            )
        )

    for edge in snapshot.edges:
        if stage and edge.stage and edge.stage != stage:
            continue
        score = _score(q_tokens, _edge_text(edge))
        if score <= 0:
            continue
        evidence.append(
            GraphEvidence(
                id=edge.id,
                kind="edge",
                label=edge.edge_type,
                score=round(score, 4),
                stage=edge.stage,
                details=_format_edge_details(edge),
            )
        )

    evidence.sort(key=lambda item: item.score, reverse=True)
    # If no lexical hit, still include a compact fallback context.
    if not evidence:
        fallback_nodes = snapshot.nodes[: min(6, len(snapshot.nodes))]
        evidence = [
            GraphEvidence(
                id=node.id,
                kind="node",
                label=node.label,
                score=0.01,
                stage=node.stage,
                details=_format_node_details(node),
            )
            for node in fallback_nodes
        ]

    return GraphRetrieveResponse(run_id=run_id, query=query, evidence=evidence[:safe_top_k])


def _evidence_to_prompt_lines(evidence: Iterable[GraphEvidence]) -> str:
    lines = []
    for item in evidence:
        stage_label = item.stage or "GLOBAL"
        lines.append(f"- [{stage_label}] {item.kind.upper()} {item.id}: {item.details}")
    return "\n".join(lines)


def answer_with_graph_context(run_id: str, query: str, top_k: int = 12) -> ChatResponse:
    retrieved = retrieve_graph_evidence(run_id=run_id, query=query, stage=None, top_k=top_k)
    context_lines = _evidence_to_prompt_lines(retrieved.evidence)

    prompt = (
        "You are a social simulation analyst. Use only the graph evidence to answer.\n"
        "If evidence is insufficient, say what is missing.\n\n"
        f"Run ID: {run_id}\n"
        f"User query: {query}\n\n"
        "Graph evidence:\n"
        f"{context_lines}\n\n"
        "Return a concise answer in plain text."
    )
    answer = call_llm_sync(prompt)

    stage_order = ["T1", "T2", "T3", "T4", "T5"]
    used = {item.stage for item in retrieved.evidence if item.stage is not None}
    stages_used = [stage for stage in stage_order if stage in used]
    return ChatResponse(answer=answer, evidence=retrieved.evidence, stages_used=stages_used)
