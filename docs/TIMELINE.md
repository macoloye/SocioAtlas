# 📅 TIMELINE.md — T0 to T5: Event Propagation Model

> A stance is not static. It evolves as information spreads, narratives form, and pressure accumulates. The T0–T5 model tracks how society's reaction changes from the moment an event breaks to when the dust settles.

---

## The 6 Phases

---

### T0 — Event Release

**What happens:** The raw event enters the world. A law passes, a product launches, a scandal breaks, a statement is made. The information is unfiltered — no narrative has formed yet.

**Who acts:** Nobody yet. This is the input state.

**Stance output:** None. This is the seed.

**Key variable:** How the event is *initially described* (neutral, alarming, triumphant) — this primes the first reactions.

---

### T1 — Immediate Reaction

**What happens:** High-activation agents publish their first take within hours. These are agents with a pre-formed worldview (Group 1: Ideological Vanguard) or a direct material stake (Group 2: Material Calculators). They don't wait for context — they react.

**Who acts:**
- Group 1: Ideological Vanguard (first and loudest)
- Group 2: Material Calculators (fast, self-interested)
- Group 6: Morality Anchors (if event triggers a value conflict)

**Stance characteristics:**
- Extreme ends of the scale dominate (🟢🟢 or 🔴🔴)
- Little nuance; maximum signal
- Stances are based on **the event itself**, not coverage of it

**Key dynamic:** The first reaction sets the **anchor frame** that others will respond to, not the event itself.

---

### T2 — Media Amplification

**What happens:** Journalists write pieces, editors choose angles, influencers record takes. The event is now packaged into competing narratives. This is where *framing* is produced and distributed.

**Who acts:**
- `mainstream_journalist` (Group 3): Files a "both sides" story, protects institutional credibility
- `partisan_journalist` (Group 1 adjacent): Amplifies the narrative that suits their audience
- `influencer` (Group 4 adjacent): Comments to generate engagement, not to inform
- `alt_media_host` (Group 5): Challenges the mainstream frame

**Stance characteristics:**
- Media agents don't necessarily take a stance — they **produce the framing** that others will use to form stances
- Framing choices: What context is included? Whose voice is centered? What is the headline?

**Key dynamic:** Two people who both "heard about" the event may have heard completely different narratives. Their T3 stances reflect the narrative, not the event.

---

### T3 — Social Spread

**What happens:** The narrative reaches ordinary people through social feeds, word of mouth, and casual media consumption. People form opinions on what they've absorbed — which is already once-removed from the event.

**Who acts:**
- Group 4: Narrative Followers (core activation point)
- Group 5: Skeptics & Contrarians (react to the mainstream narrative with doubt)
- Group 7: Passive Bystanders (activate only if the story personally lands)

**Stance characteristics:**
- Stances cluster around the dominant narrative frame
- Heterogeneity *within* Group 4 reflects which media ecosystem each agent was exposed to
- Skeptics produce counter-stances based on the narrative's perceived holes

**Key dynamic:** Stance distribution at T3 is the closest proxy to "public opinion polling." It's a function of narrative reach, not event facts.

---

### T4 — Lobbying

**What happens:** Organized interests make their moves behind the scenes. Lobbyists meet with lawmakers. Coalitions form. Funding flows toward or away from politicians. The visible debate is now being shaped by invisible pressure.

**Who acts:**
- Group 8: Organized Power Brokers (core activation point)
- Group 2: Material Calculators (if stakes are high enough to justify direct lobbying)
- Group 3: Institutional Defenders (if institutions are under pressure)

**Stance characteristics:**
- Stances here are **strategic**, not emotional
- Public stance ≠ private stance — power brokers may say one thing and lobby for another
- Coalitions form between unlikely allies when incentives align (e.g., unions + libertarians on surveillance)

**Key dynamic:** This phase is mostly invisible to the public but often determines T5 outcomes. The final policy or outcome frequently reflects T4 pressure more than T3 opinion.

---

### T5 — Stabilization

**What happens:** The event is absorbed into the status quo. Stances harden or drift to neutral. Activists either sustain the issue or burn out. Policy outcomes land. The "new normal" is established.

**Who acts:** All agents settle into a final position.

**Stance characteristics:**
- Many agents who were loud at T1 have moved on
- Material Calculators update their stance based on what actually happened vs. what they feared
- Narrative Followers drift to whatever frame dominated the long-form news cycle
- Ideological Vanguard either claims victory/defeat or narrativizes the outcome into their ongoing worldview

**Key dynamic:** T5 ≠ T1. Stances shift. The simulation output should compare T1 → T5 delta to show which agents moved, why, and in which direction.

---

## Stance Drift Rules

| Pattern | Description | Example |
|---|---|---|
| **Anchoring** | Agent's T1 stance pulls their T5 stance toward it | Ideological Vanguard rarely reverses |
| **Narrative Capture** | Agent adopts dominant T2 frame by T3 | Narrative Followers converge on media consensus |
| **Reality Correction** | Material outcome at T5 updates Material Calculator's stance | CEO who opposed policy supports it after seeing profit |
| **Fatigue Drift** | High-intensity T1 stance decays to neutral by T5 if no sustained pressure | Activists burn out, issue fades |
| **Backfire** | Opposition or support intensifies after T4 reveals lobbying manipulation | Public anger when lobbying becomes visible |
| **Realignment** | Two agents who opposed each other at T1 ally at T4 on strategic grounds | Union + small business coalition on a specific clause |

---

## Timeline Output Format

For each agent, the simulation produces:

```yaml
agent: suburban_parent
group: Narrative Followers

T1: ⚪ Neutral         # hasn't seen coverage yet
T2: ⚪ Neutral         # mainstream coverage is balanced
T3: 🔴 Oppose          # absorbed a partisan frame via social media
T4: 🔴 Oppose          # no personal lobbying, stance stable
T5: ⚪ Neutral          # story faded, returned to baseline

drift: T3 spike, returns to neutral — classic narrative capture + fatigue
incentive: Identity (absorbed group norm from social feed)
```

---

## Aggregated Timeline View

At each time step, the simulation can output a **stance distribution** across all active agents:

```
T1  |  🟢🟢 ████░░░░░  🟢 ██░░░░░░  ⚪ ██░░░░░░  🔴 ███░░░░░  🔴🔴 ████░░░░░
T3  |  🟢🟢 ███░░░░░░  🟢 ████░░░░  ⚪ ████░░░░  🔴 ████░░░░  🔴🔴 ██░░░░░░
T5  |  🟢🟢 ██░░░░░░░  🟢 ████░░░░  ⚪ ██████░░  🔴 ███░░░░░  🔴🔴 ██░░░░░░
```

This shows how the distribution shifts: extreme positions often dominate T1, the middle grows at T5 as fatigue sets in.
