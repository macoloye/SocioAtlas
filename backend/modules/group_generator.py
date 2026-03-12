import asyncio
import logging

from backend.types import Group
from backend.utils.llm_client import call_llm
from backend.utils.prompts import build_group_prompt
from backend.utils.validators import ValidationError, parse_groups_response

_logger = logging.getLogger(__name__)


async def generate_groups(event: str, previos_event: str, previos_groups: list,) -> list[Group]:
    prompt = build_group_prompt(event, previos_event, previos_groups)
    retries = 3
    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            raw = await call_llm(prompt)
            return parse_groups_response(raw)
        except (ValidationError, RuntimeError) as error:
            last_error = error
            if attempt == retries:
                break
            _logger.warning(
                "generate_groups retrying after failure (attempt %d/%d): %s",
                attempt,
                retries,
                error,
            )
            await asyncio.sleep(0.4 * attempt)

    assert last_error is not None
    raise last_error
