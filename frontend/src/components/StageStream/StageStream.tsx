import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Group, Stage, StageOutput, StanceResult } from "@socioatlas/shared";
import { useSimulationStore, type StageProgress } from "../../store/simulationStore";

const STAGE_LIST: Stage[] = ["T1", "T2", "T3", "T4", "T5"];

const POSTURE_COLOR: Record<string, string> = {
  supportive: "var(--green)",
  opposing: "var(--red)",
  ambiguous: "var(--yellow)",
  neutral: "var(--text-muted)",
};

type StageRailStatus = "queued" | "running" | "waiting" | "complete";

interface StageDelta {
  supportDelta: number;
  opposeDelta: number;
  groupCountDelta: number;
  mostShiftedGroupLabel: string;
}

function Pulse() {
  return (
    <motion.span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "var(--accent)",
        flexShrink: 0,
      }}
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function formatElapsed(ms?: number) {
  if (!ms || Number.isNaN(ms)) return "--";
  return `${(ms / 1000).toFixed(1)}s`;
}

function resolveRailStatus(output: StageOutput | undefined, progress: StageProgress | undefined): StageRailStatus {
  if (output) return "complete";
  if (!progress) return "queued";
  if (progress.status === "awaiting_choice") return "waiting";
  return "running";
}

function summarizeGroupShift(current: StageOutput, previous?: StageOutput) {
  if (!previous) return "No previous stage baseline.";

  const averageScoreByGroup = (results: StanceResult[], groups: Group[]) => {
    const sums = new Map<string, { sum: number; count: number }>();
    for (const result of results) {
      const existing = sums.get(result.assigned_group_id) ?? { sum: 0, count: 0 };
      sums.set(result.assigned_group_id, { sum: existing.sum + result.score, count: existing.count + 1 });
    }
    const names = new Map(groups.map((group) => [group.group_id, group.name]));
    return Array.from(sums.entries()).map(([groupId, value]) => ({
      groupId,
      name: names.get(groupId) ?? groupId,
      avg: value.count ? value.sum / value.count : 0,
    }));
  };

  const currentAvg = averageScoreByGroup(current.results, current.groups);
  const previousAvg = averageScoreByGroup(previous.results, previous.groups);
  const previousById = new Map(previousAvg.map((entry) => [entry.groupId, entry]));

  let topLabel = "n/a";
  let topShift = 0;
  for (const entry of currentAvg) {
    const prevAvg = previousById.get(entry.groupId)?.avg ?? 0;
    const shift = Math.abs(entry.avg - prevAvg);
    if (shift > topShift) {
      topShift = shift;
      topLabel = entry.name;
    }
  }

  return `${topLabel} (${topShift.toFixed(2)} avg stance shift)`;
}

function computeStageDelta(stage: Stage, runTimeline: Partial<Record<Stage, StageOutput>>): StageDelta | null {
  const index = STAGE_LIST.indexOf(stage);
  const current = runTimeline[stage];
  if (!current) return null;

  const currentSupport = current.results.filter((result) => result.score > 0).length;
  const currentOppose = current.results.filter((result) => result.score < 0).length;

  if (index <= 0) {
    return {
      supportDelta: currentSupport,
      opposeDelta: currentOppose,
      groupCountDelta: current.groups.length,
      mostShiftedGroupLabel: "Baseline stage",
    };
  }

  const previous = runTimeline[STAGE_LIST[index - 1]];
  if (!previous) return null;
  const previousSupport = previous.results.filter((result) => result.score > 0).length;
  const previousOppose = previous.results.filter((result) => result.score < 0).length;

  return {
    supportDelta: currentSupport - previousSupport,
    opposeDelta: currentOppose - previousOppose,
    groupCountDelta: current.groups.length - previous.groups.length,
    mostShiftedGroupLabel: summarizeGroupShift(current, previous),
  };
}

function EndStatePicker({
  stage,
  progress,
}: {
  stage: Stage;
  progress: StageProgress;
}) {
  const { selectEndState, selectingEndStateStage } = useSimulationStore();
  const timeoutSeconds = progress.timeout_seconds ?? 6;
  const [customText, setCustomText] = useState("");
  const [msLeft, setMsLeft] = useState(timeoutSeconds * 1000);

  const options = useMemo(() => {
    return (progress.end_state_options ?? []).slice(0, 3);
  }, [progress.end_state_options]);

  useEffect(() => {
    setMsLeft(timeoutSeconds * 1000);
  }, [timeoutSeconds, stage, options.length]);

  useEffect(() => {
    if (msLeft <= 0) return;
    const timer = window.setInterval(() => {
      setMsLeft((prev) => Math.max(0, prev - 100));
    }, 100);
    return () => window.clearInterval(timer);
  }, [msLeft]);

  if (!options.length) return null;

  const remainingSeconds = (msLeft / 1000).toFixed(1);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = msLeft / (timeoutSeconds * 1000);
  const dashOffset = circumference * (1 - progressRatio);

  const isSubmitting = selectingEndStateStage === stage;
  const defaultOption = options.find((o) => o.is_default) ?? options[0];

  return (
    <div className="end-state-picker">
      <div className="end-state-picker-head">
        <div className="end-state-picker-title">Choose Next Event State</div>
        <div className="end-state-picker-timer" title="Auto-selects default when timer ends">
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
            <circle className="timer-ring-bg" cx="26" cy="26" r={radius} />
            <circle
              className="timer-ring-fg"
              cx="26"
              cy="26"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span>{remainingSeconds}s</span>
        </div>
      </div>

      <div className="end-state-grid">
        {options.map((option) => (
          <button
            key={option.option_id}
            type="button"
            className={`end-state-option ${option.is_default ? "default" : ""}`}
            onClick={() =>
              void selectEndState(
                stage,
                option.next_event_state,
                option.option_id,
                "user_option",
              )
            }
            disabled={isSubmitting}
          >
            <div className="end-state-option-top">
              <span className="end-state-option-label">{option.label}</span>
              {option.is_default && <span className="end-state-default-chip">Default</span>}
            </div>
            <p>{option.next_event_state}</p>
          </button>
        ))}

        <div className="end-state-custom-box">
          <div className="end-state-option-top">
            <span className="end-state-option-label">Custom</span>
          </div>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Write your own next event state..."
            disabled={isSubmitting}
            rows={4}
          />
          <button
            type="button"
            className="end-state-custom-submit"
            onClick={() => void selectEndState(stage, customText, undefined, "user_custom")}
            disabled={isSubmitting || !customText.trim()}
          >
            Use custom state
          </button>
        </div>
      </div>

      <p className="end-state-picker-note">
        If no choice is made in time, the default option will be applied: {defaultOption.label}.
      </p>
    </div>
  );
}

function DeltaCard({ stage, delta }: { stage: Stage; delta: StageDelta | null }) {
  const { pinInsight } = useSimulationStore();

  if (!delta) return null;

  const detail = `Support ${delta.supportDelta >= 0 ? "+" : ""}${delta.supportDelta}, Oppose ${delta.opposeDelta >= 0 ? "+" : ""}${delta.opposeDelta}, Groups ${delta.groupCountDelta >= 0 ? "+" : ""}${delta.groupCountDelta}. Most shifted: ${delta.mostShiftedGroupLabel}.`;

  return (
    <div className="stage-delta-card">
      <div className="stage-delta-head">
        <span>What changed vs previous stage?</span>
        <button
          type="button"
          className="pin-insight-btn"
          onClick={() =>
            pinInsight({
              type: "stage_delta",
              stage,
              title: `${stage} delta summary`,
              detail,
            })
          }
        >
          Pin insight
        </button>
      </div>
      <div className="stage-delta-grid">
        <span>Support: {delta.supportDelta >= 0 ? "+" : ""}{delta.supportDelta}</span>
        <span>Oppose: {delta.opposeDelta >= 0 ? "+" : ""}{delta.opposeDelta}</span>
        <span>Groups: {delta.groupCountDelta >= 0 ? "+" : ""}{delta.groupCountDelta}</span>
      </div>
      <p>{delta.mostShiftedGroupLabel}</p>
    </div>
  );
}

function DoneCard({
  stage,
  output,
  progress,
  delta,
}: {
  stage: Stage;
  output: StageOutput;
  progress?: StageProgress;
  delta: StageDelta | null;
}) {
  const sup = output.results.filter((r) => r.score > 0).length;
  const opp = output.results.filter((r) => r.score < 0).length;
  const neu = output.results.length - sup - opp;
  const currentEvent = progress?.current_event;

  return (
    <div className="carousel-card">
      <div className="carousel-card-top">
        <div className="carousel-card-meta">
          <span className="stage-card-label">{stage}</span>
          <span className="stage-card-done-badge">done</span>
        </div>
        <div className="stage-card-scores">
          <span className="score-chip support">▲ {sup}</span>
          <span className="score-chip neutral">- {neu}</span>
          <span className="score-chip oppose">▼ {opp}</span>
        </div>
      </div>

      {currentEvent && (
        <div className="carousel-current-event">
          <span className="carousel-event-label">Current event</span>
          <p className="carousel-event-text">{currentEvent}</p>
        </div>
      )}

      <div className="carousel-card-body">
        <DeltaCard stage={stage} delta={delta} />

        <div className="stage-card-section-title">Groups</div>
        <div className="stage-card-groups">
          {output.groups.map((g) => (
            <div key={g.group_id} className="stage-card-group">
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: POSTURE_COLOR[g.stance_posture] ?? "var(--border)",
                  flexShrink: 0,
                }}
              />
              <span className="stage-card-group-name">{g.name}</span>
              <span className="stage-card-group-tag">{g.primary_incentive}</span>
            </div>
          ))}
        </div>

        {output.end_state && (
          <>
            <div className="stage-card-section-title" style={{ marginTop: "0.5rem" }}>
              Social Response
            </div>
            <p className="stage-card-summary">{output.end_state.social_response_summary}</p>
            <div className="stage-card-section-title" style={{ marginTop: "0.5rem" }}>
              Next Event State
            </div>
            <p className="stage-card-next-event">{output.end_state.new_event_state}</p>
          </>
        )}
      </div>
    </div>
  );
}

function LiveCard({ stage, progress }: { stage: Stage; progress: StageProgress }) {
  const { groups, results, current_event, transitionStep, transitionMessage } = progress;
  const activeStep = transitionStep ?? "groups";
  const activeStepIndex = activeStep === "groups" ? 0 : activeStep === "stances" ? 1 : 2;
  const steps: { label: string; done: boolean; active: boolean }[] = [
    { label: "Generating groups...", done: activeStepIndex > 0, active: activeStep === "groups" },
    {
      label: groups ? `${groups.length} groups • Running stances...` : "Running stances...",
      done: activeStepIndex > 1,
      active: activeStep === "stances",
    },
    {
      label: results ? `${results.length} stances • Writing end-state...` : "Writing end-state...",
      done: false,
      active: activeStep === "end_state",
    },
  ];

  return (
    <div className="carousel-card">
      <div className="carousel-card-top">
        <div className="carousel-card-meta">
          <span className="stage-card-label">{stage}</span>
          <Pulse />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>running...</span>
          {transitionMessage && (
            <span style={{ fontSize: "0.74rem", color: "var(--accent)" }}>{transitionMessage}</span>
          )}
        </div>
        <div className="stage-micro-progress-track" style={{ maxWidth: 120 }}>
          {[0, 1, 2].map((idx) => (
            <span
              key={idx}
              className={`stage-micro-progress-seg ${
                idx < activeStepIndex ? "done" : idx === activeStepIndex ? "active" : "pending"
              }`}
            />
          ))}
        </div>
      </div>

      {current_event && (
        <div className="carousel-current-event">
          <span className="carousel-event-label">Current event</span>
          <p className="carousel-event-text">{current_event}</p>
        </div>
      )}

      <div className="carousel-card-body">
        {steps.map((step, i) => (
          <div key={i} className="stage-step">
            <span className={`stage-step-dot ${step.done ? "done" : step.active ? "active" : "pending"}`} />
            <span className={`stage-step-label ${step.done ? "done" : step.active ? "active" : "pending"}`}>
              {step.label}
            </span>
          </div>
        ))}

        {groups && groups.length > 0 && (
          <div style={{ marginTop: "0.6rem" }}>
            <div className="stage-card-section-title">Groups so far</div>
            <div className="stage-card-groups">
              {groups.map((g) => (
                <div key={g.group_id} className="stage-card-group">
                  <span
                    style={{
                      display: "inline-block",
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: POSTURE_COLOR[g.stance_posture] ?? "var(--border)",
                      flexShrink: 0,
                    }}
                  />
                  <span className="stage-card-group-name">{g.name}</span>
                  <span className="stage-card-group-tag">{g.primary_incentive}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {progress.status === "awaiting_choice" && <EndStatePicker stage={stage} progress={progress} />}
      </div>
    </div>
  );
}

function PendingCard({ stage }: { stage: Stage }) {
  return (
    <div className="carousel-card carousel-card--pending">
      <div className="carousel-card-top">
        <div className="carousel-card-meta">
          <span className="stage-card-label">{stage}</span>
          <span className="stage-card-pending-label">
            <span className="pending-dots" /> pending
          </span>
        </div>
      </div>
    </div>
  );
}

function PeekCard({
  stage,
  side,
  onClick,
}: {
  stage: Stage;
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button className={`carousel-peek carousel-peek--${side}`} onClick={onClick} aria-label={`Go to ${stage}`}>
      <span className="carousel-peek-stage">{stage}</span>
      <span className="carousel-peek-arrow">{side === "left" ? "<-" : "->"}</span>
    </button>
  );
}

export function StageStream() {
  const { run, stageProgress, activeStage, setStage, isLoading } = useSimulationStore();
  const [direction, setDirection] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  if (!run) return null;

  const activeIndex = STAGE_LIST.indexOf(activeStage);

  const navigate = (toIndex: number) => {
    if (toIndex < 0 || toIndex >= STAGE_LIST.length) return;
    setDirection(toIndex > activeIndex ? 1 : -1);
    setStage(STAGE_LIST[toIndex]);
  };

  const renderCardContent = (stage: Stage) => {
    const output = run.timeline[stage];
    const progress = stageProgress[stage];
    const delta = computeStageDelta(stage, run.timeline);

    if (output) return <DoneCard stage={stage} output={output} progress={progress} delta={delta} />;
    if (progress) return <LiveCard stage={stage} progress={progress} />;
    if (isLoading) return <PendingCard stage={stage} />;
    return null;
  };

  const prevStage = activeIndex > 0 ? STAGE_LIST[activeIndex - 1] : null;
  const nextStage = activeIndex < STAGE_LIST.length - 1 ? STAGE_LIST[activeIndex + 1] : null;
  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? "60%" : "-60%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-60%" : "60%", opacity: 0 }),
  };

  return (
    <div className="stage-stream">
      <div className="stage-stream-title">Timeline Stages</div>

      <div className="stage-status-rail">
        {STAGE_LIST.map((stage, idx) => {
          const output = run.timeline[stage];
          const progress = stageProgress[stage];
          const status = resolveRailStatus(output, progress);
          const elapsedMs = output
            ? (progress?.completed_at_ms ?? nowMs) - (progress?.started_at_ms ?? nowMs)
            : progress?.started_at_ms
              ? nowMs - progress.started_at_ms
              : undefined;

          return (
            <button
              key={stage}
              type="button"
              className={`stage-rail-item ${status} ${activeStage === stage ? "active" : ""}`}
              onClick={() => navigate(idx)}
            >
              <span className="stage-rail-top">
                <strong>{stage}</strong>
                <span>{status}</span>
              </span>
              <span className="stage-rail-time">{formatElapsed(elapsedMs)}</span>
            </button>
          );
        })}
      </div>

      <div className="stage-carousel-wrap">
        {prevStage && <PeekCard stage={prevStage} side="left" onClick={() => navigate(activeIndex - 1)} />}

        <div className="stage-carousel-viewport">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={activeStage}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: "easeInOut" }}
              style={{ width: "100%" }}
            >
              {renderCardContent(activeStage)}
            </motion.div>
          </AnimatePresence>
        </div>

        {nextStage && <PeekCard stage={nextStage} side="right" onClick={() => navigate(activeIndex + 1)} />}
      </div>

      <div className="stage-dots">
        {STAGE_LIST.map((s, i) => {
          const isDone = !!run.timeline[s];
          const isLive = !!stageProgress[s] && !isDone;
          return (
            <button
              key={s}
              className={`stage-dot ${i === activeIndex ? "active" : ""} ${isDone ? "done" : ""} ${isLive ? "live" : ""}`}
              onClick={() => navigate(i)}
              title={s}
            />
          );
        })}
      </div>
    </div>
  );
}
