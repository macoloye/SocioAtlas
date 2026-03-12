import json
import os
import random
from functools import lru_cache
from typing import NamedTuple


class PersonaEntry(NamedTuple):
    id: str
    persona: str


@lru_cache(maxsize=1)
def _load_personas() -> list[PersonaEntry]:
    file_path = os.getenv("PERSONA_JSON_PATH") or os.path.join(
        os.path.dirname(__file__), "../../persona.json"
    )
    with open(file_path, "r", encoding="utf-8") as f:
        data: dict[str, str] = json.load(f)
    return [PersonaEntry(id=k, persona=v) for k, v in data.items()]


def sample_personas(n: int) -> list[PersonaEntry]:
    pool = _load_personas()
    return random.sample(pool, min(n, len(pool)))


def get_persona_pool_size() -> int:
    return len(_load_personas())
