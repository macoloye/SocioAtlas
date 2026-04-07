# AGENTS.md

## Purpose

This repository is a local-first simulation app for exploring how personas, groups, and coalitions react to an event over stages `T1` through `T5`.

The codebase is split across:

- `backend/`: FastAPI API, simulation pipeline, graph persistence, and tests
- `frontend/`: Vite + React UI for simulation, history, graph chat, and visualization
- `shared/`: TypeScript contracts consumed by the frontend and mirrored by Python models in `backend/types.py`
- `docs/`: product and modeling notes for incentives, timeline, groups, and simulation behavior

## Working Rules

- Keep changes small and local. Do not refactor across backend, frontend, and shared contracts unless the task requires it.
- Preserve the contract parity between [`shared/types.ts`](/Users/macoloye/Documents/own_code/socioatlas/shared/types.ts) and [`backend/types.py`](/Users/macoloye/Documents/own_code/socioatlas/backend/types.py). If one changes, verify whether the other must change too.
- Treat the simulation stream as an API contract. The frontend store expects event types like `init`, `stage_start`, `transition`, `groups`, `stances`, `awaiting_end_state_choice`, `end_state_selected`, `stage_done`, `done`, and `error`.
- Do not commit or overwrite local data artifacts unless explicitly asked. Important generated files at repo root include `graph_kuzu.db`, `graph_kuzu.db.wal`, `simulation_history.db`, and `simulation.log`.
- Avoid changing `.env`, persona data, or database contents as part of routine code edits.
- The repository may be dirty. Do not revert unrelated changes, especially in files you did not touch.

## Environment

- Python: `3.11+`
- Node.js: `18+`
- Backend env file: repo root `.env`
- Backend default port: `3001`
- Frontend dev server: `5173`

Important environment variables from [`.env.example`](/Users/macoloye/Documents/own_code/socioatlas/.env.example):

- `OPENAI_API_KEY`
- `MODEL_NAME`
- `BASE_URL_NAME`
- `PORT`
- `SAMPLE_SIZE`
- `AGENT_BATCH_LIMIT`
- `MAX_CONCURRENT_REQUEST`
- `PERSONA_JSON_PATH` (optional)

## Install

From repo root:

```bash
npm install
cd backend && pip install -r requirements.txt
```

## Run

From repo root:

```bash
npm run dev:frontend
npm run dev:backend
```

Equivalent direct commands:

```bash
cd frontend && npm run dev
cd backend && python -m backend.server
```

Notes:

- Frontend `vite` proxies `/api` to `http://localhost:3001`.
- The backend loads environment variables from the repo root `.env`.

## Test And Verify

Backend tests currently live under `backend/tests/` and use `unittest`.

Run:

```bash
cd backend && python -m unittest discover -s tests
```

Frontend has a build step but no dedicated test suite configured in `package.json`.

Verify frontend changes with:

```bash
cd frontend && npm run build
```

For changes that affect request/response shapes or stage data flow, run both backend tests and the frontend build.

## Code Map

### Backend

- [`backend/server.py`](/Users/macoloye/Documents/own_code/socioatlas/backend/server.py): FastAPI app, CORS, router registration, DB initialization
- [`backend/routes/simulate.py`](/Users/macoloye/Documents/own_code/socioatlas/backend/routes/simulate.py): SSE simulation endpoint, history endpoints, end-state selection
- [`backend/routes/graph.py`](/Users/macoloye/Documents/own_code/socioatlas/backend/routes/graph.py): graph snapshot and retrieval API
- [`backend/routes/chat.py`](/Users/macoloye/Documents/own_code/socioatlas/backend/routes/chat.py): graph-backed chat endpoint
- `backend/modules/`: simulation pipeline pieces such as timeline propagation, grouping, stance generation, coalition detection, end-state generation, and graph formalization
- `backend/utils/llm_client.py`: LLM access
- [`backend/utils/simulation_db.py`](/Users/macoloye/Documents/own_code/socioatlas/backend/utils/simulation_db.py): SQLite run history persistence
- [`backend/utils/graph_db.py`](/Users/macoloye/Documents/own_code/socioatlas/backend/utils/graph_db.py): Kuzu graph persistence and retrieval

### Frontend

- [`frontend/src/App.tsx`](/Users/macoloye/Documents/own_code/socioatlas/frontend/src/App.tsx): top-level app shell
- [`frontend/src/store/simulationStore.ts`](/Users/macoloye/Documents/own_code/socioatlas/frontend/src/store/simulationStore.ts): main client-side state machine for streamed simulation updates
- [`frontend/src/api/client.ts`](/Users/macoloye/Documents/own_code/socioatlas/frontend/src/api/client.ts): REST and SSE client
- `frontend/src/components/`: stage stream, graph chat, coalition map, incentive breakdown, stance matrix, timeline drift, and event input

### Shared Types

- [`shared/types.ts`](/Users/macoloye/Documents/own_code/socioatlas/shared/types.ts): frontend contract source of truth for TS consumers
- [`backend/types.py`](/Users/macoloye/Documents/own_code/socioatlas/backend/types.py): Python Pydantic mirror

## Change Guidance

### If you touch shared contracts

- Update both TypeScript and Python definitions.
- Check the affected backend route payloads.
- Check frontend parsing and store updates.
- Re-run backend tests and frontend build.

### If you touch simulation stages

- Preserve stage order semantics `T1` to `T5`.
- Verify emitted SSE chunks still match what the frontend store expects.
- Be careful with partial progress updates; the UI renders intermediate `groups`, `stances`, and end-state selection states.

### If you touch graph persistence or retrieval

- Preserve graph node and edge shape expected by the retrieval and chat endpoints.
- Avoid schema-breaking Kuzu changes unless the task explicitly includes migration work.
- Keep writes resilient; simulation streaming should not fail solely because graph persistence fails.

### If you touch persona sampling or LLM prompts

- Keep outputs structurally compatible with validators and downstream formatting.
- Do not hardcode absolute local paths unless the task explicitly requires a machine-specific override.

## Known Project Constraints

- There is no formal migration system for the SQLite or Kuzu files in this repo.
- Generated `frontend/dist/` output exists in the repository; avoid editing built assets directly.
- Root `package.json` only defines dev/build scripts for the frontend and backend startup. Backend dependency management is still `pip` + `requirements.txt`.

## Preferred Workflow For Agents

1. Read the relevant route, store, and shared contract files before editing.
2. Make the smallest change that preserves existing contracts.
3. Run targeted verification:
   - backend-only change: backend tests
   - frontend-only change: frontend build
   - contract or API-flow change: both
4. Summarize any assumptions, especially around env vars, local DB state, or LLM-dependent behavior.
