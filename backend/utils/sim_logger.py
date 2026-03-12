"""
Centralised simulation logger — writes structured log lines to simulation.log
while also echoing to stderr so the console still shows live progress.
"""
import logging
import os
from datetime import datetime, timezone

_LOG_FILE = os.path.join(
    os.path.dirname(__file__), "../../simulation.log"
)

# ── Logger setup ──────────────────────────────────────────────────────────────
_logger = logging.getLogger("simulation")
_logger.setLevel(logging.DEBUG)

if not _logger.handlers:
    fmt = logging.Formatter(
        "%(asctime)s  %(levelname)-7s  %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    # File handler - append so every run accumulates
    fh = logging.FileHandler(_LOG_FILE, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    _logger.addHandler(fh)

    # Console handler - info+ only
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)
    _logger.addHandler(ch)


def log_run_start(run_id: str, event: str, n_agents: int) -> None:
    _logger.info(
        "RUN_START  run_id=%s  agents=%d  event=%r",
        run_id, n_agents, event,
    )


def log_stage_start(run_id: str, stage: str, current_event: str) -> None:
    _logger.info(
        "STAGE_START  run_id=%s  stage=%s  event_snippet=%r",
        run_id, stage, current_event[:80],
    )


def log_groups_done(run_id: str, stage: str, groups: list) -> None:
    names = [g.name for g in groups]
    _logger.info(
        "GROUPS_DONE  run_id=%s  stage=%s  groups=%s",
        run_id, stage, names,
    )


def log_stances_done(run_id: str, stage: str, n_results: int) -> None:
    _logger.info(
        "STANCES_DONE  run_id=%s  stage=%s  results=%d",
        run_id, stage, n_results,
    )


def log_end_state(run_id: str, stage: str, summary: str, next_event: str) -> None:
    _logger.info(
        "END_STATE  run_id=%s  stage=%s  summary=%r  next_event=%r",
        run_id, stage, summary[:120], next_event[:120],
    )


def log_stage_done(run_id: str, stage: str) -> None:
    _logger.info("STAGE_DONE  run_id=%s  stage=%s", run_id, stage)


def log_run_done(run_id: str) -> None:
    _logger.info("RUN_DONE  run_id=%s", run_id)


def log_error(run_id: str, stage: str, error: str) -> None:
    _logger.error(
        "ERROR  run_id=%s  stage=%s  error=%r",
        run_id, stage, error,
    )
