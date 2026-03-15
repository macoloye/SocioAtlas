# 🧠 SocioAtlas

**Watch how society reacts to your idea in real time.** Simulate events, policies, and products across diverse communities. See which groups align, where conflicts emerge, and how coalitions shift—all powered by diverse AI personas with genuine motivations.

---

## 🎯 What is This?

SocioAtlas is an experimental platform for **simulating social dynamics** at scale. Instead of guessing how people will react to a news event, policy change, or product launch, you can:

1. **Describe the event** — Write any scenario (real or hypothetical)
2. **Watch it propagate** — See reactions unfold across 6 stages (T0→T5) as different groups respond
3. **Explore coalitions** — Discover who aligns with whom, and why
4. **Search by people** — Find how specific personas (nurses, entrepreneurs, activists, etc.) respond and form alliances

This isn't prediction—it's **exploratory social reasoning**. Perfect for researchers, product teams, policymakers, and anyone trying to understand complex social dynamics.

---

## 🎬 Event Propagation: T0 → T5

Watch your event ripple through society:

```
T0  Event Release        The news breaks. Raw information enters the world.
T1  Immediate Reaction   High-activation agents (influencers, activists, experts) publish first takes.
T2  Media Amplification  Journalists frame it. Influencers comment. Competing narratives form.
T3  Social Spread        Ordinary people react to narratives, not the original event.
T4  Lobbying             Organized interests pressure decision-makers behind the scenes.
T5  Stabilization        Stances solidify or soften. Final public distribution settles.
```

Each stage builds on the previous—outputs become inputs—creating a realistic narrative evolution.

---

## ✨ Core Features

### 🔍 Search by People
Find personas you care about and see exactly how they respond:
- **Search** across 200K+ diverse personas (engineers, teachers, activists, parents, etc.)
- **Filter by archetype** — Get personas matching specific characteristics
- **Track their journey** — Watch how individual personas move between groups across all 6 stages

### 📊 Interactive Simulation UI
- Enter any event in natural language
- Watch responses stream back in real time
- See narratives evolve and shift at each stage

### 👥 Agent-Centric Reasoning
- **Individual motivations matter** — Agents have genuine incentives (material, identity, power, survival, moral)
- **Group dynamics emerge** — No pre-defined groups; coalitions form dynamically based on shared stance
- **Transparent reasoning** — Every agent explains *why* they hold a position

### 🕸️ Coalition Map
- Interactive D3 visualization of alliances and conflicts
- See which groups align, who stands alone, and where tensions peak
- Export relationship graphs for further analysis

### 📈 Graph Snapshots API
- Persist simulation results as formal graph snapshots
- Query historical runs to see patterns
- Compare different scenarios side-by-side

See [`SIMULATION.md`](./SIMULATION.md) for technical deep dive.

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** (via `pyenv` or Conda recommended)
- **Node.js 18+** and npm
- **OpenAI API key** (or any compatible LLM endpoint)

### Setup

1. **Clone and navigate:**
   ```bash
   git clone https://github.com/macoloye/SocioAtlas.git
   cd SocioAtlas
   cp .env.example .env 
   ```

2. **Configure environment** — Create `.env` in the `backend` directory:
   ```bash
   OPENAI_API_KEY=your_api_key_here
   MODEL_NAME=gpt-4-mini            # or gpt-4, claude-3.5-sonnet, etc.
   BASE_URL_NAME=https://api.openai.com/v1  # optional, for non-default endpoints
   ```
   
   See `.env.example` for all available options.

3. **Install dependencies:**
   ```bash
   # Backend
   cd backend
   pip install -r requirements.txt
   
   # Frontend
   cd ../frontend
   npm install
   ```

4. **Run the app** — Open two terminals:

   **Terminal 1 (Backend API):**
   ```bash
   cd backend
   python -m backend.server
   ```

   **Terminal 2 (Frontend dev server):**
   ```bash
   cd frontend
   npm run dev
   ```

5. **Open in browser** — Navigate to `http://localhost:5173` (or the URL printed in your terminal)

---

## 📚 How It Works (The Philosophy)

### 1. **Personas are Real** 
We use 200K+ personas from [PersonaHub](https://huggingface.co/datasets/proj-persona/PersonaHub) with genuine backgrounds, values, and constraints—not random agents.

### 2. **Groups Form Around Behavior, Not Identity**
A nurse and a lawyer can align on the same stance. Groups aren't demographic buckets; they're **dynamic coalitions** based on how people respond to *this specific event*.

### 3. **Incentives Explain Everything**
Every stance has a root cause:
- **Material** — Jobs, money, survival needs
- **Identity** — Values, beliefs, community belonging  
- **Power** — Control, influence, authority
- **Survival** — Safety, security, health
- **Moral** — Justice, fairness, ethics

See [`INCENTIVES.md`](./INCENTIVES.md) for the full framework.

### 4. **Stances Evolve**
Agents don't lock into positions. They shift as new information spreads, coalitions realign, and pressure mounts. Stage T5 isn't "final"—it's where this round of the conversation settles.

### 5. **Relationships Emerge Naturally**
Alliances aren't pre-coded. Agents align when their incentives and stances converge *in context*. This makes surprising coalitions visible.

---

## 🛠️ Use Cases

- **Product launches** — How will different communities react to your new feature?
- **Policy analysis** — Who wins and loses from a regulation? Where are the unexpected alliances?
- **Media impact** — How do narratives spread and mutate as they reach different audiences?
- **Crisis communication** — Which groups will amplify your message? Who will push back?
- **Research & prototyping** — Test social hypotheses without waiting for real events

---

## 📖 Repository Guide

High-level documentation:

| File | Content |
|---|---|
| [`GROUPS.md`](./GROUPS.md) | Agent pool and example stance-based groups |
| [`INCENTIVES.md`](./INCENTIVES.md) | The 5 incentive types that explain every stance |
| [`TIMELINE.md`](./TIMELINE.md) | T0–T5 mechanics — who acts when and why |
| [`SIMULATION.md`](./SIMULATION.md) | Simulation pipeline and visualization details |

Key code areas:

- `backend/`: FastAPI app, simulation pipeline, LLM prompts, validators, and graph snapshot builder.
- `frontend/`: React UI, coalition map, stage stream, and API client.
- `shared/`: Shared TypeScript types used by the frontend and backend.

---

## Acknowledgements

- **Persona data:** [PersonaHub dataset](https://huggingface.co/datasets/proj-persona/PersonaHub)
- **Simulation inspiration:** [MiroFish](https://github.com/666ghj/MiroFish)

---

## Contributing

This is an experimental project. If you would like to extend it:

- Open an issue describing the change or idea.
- For code changes, prefer small, focused pull requests with:
  - A short description of the change and motivation.
  - Notes on any new configuration or environment variables.

Please avoid committing real or sensitive events/personas; keep examples anonymized and synthetic.
