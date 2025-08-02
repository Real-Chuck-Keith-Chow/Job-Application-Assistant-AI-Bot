import os
from openai import OpenAI

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def generate_answer(question, context=None):
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    prompt = f"Answer this job application question: {question}"
    if context:
        prompt += f"\n\nContext: {context}"

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=150
    )
    
    return response.choices[0].message.content.strip()
