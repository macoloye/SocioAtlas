import json
import os
import sqlite3
from datetime import datetime, timezone

from backend.types import SimulationRun

_DB_PATH = os.path.join(
    os.path.dirname(__file__), "../../simulation_history.db"
)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS simulation_runs (
                run_id TEXT PRIMARY KEY,
                initial_event TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                status TEXT NOT NULL,
                run_json TEXT NOT NULL
            )
            """
        )
        conn.commit()


def upsert_run(run: SimulationRun, status: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO simulation_runs (
                run_id, initial_event, created_at, updated_at, status, run_json
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(run_id) DO UPDATE SET
                initial_event=excluded.initial_event,
                updated_at=excluded.updated_at,
                status=excluded.status,
                run_json=excluded.run_json
            """,
            (
                run.run_id,
                run.initial_event,
                run.created_at,
                now,
                status,
                run.model_dump_json(),
            ),
        )
        conn.commit()


def get_run(run_id: str) -> SimulationRun | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT run_json FROM simulation_runs WHERE run_id = ?",
            (run_id,),
        ).fetchone()
    if not row:
        return None
    payload = json.loads(row["run_json"])
    return SimulationRun.model_validate(payload)


def list_runs(limit: int = 25) -> list[dict[str, str]]:
    safe_limit = max(1, min(limit, 100))
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT run_id, initial_event, created_at, status, updated_at
            FROM simulation_runs
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
    return [
        {
            "run_id": row["run_id"],
            "initial_event": row["initial_event"],
            "created_at": row["created_at"],
            "status": row["status"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]
