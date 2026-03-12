# 💡 INCENTIVES.md — The 5 Incentive Types

> Incentives are the **root cause** of every stance. Before an agent can produce a stance, the engine identifies which incentive type is driving them. Relationships between agents are not pre-set — they emerge when agents share or conflict on incentive type for a given topic.

---

## Why Incentives, Not Relationships?

Traditional agent models hardcode alliances: "unions always ally with progressive politicians." But this breaks down. A union might align with conservatives on trade, oppose progressives on immigration, and split internally on automation. 

**Incentives are more fundamental.** Two agents ally when their incentives point the same direction on the current topic. They oppose when incentives conflict. This happens fresh for every simulation run.

---

## The 5 Incentive Types

---

### `M` — Material

> "What does this mean for my money, my job, my assets?"

The agent calculates concrete gain or loss. This is the most legible and predictable incentive — the agent will support anything that increases income/wealth/security and oppose anything that threatens it.

**Characteristic behavior:** Consistent, transactional, willing to ally with ideological opponents if the numbers work.

**Examples:**
- A CEO opposes a carbon tax because it raises operating costs
- A landlord opposes rent control because it lowers asset returns
- A gig worker supports a minimum income floor because it stabilizes their earnings

**Signals in reasoning:** References to cost, revenue, jobs, prices, market access, asset values.

---

### `P` — Power

> "Does this increase or decrease my influence, authority, or leverage?"

The agent evaluates the event by its effect on who controls what. Politicians, institutions, and organized groups run on this incentive. They may mask it with moral or material language, but the underlying question is always about control.

**Characteristic behavior:** Strategic, coalition-building, willing to reverse prior positions if the power calculus changes.

**Examples:**
- A politician supports a popular policy not because they believe in it but because opposing it would cost votes
- A trade association funds both parties to maintain access regardless of who wins
- A union backs a candidate in exchange for labor protections in the platform

**Signals in reasoning:** References to votes, donors, endorsements, institutional mandates, leverage, coalitions.

---

### `I` — Identity

> "Does this affirm or threaten who I am and who my people are?"

The agent's stance is driven by group membership, cultural belonging, and self-concept. This incentive is resistant to factual counter-argument because the logic is not empirical — it's social and psychological.

**Characteristic behavior:** Fast to activate, sticky (hard to change), tribal, and emotionally intense.

**Examples:**
- A nationalist opposes immigration because it threatens their conception of cultural continuity
- An evangelical opposes same-sex marriage because it conflicts with their religious identity
- A progressive activist supports a protest because it signals membership in a moral community

**Signals in reasoning:** References to "us vs. them," culture, values, tradition, community, identity markers.

---

### `S` — Survival

> "Does this threaten my existence — as a person, an organization, or a way of life?"

When stakes feel existential, this incentive overrides all others. It activates when an agent perceives irreversible harm. It produces the most extreme and hardest-to-negotiate stances.

**Characteristic behavior:** High intensity, resistant to compromise, will ally with unlikely partners to survive.

**Examples:**
- A fossil fuel executive frames climate regulation as an existential industry threat
- A union fights automation policy with maximum intensity because it threatens membership
- A minority community opposes a policy they see as enabling state violence against them

**Signals in reasoning:** "This will destroy," "we cannot allow," existential framing, maximum urgency, zero-sum language.

---

### `N` — Normative / Moral

> "Is this right or wrong, regardless of what it means for me?"

The agent holds a principled ethical position that is at least partially independent of self-interest. This can come from religious teaching, philosophical frameworks, legal ethics, or deeply internalized values.

**Characteristic behavior:** Consistent across topics that share the same ethical dimension, resistant to material arguments ("you can't put a price on human dignity").

**Examples:**
- A human rights lawyer opposes a surveillance law even though it has no personal impact on them
- A pacifist opposes military intervention regardless of strategic benefit
- A bioethicist supports consent requirements in medical trials regardless of research cost

**Signals in reasoning:** References to rights, dignity, justice, fairness, principles, ethical frameworks, duties.

---

## Incentive Conflict Resolution

When an agent faces conflicting incentives (e.g., a union leader whose members would gain wages from a policy but lose jobs to it), the engine resolves by priority:

```
Survival (S) > Identity (I) > Material (M) > Power (P) > Normative (N)
```

When two top-level incentives genuinely conflict → stance becomes `🟡 Contested` with an internal split note.

---

## Incentive → Stance Logic

```
For a given event and agent:

1. Identify which incentive type is active (M / P / I / S / N)
2. Determine direction: does the event help (+) or hurt (-) that incentive?
3. Determine intensity: is this a core incentive for this agent (high) or peripheral (low)?
4. Compute stance:
     high intensity + helps  → 🟢🟢 Strongly Support
     low intensity + helps   → 🟢 Support
     high intensity + hurts  → 🔴🔴 Strongly Oppose
     low intensity + hurts   → 🔴 Oppose
     ambiguous / mixed       → 🟡 Contested or ⚪ Neutral
```

---

## Emergent Relationships

Alliances and rivalries are computed per topic:

```
Two agents ALLY when:
  - Same incentive type, same direction
  - E.g., CEO (M: cost concern) + Landlord (M: cost concern) both oppose rent regulation

Two agents RIVAL when:
  - Conflicting incentive types, or same type in opposite direction
  - E.g., CEO (M: lower labor cost) vs. Factory Worker (M: higher wages) on minimum wage

Two agents are INDIFFERENT when:
  - Different incentive types that don't interact on this topic
  - E.g., Bioethicist (N) and Investor (M) on a topic where ethics and finance don't collide
```

This means the same two agents can ally on one topic and oppose each other on the next.
