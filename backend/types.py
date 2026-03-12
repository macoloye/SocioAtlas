from typing import Literal, Optional
from pydantic import BaseModel

# ── Primitive types ───────────────────────────────────────────────────────────

IncentiveType = Literal["M", "P", "I", "S", "N"]
StanceLabel = Literal[
    "Strongly Support", "Support", "Neutral",
    "Oppose", "Strongly Oppose", "Contested"
]
Stage = Literal["T1", "T2", "T3", "T4", "T5"]
ActivationStage = Literal["T1", "T2", "T3", "T4"]
StancePosture = Literal["supportive", "opposing", "ambiguous", "neutral"]

# ── Core domain models ────────────────────────────────────────────────────────

class Agent(BaseModel):
    id: str
    persona: str


class Group(BaseModel):
    group_id: str
    name: str
    description: str
    stance_posture: StancePosture
    primary_incentive: IncentiveType


class StanceResult(BaseModel):
    agent_id: str
    assigned_group_id: str
    stance: StanceLabel
    score: int  # -2 … +2
    incentive_active: Optional[IncentiveType]
    reasoning: str


class StageEndState(BaseModel):
    social_response_summary: str
    new_event_state: str


class StageOutput(BaseModel):
    stage: Stage
    groups: list[Group]
    results: list[StanceResult]
    end_state: StageEndState


# ── Simulation run ────────────────────────────────────────────────────────────

class SimulationRun(BaseModel):
    run_id: str
    initial_event: str
    created_at: str
    agents: list[Agent]
    timeline: dict[str, StageOutput]   # Stage key → StageOutput


# ── API contracts ─────────────────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    event: str
    sample_size: Optional[int] = None


class SimulateResponse(BaseModel):
    run: SimulationRun


class GetSimulationResponse(BaseModel):
    run: SimulationRun


class SimulationRunSummary(BaseModel):
    run_id: str
    initial_event: str
    created_at: str
    status: str
    updated_at: str


class ListSimulationsResponse(BaseModel):
    runs: list[SimulationRunSummary]


class ApiError(BaseModel):
    error: str
    message: str
