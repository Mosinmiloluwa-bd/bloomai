import asyncio
import httpx
import os
import sys

# Add project root to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.config import MODEL_CONFIG, settings

async def test_models():
    api_key = settings.CEREBRAS_API_KEY
    if not api_key:
        print("ERROR: CEREBRAS_API_KEY is not set.")
        return

    base_url = settings.model_base_url.rstrip('/')
    models = [MODEL_CONFIG.primary] + MODEL_CONFIG.fallbacks
    
    print(f"Using Cerebras API URL: {base_url}")
    print("-" * 50)

    async with httpx.AsyncClient(timeout=15.0) as client:
        for model in models:
            print(f"Testing model: {model} ... ", end="")
            try:
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": "Reply with only the word 'OK'."}],
                        "max_tokens": 10,
                        "temperature": 0.1
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    print(f"✅ SUCCESS! Response: '{content}'")
                else:
                    print(f"❌ FAILED. Status: {response.status_code}, Error: {response.text}")
            except Exception as e:
                print(f"❌ FAILED. Exception: {str(e)}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(test_models())
