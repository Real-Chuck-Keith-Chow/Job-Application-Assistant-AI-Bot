import os
import requests
from openai import OpenAI

BACKEND_URL = "http://localhost:3000"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def match_question(question):
    try:
        response = requests.get(
            f"{BACKEND_URL}/answers",
            params={"question": question}
        )
        
        if response.status_code == 200 and response.json().get("answer"):
            return response.json()["answer"]

        client = OpenAI(api_key=OPENAI_API_KEY)
        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": question}]
        )
        generated_answer = completion.choices[0].message.content

        requests.post(
            f"{BACKEND_URL}/answers",
            json={"question": question, "answer": generated_answer}
        )

        return generated_answer

    except Exception as e:
        print(f"Error: {e}")
        return "I couldn't generate an answer."
