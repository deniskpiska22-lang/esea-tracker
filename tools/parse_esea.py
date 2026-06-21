import json
import requests

API_KEY = "1f7e7c47-0d9b-403e-9007-acd463de617b"
BASE_URL = "https://open.faceit.com/data/v4"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Accept": "application/json"}

def find_s57():
    offset = 0
    limit = 50
    found = False

    while not found:
        r = requests.get(
            f"{BASE_URL}/search/championships",
            headers=HEADERS,
            params={"name": "S57", "limit": limit, "offset": offset},
            timeout=20
        )

        data = r.json()
        items = data.get("items", [])

        if not items:
            print("Больше результатов нет. S57 не найден")
            break

        for item in items:
            if "S57" in item.get("name", ""):
                print("Найден сезон S57:")
                print(item["name"])
                print("Competition ID:", item["competition_id"])
                found = True

        offset += limit

if __name__ == "__main__":
    find_s57()