import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Stage } from "@socioatlas/shared";
import { EventInput } from "./components/EventInput/EventInput";
import { StanceMatrix } from "./components/StanceMatrix/StanceMatrix";
import { TimelineDrift } from "./components/TimelineDrift/TimelineDrift";
import { CoalitionMap } from "./components/CoalitionMap/CoalitionMap";
import { IncentiveBreakdown } from "./components/IncentiveBreakdown/IncentiveBreakdown";
import { GraphChat } from "./components/GraphChat/GraphChat";
import { InsightTray } from "./components/InsightTray/InsightTray";
import { EndStatePicker } from "./components/StageStream/StageStream";
import { useSimulationStore } from "./store/simulationStore";

type RightPanelTab = "matrix" | "drift" | "incentive" | "chat" | "insights";

const STAGE_LIST: Stage[] = ["T1", "T2", "T3", "T4", "T5"];

const RIGHT_TABS: { id: RightPanelTab; label: string }[] = [
  { id: "matrix", label: "Matrix" },
  { id: "drift", label: "Drift" },
  { id: "incentive", label: "Incentives" },
  { id: "chat", label: "Ask Graph" },
  { id: "insights", label: "Notes" },
];

export default function App() {
  const {
    run,
    stageProgress,
    isLoading,
    error,
    reset,
    history,
    historyLoading,
    historyError,
    historyRefreshToken,
    loadHistory,
    loadRun,
    activeStage,
    setStage,
  } = useSimulationStore();

  const [activeRightTab, setActiveRightTab] = useState<RightPanelTab>("matrix");
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string>("");

  const completedStages = run ? Object.keys(run.timeline).length : 0;
  const statusLabel = isLoading ? "Processing" : run ? "Ready" : "Idle";
  const activeStageOutput = run?.timeline[activeStage];
  const activeStageProgress = stageProgress[activeStage];
  const activeStageGroups = activeStageOutput?.groups ?? activeStageProgress?.groups ?? [];
  const activeStageResults = activeStageOutput?.results ?? activeStageProgress?.results ?? [];
  const supportCount = activeStageResults.filter((result) => result.score > 0).length;
  const opposeCount = activeStageResults.filter((result) => result.score < 0).length;
  const neutralCount = Math.max(0, activeStageResults.length - supportCount - opposeCount);

  const activeStageStatusLabel = (() => {
    if (activeStageOutput) return "Completed";
    if (!activeStageProgress) return "Not started";
    if (activeStageProgress.status === "awaiting_choice") return "Awaiting choice";
    if (activeStageProgress.transitionStep === "groups") return "Generating groups";
    if (activeStageProgress.transitionStep === "stances") return "Running stances";
    if (activeStageProgress.transitionStep === "end_state") return "Writing stage outcome";
    return "Processing";
  })();

  const activeStageSummary =
    activeStageOutput?.end_state?.social_response_summary ??
    activeStageProgress?.transitionMessage ??
    "Select a stage to inspect how coalitions and stances evolve.";

  const activeStreamingStep = activeStageOutput
    ? "end_state"
    : activeStageProgress?.transitionStep;

  const stageStreamingSteps: Array<{
    key: "groups" | "stances" | "end_state";
    label: string;
    state: "done" | "active" | "pending";
  }> = [
    {
      key: "groups",
      label: "Groups",
      state:
        activeStageOutput ||
        activeStageProgress?.status === "groups_done" ||
        activeStageProgress?.status === "stances_done" ||
        activeStageProgress?.status === "awaiting_choice" ||
        activeStageProgress?.status === "done"
          ? "done"
          : activeStreamingStep === "groups"
            ? "active"
            : "pending",
    },
    {
      key: "stances",
      label: "Stances",
      state:
        activeStageOutput ||
        activeStageProgress?.status === "stances_done" ||
        activeStageProgress?.status === "awaiting_choice" ||
        activeStageProgress?.status === "done"
          ? "done"
          : activeStreamingStep === "stances"
            ? "active"
            : "pending",
    },
    {
      key: "end_state",
      label: "End State",
      state:
        activeStageOutput
          ? "done"
          : activeStreamingStep === "end_state"
            ? "active"
            : "pending",
    },
  ];

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (historyRefreshToken > 0) loadHistory();
  }, [historyRefreshToken, loadHistory]);

  const renderInspectorContent = () => {
    if (activeRightTab === "matrix") return <StanceMatrix />;
    if (activeRightTab === "drift") return <TimelineDrift />;
    if (activeRightTab === "incentive") return <IncentiveBreakdown />;
    if (activeRightTab === "chat") return <GraphChat />;
    return <InsightTray />;
  };

  const getStageState = (stage: Stage) => {
    const isComplete = !!run?.timeline[stage];
    const hasProgress = !!stageProgress[stage];
    const isCurrent = activeStage === stage;
    const isAvailable = isComplete || hasProgress || isCurrent;

    if (isCurrent && isLoading) return { label: "Live", isAvailable };
    if (isComplete) return { label: "Done", isAvailable };
    if (hasProgress) return { label: "Live", isAvailable };
    return { label: "Locked", isAvailable };
  };

  return (
    <div className="app neo-shell">
      <header className="atlas-topbar">
        <div className="atlas-brand">
          <div className="atlas-brand-mark">S</div>
          <div className="atlas-brand-copy">
            <h1>SocioAtlas</h1>
            <p>Graph-native coalition intelligence</p>
          </div>
        </div>

        <div className="atlas-status">
          <span className="atlas-status-step">{run ? `${activeStage} selected` : "Awaiting run"}</span>
          <span className={`atlas-status-dot ${isLoading ? "live" : ""}`} />
          <span>{statusLabel}</span>
        </div>
      </header>

      <section className="atlas-command-bar panel-glass">
        <div className="atlas-command-head">
          <div>
            <span className="panel-kicker">Launch Simulation</span>
            <h2>Scenario Input</h2>
          </div>
          <div className="neo-history inline">
            <label htmlFor="history-select">Load run</label>
            <div className="neo-history-row">
              <select
                id="history-select"
                className="history-select"
                value={selectedHistoryRunId}
                onChange={(e) => setSelectedHistoryRunId(e.target.value)}
                disabled={historyLoading || history.length === 0}
              >
                <option value="">
                  {historyLoading
                    ? "Loading..."
                    : history.length
                      ? "Select a simulation"
                      : "No saved runs"}
                </option>
                {history.map((item) => (
                  <option key={item.run_id} value={item.run_id} title={item.initial_event}>
                    {new Date(item.created_at).toLocaleString()} · {item.initial_event.slice(0, 24)}
                  </option>
                ))}
              </select>
              <button
                className="history-load-btn"
                disabled={!selectedHistoryRunId}
                onClick={() => void loadRun(selectedHistoryRunId)}
              >
                Load
              </button>
            </div>
            {historyError && <p className="history-error">{historyError}</p>}
          </div>
        </div>
        <EventInput />
      </section>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="neo-loading"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span>
              {run
                ? `Streaming graph state · ${completedStages}/5 stages complete`
                : "Initializing graph simulation..."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {error && !isLoading && (
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button className="reset-btn" onClick={reset}>Retry</button>
        </div>
      )}

      <AnimatePresence>
        {run && (
          <motion.main
            className="atlas-workspace"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <section className="panel-glass atlas-graph-pane">
              <div className="panel-head compact">
                <div>
                  <span className="panel-kicker">Graph Relationship Visualization</span>
                  <h2>Knowledge Graph</h2>
                </div>
              </div>
              <div className="atlas-graph-frame">
                <CoalitionMap />
              </div>
            </section>

            <aside className="atlas-sidebar">
              <section className="panel-glass atlas-sidebar-card">
                <div className="panel-head compact">
                  <div>
                    <span className="panel-kicker">Current Event</span>
                    <h2>Scenario Brief</h2>
                  </div>
                  <span className="status-pill">{activeStage}</span>
                </div>
                <div className="event-signal-box">
                  <p>{run.initial_event}</p>
                </div>
              </section>

              <section className="panel-glass atlas-sidebar-card">
                <div className="panel-head compact">
                  <div>
                    <span className="panel-kicker">Stage Selector</span>
                    <h2>Inspect Stage</h2>
                  </div>
                </div>
                <div className="atlas-stage-selector">
                  {STAGE_LIST.map((stage) => {
                    const state = getStageState(stage);
                    return (
                      <button
                        key={stage}
                        type="button"
                        className={`atlas-stage-btn ${activeStage === stage ? "active" : ""}`}
                        onClick={() => state.isAvailable && setStage(stage)}
                        disabled={!state.isAvailable}
                      >
                        <strong>{stage}</strong>
                        <span>{state.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="atlas-stage-current">
                  <div className="atlas-stage-current-head">
                    <div>
                      <span className="atlas-stage-current-label">Current stage</span>
                      <strong>{activeStage}</strong>
                    </div>
                    <span className="status-pill">{activeStageStatusLabel}</span>
                  </div>
                  <div className="atlas-stage-metrics">
                    <span>{activeStageGroups.length} groups</span>
                    <span>{activeStageResults.length} agents</span>
                    <span>
                      {supportCount}/{neutralCount}/{opposeCount} S/N/O
                    </span>
                  </div>
                  <div className="atlas-stage-stream">
                    <div className="atlas-stage-stream-rail">
                      {stageStreamingSteps.map((step) => (
                        <div key={step.key} className={`atlas-stage-stream-step ${step.state}`}>
                          <span className="atlas-stage-stream-dot" />
                          <span>{step.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="atlas-stage-stream-message">{activeStageSummary}</p>
                  </div>
                  {activeStageProgress?.status === "awaiting_choice" && (
                    <div className="atlas-stage-decision">
                      <EndStatePicker stage={activeStage} progress={activeStageProgress} />
                    </div>
                  )}
                </div>
              </section>

              <section className="panel-glass atlas-sidebar-card atlas-inspector-card">
                <div className="panel-head compact">
                  <div>
                    <span className="panel-kicker">Inspector</span>
                    <h2>Analysis Panel</h2>
                  </div>
                </div>

                <div className="neo-tabs atlas-inspector-tabs">
                  {RIGHT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      className={`tab-btn ${activeRightTab === tab.id ? "active" : ""}`}
                      onClick={() => setActiveRightTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="neo-tab-content atlas-inspector-content">
                  {renderInspectorContent()}
                </div>
              </section>
            </aside>
          </motion.main>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!run && !isLoading && !error && (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p>Define an event to initialize the graph-driven dashboard.</p>
            <p className="empty-hint">
              The knowledge graph remains the primary surface; stage selection only changes which state you inspect.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
