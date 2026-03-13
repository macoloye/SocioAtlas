# ⚙️ SIMULATION.md — Single‑File System Overview

This file is the **single source of truth** for how SocialAtlas works. It is written so that an LLM (or a human) can understand and safely extend the system without reading the whole repo.

---

### Architecture Overview

```
User Input (Initial Event String)
        │
        ▼
┌────────────────────────────────────────────────────────┐
│ Timeline Loop (T1 → T2 → T3 → T4 → T5)                │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Step 1: Group Generator                            │◄├── New Event State + Persuadable Context (prev stage)
│ │ LLM generates 3–6 relevant stance groups for the  │ │
│ │ CURRENT event state.                              │ │
│ └────────────────────────────────────────────────────┘ │
│                          │                             │
│                          ▼                             │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Step 2: Stance Runner                              │ │
│ │ Single LLM call (all agents).                     │ │
│ │ Outputs per agent: score, contested, incentive,   │ │
│ │ intensity, visibility, flip_risk, reasoning.      │ │
│ └────────────────────────────────────────────────────┘ │
│                          │                             │
│                          ▼                             │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Step 3: Relationship Deriver  (pure Python)        │ │
│ │ Builds agent↔agent and group↔group ALIGNS_WITH /  │ │
│ │ CONFLICTS_WITH edges from score overlap.          │ │
│ │ Calls build_stage_context() to extract persuadable│ │
│ │ + contested agents — injected into next Stage 2.  │ │
│ └────────────────────────────────────────────────────┘ │
│                          │                             │
│                          ▼                             │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Step 4: End State Generator                        │ │
│ │ Based on groups and agent stances, summarizes the  │ │
│ │ social response and outputs the new event state.  │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ Step 5: Output Formatter & Viz            │
│ Stance matrix, timeline chart, and a      │
│ group-based scrollable coalition map.     │
└───────────────────────────────────────────┘
```

Timeline semantics (from `README.md` / `TIMELINE.md`):
- `T1` Immediate reaction, `T2` media amplification, `T3` social spread, `T4` lobbying, `T5` stabilization.

---

## 2. Core Data Model (shared between backend and frontend)

Defined in `backend/types.py` and `shared/types.ts`.

- **Primitive types**
  - `IncentiveType`: `"M" | "P" | "I" | "S" | "N"` (Material, Power, Identity, Survival, Normative).
  - `StanceLabel`: `"Strongly Support" | "Support" | "Neutral" | "Oppose" | "Strongly Oppose" | "Contested"`.
  - `Stage`: `"T1" | "T2" | "T3" | "T4" | "T5"`.
  - `StanceScore`: `-2 | -1 | 0 | 1 | 2`.
  - `StancePosture`: `"supportive" | "opposing" | "ambiguous" | "neutral"`.

- **Domain models**
  - `Agent`: `{ id: string; persona: string }`.
  - `Group`: `{ group_id, name, description, stance_posture, primary_incentive }`.
  - `StanceResult` (per agent per stage):
    - `agent_id`, `assigned_group_id`, **derived** `stance: StanceLabel`.
    - `score: StanceScore`, `contested: boolean`.
    - `incentive_active: IncentiveType | null`.
    - `intensity: 1 | 2 | 3` (activation; drives node size).
    - `visibility: "low" | "mid" | "high"` (when they appear).
    - `flip_risk: number` in \[0, 1] (persuadability for next stage).
    - `reasoning: string` (persona‑grounded explanation).
  - `StageEndState`: `{ social_response_summary, new_event_state }`.
  - `StageOutput`: `{ stage, groups: Group[], results: StanceResult[], end_state: StageEndState }`.
  - `SimulationRun`:
    - `run_id`, `initial_event`, timestamps.
    - `agents: Agent[]` (sampled from a large persona pool).
    - `timeline: Record<Stage, StageOutput>` (backend) / `Partial<Record<Stage, StageOutput>>` (frontend).

- **Graph models**
  - `GraphNodeType`: `"run" | "stage" | "agent" | "group"`.
  - `GraphEdgeType`: `"HAS_STAGE" | "HAS_AGENT" | "HAS_GROUP" | "MEMBER_OF" | "ALIGNS_WITH" | "CONFLICTS_WITH" | "COOPERATES_WITH" | "COMPETES_WITH"`.
  - `GraphNode`: `{ id, node_type, label, run_id, stage?, attrs: Record<string, string | number | boolean | null> }`.
  - `GraphEdge`: `{ id, edge_type, source, target, run_id, stage?, weight, attrs }`.
  - `GraphSnapshot`: `{ run_id, nodes, edges }`.

---

## 3. Backend: Simulation Loop and Prompts

The backend is Python (FastAPI style) with Pydantic models in `backend/types.py` and prompt builders in `backend/utils/prompts.py`.

**External API surface**
- `POST /simulate` → `SimulateRequest { event, sample_size? }` → `SimulateResponse { run: SimulationRun }`.
- `GET /simulate/{run_id}` → `SimulationRun`.
- `GET /simulate` → list of `SimulationRunSummary`.
- `GET /graph/{run_id}/snapshot` → `GraphSnapshot` for the current run (used by Coalition Map).
- `POST /graph/{run_id}/chat` → `ChatResponse` (Graph‑aware QA).

**Simulation loop (conceptual)**

```python
current_event = initial_event
agents = sample_personas(sample_size)
persuadable_context = ""
timeline = {}

for stage in ["T1", "T2", "T3", "T4", "T5"]:
    groups = llm(build_group_prompt(current_event, previous_event, previous_groups))
    stances = llm(build_stance_prompt(current_event, stage, groups, agents, persuadable_context))
    persuadable_context = build_stage_context(stances.results)
    end_state = llm(build_end_state_prompt(current_event, stage, groups, stances))
    timeline[stage] = StageOutput(stage=stage, groups=groups, results=stances.results, end_state=end_state)
    previous_event = current_event
    previous_groups = groups
    current_event = end_state.new_event_state
```

Key rules (enforced by prompt builders and validators):
- **Groups:** 3–6 stance groups per stage, defined by **relationship to the event**, not demographics; must span support / oppose / ambiguous.
- **Stances:** One **batch call** per stage over all agents. LLM returns only primitive fields (`score`, `contested`, `incentive_active`, `intensity`, `visibility`, `flip_risk`, `reasoning`); **`stance` label is derived** from `score` and `contested`.
- **Persuadable context:** `build_stage_context` takes previous stage `StanceResult[]` and emits a short text block describing:
  - Agents with `flip_risk > 0.6`.
  - All `contested == true` agents.
  - This text is injected into the next stage’s stance prompt so the LLM can model drift without hand‑coded rules.
- **End‑state:** `build_end_state_prompt` summarizes which groups gained members and produces:
  - `social_response_summary` (1–2 paragraphs).
  - `new_event_state` (news‑style description used as `EVENT` for the next stage).

The backend also constructs a **knowledge graph** from each `SimulationRun`:
- Nodes: one `run` node, five `stage` nodes, `agent` nodes, `group` nodes.
- Edges:
  - Structural: `HAS_STAGE`, `HAS_AGENT`, `HAS_GROUP`.
  - Membership: `MEMBER_OF` from agents to groups per stage, with attrs like `score`, `contested`, `reasoning`, `intensity`.
  - Alignment: `ALIGNS_WITH` / `CONFLICTS_WITH` / `COOPERATES_WITH` / `COMPETES_WITH` based on stance similarity and incentive overlap.

Graph‑aware chat (`ChatRequest` / `ChatResponse`) retrieves top‑K `GraphEvidence` and lets an LLM answer natural‑language questions about “who opposed what, when, and why” anchored in the graph.

---

## 4. Frontend: Main Screens and Behavior

The frontend is React + TypeScript (`frontend/src`) using shared types from `@socioatlas/shared`.

- **`App.tsx`**
  - Global store: `useSimulationStore` (current `run`, loading state, active stage, history).
  - Layout:
    - Top: `EventInput` (event text + **Agents in the World** slider, 5–200; calls `submitEvent`).
    - Progress banner while streaming stages.
    - Once any stage is available:
      - `StageStream`: compact timeline view of `T1`–`T5` and current progress.
      - Left pane: `CoalitionMap`.
      - Right pane tabs:
        - `StanceMatrix`.
        - `TimelineDrift`.
        - `IncentiveBreakdown`.
        - `GraphChat`.
    - History selector for loading previous `SimulationRun`s.

- **`CoalitionMap/CoalitionMap.tsx`**
  - Fetches `GraphSnapshot` for the active `run_id`.
  - Uses `graphology` + `sigma` to render:
    - Group nodes laid out in a grid.
    - Agent nodes orbiting their group, colored by stance (`score` / `contested`), sized by `intensity`.
  - Toolbar filters: **All**, **Groups only**, **Support**, **Oppose**.
  - Sidebar shows details for the selected node:
    - For groups: description, primary incentive, average stance, size.
    - For agents: persona, stance label, intensity, reasoning, coalition peers.

- **Other views**
  - `StanceMatrix`: table of groups → agents with stance icons at the selected stage; hover shows `reasoning`.
  - `TimelineDrift`: chart of stance trajectories (`score`) over `T1`–`T5` for a single agent or aggregate.
  - `IncentiveBreakdown`: per‑stage distribution of `incentive_active` (Material / Identity / Normative / Power / Survival), with filters for all vs. support vs. oppose.
  - `GraphChat`: chat panel backed by `/graph/{run_id}/chat`, exposing the knowledge graph as a QA surface.

---

## 5. How to Extend Safely (for LLMs)

When modifying or adding features:
- **Preserve schemas** in `backend/types.py` and `shared/types.ts`. Add fields in a backward‑compatible way where possible.
- **Do not change**:
  - Meaning of `StanceScore`, `StanceLabel`, or incentive codes.
  - The rule that `stance` is derived from `score` + `contested`, not produced by the LLM.
- **Be consistent across layers**:
  - Any field added to `StanceResult`, `Group`, `StageOutput`, or `SimulationRun` must be updated in both Python and TypeScript types and respected in prompt builders and visualizations.
- **Graph invariants**:
  - Every graph node/edge must carry `run_id` and be stage‑scoped where appropriate.
  - `MEMBER_OF` edges should always include stance attributes so `CoalitionMap` and `GraphChat` remain informative.

If you need finer control over prompts, edit `backend/utils/prompts.py` but keep:
- Strict **JSON‑only** responses.
- Clear instructions for incentive types, score scale, and contested vs. neutral.

