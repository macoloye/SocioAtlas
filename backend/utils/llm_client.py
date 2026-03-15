import asyncio
import logging
import os
import random
import time
from typing import Optional

from openai import (
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    OpenAI,
    RateLimitError,
)

_logger = logging.getLogger(__name__)
_TRANSIENT_OPENAI_ERRORS = (
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    RateLimitError,
)


def call_llm_sync(
    prompt: str,
    model_name: Optional[str] = None,
) -> str:
    """
    Synchronous OpenAI-compatible chat completion call.
    Safe to run inside a ThreadPoolExecutor worker.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    model = os.getenv("MODEL_NAME") or model_name
    if not model:
        raise RuntimeError("MODEL_NAME is not set and no model_name was provided")

    client_kwargs: dict = {"api_key": api_key}
    base_url = os.getenv("BASE_URL_NAME")
    if base_url:
        client_kwargs["base_url"] = base_url

    client = OpenAI(**client_kwargs)

    max_attempts = max(1, int(os.getenv("OPENAI_MAX_RETRIES", "4")))
    base_delay = float(os.getenv("OPENAI_RETRY_BASE_SECONDS", "0.75"))
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=1.0,
                max_tokens=4096,
            )
            content = response.choices[0].message.content
            if not content:
                raise RuntimeError("OpenAI-compatible API returned empty response")
            return content
        except _TRANSIENT_OPENAI_ERRORS as error:
            last_error = error
            if attempt == max_attempts:
                break

            # Exponential backoff with a small jitter helps smooth short provider outages.
            delay_seconds = (base_delay * (2 ** (attempt - 1))) + random.uniform(0, 0.25)
            _logger.warning(
                "Transient LLM failure on attempt %d/%d: %s. Retrying in %.2fs",
                attempt,
                max_attempts,
                error,
                delay_seconds,
            )
            time.sleep(delay_seconds)

    assert last_error is not None
    raise RuntimeError(
        f"OpenAI-compatible API failed after {max_attempts} attempts"
    ) from last_error


async def call_llm(
    prompt: str,
    model_name: Optional[str] = None,
) -> str:
    """Async wrapper kept for callers that still await it."""
    return await asyncio.to_thread(call_llm_sync, prompt, model_name)
