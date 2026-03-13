// ─── Primitive types ─────────────────────────────────────────────────────────

export type IncentiveType = "M" | "P" | "I" | "S" | "N";

export type StanceLabel =
  | "Strongly Support"
  | "Support"
  | "Neutral"
  | "Oppose"
  | "Strongly Oppose"
  | "Contested";

export type Stage = "T1" | "T2" | "T3" | "T4" | "T5";

export type StanceScore = -2 | -1 | 0 | 1 | 2;

export type StancePosture = "supportive" | "opposing" | "ambiguous" | "neutral";

// ─── Core domain types ───────────────────────────────────────────────────────

export interface Agent {
  id: string;
  persona: string;
}

export interface Group {
  group_id: string;
  name: string;
  description: string;
  stance_posture: StancePosture;
  primary_incentive: IncentiveType;
}

export interface StanceResult {
  agent_id: string;
  assigned_group_id: string;
  stance: StanceLabel;
  score: StanceScore;
  contested: boolean;
  incentive_active: IncentiveType | null;
  intensity: 1 | 2 | 3;
  visibility: "low" | "mid" | "high";
  flip_risk: number;
  reasoning: string;
}

export interface StageEndState {
  social_response_summary: string;
  new_event_state: string;
}

export interface StageOutput {
  stage: Stage;
  groups: Group[];
  results: StanceResult[];
  end_state: StageEndState;
}

// ─── Simulation run ───────────────────────────────────────────────────────────

export interface SimulationRun {
  run_id: string;
  initial_event: string;
  created_at: string;
  agents: Agent[];
  timeline: Partial<Record<Stage, StageOutput>>;
}

// ─── API contracts ────────────────────────────────────────────────────────────

export interface SimulateRequest {
  event: string;
  sample_size?: number;
}

export interface SimulateResponse {
  run: SimulationRun;
}

export interface GetSimulationResponse {
  run: SimulationRun;
}

export interface SimulationRunSummary {
  run_id: string;
  initial_event: string;
  created_at: string;
  status: string;
  updated_at: string;
}

export interface ListSimulationsResponse {
  runs: SimulationRunSummary[];
}

export interface ApiError {
  error: string;
  message: string;
}

// ─── Graph formalization ─────────────────────────────────────────────────────

export type GraphNodeType = "run" | "stage" | "agent" | "group";

export type GraphEdgeType =
  | "HAS_STAGE"
  | "HAS_AGENT"
  | "HAS_GROUP"
  | "MEMBER_OF"
  | "ALIGNS_WITH"
  | "CONFLICTS_WITH"
  | "COOPERATES_WITH"
  | "COMPETES_WITH";

export interface GraphNode {
  id: string;
  node_type: GraphNodeType;
  label: string;
  run_id: string;
  stage: Stage | null;
  attrs: Record<string, string | number | boolean | null>;
}

export interface GraphEdge {
  id: string;
  edge_type: GraphEdgeType;
  source: string;
  target: string;
  run_id: string;
  stage: Stage | null;
  weight: number;
  attrs: Record<string, string | number | boolean | null>;
}

export interface GraphSnapshot {
  run_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphRetrieveRequest {
  query: string;
  stage?: Stage;
  top_k?: number;
}

export interface GraphEvidence {
  id: string;
  kind: "node" | "edge";
  label: string;
  score: number;
  stage: Stage | null;
  details: string;
}

export interface GraphRetrieveResponse {
  run_id: string;
  query: string;
  evidence: GraphEvidence[];
}

export interface ChatRequest {
  query: string;
  top_k?: number;
}

export interface ChatResponse {
  answer: string;
  evidence: GraphEvidence[];
  stages_used: Stage[];
}
