import { useSimulationStore } from "../../store/simulationStore";

export function InsightTray() {
  const { pinnedInsights, removePinnedInsight, clearPinnedInsights, setStage } = useSimulationStore();

  return (
    <aside className="insight-tray">
      <div className="insight-tray-header">
        <div>
          <h3>Insight Tray</h3>
          <p>Pinned observations for quick comparison and export.</p>
        </div>
        <button
          type="button"
          className="insight-clear-btn"
          onClick={clearPinnedInsights}
          disabled={pinnedInsights.length === 0}
        >
          Clear all
        </button>
      </div>

      {pinnedInsights.length === 0 ? (
        <p className="insight-empty">No insights pinned yet. Use “Pin insight” in stage cards or 📌 in the matrix.</p>
      ) : (
        <div className="insight-list">
          {pinnedInsights.map((item) => (
            <article key={item.id} className="insight-item">
              <div className="insight-item-top">
                <span className="insight-chip">{item.type.replace("_", " ")}</span>
                {item.stage && (
                  <button
                    type="button"
                    className="insight-stage-link"
                    onClick={() => setStage(item.stage!)}
                    title={`Jump to ${item.stage}`}
                  >
                    {item.stage}
                  </button>
                )}
              </div>
              <h4>{item.title}</h4>
              <p>{item.detail}</p>
              <button
                type="button"
                className="insight-remove-btn"
                onClick={() => removePinnedInsight(item.id)}
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
