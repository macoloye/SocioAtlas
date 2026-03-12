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
  incentive_active: IncentiveType | null;
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
