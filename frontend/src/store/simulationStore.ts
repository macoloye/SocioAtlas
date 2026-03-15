import { create } from "zustand";
import type {
  SimulationRun,
  Stage,
  Group,
  StanceResult,
  StageEndState,
  EventStateOption,
  SimulationRunSummary,
  GraphEvidence,
} from "@socioatlas/shared";
import {
  chatWithGraph,
  getSimulation,
  listSimulations,
  streamSimulation,
  submitEndStateSelection,
} from "../api/client";

// Partial progress within a single stage (updates as each LLM call completes)
export interface StageProgress {
  status:
    | "starting"
    | "transition"
    | "groups_done"
    | "stances_done"
    | "awaiting_choice"
    | "done";
  transitionStep?: "groups" | "stances" | "end_state";
  transitionMessage?: string;
  current_event?: string;
  groups?: Group[];
  results?: StanceResult[];
  end_state?: StageEndState;
  end_state_options?: EventStateOption[];
  timeout_seconds?: number;
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
  chatLoading: boolean;
  chatError: string | null;
  chatAnswer: string;
  chatEvidence: GraphEvidence[];
  selectingEndStateStage: Stage | null;

  submitEvent: (event: string, sampleSize?: number) => Promise<void>;
  selectEndState: (
    stage: Stage,
    chosenEventState: string,
    selectedOptionId?: string,
    selectionSource?: "user_option" | "user_custom",
  ) => Promise<void>;
  loadHistory: () => Promise<void>;
  loadRun: (runId: string) => Promise<void>;
  askGraphQuestion: (query: string, topK?: number) => Promise<void>;
  clearChat: () => void;
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
      end_state_options: output.end_state.event_state_options,
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
  chatLoading: false,
  chatError: null,
  chatAnswer: "",
  chatEvidence: [],
  selectingEndStateStage: null,

  submitEvent: async (event: string, sampleSize?: number) => {
    set({
      isLoading: true,
      error: null,
      selectedAgentId: null,
      run: null,
      stageProgress: {},
      selectingEndStateStage: null,
    });

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
        } else if (type === "awaiting_end_state_choice") {
          set((state) => ({
            stageProgress: {
              ...state.stageProgress,
              [stage]: {
                ...state.stageProgress[stage as Stage],
                status: "awaiting_choice",
                transitionStep: "end_state",
                transitionMessage: "Select next event state",
                end_state: chunk.end_state,
                end_state_options: chunk.end_state?.event_state_options ?? [],
                timeout_seconds: chunk.timeout_seconds ?? 6,
              },
            },
            activeStage: stage as Stage,
          }));
        } else if (type === "end_state_selected") {
          set((state) => {
            const prev = state.stageProgress[stage as Stage];
            if (!prev?.end_state) {
              return { selectingEndStateStage: null };
            }
            return {
              selectingEndStateStage: null,
              stageProgress: {
                ...state.stageProgress,
                [stage]: {
                  ...prev,
                  status: "transition",
                  transitionStep: "end_state",
                  transitionMessage:
                    chunk.selection_source === "default_timeout"
                      ? "Default selected"
                      : "Selection applied",
                  end_state: {
                    ...prev.end_state,
                    new_event_state: chunk.new_event_state,
                    selected_option_id: chunk.selected_option_id,
                    selection_source: chunk.selection_source,
                  },
                },
              },
            };
          });
        } else if (type === "stage_done") {
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
                  end_state_options: chunk.end_state?.event_state_options ?? [],
                },
              },
            };
          });
        } else if (type === "done") {
          set((state) => ({
            isLoading: false,
            selectingEndStateStage: null,
            historyRefreshToken: state.historyRefreshToken + 1,
          }));
        } else if (type === "error") {
          set({
            isLoading: false,
            selectingEndStateStage: null,
            error: chunk.detail || "Simulation error",
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Simulation failed";
      set({ isLoading: false, selectingEndStateStage: null, error: message });
    }
  },

  selectEndState: async (
    stage: Stage,
    chosenEventState: string,
    selectedOptionId?: string,
    selectionSource: "user_option" | "user_custom" = "user_option",
  ) => {
    const { run, selectingEndStateStage } = useSimulationStore.getState();
    if (!run) return;
    if (selectingEndStateStage === stage) return;

    const chosen = chosenEventState.trim();
    if (!chosen) return;

    set({ selectingEndStateStage: stage });
    try {
      await submitEndStateSelection(run.run_id, {
        stage,
        chosen_event_state: chosen,
        selected_option_id: selectedOptionId,
        selection_source: selectionSource,
      });
    } catch {
      set((state) => ({
        selectingEndStateStage: null,
        stageProgress: {
          ...state.stageProgress,
          [stage]: {
            ...state.stageProgress[stage],
            transitionMessage: "Selection failed, waiting for default",
          },
        },
      }));
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
        chatLoading: false,
        chatError: null,
        chatAnswer: "",
        chatEvidence: [],
        selectingEndStateStage: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load simulation";
      set({ isLoading: false, error: message });
    }
  },

  askGraphQuestion: async (query: string, topK?: number) => {
    const trimmed = query.trim();
    if (!trimmed) {
      set({ chatError: "Query is required." });
      return;
    }
    const runId = useSimulationStore.getState().run?.run_id;
    if (!runId) {
      set({ chatError: "Load or run a simulation first." });
      return;
    }

    set({ chatLoading: true, chatError: null });
    try {
      const response = await chatWithGraph(runId, { query: trimmed, top_k: topK });
      set({
        chatLoading: false,
        chatError: null,
        chatAnswer: response.answer,
        chatEvidence: response.evidence,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat failed";
      set({ chatLoading: false, chatError: message });
    }
  },

  clearChat: () => set({ chatAnswer: "", chatEvidence: [], chatError: null }),

  setStage: (stage) => set({ activeStage: stage }),
  selectAgent: (agentId) => set({ selectedAgentId: agentId }),

  reset: () =>
    set({
      run: null,
      stageProgress: {},
      activeStage: "T1",
      selectedAgentId: null,
      error: null,
      chatLoading: false,
      chatError: null,
      chatAnswer: "",
      chatEvidence: [],
      selectingEndStateStage: null,
    }),
}));