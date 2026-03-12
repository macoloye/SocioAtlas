# 🧠 SocialAtlas

> Type in an event. Watch society react — across stance groups, agents, and time.

---

## Core Idea

You input an event, policy, or product. The system simulates a timeline of societal reaction.

**Dynamic Event Evolution:**
At each timeline stage, the event may mutate depending on the public reaction. The outcome of one stage becomes the reality fed into the next.

**Dynamic Group Formation:**
At every stage, new groups can emerge based on the evolving event, or existing ones can persist. Groups are NOT defined by fixed demographics. They are ad-hoc coalitions defined by shared behavioral orientations toward the event.

**Agents Join Groups On The Fly:**
Specific **agents** (personas with distinct backgrounds and incentives) evaluate the current event state and dynamically decide which group to join. Agents take a **stance** and provide a piece of **reasoning** based on their core personas.

---

## Event Propagation: T0 → T5

```
T0  Event Release        The news breaks. Raw information enters the world.
T1  Immediate Reaction   High-activation agents publish first takes within hours.
T2  Media Amplification  Journalists frame it. Influencers comment. Narratives form.
T3  Social Spread        Ordinary people react to the narratives, not the event itself.
T4  Lobbying             Organized interests pressure decision-makers behind the scenes.
T5  Stabilization        Stances harden or soften. Final distribution locks in.
```

---


python -m backend.server
npm run dev:frontend

## File Map

| File | Content |
|---|---|
| [`GROUPS.md`](./GROUPS.md) | The agent pool and example stance-based groups |
| [`INCENTIVES.md`](./INCENTIVES.md) | The 5 incentive types that explain every stance |
| [`TIMELINE.md`](./TIMELINE.md) | T0–T5 mechanics — who acts when and why |
| [`SIMULATION.md`](./SIMULATION.md) | How to implement + how to visualize |

---

## Stance Scale

| Label | Score | Meaning |
|---|---|---|
| 🟢🟢 Strongly Support | +2 | Actively champion it |
| 🟢 Support | +1 | In favor, may signal publicly |
| ⚪ Neutral | 0 | No strong feeling, wait and see |
| 🔴 Oppose | -1 | Against it, may signal publicly |
| 🔴🔴 Strongly Oppose | -2 | Actively fight it |
| 🟡 Contested | ± | Internal split, depends on framing |

---

## Design Principles

1. **Groups describe behavioral posture, not occupation.** A nurse and a lawyer can be in the same group if they share the same reaction pattern.
2. **Incentives explain the stance.** Every stance has a root cause — material, identity, power, survival, or moral.
3. **Stances evolve through the timeline.** Responses shift dynamically. The simulation captures this by summarizing social response and generating a new event state at the end of each stage.
4. **Dynamic Grouping.** Rather than remaining static, agents fluidly form new groups depending on the event's evolution.
5. **Relationships emerge from incentives.** Two agents ally when their incentives align on a topic and they join the same group. They don't need a pre-set relationship.
