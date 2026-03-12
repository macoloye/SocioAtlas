import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Stage, StanceResult, StageOutput } from "@socioatlas/shared";
import { useSimulationStore } from "../../store/simulationStore";

const STAGES: Stage[] = ["T1", "T2", "T3", "T4", "T5"];

type Timeline = Partial<Record<Stage, StageOutput>>;

// Score bucket counts per stage for aggregate view
type ScoreBucket = { stage: Stage; "2": number; "1": number; "0": number; "-1": number; "-2": number };

function buildAggregateData(timeline: Timeline): ScoreBucket[] {
  return STAGES.map((stage) => {
    const results: StanceResult[] = timeline[stage]?.results ?? [];
    const bucket: ScoreBucket = { stage, "2": 0, "1": 0, "0": 0, "-1": 0, "-2": 0 };
    results.forEach((r) => {
      const key = String(r.score) as keyof Omit<ScoreBucket, "stage">;
      bucket[key] = (bucket[key] ?? 0) + 1;
    });
    return bucket;
  });
}

function buildAgentData(agentId: string, timeline: Timeline) {
  return STAGES.map((stage) => {
    const result: StanceResult | undefined = timeline[stage]?.results.find(
      (r) => r.agent_id === agentId
    );
    return {
      stage,
      score: result?.score ?? null,
      stance: result?.stance ?? "",
    };
  });
}

export function TimelineDrift() {
  const { run, selectedAgentId, selectAgent } = useSimulationStore();

  if (!run) return null;

  const agentId = selectedAgentId;
  const allAgents = run.agents;
  const agentPersona = allAgents.find((a) => a.id === agentId)?.persona ?? "";

  if (agentId) {
    const data = buildAgentData(agentId, run.timeline);
    return (
      <div className="timeline-drift">
        <div className="drift-header">
          <span className="drift-title">Timeline Drift</span>
          <span className="drift-agent-label">{agentPersona}</span>
          <button className="drift-clear-btn" onClick={() => selectAgent(null)}>
            Show aggregate
          </button>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="stage" stroke="#888" />
            <YAxis domain={[-2, 2]} ticks={[-2, -1, 0, 1, 2]} stroke="#888" />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
              formatter={(val: unknown, _name: unknown, props: { payload?: { stance?: string } }) =>
                [`${val} (${props.payload?.stance ?? ""})`, "Score"]
              }
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Aggregate stacked area
  const data = buildAggregateData(run.timeline);
  const scoreColors: Record<string, string> = {
    "2": "#16a34a",
    "1": "#4ade80",
    "0": "#a3a3a3",
    "-1": "#f87171",
    "-2": "#dc2626",
  };
  const scoreLabels: Record<string, string> = {
    "2": "Strongly Support",
    "1": "Support",
    "0": "Neutral/Contested",
    "-1": "Oppose",
    "-2": "Strongly Oppose",
  };

  return (
    <div className="timeline-drift">
      <div className="drift-header">
        <span className="drift-title">Timeline Drift</span>
        <span className="drift-subtitle">Click an agent in the matrix to drill down</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis dataKey="stage" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip
            contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
            formatter={(value: number, name: string) => [
              `${value}`,
              scoreLabels[name] ?? name,
            ]}
          />
          <Legend formatter={(val) => scoreLabels[val] ?? val} />
          {(["-2", "-1", "0", "1", "2"] as const).map((s) => (
            <Area
              key={s}
              type="monotone"
              dataKey={s}
              stackId="1"
              stroke={scoreColors[s]}
              fill={scoreColors[s]}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
