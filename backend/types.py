from typing import Literal, Optional
from pydantic import BaseModel, Field

# ── Primitive types ───────────────────────────────────────────────────────────

IncentiveType = Literal["M", "P", "I", "S", "N"]
StanceLabel = Literal[
    "Strongly Support", "Support", "Neutral",
    "Oppose", "Strongly Oppose", "Contested"
]
Stage = Literal["T1", "T2", "T3", "T4", "T5"]
ActivationStage = Literal["T1", "T2", "T3", "T4"]
StancePosture = Literal["supportive", "opposing", "ambiguous", "neutral"]
GraphNodeType = Literal["run", "stage", "agent", "group"]
GraphEdgeType = Literal[
    "HAS_STAGE",
    "HAS_AGENT",
    "HAS_GROUP",
    "MEMBER_OF",
    "ALIGNS_WITH",
    "CONFLICTS_WITH",
    "COOPERATES_WITH",
    "COMPETES_WITH",
]

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
    contested: bool = False          # True = internally split (different from neutral)
    incentive_active: Optional[IncentiveType]
    intensity: int = 2               # 1 = background, 2 = engaged, 3 = loud
    visibility: str = "mid"          # "low" | "mid" | "high"
    flip_risk: float = 0.0           # 0.0–1.0, persuadability for next stage
    reasoning: str


class StageEndState(BaseModel):
    social_response_summary: str
    new_event_state: str
    event_state_options: list["EventStateOption"] = Field(default_factory=list)
    selected_option_id: Optional[str] = None
    selection_source: Optional[
        Literal["default_timeout", "user_option", "user_custom"]
    ] = None


class EventStateOption(BaseModel):
    option_id: str
    label: str
    next_event_state: str
    is_default: bool = False


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


class EndStateSelectionRequest(BaseModel):
    stage: Stage
    chosen_event_state: str
    selected_option_id: Optional[str] = None
    selection_source: Literal["user_option", "user_custom"] = "user_option"


class EndStateSelectionResponse(BaseModel):
    accepted: bool
    message: str


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


# ── Formal graph + chat contracts ────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    node_type: GraphNodeType
    label: str
    run_id: str
    stage: Optional[Stage] = None
    attrs: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str
    edge_type: GraphEdgeType
    source: str
    target: str
    run_id: str
    stage: Optional[Stage] = None
    weight: float = 0.0
    attrs: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class GraphSnapshot(BaseModel):
    run_id: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class GraphRetrieveRequest(BaseModel):
    query: str
    stage: Optional[Stage] = None
    top_k: int = 12


class GraphEvidence(BaseModel):
    id: str
    kind: Literal["node", "edge"]
    label: str
    score: float
    stage: Optional[Stage] = None
    details: str


class GraphRetrieveResponse(BaseModel):
    run_id: str
    query: str
    evidence: list[GraphEvidence]


class ChatRequest(BaseModel):
    query: str
    top_k: int = 12


class ChatResponse(BaseModel):
    answer: str
    evidence: list[GraphEvidence]
    stages_used: list[Stage]
