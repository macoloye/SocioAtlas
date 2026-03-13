import { useEffect, useState } from "react";
import { EventInput } from "./components/EventInput/EventInput";
import { StanceMatrix } from "./components/StanceMatrix/StanceMatrix";
import { TimelineDrift } from "./components/TimelineDrift/TimelineDrift";
import { CoalitionMap } from "./components/CoalitionMap/CoalitionMap";
import { IncentiveBreakdown } from "./components/IncentiveBreakdown/IncentiveBreakdown";
import { StageStream } from "./components/StageStream/StageStream";
import { GraphChat } from "./components/GraphChat/GraphChat";
import { useSimulationStore } from "./store/simulationStore";
import { motion, AnimatePresence } from "framer-motion";

type RightPanelTab = "matrix" | "drift" | "incentive" | "chat";

const RIGHT_TABS: { id: RightPanelTab; label: string }[] = [
  { id: "matrix", label: "Stance Matrix" },
  { id: "drift", label: "Timeline Drift" },
  { id: "incentive", label: "Incentive Breakdown" },
  { id: "chat", label: "Graph Chat" },
];

export default function App() {
  const {
    run,
    isLoading,
    error,
    reset,
    history,
    historyLoading,
    historyError,
    historyRefreshToken,
    loadHistory,
    loadRun,
  } = useSimulationStore();
  // Default to matrix tab so user sees stance matrix by default on the right
  const [activeRightTab, setActiveRightTab] = useState<RightPanelTab>("matrix");
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string>("");

  const stageCount = run ? Object.keys(run.timeline).length : 0;
  const TOTAL_STAGES = 5;

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (historyRefreshToken > 0) {
      loadHistory();
    }
  }, [historyRefreshToken, loadHistory]);

  return (
    <div className="app dashboard-layout">
      {/* Header */}
      <header className="app-header">
        <div className="app-title-row">
          <div className="app-title-group">
            <h1 className="app-title">SocioAtlas</h1>
            {run && (
              <button className="reset-btn" onClick={reset}>
                New simulation
              </button>
            )}
          </div>
          <div className="history-controls">
            <label className="history-label" htmlFor="history-select">
              Previous simulations
            </label>
            <div className="history-row">
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
                    : "No saved runs yet"}
                </option>
                {history.map((item) => {
                  const truncatedEvent =
                    item.initial_event.length > 10
                      ? `${item.initial_event.slice(0, 10)}…`
                      : item.initial_event;
                  return (
                    <option key={item.run_id} value={item.run_id} title={item.initial_event}>
                      {new Date(item.created_at).toLocaleString()} - {truncatedEvent}
                    </option>
                  );
                })}
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
        <p className="app-subtitle">
          Enter any event and watch how real personas react across society over time.
        </p>
      </header>

      {/* Event input */}
      <div className="input-section">
        <EventInput />
      </div>

      {/* Streaming progress banner (compact — shows while loading but run exists) */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="loading-state"
            style={{ padding: "1rem 1.5rem", flexDirection: "row", gap: "0.75rem", justifyContent: "flex-start" }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            <p style={{ fontSize: "0.88rem" }}>
              {run
                ? `Streaming… ${stageCount} / ${TOTAL_STAGES} stages complete`
                : "Initializing simulation…"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && !isLoading && (
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button className="reset-btn" onClick={reset}>
            Try again
          </button>
        </div>
      )}

      {/* Results Dashboard — shown as soon as first stage arrives */}
      <AnimatePresence>
        {run && (
          <motion.div
            className="results-dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Event label */}
            <div className="event-label">
              <span className="event-label-prefix">Event:</span>
              <span className="event-label-text">{run.initial_event}</span>
            </div>

            {/* Top: Stage Stream */}
            <div className="dashboard-top">
                <StageStream />
            </div>

            {/* Bottom: Split View */}
            <div className="dashboard-grid">
              {/* Left: Coalition Map */}
              <div className="dashboard-left">
                <CoalitionMap />
              </div>

              {/* Right: Tabbed Details */}
              <div className="dashboard-right">
                <div className="dashboard-tabs">
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
                <div className="dashboard-content">
                  {activeRightTab === "matrix" && <StanceMatrix />}
                  {activeRightTab === "drift" && <TimelineDrift />}
                  {activeRightTab === "incentive" && <IncentiveBreakdown />}
                  {activeRightTab === "chat" && <GraphChat />}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      <AnimatePresence>
        {!run && !isLoading && !error && (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p>Type an event above to begin the simulation.</p>
            <p className="empty-hint">
              Personas are sampled from a pool of 78,000+ real character descriptions
              and scored by an LLM at each of the 5 timeline stages.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
