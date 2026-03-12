from types import SimpleNamespace
from typing import NamedTuple

STAGE_DESCRIPTIONS: dict[str, str] = {
    "T1": "IMMEDIATE REACTION — The news just broke. Agents are reacting within hours based on the raw event, before any media narrative has formed. High-activation agents respond first.",
    "T2": "MEDIA AMPLIFICATION — Journalists have filed stories. Influencers have posted. Two or three competing narratives are now in circulation. Agents are responding to these frames, not just the event.",
    "T3": "SOCIAL SPREAD — The story has reached ordinary people through social feeds and word of mouth. Most people are reacting to what they heard about the event, not the event itself.",
    "T4": "LOBBYING — Organized interests are making moves behind the scenes. Coalitions are forming. Some agents' public stance may now diverge from their private action.",
    "T5": "STABILIZATION — The event has been absorbed. Stances are hardening or fading. The 'new normal' is emerging.",
}


class SampledPersona(NamedTuple):
    id: str
    persona: str


def build_group_prompt(event: str,  previos_event: str, previos_groups: list,) -> str:

  if previos_groups:
    groups_list = ""
    for g in previos_groups:
        groups_list += f"- ID: {g.group_id} | Name: {g.name} | Desc: {g.description} | Posture: {g.stance_posture}\n"
  else:
    groups_list = "No previous groups"

  if previos_event:
    previos_event_str = previos_event
  else:
    previos_event_str = "No previous event"


  return f"""You are designing the societal reaction landscape for a simulation.

Previos Grouping in previous stages:
{groups_list}

Previos Event:
{previos_event_str}

Current EVENT: {event}

Generate between 3 and 6 stance groups that would naturally form around this event.
Groups are defined by their relationship to the event — not by demographics or profession.
Cover the full spectrum: at least one group likely to support, one likely to oppose, one ambiguous.

Return ONLY valid JSON. No explanation outside the JSON block.

{{
  "groups": [
    {{
      "group_id": "snake_case_id",
      "name": "Plain language group name",
      "description": "One sentence: who are these people and why do they care?",
      "stance_posture": "Their default orientation to this event",
      "primary_incentive": "M | P | I | S | N"
    }}
  ]
}}"""


def build_agents_list(agents: list) -> str:
    lines = []
    for i, agent in enumerate(agents):
        lines.append(f"{i + 1}. ID: {agent.id} | Persona: {agent.persona}")
    return "\n".join(lines)


def build_stance_prompt(event: str, stage: str, groups: list, agents: list) -> str:
    stage_description = STAGE_DESCRIPTIONS.get(stage, "")
    agents_list = build_agents_list(agents)
    
    groups_list = ""
    for g in groups:
        groups_list += f"- ID: {g.group_id} | Name: {g.name} | Desc: {g.description} | Posture: {g.stance_posture}\n"

    return f"""You are running a societal simulation. Given an event, a list of agents, and the available groups for this stage, output each agent's stance, reasoning, and group assignment.

EVENT: {event}

TIMELINE STAGE: {stage}
{stage_description}

AVAILABLE GROUPS:
{groups_list}

INCENTIVE TYPES (use these to ground your reasoning):
  M = Material     — "what does this cost or gain me?"
  P = Power        — "does this increase or reduce my influence?"
  I = Identity     — "does this affirm or threaten who I am?"
  S = Survival     — "does this threaten my existence or way of life?"
  N = Normative    — "is this right or wrong regardless of self-interest?"

Priority of incentives for most of the agents:
Material (M) > Survival (S) > Identity (I) > Power (P) > Normative (N)

STANCE SCALE:
  +2 = Strongly Support
  +1 = Support
   0 = Neutral
  -1 = Oppose
  -2 = Strongly Oppose
   ± = Contested (internal split)

AGENTS:
{agents_list}

For each agent, select the most appropriate group from the available groups, and output their stance at this timeline stage.
Reasoning must be 1–2 sentences, grounded in their specific persona and the event.
Do NOT be generic. Connect the persona to the event concretely.

Return ONLY valid JSON. No explanation outside the JSON block.

{{
  "stage": "{stage}",
  "results": [
    {{
      "agent_id": "string",
      "assigned_group_id": "group_id_from_available_groups",
      "stance": "Strongly Support | Support | Neutral | Oppose | Strongly Oppose | Contested",
      "score": 2,
      "incentive_active": "M | P | I | S | N",
      "reasoning": "1–2 sentences"
    }}
  ]
}}"""

def build_end_state_prompt(event: str, stage_label: str, groups: list, stances: dict) -> str:
    # Build group summary
    group_summary_lines = []
    
    # We are just constructing a prompt from groups and stances to help the LLM.
    results = stances.get("results", [])
    
    group_counts = {}
    for r in results:
        gid = r.get("assigned_group_id")
        if gid:
            group_counts[gid] = group_counts.get(gid, 0) + 1
            
    for g in groups:
        count = group_counts.get(g.group_id, 0)
        group_summary_lines.append(f"- Group '{g.name}' ({g.stance_posture}): {count} agents joined.")
        
    group_stance_summary = "\n".join(group_summary_lines)
    
    return f"""You are a simulation engine summarizing the outcome of a timeline stage. 
Based on the current event, the groups involved, and the agents' stances, summarize the social response and outcome. Then, generate the new "event state" which will serve as the reality for the next stage.

CURRENT EVENT: {event}
TIMELINE STAGE: {stage_label}

GROUP SUMMARY FOR THIS STAGE:
{group_stance_summary}

Return ONLY valid JSON. No explanation outside the JSON block.

{{
  "social_response_summary": "1-2 paragraphs summarizing the macro reaction, dominant groups, and shifts in public opinion or policy.",
  "new_event_state": "The updated reality of the event. Write it as a news summary detailing where things stand now. This text will be the new EVENT prompt for the next timeline stage."
}}"""
