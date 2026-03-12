import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { IncentiveType } from "@socioatlas/shared";
import { useSimulationStore } from "../../store/simulationStore";
import { incentiveLabel } from "../../utils/stanceHelpers";

type FilterMode = "all" | "support" | "oppose";

const INCENTIVE_COLORS: Record<IncentiveType, string> = {
  M: "#f59e0b",
  P: "#a78bfa",
  I: "#f472b6",
  S: "#f87171",
  N: "#34d399",
};

export function IncentiveBreakdown() {
  const { run, activeStage } = useSimulationStore();
  const [filter, setFilter] = useState<FilterMode>("all");

  if (!run) return null;

  const stageOutput = run.timeline[activeStage];
  const results = stageOutput?.results ?? [];

  const filtered = results.filter((r) => {
    if (filter === "support") return r.score > 0;
    if (filter === "oppose") return r.score < 0;
    return true;
  });

  const counts: Record<IncentiveType, number> = { M: 0, P: 0, I: 0, S: 0, N: 0 };
  filtered.forEach((r) => {
    if (r.incentive_active) counts[r.incentive_active]++;
  });

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  const data = (Object.entries(counts) as [IncentiveType, number][])
    .map(([type, count]) => ({
      type,
      label: incentiveLabel(type),
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="incentive-breakdown">
      <div className="incentive-header">
        <span className="incentive-title">Incentive Breakdown</span>
        <div className="panel-stage-badge">{activeStage}</div>

        <div className="filter-toggle">
          {(["all", "support", "oppose"] as FilterMode[]).map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
          <XAxis type="number" stroke="#888" />
          <YAxis type="category" dataKey="label" stroke="#888" width={80} />
          <Tooltip
            contentStyle={{ background: "#1a1a1a", border: "1px solid #333" }}
            formatter={(val: unknown) => [`${val} agents`, "Count"]}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.type}
                fill={INCENTIVE_COLORS[entry.type]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
