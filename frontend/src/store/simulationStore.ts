import { create } from "zustand";
import type {
  SimulationRun,
  Stage,
  Group,
  StanceResult,
  StageEndState,
  SimulationRunSummary,
} from "@socioatlas/shared";
import { getSimulation, listSimulations, streamSimulation } from "../api/client";

// Partial progress within a single stage (updates as each LLM call completes)
export interface StageProgress {
  status: "starting" | "transition" | "groups_done" | "stances_done" | "done";
  transitionStep?: "groups" | "stances" | "end_state";
  transitionMessage?: string;
  current_event?: string;
  groups?: Group[];
  results?: StanceResult[];
  end_state?: StageEndState;
}

interface SimulationState {
  run: SimulationRun | null;
  stageProgress: Partial<Record<Stage, StageProgress>>;
  activeStage: Stage;
  selectedAgentId: string | null;
  history: SimulationRunSummary[];
  historyLoading: boolean;
  historyError: string | null;
  historyRefreshToken: number;
  isLoading: boolean;
  error: string | null;

  submitEvent: (event: string, sampleSize?: number) => Promise<void>;
  loadHistory: () => Promise<void>;
  loadRun: (runId: string) => Promise<void>;
  setStage: (stage: Stage) => void;
  selectAgent: (agentId: string | null) => void;
  reset: () => void;
}

const STAGE_ORDER: Stage[] = ["T1", "T2", "T3", "T4", "T5"];

function buildStageProgressFromRun(run: SimulationRun): Partial<Record<Stage, StageProgress>> {
  const progress: Partial<Record<Stage, StageProgress>> = {};
  for (const stage of STAGE_ORDER) {
    const output = run.timeline[stage];
    if (!output) continue;
    progress[stage] = {
      status: "done",
      transitionStep: "end_state",
      transitionMessage: "Loaded from history",
      groups: output.groups,
      results: output.results,
      end_state: output.end_state,
    };
  }
  return progress;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  run: null,
  stageProgress: {},
  activeStage: "T1",
  selectedAgentId: null,
  history: [],
  historyLoading: false,
  historyError: null,
  historyRefreshToken: 0,
  isLoading: false,
  error: null,

  submitEvent: async (event: string, sampleSize?: number) => {
    set({ isLoading: true, error: null, selectedAgentId: null, run: null, stageProgress: {} });
    try {
      for await (const chunk of streamSimulation(event, sampleSize)) {
        const { type, stage } = chunk;

        if (type === "init") {
          set({ run: chunk.run, activeStage: "T1", isLoading: true });

        } else if (type === "stage_start") {
          set((state) => ({
            stageProgress: {
              ...state.stageProgress,
              [stage]: {
                status: "starting",
                transitionStep: "groups",
                transitionMessage: "Starting stage",
                current_event: chunk.current_event,
              },
            },
            activeStage: stage as Stage,
          }));

        } else if (type === "transition") {
          set((state) => ({
            stageProgress: {
              ...state.stageProgress,
              [stage]: {
                ...state.stageProgress[stage as Stage],
                status: "transition",
                transitionStep: chunk.step,
                transitionMessage: chunk.message,
              },
            },
          }));

        } else if (type === "groups") {
          set((state) => ({
            stageProgress: {
              ...state.stageProgress,
              [stage]: {
                ...state.stageProgress[stage as Stage],
                status: "groups_done",
                transitionStep: "stances",
                transitionMessage: "Groups ready",
                groups: chunk.groups,
              },
            },
          }));

        } else if (type === "stances") {
          set((state) => ({
            stageProgress: {
              ...state.stageProgress,
              [stage]: {
                ...state.stageProgress[stage as Stage],
                status: "stances_done",
                transitionStep: "end_state",
                transitionMessage: "Stances ready",
                results: chunk.results,
              },
            },
          }));

        } else if (type === "stage_done") {
          // Full stage complete — update both the run timeline and progress
          set((state) => {
            if (!state.run) return state;
            return {
              run: {
                ...state.run,
                timeline: {
                  ...state.run.timeline,
                  [stage]: chunk,
                },
              },
              stageProgress: {
                ...state.stageProgress,
                [stage]: {
                  ...state.stageProgress[stage as Stage],
                  status: "done",
                  transitionMessage: "Stage complete",
                  end_state: chunk.end_state,
                },
              },
            };
          });

        } else if (type === "done") {
          set((state) => ({ isLoading: false, historyRefreshToken: state.historyRefreshToken + 1 }));

        } else if (type === "error") {
          set({ isLoading: false, error: chunk.detail || "Simulation error" });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Simulation failed";
      set({ isLoading: false, error: message });
    }
  },

  loadHistory: async () => {
    set({ historyLoading: true, historyError: null });
    try {
      const runs = await listSimulations(30);
      set({ history: runs, historyLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load history";
      set({ historyLoading: false, historyError: message });
    }
  },

  loadRun: async (runId: string) => {
    set({ isLoading: true, error: null });
    try {
      const run = await getSimulation(runId);
      const loadedProgress = buildStageProgressFromRun(run);
      const completedStages = STAGE_ORDER.filter((stage) => Boolean(run.timeline[stage]));
      const activeStage = completedStages.length
        ? completedStages[completedStages.length - 1]
        : "T1";

      set({
        run,
        stageProgress: loadedProgress,
        activeStage,
        selectedAgentId: null,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load simulation";
      set({ isLoading: false, error: message });
    }
  },

  setStage: (stage) => set({ activeStage: stage }),
  selectAgent: (agentId) => set({ selectedAgentId: agentId }),

  reset: () =>
    set({
      run: null,
      stageProgress: {},
      activeStage: "T1",
      selectedAgentId: null,
      error: null,
    }),
}));
