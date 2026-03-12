import type { IncentiveType, StanceScore, StanceLabel } from "@socioatlas/shared";

export function scoreToColor(score: StanceScore | number): string {
  if (score >= 2) return "#16a34a";   // green-600
  if (score === 1) return "#4ade80";  // green-400
  if (score === 0) return "#a3a3a3";  // neutral-400
  if (score === -1) return "#f87171"; // red-400
  return "#dc2626";                   // red-600
}

export function scoreToIcon(score: StanceScore | number | null): string {
  if (score === null) return "●";
  if (score >= 2) return "●●";
  if (score === 1) return "●";
  if (score === 0) return "○";
  if (score === -1) return "●";
  return "●●";
}

export function stanceLabelToScore(label: StanceLabel): StanceScore {
  const map: Record<StanceLabel, StanceScore> = {
    "Strongly Support": 2,
    "Support": 1,
    "Neutral": 0,
    "Contested": 0,
    "Oppose": -1,
    "Strongly Oppose": -2,
  };
  return map[label] ?? 0;
}

export function incentiveLabel(type: IncentiveType): string {
  const labels: Record<IncentiveType, string> = {
    M: "Material",
    P: "Power",
    I: "Identity",
    S: "Survival",
    N: "Normative",
  };
  return labels[type];
}

export function incentiveDescription(type: IncentiveType): string {
  const descs: Record<IncentiveType, string> = {
    M: "What does this cost or gain me?",
    P: "Does this increase or reduce my influence?",
    I: "Does this affirm or threaten who I am?",
    S: "Does this threaten my existence or way of life?",
    N: "Is this right or wrong regardless of self-interest?",
  };
  return descs[type];
}

export function stanceToColorClass(label: StanceLabel): string {
  if (label === "Strongly Support") return "text-green-600";
  if (label === "Support") return "text-green-400";
  if (label === "Neutral") return "text-neutral-400";
  if (label === "Contested") return "text-yellow-500";
  if (label === "Oppose") return "text-red-400";
  return "text-red-600";
}
