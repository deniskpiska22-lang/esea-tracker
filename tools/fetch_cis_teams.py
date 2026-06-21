import json
import requests
import re

# Список стран СНГ
CIS_COUNTRIES = {"RU", "BY", "KZ"}

# URL запроса (твой рабочий)
URL = "https://www.faceit.com/api/team-leagues/v2/teams/seasons/a4ec16e0-348c-455c-aaf3-96711737c397/registrations?leagueTeamIds=1ca7f7ac-e0b8-4452-ac68-06ddbb2c65e0&leagueTeamIds=..."  # вставь весь URL

OUTPUT_JSON = "tools/cis_teams.json"
OUTPUT_JS = "src/data/autoTeams.js"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    # если потребуется, вставить токен авторизации
    # "authorization": "Bearer ...",
}

def make_slug(name):
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")

def country_to_flag(country):
    flags = {"RU": "/flags/russia.svg", "BY": "/flags/bel.svg", "KZ": "/flags/kaz.svg"}
    return flags.get(country, "/flags/unknown.svg")

# Получаем команды
r = requests.get(URL, headers=HEADERS)
r.raise_for_status()
data = r.json()

all_teams = []
seen_team_ids = set()

for team in data.get("payload", []):
    country = team.get("country_code")
    if country not in CIS_COUNTRIES:
        continue
    team_id = team.get("league_team_id")
    if team_id in seen_team_ids:
        continue
    seen_team_ids.add(team_id)

    all_teams.append({
        "slug": make_slug(team.get("name")),
        "name": team.get("name"),
        "logo": team.get("avatar_url", ""),
        "flag": country_to_flag(country),
        "division": "Unknown",  # можно добавить логику определения дивизиона
        "stats": {"wins": 0, "losses": 0},
        "players": [],
        "matches": [],
        "faceit": {"team_id": team_id, "status": team.get("status"), "country": country},
    })

# Сохраняем JSON
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(all_teams, f, ensure_ascii=False, indent=2)

# Генерируем JS
js_content = "const autoTeams = " + json.dumps(all_teams, ensure_ascii=False, indent=2)
js_content += "\n\nexport default autoTeams\n"

with open(OUTPUT_JS, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Создан {OUTPUT_JSON} и {OUTPUT_JS} с {len(all_teams)} командами СНГ")