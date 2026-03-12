from backend.types import Group, StageOutput, StageEndState
from backend.utils.llm_client import call_llm
from backend.utils.prompts import build_end_state_prompt
from backend.utils.validators import parse_end_state_response


async def generate_end_state(
    event: str, stage_label: str, groups: list[Group], stances: StageOutput
) -> StageEndState:
    # Convert StageOutput to a dict for the prompt builder
    stances_dict = {"results": [r.model_dump() for r in stances.results]}
    
    prompt = build_end_state_prompt(event, stage_label, groups, stances_dict)
    raw = await call_llm(prompt)
    return parse_end_state_response(raw)
