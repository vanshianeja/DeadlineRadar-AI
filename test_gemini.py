import os
from dotenv import load_dotenv
from google import genai

load_dotenv(override=True)

api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "").strip()

if not api_key:
    raise ValueError("API key not found")

if not model_name:
    raise ValueError("Model name not found")

print(f"Testing model: {model_name}")

client = genai.Client(api_key=api_key)

try:
    response = client.models.generate_content(
        model=model_name,
        contents="Reply with: DeadlineRadar AI is connected successfully."
    )

    print("\nSUCCESS!")
    print(response.text)

except Exception as e:
    print("\nAPI Error:")
    print(e)