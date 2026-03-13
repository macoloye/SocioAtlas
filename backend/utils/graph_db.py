from __future__ import annotations

import json
import os
from typing import Any

import kuzu

from backend.types import GraphEdge, GraphNode, GraphSnapshot

_GRAPH_DB_PATH = os.path.join(os.path.dirname(__file__), "../../graph_kuzu.db")
_DB: kuzu.Database | None = None
_CONN: kuzu.Connection | None = None
_RO_DB: kuzu.Database | None = None
_RO_CONN: kuzu.Connection | None = None
_SCHEMA_READY = False


def _escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def _q(value: str) -> str:
    return f"'{_escape(value)}'"


def _json(value: dict[str, str | int | float | bool | None]) -> str:
    return json.dumps(value, ensure_ascii=True)


def _conn(read_only: bool = False) -> kuzu.Connection:
    global _DB, _CONN, _RO_DB, _RO_CONN
    if read_only:
        if _RO_CONN is None:
            os.makedirs(os.path.dirname(_GRAPH_DB_PATH), exist_ok=True)
            _RO_DB = kuzu.Database(_GRAPH_DB_PATH, read_only=True)
            _RO_CONN = kuzu.Connection(_RO_DB)
        return _RO_CONN

    if _CONN is None:
        os.makedirs(os.path.dirname(_GRAPH_DB_PATH), exist_ok=True)
        _DB = kuzu.Database(_GRAPH_DB_PATH)
        _CONN = kuzu.Connection(_DB)
    return _CONN


def _safe_exec(query: str) -> None:
    try:
        _conn(read_only=False).execute(query)
    except Exception as exc:
        message = str(exc).lower()
        if "already exists" in message:
            return
        raise


def _rows(query: str) -> list[list[Any]]:
    # Read through the writable connection so fresh stage writes are visible
    # immediately to the graph API during the same server process.
    init_graph_db()
    result = _conn(read_only=False).execute(query)
    output: list[list[Any]] = []
    while result.has_next():
        row = result.get_next()
        output.append(list(row))
    return output


def init_graph_db() -> None:
    global _SCHEMA_READY
    if _SCHEMA_READY:
        return
    _safe_exec(
        """
        CREATE NODE TABLE IF NOT EXISTS run(
            run_id STRING,
            label STRING,
            attrs_json STRING,
            PRIMARY KEY(run_id)
        )
        """
    )
    _SCHEMA_READY = True
    _safe_exec(
        """
        CREATE NODE TABLE IF NOT EXISTS stage(
            stage_id STRING,
            run_id STRING,
            stage STRING,
            label STRING,
            attrs_json STRING,
            PRIMARY KEY(stage_id)
        )
        """
    )
    _safe_exec(
        """
        CREATE NODE TABLE IF NOT EXISTS agent(
            node_id STRING,
            run_id STRING,
            agent_id STRING,
            label STRING,
            attrs_json STRING,
            PRIMARY KEY(node_id)
        )
        """
    )
    _safe_exec(
        """
        CREATE NODE TABLE IF NOT EXISTS grp(
            node_id STRING,
            run_id STRING,
            group_id STRING,
            label STRING,
            attrs_json STRING,
            PRIMARY KEY(node_id)
        )
        """
    )
    _safe_exec(
        """
        CREATE REL TABLE IF NOT EXISTS has_stage(
            FROM run TO stage,
            rel_id STRING,
            run_id STRING,
            stage STRING,
            edge_type STRING,
            weight DOUBLE,
            attrs_json STRING
        )
        """
    )
    _safe_exec(
        """
        CREATE REL TABLE IF NOT EXISTS has_agent(
            FROM stage TO agent,
            rel_id STRING,
            run_id STRING,
            stage STRING,
            edge_type STRING,
            weight DOUBLE,
            attrs_json STRING
        )
        """
    )
    _safe_exec(
        """
        CREATE REL TABLE IF NOT EXISTS has_group(
            FROM stage TO grp,
            rel_id STRING,
            run_id STRING,
            stage STRING,
            edge_type STRING,
            weight DOUBLE,
            attrs_json STRING
        )
        """
    )
    _safe_exec(
        """
        CREATE REL TABLE IF NOT EXISTS member_of(
            FROM agent TO grp,
            rel_id STRING,
            run_id STRING,
            stage STRING,
            edge_type STRING,
            weight DOUBLE,
            attrs_json STRING
        )
        """
    )
    _safe_exec(
        """
        CREATE REL TABLE IF NOT EXISTS agent_rel(
            FROM agent TO agent,
            rel_id STRING,
            run_id STRING,
            stage STRING,
            edge_type STRING,
            weight DOUBLE,
            attrs_json STRING
        )
        """
    )
    _safe_exec(
        """
        CREATE REL TABLE IF NOT EXISTS group_rel(
            FROM grp TO grp,
            rel_id STRING,
            run_id STRING,
            stage STRING,
            edge_type STRING,
            weight DOUBLE,
            attrs_json STRING
        )
        """
    )


def _upsert_node(node: GraphNode) -> None:
    attrs_json = _q(_json(node.attrs))
    if node.node_type == "run":
        _conn().execute(
            f"""
            MERGE (n:run {{run_id: {_q(node.run_id)}}})
            SET n.label = {_q(node.label)}, n.attrs_json = {attrs_json}
            """
        )
        return

    if node.node_type == "stage":
        _conn().execute(
            f"""
            MERGE (n:stage {{stage_id: {_q(node.id)}}})
            SET n.run_id = {_q(node.run_id)},
                n.stage = {_q(node.stage or "")},
                n.label = {_q(node.label)},
                n.attrs_json = {attrs_json}
            """
        )
        return

    if node.node_type == "agent":
        agent_id = str(node.attrs.get("agent_id", ""))
        _conn().execute(
            f"""
            MERGE (n:agent {{node_id: {_q(node.id)}}})
            SET n.run_id = {_q(node.run_id)},
                n.agent_id = {_q(agent_id)},
                n.label = {_q(node.label)},
                n.attrs_json = {attrs_json}
            """
        )
        return

    if node.node_type == "group":
        group_id = str(node.attrs.get("group_id", ""))
        _conn().execute(
            f"""
            MERGE (n:grp {{node_id: {_q(node.id)}}})
            SET n.run_id = {_q(node.run_id)},
                n.group_id = {_q(group_id)},
                n.label = {_q(node.label)},
                n.attrs_json = {attrs_json}
            """
        )
        return


def _upsert_edge(edge: GraphEdge) -> None:
    attrs_json = _q(_json(edge.attrs))
    stage = _q(edge.stage or "")
    common = (
        f"SET r.run_id = {_q(edge.run_id)}, "
        f"r.stage = {stage}, "
        f"r.edge_type = {_q(edge.edge_type)}, "
        f"r.weight = {edge.weight}, "
        f"r.attrs_json = {attrs_json}"
    )

    if edge.edge_type == "HAS_STAGE":
        _conn().execute(
            f"""
            MATCH (a:run {{run_id: {_q(edge.run_id)}}}), (b:stage {{stage_id: {_q(edge.target)}}})
            MERGE (a)-[r:has_stage {{rel_id: {_q(edge.id)}}}]->(b)
            {common}
            """
        )
        return

    if edge.edge_type == "HAS_AGENT":
        _conn().execute(
            f"""
            MATCH (a:stage {{stage_id: {_q(edge.source)}}}), (b:agent {{node_id: {_q(edge.target)}}})
            MERGE (a)-[r:has_agent {{rel_id: {_q(edge.id)}}}]->(b)
            {common}
            """
        )
        return

    if edge.edge_type == "HAS_GROUP":
        _conn().execute(
            f"""
            MATCH (a:stage {{stage_id: {_q(edge.source)}}}), (b:grp {{node_id: {_q(edge.target)}}})
            MERGE (a)-[r:has_group {{rel_id: {_q(edge.id)}}}]->(b)
            {common}
            """
        )
        return

    if edge.edge_type == "MEMBER_OF":
        _conn().execute(
            f"""
            MATCH (a:agent {{node_id: {_q(edge.source)}}}), (b:grp {{node_id: {_q(edge.target)}}})
            MERGE (a)-[r:member_of {{rel_id: {_q(edge.id)}}}]->(b)
            {common}
            """
        )
        return

    if edge.edge_type in ("ALIGNS_WITH", "CONFLICTS_WITH"):
        _conn().execute(
            f"""
            MATCH (a:agent {{node_id: {_q(edge.source)}}}), (b:agent {{node_id: {_q(edge.target)}}})
            MERGE (a)-[r:agent_rel {{rel_id: {_q(edge.id)}}}]->(b)
            {common}
            """
        )
        return

    if edge.edge_type in ("COOPERATES_WITH", "COMPETES_WITH"):
        _conn().execute(
            f"""
            MATCH (a:grp {{node_id: {_q(edge.source)}}}), (b:grp {{node_id: {_q(edge.target)}}})
            MERGE (a)-[r:group_rel {{rel_id: {_q(edge.id)}}}]->(b)
            {common}
            """
        )


def upsert_graph_snapshot(snapshot: GraphSnapshot) -> None:
    init_graph_db()
    for node in snapshot.nodes:
        _upsert_node(node)
    for edge in snapshot.edges:
        _upsert_edge(edge)


def get_graph_snapshot(run_id: str) -> GraphSnapshot:
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []

    run_rows = _rows(
        f"MATCH (n:run {{run_id: {_q(run_id)}}}) RETURN n.run_id, n.label, n.attrs_json"
    )
    for row in run_rows:
        attrs = json.loads(row[2] or "{}")
        nodes.append(
            GraphNode(
                id=f"run:{row[0]}",
                node_type="run",
                label=row[1],
                run_id=row[0],
                stage=None,
                attrs=attrs,
            )
        )

    stage_rows = _rows(
        f"MATCH (n:stage) WHERE n.run_id = {_q(run_id)} RETURN n.stage_id, n.run_id, n.stage, n.label, n.attrs_json"
    )
    for row in stage_rows:
        attrs = json.loads(row[4] or "{}")
        nodes.append(
            GraphNode(
                id=row[0],
                node_type="stage",
                label=row[3],
                run_id=row[1],
                stage=row[2],
                attrs=attrs,
            )
        )

    agent_rows = _rows(
        f"MATCH (n:agent) WHERE n.run_id = {_q(run_id)} RETURN n.node_id, n.run_id, n.label, n.attrs_json"
    )
    for row in agent_rows:
        attrs = json.loads(row[3] or "{}")
        nodes.append(
            GraphNode(
                id=row[0],
                node_type="agent",
                label=row[2],
                run_id=row[1],
                stage=None,
                attrs=attrs,
            )
        )

    group_rows = _rows(
        f"MATCH (n:grp) WHERE n.run_id = {_q(run_id)} RETURN n.node_id, n.run_id, n.label, n.attrs_json"
    )
    for row in group_rows:
        attrs = json.loads(row[3] or "{}")
        nodes.append(
            GraphNode(
                id=row[0],
                node_type="group",
                label=row[2],
                run_id=row[1],
                stage=None,
                attrs=attrs,
            )
        )

    rel_queries = [
        (
            "has_stage",
            """
            MATCH (a:run)-[r:has_stage]->(b:stage)
            WHERE r.run_id = {run_id}
            RETURN r.rel_id, r.edge_type, a.run_id AS source_id, b.stage_id AS target_id, r.stage, r.weight, r.attrs_json
            """,
        ),
        (
            "has_agent",
            """
            MATCH (a:stage)-[r:has_agent]->(b:agent)
            WHERE r.run_id = {run_id}
            RETURN r.rel_id, r.edge_type, a.stage_id AS source_id, b.node_id AS target_id, r.stage, r.weight, r.attrs_json
            """,
        ),
        (
            "has_group",
            """
            MATCH (a:stage)-[r:has_group]->(b:grp)
            WHERE r.run_id = {run_id}
            RETURN r.rel_id, r.edge_type, a.stage_id AS source_id, b.node_id AS target_id, r.stage, r.weight, r.attrs_json
            """,
        ),
        (
            "member_of",
            """
            MATCH (a:agent)-[r:member_of]->(b:grp)
            WHERE r.run_id = {run_id}
            RETURN r.rel_id, r.edge_type, a.node_id AS source_id, b.node_id AS target_id, r.stage, r.weight, r.attrs_json
            """,
        ),
        (
            "agent_rel",
            """
            MATCH (a:agent)-[r:agent_rel]->(b:agent)
            WHERE r.run_id = {run_id}
            RETURN r.rel_id, r.edge_type, a.node_id AS source_id, b.node_id AS target_id, r.stage, r.weight, r.attrs_json
            """,
        ),
        (
            "group_rel",
            """
            MATCH (a:grp)-[r:group_rel]->(b:grp)
            WHERE r.run_id = {run_id}
            RETURN r.rel_id, r.edge_type, a.node_id AS source_id, b.node_id AS target_id, r.stage, r.weight, r.attrs_json
            """,
        ),
    ]
    for _, query_template in rel_queries:
        query = query_template.replace("{run_id}", _q(run_id))
        rows = _rows(query)
        for row in rows:
            source = row[2]
            target = row[3]
            if source == run_id:
                source = f"run:{run_id}"
            attrs = json.loads(row[6] or "{}")
            edges.append(
                GraphEdge(
                    id=row[0],
                    edge_type=row[1],
                    source=source,
                    target=target,
                    run_id=run_id,
                    stage=(row[4] or None),
                    weight=float(row[5] or 0.0),
                    attrs=attrs,
                )
            )

    return GraphSnapshot(run_id=run_id, nodes=nodes, edges=edges)
