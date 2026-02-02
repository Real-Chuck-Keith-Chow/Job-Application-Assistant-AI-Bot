import os
import requests
from functools import lru_cache

from ai.answer_generator import generate_answer

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
REQUEST_TIMEOUT_S = float(os.getenv("REQUEST_TIMEOUT_S", "3"))


def _safe_get_cached_answer(question: str):
    """
    Try to fetch an existing answer from the backend cache.
    Accepts either:
      - {"answer": "text"}
      - {"answer": {"answer": "text", ...}}  (if backend stores structured objects)
    """
    try:
        r = requests.get(
            f"{BACKEND_URL}/answers",
            params={"question": question},
            timeout=REQUEST_TIMEOUT_S,
        )
        if not r.ok:
            return None

        data = r.json()
        if not isinstance(data, dict):
            return None

        answer_field = data.get("answer")
        if isinstance(answer_field, str) and answer_field.strip():
            return answer_field.strip()

        if isinstance(answer_field, dict):
            inner = answer_field.get("answer")
            if isinstance(inner, str) and inner.strip():
                return inner.strip()

        return None
    except Exception:
        # backend down, bad json, timeout, etc. -> just fall back to generation
        return None


def _safe_store_answer(question: str, payload: dict):
    """
    Best-effort store. Never raises (don’t break automation if backend fails).
    """
    try:
        requests.post(
            f"{BACKEND_URL}/answers",
            json={"question": question, **payload},
            timeout=REQUEST_TIMEOUT_S,
        )
    except Exception:
        pass


@lru_cache(maxsize=256)
def match_question(question: str, context: str | None = None) -> str:
    """
    Returns the answer text for a job application question.
    1) Try backend cache
    2) Generate via ai.answer_generator.generate_answer()
    3) Store back to backend (best-effort)
    """
    q = (question or "").strip()
    if not q:
        return ""

    cached = _safe_get_cached_answer(q)
    if cached:
        return cached

    # Generate structured response via your upgraded generator
    try:
        result = generate_answer(q, context=context)  # {"answer","confidence","reasoning"}
        if not isinstance(result, dict) or "answer" not in result:
            return "I couldn't generate an answer."
    except Exception:
        return "I couldn't generate an answer."

    # Store structured answer + metadata (even if caller only needs text)
    _safe_store_answer(q, result)

    return str(result["answer"]).strip()
