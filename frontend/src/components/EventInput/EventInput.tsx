import { useState } from "react";
import { useSimulationStore } from "../../store/simulationStore";

const MIN_SAMPLE_SIZE = 5;
const MAX_SAMPLE_SIZE = 200;
const DEFAULT_SAMPLE_SIZE = 30;

export function EventInput() {
  const [value, setValue] = useState("");
  const [sampleSize, setSampleSize] = useState(DEFAULT_SAMPLE_SIZE);
  const { isLoading, submitEvent } = useSimulationStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    submitEvent(trimmed, sampleSize);
  };

  const fillPct =
    ((sampleSize - MIN_SAMPLE_SIZE) / (MAX_SAMPLE_SIZE - MIN_SAMPLE_SIZE)) * 100;

  return (
    <form onSubmit={handleSubmit} className="event-input-form">
      <div className="event-input-row">
        <input
          className="event-input-field"
          type="text"
          placeholder='Enter an event to simulate…'
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isLoading}
          autoFocus
        />
        <button
          className="event-input-submit"
          type="submit"
          disabled={isLoading || value.trim().length === 0}
        >
          {isLoading ? "Simulating…" : "Simulate"}
        </button>
      </div>

      <div className="agent-slider-wrap">
        <div className="agent-slider-header">
          <span className="agent-slider-label">Agents in the World</span>
          <span className="agent-slider-badge">{sampleSize}</span>
        </div>
        <input
          className="agent-slider-input"
          type="range"
          min={MIN_SAMPLE_SIZE}
          max={MAX_SAMPLE_SIZE}
          value={sampleSize}
          onChange={(e) => setSampleSize(Number(e.target.value))}
          disabled={isLoading}
          style={{ "--fill": `${fillPct}%` } as React.CSSProperties}
        />
        <div className="agent-slider-hints">
          <span>Fewer · faster</span>
          <span>More · richer</span>
        </div>
      </div>
    </form>
  );
}
