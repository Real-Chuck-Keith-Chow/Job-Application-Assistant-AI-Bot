import os
import json
from openai import OpenAI

# Load API key from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise EnvironmentError("OPENAI_API_KEY environment variable not set")

client = OpenAI(api_key=OPENAI_API_KEY)

SYSTEM_PROMPT = """
You are an AI job application assistant.
You answer professionally, clearly, and honestly.
Avoid generic corporate clichés and buzzwords.
If the question is unclear, ask for clarification instead of guessing.
Keep answers concise and tailored to job applications.
"""

def generate_answer(question, context=None, retries=2):
    """
    Generate a structured answer for a job application question.

    Returns:
        {
            "answer": str,
            "confidence": float (0.0 - 1.0),
            "reasoning": str
        }
    """

    user_prompt = f"""
Question:
{question}

Context:
{context or "None"}

Respond ONLY in valid JSON with:
- answer (string)
- confidence (number between 0.0 and 1.0)
- reasoning (one short sentence)
"""

    for attempt in range(retries + 1):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.4,
                max_tokens=250
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON safely
            parsed = json.loads(content)

            # Basic validation
            if not all(k in parsed for k in ("answer", "confidence", "reasoning")):
                raise ValueError("Invalid response format from model")

            return parsed

        except Exception as e:
            if attempt == retries:
                raise RuntimeError(
                    f"Failed to generate answer after {retries + 1} attempts"
                ) from e
