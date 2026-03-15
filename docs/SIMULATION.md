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
│ │ Builds deterministic agent↔agent and group↔group  │ │
│ │ relationship edges using stance, incentives,       │ │
│ │ intensity, visibility, contested, and flip_risk.   │ │
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
        │        ▼ (For T1–T4: PAUSE & AWAIT USER CHOICE)
┌────────────────────────────────────────────────────────┐
│ Step 4b: End State Choice (T1–T4 only)               │
│ LLM generates 3 probable next_event_states.          │
│ Frontend displays options + 6s countdown.            │
│ User picks an option, writes custom, or waits for   │
│ timeout (defaults to LLM's choice).                  │
│ POST /simulate/{run_id}/select-end-state confirms   │
│ choice and resumes loop. (T5 skips this step.)      │
│ └────────────────────────────────────────────────────┘
        │        ▼
┌───────────────────────────────────────────┐
│ Step 5: Output Formatter & Viz            │
│ Stance matrix, timeline chart, and an     │
│ animated D3 coalition relationship map.   │
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
  - `EventStateOption`: `{ option_id: string, label: string, next_event_state: string, is_default: boolean }`.
  - `StageEndState`: `{ social_response_summary, new_event_state, event_state_options: EventStateOption[], selected_option_id?: string, selection_source?: "default_timeout" | "user_option" | "user_custom" }`.
    - `event_state_options` is populated for T1–T4 stages by the LLM (3 options); T5 has empty array.
    - `selected_option_id`, `selection_source` are set after user makes a choice or timeout occurs.
  - `EndStateSelectionRequest`: `{ stage: Stage, chosen_event_state: string, selected_option_id?: string, selection_source: "user_option" | "user_custom" }`.
  - `EndStateSelectionResponse`: `{ accepted: boolean, message: string }`.
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
    - `attrs` is scalar-only (string/number/boolean/null); nested objects are not allowed.
  - `GraphSnapshot`: `{ run_id, nodes, edges }`.

---

## 3. Backend: Simulation Loop and Prompts

The backend is Python (FastAPI style) with Pydantic models in `backend/types.py` and prompt builders in `backend/utils/prompts.py`.

**External API surface**
- `POST /simulate` → `SimulateRequest { event, sample_size? }` → `SimulateResponse { run: SimulationRun }`.
- `GET /simulate/{run_id}` → `SimulationRun`.
- `GET /simulate` → list of `SimulationRunSummary`.
- `POST /simulate/{run_id}/select-end-state` → `EndStateSelectionRequest` → `EndStateSelectionResponse` (user selects a next event state or timeout fires).
- `GET /graph/{run_id}/snapshot` → `GraphSnapshot` for the current run (used by Coalition Map).
- `POST /graph/{run_id}/chat` → `ChatResponse` (Graph‑aware QA).

**Simulation loop (conceptual)**

```python
current_event = initial_event
agents = sample_personas(sample_size)
persuadable_context = ""
timeline = {}
pending_choices = {}  # { stage: asyncio.Event }

for stage in ["T1", "T2", "T3", "T4", "T5"]:
    groups = llm(build_group_prompt(current_event, previous_event, previous_groups))
    stances = llm(build_stance_prompt(current_event, stage, groups, agents, persuadable_context))
    persuadable_context = build_stage_context(stances.results)
    end_state = llm(build_end_state_prompt(current_event, stage, groups, stances))
    
    # ===== NEW: For T1–T4, pause and await user selection (6s timeout) =====
    if stage in ["T1", "T2", "T3", "T4"]:
        # Emit "awaiting_end_state_choice" SSE event with 3 options + timeout
        emit_sse_event("awaiting_end_state_choice", {
            stage, event_state_options: end_state.event_state_options, timeout_seconds: 6
        })
        
        # Wait up to 6s for user to POST /simulate/{run_id}/select-end-state
        try:
            user_choice = await asyncio.wait_for(pending_choices[stage].wait(), timeout=6)
            chosen_event_state = user_choice.chosen_event_state
            selection_source = user_choice.selection_source  # "user_option" or "user_custom"
        except asyncio.TimeoutError:
            # Apply LLM's default option
            default_option = find_default(end_state.event_state_options)
            chosen_event_state = default_option.next_event_state
            selection_source = "default_timeout"
        
        # Update end_state with user's selection
        end_state.selected_option_id = user_choice.selected_option_id if user_choice else default_option.option_id
        end_state.selection_source = selection_source
        current_event = chosen_event_state
        
        # Emit "end_state_selected" SSE event to confirm choice
        emit_sse_event("end_state_selected", {
            stage, chosen_event_state, selection_source
        })
    else:
        # T5: No pause, directly use LLM's output
        end_state.event_state_options = []  # Empty for T5
        end_state.selected_option_id = None
        end_state.selection_source = None
        current_event = end_state.new_event_state
    
    timeline[stage] = StageOutput(stage=stage, groups=groups, results=stances.results, end_state=end_state)
    previous_event = current_event
    previous_groups = groups
```

Key rules (enforced by prompt builders and validators):
- **Groups:** 3–6 stance groups per stage, defined by **relationship to the event**, not demographics; must span support / oppose / ambiguous.
- **Stances:** One **batch call** per stage over all agents. LLM returns only primitive fields (`score`, `contested`, `incentive_active`, `intensity`, `visibility`, `flip_risk`, `reasoning`); **`stance` label is derived** from `score` and `contested`.
- **Persuadable context:** `build_stage_context` takes previous stage `StanceResult[]` and emits a short text block describing:
  - Agents with `flip_risk > 0.6`.
  - All `contested == true` agents.
  - This text is injected into the next stage’s stance prompt so the LLM can model drift without hand‑coded rules.
- **End‑state:** `build_end_state_prompt` summarizes which groups gained members and produces (for **T1–T4**):
  - `social_response_summary` (1–2 paragraphs).
  - `new_event_state` implied in the first option (unused during pause).
  - `event_state_options`: Array of exactly **3 distinct next‑event scenarios**, each with `option_id`, `label`, `next_event_state`, and `is_default: true` for exactly one.
  - For **T5** (final stage): Single output (no branching):
    - `social_response_summary` (1–2 paragraphs).
    - `new_event_state` (final event state, not used as input to next stage).
    - `event_state_options`: Empty array (no user choice at final stage).
- **Choice normalization:** `parse_end_state_response()` validator ensures:
  - Exactly one option is marked `is_default=true` (fixes LLM lapses).
  - All options have valid `option_id`, `label`, and `next_event_state`.

The backend also constructs a **knowledge graph** from each `SimulationRun`:
- Nodes: one `run` node, five `stage` nodes, `agent` nodes, `group` nodes.
- Edges:
  - Structural: `HAS_STAGE`, `HAS_AGENT`, `HAS_GROUP`.
  - Membership: `MEMBER_OF` from agents to groups per stage, with attrs like `score`, `contested`, `reasoning`, `intensity`.
  - Alignment: `ALIGNS_WITH` / `CONFLICTS_WITH` / `COOPERATES_WITH` / `COMPETES_WITH` from deterministic relationship scoring (`deterministic_v2`).
    - Agent-agent features: stance distance/similarity, same group, same incentive, intensity sync, visibility sync, average `flip_risk`, contested split, opposite-sign pressure.
    - Group-group features: mean stance distance, incentive overlap, posture alignment/divergence, volatility gap (from `flip_risk`), contested-share gap, visibility pressure.
    - Relationship metadata is stored as scalar attrs (for example `component_stance_similarity`, `component_visibility_pressure`, `confidence`, `threshold_margin`, `classification_band`).

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
        - **NEW:** During T1–T4 end-state generation, displays `EndStatePicker` component with 3 option buttons, custom textarea, and 6s countdown timer.
      - Left pane: `CoalitionMap`.
      - Right pane tabs:
        - `StanceMatrix`.
        - `TimelineDrift`.
        - `IncentiveBreakdown`.
        - `GraphChat`.
    - History selector for loading previous `SimulationRun`s.

- **`CoalitionMap/CoalitionMap.tsx` + `CoalitionMap/CoalitionGraphD3.tsx`**
  - Fetches `GraphSnapshot` for the active `run_id` and renders with D3 force simulation.
  - Displays stage relationship edges (membership + align/conflict + cooperate/compete), with group-only mode focused on group-group edges.
  - Layout behavior:
    - Group anchors are arranged in a spaced grid.
    - Agent nodes orbit group anchors and are colored by stance (`score` / `contested`) and sized by `intensity`.
    - Label visibility is density-aware (collision suppression + zoom-gated labels + selected-node priority).
    - Edge and node entry transitions provide motion cues without changing graph semantics.
  - Toolbar filters: **All**, **Groups only**, **Support**, **Oppose**.
  - Sidebar shows details for the selected node:
    - For groups: description, primary incentive, average stance, size.
    - For agents: persona, stance label, intensity, reasoning, coalition peers.

- **`StageStream` — EndStatePicker (NEW)**
  - Component renders when `StageProgress.status === "awaiting_choice"`.
  - Displays:
    - **3 option buttons**: Each shows the option's `label` and marks the default with a pill chip.
    - **Custom textarea**: Allows user to write a custom event state.
    - **6s countdown timer**: SVG circular progress ring that decrements every 100ms and displays remaining seconds as text overlay.
    - **Submit button**: For custom text (option click submits immediately).
  - **Interaction**:
    - Clicking an option calls `selectEndState(stage, option.next_event_state, option.option_id, "user_option")`.
    - Submitting custom text calls `selectEndState(stage, customText, undefined, "user_custom")`.
    - If timer reaches 0, frontend auto-submits the default option: `selectEndState(stage, defaultOption.next_event_state, defaultOption.option_id, "default_timeout")`.
  - **SSE event flow**:
    - Backend emits `awaiting_end_state_choice` with options + timeout → frontend populates picker.
    - User submits choice → `selectEndState()` POSTs to `POST /simulate/{run_id}/select-end-state`.
    - Backend resumes simulation, then emits `end_state_selected` → frontend clears picker and continues.

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
  - The pause-and-resume mechanism for T1–T4 end-state selection (hardcoded 6s timeout, 3-option branching, `selection_source` tracking).
- **Be consistent across layers**:
  - Any field added to `StanceResult`, `Group`, `StageOutput`, or `SimulationRun` must be updated in both Python and TypeScript types and respected in prompt builders and visualizations.
  - If you modify end-state selection logic, update both `backend/modules/timeline_propagator.py` (pause/resume) and `frontend/src/store/simulationStore.ts` (SSE handlers).
- **Graph invariants**:
  - Every graph node/edge must carry `run_id` and be stage‑scoped where appropriate.
  - `MEMBER_OF` edges should always include stance attributes so `CoalitionMap` and `GraphChat` remain informative.
- **End-state selection**: When updating prompts for T1–T4 end-states:
  - Ensure exactly 3 distinct next-event scenarios are produced (no duplicates).
  - Ensure exactly one is marked `is_default=true`.
  - Use the validator's normalization (in `backend/utils/validators.py`) if edge cases occur.

If you need finer control over prompts, edit `backend/utils/prompts.py` but keep:
- Strict **JSON‑only** responses.
- Clear instructions for incentive types, score scale, and contested vs. neutral.
- For T1–T4: Explicit instruction to return 3 options with labels and `is_default` markers.
- For T5: Single output without branching.

