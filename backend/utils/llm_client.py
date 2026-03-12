import os
from typing import Optional

from openai import OpenAI


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

    client_kwargs: dict = {"api_key": api_key}
    base_url = os.getenv("BASE_URL_NAME")
    if base_url:
        client_kwargs["base_url"] = base_url

    client = OpenAI(**client_kwargs)

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


async def call_llm(
    prompt: str,
    model_name: Optional[str] = None,
) -> str:
    """Async wrapper kept for callers that still await it."""
    return call_llm_sync(prompt, model_name)
