import requests
import json

API_KEY = "1f7e7c47-0d9b-403e-9007-acd463de617b"

championship_id = "83fc05fb-0f31-42e3-82c3-96c6dc16660a"

url = f"https://open.faceit.com/data/v4/championships/{championship_id}"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0"
}

r = requests.get(url, headers=headers, timeout=20)

print("STATUS:", r.status_code)

try:
    data = r.json()
    print(json.dumps(data, indent=2, ensure_ascii=False)[:5000])
except Exception:
    print(r.text[:5000])