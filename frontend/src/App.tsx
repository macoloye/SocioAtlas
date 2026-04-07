import { useEffect, useState } from "react";
import { EventInput } from "./components/EventInput/EventInput";
import { StanceMatrix } from "./components/StanceMatrix/StanceMatrix";
import { TimelineDrift } from "./components/TimelineDrift/TimelineDrift";
import { CoalitionMap } from "./components/CoalitionMap/CoalitionMap";
import { IncentiveBreakdown } from "./components/IncentiveBreakdown/IncentiveBreakdown";
import { StageStream } from "./components/StageStream/StageStream";
import { GraphChat } from "./components/GraphChat/GraphChat";
import { InsightTray } from "./components/InsightTray/InsightTray";
import { useSimulationStore } from "./store/simulationStore";
import { motion, AnimatePresence } from "framer-motion";

type RightPanelTab = "matrix" | "drift" | "incentive" | "chat";

const RIGHT_TABS: { id: RightPanelTab; label: string }[] = [
  { id: "matrix", label: "Matrix" },
  { id: "drift", label: "Drift" },
  { id: "incentive", label: "Incentives" },
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
    activeStage,
  } = useSimulationStore();

  const [activeRightTab, setActiveRightTab] = useState<RightPanelTab>("chat");
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string>("");

  const completedStages = run ? Object.keys(run.timeline).length : 0;

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (historyRefreshToken > 0) loadHistory();
  }, [historyRefreshToken, loadHistory]);

  return (
    <div className="app neo-shell">
      <header className="neo-header">
        <div className="neo-brand">
          <h1>SocioAtlas // Graph Ops</h1>
          <p>Minimal signal interface for coalition intelligence.</p>
        </div>

        <div className="neo-history">
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
      </header>

      <section className="neo-command-bar">
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
            className="neo-dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="neo-topline">
              <div>
                <span className="neo-kicker">Current Event</span>
                <p>{run.initial_event}</p>
              </div>
              <div className="neo-metrics">
                <div><span>Active Stage</span><strong>{activeStage}</strong></div>
                <div><span>Stages done</span><strong>{completedStages}/5</strong></div>
                <div><span>Agents</span><strong>{run.agents.length}</strong></div>
              </div>
            </div>

            <section className="neo-graph-grid">
              <div className="neo-graph-main panel-glass">
                <div className="panel-head">
                  <h2>Knowledge Graph</h2>
                  <span>Primary canvas</span>
                </div>
                <CoalitionMap />
              </div>

              <aside className="neo-right-rail panel-glass">
                <div className="panel-head">
                  <h2>Stage Intelligence</h2>
                </div>
                <StageStream />

                <div className="neo-tabs">
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
                <div className="neo-tab-content">
                  {activeRightTab === "matrix" && <StanceMatrix />}
                  {activeRightTab === "drift" && <TimelineDrift />}
                  {activeRightTab === "incentive" && <IncentiveBreakdown />}
                  {activeRightTab === "chat" && <GraphChat />}
                </div>
              </aside>
            </section>

            <section className="neo-bottom-grid">
              <div className="panel-glass">
                <div className="panel-head">
                  <h2>Pinned Insights</h2>
                </div>
                <InsightTray />
              </div>
            </section>
          </motion.main>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!run && !isLoading && !error && (
          <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p>Define an event to initialize the graph-driven dashboard.</p>
            <p className="empty-hint">SocioAtlas now prioritizes the coalition knowledge graph as the primary command surface.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
