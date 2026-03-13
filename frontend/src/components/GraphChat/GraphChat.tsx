import { FormEvent, useState } from "react";
import { useSimulationStore } from "../../store/simulationStore";

export function GraphChat() {
  const [query, setQuery] = useState("");
  const {
    chatLoading,
    chatError,
    chatAnswer,
    chatEvidence,
    askGraphQuestion,
    clearChat,
  } = useSimulationStore();

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void askGraphQuestion(query, 12);
  };

  return (
    <div className="graph-chat">
      <div className="graph-chat-header">
        <span className="graph-chat-title">Graph Chat</span>
        <button className="graph-chat-clear" onClick={clearChat} disabled={chatLoading}>
          Clear
        </button>
      </div>

      <form className="graph-chat-form" onSubmit={onSubmit}>
        <input
          className="graph-chat-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask about agent/group relationships..."
        />
        <button className="graph-chat-submit" type="submit" disabled={chatLoading}>
          {chatLoading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {chatError && <p className="graph-chat-error">{chatError}</p>}

      {chatAnswer && (
        <div className="graph-chat-answer">
          <div className="graph-chat-label">Answer</div>
          <p>{chatAnswer}</p>
        </div>
      )}

      {chatEvidence.length > 0 && (
        <div className="graph-chat-evidence">
          <div className="graph-chat-label">Retrieved Evidence</div>
          <div className="graph-chat-evidence-list">
            {chatEvidence.map((item) => (
              <div key={item.id} className="graph-chat-evidence-item">
                <span className="graph-chat-evidence-title">
                  [{item.stage ?? "GLOBAL"}] {item.kind.toUpperCase()} {item.label}
                </span>
                <span className="graph-chat-evidence-score">score {item.score.toFixed(2)}</span>
                <p className="graph-chat-evidence-details">{item.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
