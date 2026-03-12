# ⚙️ SIMULATION.md — Implementation & Visualization Guide

---

## Part 1: Implementation

---

### Architecture Overview

```
User Input (Initial Event String)
        │
        ▼
┌───────────────────────────────────────────┐
│ Timeline Loop (T1 → T2 → T3 → T4 → T5)    │
│                                           │
│ ┌───────────────────────────────────────┐ │
│ │ Step 1: Group Generator               │◄├── New Event State (from prev stage)
│ │ LLM generates 3–6 relevant stance     │ │
│ │ groups for the CURRENT event state.   │ │
│ └───────────────────────────────────────┘ │
│                   │                       │
│                   ▼                       │
│ ┌───────────────────────────────────────┐ │
│ │ Step 2: Stance Runner                 │ │
│ │ Single LLM call (all agents).         │ │
│ │ Decides which group each agent joins  │ │
│ │ + stance, score, and reasoning.       │ │
│ └───────────────────────────────────────┘ │
│                   │                       │
│                   ▼                       │
│ ┌───────────────────────────────────────┐ │
│ │ Step 3: End State Generator           │ │
│ │ Based on groups and agent stances,    │ │
│ │ summarizes the social response and    │ │
│ │ outputs the new event state.          │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────┐
│ Step 4: Output Formatter & Viz            │
│ Stance matrix, timeline chart, and a      │
│ group-based scrollable coalition map.     │
└───────────────────────────────────────────┘
```

---

### Step 1 — Group Generation Prompt

This runs **at the start of every stage (T1–T5)**. Groups can change, emerge, or persist depending on how the event evolves.

```
You are designing the societal reaction landscape for a simulation.

EVENT: {event}

Generate between 3 and 6 stance groups that would naturally form around this event.
Groups are defined by their relationship to the event — not by demographics or profession.
Cover the full spectrum: at least one group likely to support, one likely to oppose, one ambiguous.

Return ONLY valid JSON. No explanation outside the JSON block.

{
  "groups": [
    {
      "group_id": "snake_case_id",
      "name": "Plain language group name",
      "description": "One sentence: who are these people and why do they care?",
      "stance_posture": "Their default orientation to this event",
      "primary_incentive": "M | P | I | S | N",
    },
    ...
  ]
}

Example Event
EVENT: Government introduces a 5% tax on cryptocurrency transactions.

Example Output
{
  "groups": [
    {
      "group_id": "financial_stability_advocates",
      "name": "Financial Stability Advocates",
      "description": "People who believe speculative crypto activity threatens economic stability and support measures to regulate it.",
      "stance_posture": "Generally supportive of the tax as a way to reduce speculation and integrate crypto into formal financial oversight.",
      "primary_incentive": "S"
    },
    {
      "group_id": "innovation_protectionists",
      "name": "Innovation Protectionists",
      "description": "People who view crypto as a frontier technology and worry regulation will slow innovation and push talent elsewhere.",
      "stance_posture": "Opposed to the tax because it signals hostility toward emerging financial technology.",
      "primary_incentive": "P"
    },
    {
      "group_id": "personal_finance_defenders",
      "name": "Personal Finance Defenders",
      "description": "Individuals focused on protecting their own financial upside and minimizing costs on their investments or trading activity.",
      "stance_posture": "Strongly opposed because the tax directly reduces their expected gains.",
      "primary_incentive": "M"
    },
    {
      "group_id": "institutional_pragmatists",
      "name": "Institutional Pragmatists",
      "description": "Observers who accept that some regulation is inevitable but want rules that are predictable and workable.",
      "stance_posture": "Ambivalent; open to the tax if it comes with clearer legal frameworks and stability.",
      "primary_incentive": "N"
    },
    {
      "group_id": "fairness_watchdogs",
      "name": "Fairness Watchdogs",
      "description": "People concerned with whether powerful actors are contributing fairly to public revenue and social obligations.",
      "stance_posture": "Conditionally supportive if the tax is framed as ensuring crypto participants contribute like other financial sectors.",
      "primary_incentive": "I"
    },
    {
      "group_id": "news_followers",
      "name": "News Followers",
      "description": "People who are aware of the event but have not yet formed a strong opinion and are primarily observing the developing discussion.",
      "stance_posture": "Neutral and waiting for more information or social signals before forming a position.",
      "primary_incentive": "N"
    }
  ]
}

```

---

### Step 2 — Single Batch Stance Prompt (Core)

This is the main prompt. It runs **all agents in one call**, returning their stance, reasoning, and **which formed group they belong to** at this stage.

```
You are running a societal simulation. Given an event, a list of agents, and the available groups for this stage, output each agent's stance, reasoning, and group assignment.

EVENT: {event}

TIMELINE STAGE: {stage_label}
{stage_description}

AVAILABLE GROUPS:
{groups_list}

INCENTIVE TYPES (use these to ground your reasoning):
  M = Material     — "what does this cost or gain me?"
  P = Power        — "does this increase or reduce my influence?"
  I = Identity     — "does this affirm or threaten who I am?"
  S = Survival     — "does this threaten my existence or way of life?"
  N = Normative    — "is this right or wrong regardless of self-interest?"

STANCE SCALE:
  +2 = Strongly Support
  +1 = Support
   0 = Neutral
  -1 = Oppose
  -2 = Strongly Oppose
   ± = Contested (internal split)

AGENTS:
{agents_list}

For each agent, select the most appropriate group from the available groups, and output their stance at this timeline stage.
Reasoning must be 1–2 sentences, grounded in their specific persona and the event.
Do NOT be generic. Connect the persona to the event concretely.

Return ONLY valid JSON. No explanation outside the JSON block.

{
  "stage": "{stage}",
  "results": [
    {
      "agent_id": "string",
      "assigned_group_id": "group_id_from_available_groups",
      "stance": "Strongly Support | Support | Neutral | Oppose | Strongly Oppose | Contested",
      "score": 2 | 1 | 0 | -1 | -2,
      "incentive_active": "M | P | I | S | N",
      "reasoning": "1–2 sentences"
    },
    ...
  ]
}
```

**`{agents_list}` format** — injected as a numbered list:

```
1. ID: power_user_1 | Group: Early Adopter Power Users | Persona: A productivity-obsessed freelance designer who beta-tests every new app and posts honest reviews
2. ID: privacy_skeptic_1 | Group: Privacy-Concerned Skeptics | Persona: A cybersecurity professional who scrutinizes every new app's data practices before installation
3. ID: privacy_skeptic_2 | Group: Privacy-Concerned Skeptics | Persona: A digital rights activist who sees AI assistants as surveillance infrastructure
...up to 10 agents
```

---

### Step 3 — End State Generator Prompt

After calculating stances and assigning agents to groups for a stage, this prompt summarizes the impact and generates the new event state for the next timeline stage.

```
You are a simulation engine summarizing the outcome of a timeline stage. 
Based on the current event, the groups involved, and the agents' stances, summarize the social response and outcome. Then, generate the new "event state" which will serve as the reality for the next stage.

CURRENT EVENT: {event}
TIMELINE STAGE: {stage_label}

GROUP & STANCE SUMMARY:
{group_stance_summary}

Return ONLY valid JSON. No explanation outside the JSON block.

{
  "social_response_summary": "1-2 paragraphs summarizing the macro reaction, dominant groups, and shifts in public opinion or policy.",
  "new_event_state": "The updated reality of the event. Write it as a news summary detailing where things stand now. This text will be the new EVENT prompt for the next timeline stage."
}
```

---

### Stage Descriptions (inject into `{stage_description}`)

```python
STAGE_DESCRIPTIONS = {
  "T1": "IMMEDIATE REACTION — The news just broke. Agents are reacting within hours based on the raw event, before any media narrative has formed. High-activation agents respond first.",
  "T2": "MEDIA AMPLIFICATION — Journalists have filed stories. Influencers have posted. Two or three competing narratives are now in circulation. Agents are responding to these frames, not just the event.",
  "T3": "SOCIAL SPREAD — The story has reached ordinary people through social feeds and word of mouth. Most people are reacting to what they heard about the event, not the event itself.",
  "T4": "LOBBYING — Organized interests are making moves behind the scenes. Coalitions are forming. Some agents' public stance may now diverge from their private action.",
  "T5": "STABILIZATION — The event has been absorbed. Stances are hardening or fading. The 'new normal' is emerging."
}
```

---

### Timeline Loop

```python
async def run_simulation(initial_event: str) -> SimulationRun:

    current_event = initial_event
    agents = load_all_agents()  # static list of all defined agents
    results = {}

    for stage in ["T1", "T2", "T3", "T4", "T5"]:
        # Step 1: Generate groups for this event state
        groups = await generate_groups(current_event)
        
        # Step 2: Run stances & assign agents to groups
        batch = build_agent_list(agents)      
        prompt = build_stance_prompt(current_event, stage, groups, batch)
        raw_stances = await llm(prompt)
        stances = parse_json(raw_stances)
        
        # Step 3: Generate end state of this stage
        end_state_prompt = build_end_state_prompt(current_event, stage, groups, stances)
        raw_end_state = await llm(end_state_prompt)
        end_state = parse_json(raw_end_state)
        
        results[stage] = {
            "groups": groups,
            "stances": stances,
            "end_state": end_state
        }
        
        # The end state becomes the event for the next stage
        current_event = end_state["new_event_state"]

    return SimulationRun(initial_event, agents, results)
```

---

### Full Example: Prompt + Output

**Event:** `"A major coffee chain bans single-use plastic cups starting next month"`

**Agents list injected (10 agents):**
```
1. ID: eco_loyal_1    | Group: Eco-Conscious Loyalists    | Persona: A reusable-cup-carrying regular who has been asking this chain to go green for years
2. ID: eco_loyal_2    | Group: Eco-Conscious Loyalists    | Persona: A climate activist who uses brand choices as a political statement
3. ID: conv_customer_1| Group: Convenience-First Customers| Persona: A daily commuter who grabs coffee between meetings and never remembers their reusable cup
4. ID: conv_customer_2| Group: Convenience-First Customers| Persona: A parent of three who finds "bring your own cup" policies stressful on busy mornings
5. ID: competitor_1   | Group: Competing Coffee Brands    | Persona: A marketing director at a rival chain calculating whether this is a PR win for competitors or a market share opportunity
6. ID: competitor_2   | Group: Competing Coffee Brands    | Persona: A franchise owner at a competing brand watching whether customers migrate
7. ID: disengaged_1   | Group: Indifferent Non-Customers  | Persona: A tea drinker who doesn't visit coffee chains and has no stake in the decision
8. ID: disengaged_2   | Group: Indifferent Non-Customers  | Persona: A news-fatigued person who scrolls past corporate sustainability announcements without engaging
9. ID: watchdog_1     | Group: Environmental Watchdogs   | Persona: An NGO researcher who tracks whether corporate sustainability pledges produce real impact
10. ID: watchdog_2    | Group: Environmental Watchdogs   | Persona: A journalist covering greenwashing who will scrutinize the policy's actual emissions savings
```

**Output (T1):**
```json
{
  "stage": "T1",
  "results": [
    {
      "agent_id": "eco_loyal_1",
      "stance": "Strongly Support",
      "score": 2,
      "incentive_active": "I",
      "reasoning": "This is exactly what she's been asking for — it validates her identity as someone who pushes brands toward accountability. She'll post about it immediately."
    },
    {
      "agent_id": "eco_loyal_2",
      "stance": "Support",
      "score": 1,
      "incentive_active": "N",
      "reasoning": "Supports the direction but reserves full endorsement until she sees whether the policy has teeth — she's seen too many corporate pledges evaporate."
    },
    {
      "agent_id": "conv_customer_1",
      "stance": "Oppose",
      "score": -1,
      "incentive_active": "M",
      "reasoning": "This adds friction to a routine that runs on speed — he'll lose time fumbling with cups and may start going to competitors that still offer disposables."
    },
    {
      "agent_id": "conv_customer_2",
      "stance": "Strongly Oppose",
      "score": -2,
      "incentive_active": "M",
      "reasoning": "Her morning coffee run is already chaotic with three kids — a 'bring your own cup' mandate feels like the brand punishing customers for corporate virtue-signaling."
    },
    {
      "agent_id": "competitor_1",
      "stance": "Neutral",
      "score": 0,
      "incentive_active": "P",
      "reasoning": "She's not reacting yet — she's running numbers to decide whether to match the policy (reputational benefit) or hold off and capture the disgruntled customers."
    },
    {
      "agent_id": "competitor_2",
      "stance": "Support",
      "score": 1,
      "incentive_active": "M",
      "reasoning": "He's hoping the inconvenienced regulars walk into his stores — he'll quietly benefit from any customer churn this creates."
    },
    {
      "agent_id": "disengaged_1",
      "stance": "Neutral",
      "score": 0,
      "incentive_active": null,
      "reasoning": "Completely uninvested — doesn't drink coffee and has no emotional or material stake in how a coffee chain manages its cups."
    },
    {
      "agent_id": "disengaged_2",
      "stance": "Neutral",
      "score": 0,
      "incentive_active": null,
      "reasoning": "Scrolled past the announcement without reading it — corporate sustainability news is background noise to her."
    },
    {
      "agent_id": "watchdog_1",
      "stance": "Contested",
      "score": 0,
      "incentive_active": "N",
      "reasoning": "Positive step in principle, but he's already pulling lifecycle data on the reusable cup program — if the manufacturing footprint exceeds the single-use savings, this is optics not impact."
    },
    {
      "agent_id": "watchdog_2",
      "stance": "Contested",
      "score": 0,
      "incentive_active": "N",
      "reasoning": "Her first instinct is to file a FOIA on their emissions data — she's seen too many 'green' announcements that collapse under scrutiny, and this has the hallmarks of a PR play."
    }
  ]
}
```

---

### Data Model

```typescript
type IncentiveType = "M" | "P" | "I" | "S" | "N";
type StanceLabel = "Strongly Support" | "Support" | "Neutral" | "Oppose" | "Strongly Oppose" | "Contested";
type Stage = "T1" | "T2" | "T3" | "T4" | "T5";

interface Agent {
  id: string;
  persona: string;        // single sentence
}

interface Group {
  group_id: string;
  name: string;
  description: string;
  stance_posture: string;
  primary_incentive: IncentiveType;
}

interface StanceResult {
  agent_id: string;
  assigned_group_id: string;
  stance: StanceLabel;
  score: -2 | -1 | 0 | 1 | 2;
  incentive_active: IncentiveType | null;
  reasoning: string;
}

interface StageEndState {
  social_response_summary: string;
  new_event_state: string;
}

interface StageOutput {
  stage: Stage;
  groups: Group[];
  results: StanceResult[];
  end_state: StageEndState;
}

interface SimulationRun {
  initial_event: string;
  agents: Agent[];
  timeline: Record<Stage, StageOutput>;
}
```

---

## Part 2: Visualization

---

### Viz 1 — Stance Matrix (Primary View)

All active agents, grouped, with stance at selected stage. Stage toggle updates stances in place.

```
EVENT: "A major coffee chain bans single-use plastic cups"    [T1] [T3] [T5]

GROUP: Eco-Conscious Loyalists
  eco_loyal_1   A reusable-cup-carrying regular...     🟢🟢 Strongly Support
  eco_loyal_2   A climate activist who uses brand...   🟢  Support

GROUP: Convenience-First Customers
  conv_customer_1   A daily commuter who grabs...      🔴  Oppose
  conv_customer_2   A parent of three who finds...     🔴🔴 Strongly Oppose

GROUP: Environmental Watchdogs
  watchdog_1   An NGO researcher who tracks...         🟡  Contested
  watchdog_2   A journalist covering greenwashing...   🟡  Contested
```

**Implementation:** React table. Groups as collapsible sections. Hover on stance row → reasoning tooltip. Stage selector (T1 / T3 / T5) triggers re-render from cached results.

---

### Viz 2 — Timeline Drift (per agent or aggregate)

How stances shift T1 → T3 → T5. Shows which agents moved and why.

**Single agent:** Line from T1 to T5, score on Y-axis (`-2` to `+2`).

**Aggregate:** Stacked area or grouped bar showing distribution at each stage.

```
     T1    T3    T5
+2   ██    ██    █
+1   ██    ███   ███
 0   ██    ███   █████
-1   ███   ███   ██
-2   ███   ██    █
```

**Implementation:** Recharts `AreaChart` for aggregate. `LineChart` for single agent. X-axis: T1 / T3 / T5. Y-axis: score. Color per stance level.

---

### Viz 3 — Coalition Map (Group-Based Layout)

Layout is grouped by the dynamic groups formed at that specific timeline stage. Agents are clustered within their correctly assigned group.

**Interaction:**
- Scroll within a group container to see its agent nodes.
- **Node properties:** Represent the agent's stance (color) and intensity (size).
- **Click on an agent node:** Opens a detailed stats panel showing:
  - **Persona:** Their background and traits.
  - **Incentive:** The primary incentive driving them (M/P/I/S/N).
  - **Reasoning:** Why they took this stance and joined this group.

**Implementation:** A React layout with grouped columns or flex grids representing each group. Each group is a visual container (e.g., a card with a scrollable list of agent nodes). Click a node to set `selectedAgent` in state and render the stats panel.

---

### Viz 4 — Incentive Breakdown

For a given event and stage, what incentive type is driving the most stances?

```
Material (M)    ██████████░   42%
Identity (I)    ██████░░░░░   25%
Normative (N)   █████░░░░░░   20%
Power (P)       ██░░░░░░░░░    8%
Survival (S)    █░░░░░░░░░░    5%
```

Filter to "support side" vs "oppose side" to see if the two coalitions are driven by different incentive types.

**Implementation:** Recharts horizontal `BarChart`. Two toggle buttons: All / Support / Oppose.

---

### Recommended Stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript |
| Charts | Recharts |
| Coalition graph | D3.js or `react-force-graph` |
| LLM backend | Node.js or Python + Anthropic / OpenAI API |
| State | Zustand |
| Storage | JSON (dev) → Postgres (prod) |

---

### MVP Flow

```
1. Text input → user types initial event
2. For each stage (T1 to T5):
   a. POST /simulate/groups     → LLM generates groups for current event state
   b. POST /simulate/stances    → LLM assigns all agents to groups & calculates stances
   c. POST /simulate/end_state  → LLM generates social response summary & new event state
3. Render group-based coalition map, stance matrix, and timeline drift
```

**Call count for a full run:** 3 LLM calls per stage × 5 stages = **15 total LLM calls** per full simulation run.
