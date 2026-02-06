import os
import json
import re
from typing import Any, Dict, Optional

from openai import OpenAI

# Config via env so you can tweak without code changes
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.4"))
OPENAI_MAX_TOKENS = int(os.getenv("OPENAI_MAX_TOKENS", "250"))

if not OPENAI_API_KEY:
    # Keep this loud (it’s a real config error), but make it clear what to do
    raise EnvironmentError("OPENAI_API_KEY environment variable not set")

client = OpenAI(api_key=OPENAI_API_KEY)

SYSTEM_PROMPT = """
You are an AI job application assistant.
Answer professionally, clearly, and honestly.
Avoid generic corporate clichés and buzzwords.
If the question is unclear, ask for clarification instead of guessing.
Keep answers concise and tailored to job applications.
"""

# A strict schema we want back
REQUIRED_KEYS = ("answer", "confidence", "reasoning")


def _clamp_confidence(value: Any) -> float:
    try:
        x = float(value)
    except (TypeError, ValueError):
        return 0.0
    if x < 0.0:
        return 0.0
    if x > 1.0:
        return 1.0
    return x


def _extract_json_object(text: str) -> Dict[str, Any]:
    """
    Tries:
    1) direct json.loads
    2) extract first {...} JSON object from the text (handles code fences / extra prose)
    """
    text = (text or "").strip()

    # 1) direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # 2) remove common code fences
    fenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    try:
        return json.loads(fenced)
    except Exception:
        pass

    # 3) best-effort: find the first {...} blob
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        candidate = match.group(0)
        return json.loads(candidate)

    # Nothing worked
    raise ValueError("Model did not return valid JSON")


def generate_answer(question: str, context: Optional[str] = None, retries: int = 2) -> Dict[str, Any]:
    """
    Generate a structured answer for a job application question.

    Returns:
        {
            "answer": str,
            "confidence": float (0.0 - 1.0),
            "reasoning": str
        }
    """
    q = (question or "").strip()
    if not q:
        return {"answer": "", "confidence": 0.0, "reasoning": "Empty question"}

    user_prompt = f"""
Question:
{q}

Context:
{(context or "None").strip()}

Respond ONLY in valid JSON with:
- answer (string)
- confidence (number between 0.0 and 1.0)
- reasoning (one short sentence)
"""

    last_error: Optional[Exception] = None

    for attempt in range(retries + 1):
        try:
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT.strip()},
                    {"role": "user", "content": user_prompt.strip()},
                ],
                temperature=OPENAI_TEMPERATURE,
                max_tokens=OPENAI_MAX_TOKENS,
            )

            content = (response.choices[0].message.content or "").strip()
            parsed = _extract_json_object(content)

            # Validate shape
            if not isinstance(parsed, dict):
                raise ValueError("Model response JSON is not an object")

            if not all(k in parsed for k in REQUIRED_KEYS):
                raise ValueError(f"Invalid response format from model (missing keys: {REQUIRED_KEYS})")

            # Normalize + clamp
            parsed["answer"] = str(parsed.get("answer", "")).strip()
            parsed["reasoning"] = str(parsed.get("reasoning", "")).strip()
            parsed["confidence"] = _clamp_confidence(parsed.get("confidence"))

            # Optional: keep answers from being insanely long
            if len(parsed["answer"]) > 1200:
                parsed["answer"] = parsed["answer"][:1200].rstrip() + "…"

            return parsed

        except Exception as e:
            last_error = e
            # Try again unless this was the final attempt
            if attempt == retries:
                raise RuntimeError(
                    f"Failed to generate answer after {retries + 1} attempts: {str(last_error)}"
                ) from last_error

    # Should never reach here
    raise RuntimeError("Unexpected failure in generate_answer")
