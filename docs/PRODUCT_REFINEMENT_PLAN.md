# SocioAtlas UI + Functional Refinement Plan

## Goal
Create a pragmatic, implementation-ready roadmap to improve SocioAtlas in two areas:
1. **UI refinement** (clarity, speed-to-understanding, accessibility, control)
2. **Functional depth** (analysis workflows, comparison workflows, trust/traceability)

This plan is based on the current app surface in `App.tsx` and key modules (`EventInput`, `StageStream`, `CoalitionMap`, `StanceMatrix`) and is structured into phased delivery.

---

## 1) Current Product Friction (Observed)

### A. Input and run setup
- Event input is single-line and optimized for fast entry, but lacks:
  - pre-built scenario templates,
  - advanced run parameters,
  - explicit model/cost/latency expectations.
- Agent count slider exists, but users do not get estimated runtime/quality tradeoffs before launch.

### B. Runtime comprehension
- Streaming progress is shown, but users can still feel uncertainty around:
  - what each stage is currently doing,
  - how long each step typically takes,
  - what changed from previous stage in concrete terms.

### C. Analysis workflow
- Insights are split across multiple views (Stage Stream, Map, Matrix, Drift, Incentives, Chat), but there is no guided “analysis mode.”
- Users can inspect details, but lack a “pin and compare” workflow for:
  - group-to-group comparisons,
  - stage-to-stage deltas,
  - run-to-run differences.

### D. Trust and provenance
- Outputs include reasoning text, but provenance is still hard to audit at scale:
  - no confidence bands,
  - no systematic “why this changed” trace cards,
  - no explicit uncertainty flags for contested clusters.

### E. Accessibility & usability polish
- Keyboard navigation and focus hierarchy are not clearly signposted.
- Dense surfaces (matrix/map) can be hard for first-time users without progressive disclosure.
- Visual language is strong but still heavy for long sessions; optional density/theme controls are missing.

---

## 2) UI Refinement Roadmap

## Phase 1 — Quick Wins (1–2 weeks)

### 2.1 Simulation Launch Panel 2.0
**Objective:** Improve run setup confidence.

- Convert input block into two-level panel:
  - **Basic:** event text + agent count (current default)
  - **Advanced (collapsible):**
    - run name,
    - optional hypothesis,
    - random seed toggle (for reproducibility),
    - “focus archetypes” tags.
- Add runtime estimate under slider:
  - “~X–Y seconds expected with current settings.”
- Add template chips:
  - Policy, Product launch, Crisis, Cultural narrative, Regulation.

**Acceptance criteria**
- Users can launch with default in one click.
- Advanced options are discoverable but not intrusive.
- Runtime estimate updates as agent count changes.

### 2.2 Stage Stream Clarity Pass
**Objective:** Make stage progression instantly understandable.

- Add stage timeline rail with explicit labels and micro-status:
  - queued, running, waiting-for-input, complete.
- Add per-stage elapsed timer and optional ETA.
- Add “What changed since previous stage?” diff snippet block:
  - top 3 shifted groups,
  - net stance swing,
  - most changed incentive type.

**Acceptance criteria**
- A user can identify current stage and next action in <3 seconds.
- Every completed stage displays one concise delta summary.

### 2.3 Information Scent + Layout Controls
**Objective:** Reduce cognitive load.

- Add `Compact / Comfortable` density toggle.
- Add sticky stage selector and sticky right-panel tabs.
- Add “Reset panel layout” and remember local layout preferences.

---

## Phase 2 — Analysis UX (2–4 weeks)

### 2.4 Analyst Workspace
**Objective:** Convert exploratory browsing into workflow.

- Introduce a left-side “Insight Tray” where users can pin:
  - agents,
  - groups,
  - chat findings,
  - stage cards.
- Add compare mode:
  - compare two groups at same stage,
  - compare one group across T1→T5,
  - compare selected agent against group mean.

### 2.5 Matrix + Map Coordination
**Objective:** Tight coupling between views.

- Shared hover/select synchronization:
  - hover group in matrix highlights map cluster,
  - select node on map scrolls matrix to matching row/group.
- Visual legend improvements:
  - stance color scale shown persistently,
  - contested-state indicator with tooltip definition.

### 2.6 Guided Onboarding Layer
**Objective:** Improve first-run activation.

- 90-second inline walkthrough:
  - input, stream, map, matrix, drift.
- Optional “Narrated Insights” mode after run complete:
  - automatically calls out notable coalition shifts and anomalies.

---

## Phase 3 — Professional UX polish (4–6 weeks)

### 2.7 Snapshot Report Builder
- One-click “Generate briefing” from pinned insights.
- Export to Markdown/PDF with:
  - scenario summary,
  - top coalition outcomes,
  - dissent pockets,
  - recommendation prompts.

### 2.8 Advanced accessibility
- Full keyboard pass on map and matrix interactions.
- ARIA labels for all controls and dynamic updates.
- High-contrast theme + reduced-motion mode.

---

## 3) Functional Expansion Roadmap

## Phase 1 — Immediate Functional Additions (1–2 weeks)

### 3.1 Scenario Presets + Batch Launch
- Allow saving event + settings as reusable scenario presets.
- Add “Run 3 variants” quick batch action:
  - baseline,
  - supportive framing,
  - oppositional framing.

### 3.2 Stage Intervention Controls
- Add interventions at stage boundaries:
  - message injection,
  - policy tweak,
  - actor amplification/suppression.
- Show intervention marker on timeline with causal badge.

### 3.3 Quality + Reliability Metadata
- Store model, temperature, sample size, and run duration metadata.
- Show run metadata panel for reproducibility and audit.

## Phase 2 — Comparative Intelligence (2–4 weeks)

### 3.4 Run-to-Run Diff Engine
- Side-by-side diff view for two runs:
  - group composition changes,
  - stance distribution differences,
  - coalition edge gain/loss.
- “Biggest divergence” auto-summary.

### 3.5 Influence Path Analyzer
- Trace likely narrative flow:
  - which groups precede broad sentiment movement,
  - what incentive shifts correlate with alignment changes.
- Output ranked influence paths with confidence scores.

### 3.6 Risk and Opportunity Detector
- Automatic flags:
  - polarization surge,
  - coalition fragmentation,
  - consensus windows,
  - reputational risk pockets.

## Phase 3 — Strategic Capabilities (4–8 weeks)

### 3.7 Counterfactual Sandbox
- Clone any stage and branch alternate interventions.
- Compare branch outcomes in parallel timeline trees.

### 3.8 API Enhancements for Enterprise Use
- Add endpoints for:
  - pinned insight extraction,
  - diff summaries,
  - report generation.
- Webhook support for run completion and threshold alerts.

---

## 4) Suggested Technical Implementation Tracks

## Track A — Frontend architecture
- Introduce feature slices for:
  - run setup,
  - insights tray,
  - comparison workspace.
- Add URL-state sync for:
  - selected stage,
  - selected node/group,
  - active tab,
  - compare mode state.

## Track B — Data model evolution
- Extend run snapshot schema with:
  - interventions,
  - reproducibility metadata,
  - confidence/uncertainty objects,
  - run comparison artifacts.

## Track C — Performance
- Virtualize large matrix lists.
- Add memoized selectors for stage/group subsets.
- Add progressive graph rendering (group shells first, agent nodes second).

## Track D — Evaluation
- Add product metrics dashboard:
  - time to first insight,
  - % runs with pinned insights,
  - compare-mode usage,
  - export conversion.

---

## 5) Prioritized Backlog (Top 12)

1. Runtime estimate under agent slider.
2. Stage status rail with ETA + waiting states.
3. “What changed?” stage delta cards.
4. Shared highlight between map and matrix.
5. Insight Tray with pinning.
6. Compare mode (group vs group, stage vs stage).
7. Scenario presets.
8. Run metadata/audit panel.
9. Run-to-run diff summary.
10. Risk/opportunity auto-flags.
11. Report builder export.
12. Counterfactual branching sandbox.

---

## 6) Delivery Plan

## Sprint A (Week 1–2)
- 1, 2, 3, 7
- Output: better first-run clarity + reusable setup.

## Sprint B (Week 3–4)
- 4, 5, 6
- Output: true analyst workflow and coordinated exploration.

## Sprint C (Week 5–6)
- 8, 9, 10
- Output: stronger trust layer and strategic comparison.

## Sprint D (Week 7+)
- 11, 12
- Output: executive-ready communication and counterfactual planning.

---

## 7) Success Metrics

- **Activation:** +20% increase in users completing first full run.
- **Insight depth:** +30% runs with at least one pinned insight.
- **Comparative usage:** 25% of returning users open compare mode.
- **Retention quality:** median session duration grows without higher abandonment.
- **Trust:** reduction in “unclear output” qualitative feedback.

---

## 8) Recommended First Build (Minimum Valuable Improvement)

If we implement only one compact milestone first:

- Stage status rail + delta cards,
- runtime estimate in setup,
- pin-to-insight tray.

This gives immediate user-visible value, improves understanding during simulation, and creates a foundation for deeper comparative analytics.
