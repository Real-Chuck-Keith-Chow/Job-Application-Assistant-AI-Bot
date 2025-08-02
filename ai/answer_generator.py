import os
import requests
from openai import OpenAI  


BACKEND_URL = "http://localhost:3000" 
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # Or Gemini API key

def match_question(question: str) -> str:
    
    response = requests.get(
        f"{BACKEND_URL}/answers",
        params={"question": question}
    )
    
    if response.status_code == 200 and response.json().get("answer"):
        return response.json()["answer"]  # Use stored answer
    
 
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{
            "role": "user",
            "content": f"Answer this job application question: {question}"
        }]
    )
    
    generated_answer = response.choices[0].message.content
    
    requests.post(
        f"{BACKEND_URL}/answers",
        json={"question": question, "answer": generated_answer}
    )
    
    return generated_answer
