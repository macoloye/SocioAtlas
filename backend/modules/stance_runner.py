import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.types import Agent, Group, StageOutput
from backend.utils.llm_client import call_llm_sync
from backend.utils.prompts import build_stance_prompt
from backend.utils.validators import parse_stance_response

AGENT_BATCH_LIMIT = int(os.getenv("AGENT_BATCH_LIMIT", "10"))
MAX_CONCURRENT_REQUEST = int(os.getenv("MAX_CONCURRENT_REQUEST", "3"))
worker_count = MAX_CONCURRENT_REQUEST if MAX_CONCURRENT_REQUEST > 0 else 1


def _run_batch(event: str, stage: str, groups: list[Group], batch_agents: list[Agent], persuadable_context: str = "") -> StageOutput:
    prompt = build_stance_prompt(event, stage, groups, batch_agents, persuadable_context)
    raw = call_llm_sync(prompt)
    return parse_stance_response(raw)


def run_stances(event: str, stage: str, groups: list[Group], agents: list[Agent], persuadable_context: str = "") -> StageOutput:
    if not agents:
        return StageOutput(stage=stage, groups=groups, results=[], end_state=None)  # type: ignore[arg-type]

    batch_size = AGENT_BATCH_LIMIT if AGENT_BATCH_LIMIT > 0 else len(agents)
    batches: list[list[Agent]] = [
        agents[i : i + batch_size] for i in range(0, len(agents), batch_size)
    ]

    combined_results = []
    base_output: StageOutput | None = None

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {
            executor.submit(_run_batch, event, stage, groups, batch, persuadable_context): batch
            for batch in batches
        }
        for future in as_completed(futures):
            out = future.result()
            combined_results.extend(out.results)
            if base_output is None:
                base_output = out

    if base_output is None:
        base_output = StageOutput(stage=stage, groups=[], results=[], end_state=None)  # type: ignore[arg-type]

    base_output.stage = stage  # type: ignore[assignment]
    base_output.groups = groups
    base_output.results = combined_results
    return base_output
