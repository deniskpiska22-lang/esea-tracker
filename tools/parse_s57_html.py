import json
import requests
from bs4 import BeautifulSoup
import re

# Список стран СНГ
CIS_COUNTRIES = {"RU", "BY", "KZ"}

# Ссылки на страницы всех дивизионов и групп
DIVISION_URLS = [
    "https://www.faceit.com/ru/cs2/league/ESEA%20League/.../teams?division=9b867789-2ed4-4ef5-8ab5-9b0e09d4e32f", # Advanced
    "https://www.faceit.com/ru/cs2/league/ESEA%20League/.../teams?division=0c1466a0-2b92-413b-ac90-e0eb71a7b05c", # Main A+B
    "https://www.faceit.com/ru/cs2/league/ESEA%20League/.../teams?division=83f5519f-1cc1-4f0f-9aa0-ec73bfdc5870", # Intermediate A-D
    "https://www.faceit.com/ru/cs2/league/ESEA%20League/.../teams?division=269c4aaa-eb86-4d3d-bd89-ef766c789c1a", # Entry A-D
]

OUTPUT_JSON = "tools/cis_teams.json"
OUTPUT_JS = "src/data/autoTeams.js"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

def make_slug(name):
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")

def country_to_flag(country):
    flags = {"RU": "/flags/russia.svg", "BY": "/flags/bel.svg", "KZ": "/flags/kaz.svg"}
    return flags.get(country, "/flags/unknown.svg")

all_teams = []
seen_team_ids = set()

for url in DIVISION_URLS:
    r = requests.get(url, headers=HEADERS)
    if r.status_code != 200:
        print(f"Ошибка при запросе {url}: {r.status_code}")
        continue
    soup = BeautifulSoup(r.text, "html.parser")

    # Найти все блоки команд (пример, может потребоваться точный селектор по классу)
    for team_div in soup.select(".css-1qxp2h7"):  # <- пример, уточнить под HTML Faceit
        team_name = team_div.get_text(strip=True)
        country_code = team_div.get("data-country")  # пример атрибута, уточнить
        avatar = team_div.find("img")["src"] if team_div.find("img") else ""
        league_team_id = team_div.get("data-id")  # пример атрибута, уточнить

        if not country_code or country_code not in CIS_COUNTRIES:
            continue
        if league_team_id in seen_team_ids:
            continue
        seen_team_ids.add(league_team_id)

        all_teams.append({
            "slug": make_slug(team_name),
            "name": team_name,
            "logo": avatar,
            "flag": country_to_flag(country_code),
            "division": "Unknown",
            "stats": {"wins": 0, "losses": 0},
            "players": [],
            "matches": [],
            "faceit": {"team_id": league_team_id, "status": "REGISTERED", "country": country_code},
        })

print(f"Найдено команд СНГ: {len(all_teams)}")

# Сохраняем JSON
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(all_teams, f, ensure_ascii=False, indent=2)

# Генерируем JS
js_content = "const autoTeams = " + json.dumps(all_teams, ensure_ascii=False, indent=2)
js_content += "\n\nexport default autoTeams\n"

with open(OUTPUT_JS, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Сохранено в {OUTPUT_JSON} и {OUTPUT_JS}")