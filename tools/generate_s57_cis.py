import json
import requests
import re

# Конфигурация
SEASON_ID = "a4ec16e0-348c-455c-aaf3-96711737c397"  # S57
DIVISION_IDS = {
    "Advanced": ["9b867789-2ed4-4ef5-8ab5-9b0e09d4e32f"],
    "Main": ["0c1466a0-2b92-413b-ac90-e0eb71a7b05c"],  # A+B группы
    "Intermediate": ["83f5519f-1cc1-4f0f-9aa0-ec73bfdc5870"],  # A–D группы
    "Entry": ["269c4aaa-eb86-4d3d-bd89-ef766c789c1a"],  # A–D группы
}

CIS_COUNTRIES = {"RU", "BY", "KZ"}

OUTPUT_JSON = "tools/cis_teams.json"
OUTPUT_JS = "src/data/autoTeams.js"

# Вспомогательные функции
def make_slug(name):
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")

def country_to_flag(country):
    flags = {"RU": "/flags/russia.svg", "BY": "/flags/bel.svg", "KZ": "/flags/kaz.svg"}
    return flags.get(country, "/flags/unknown.svg")

def fetch_teams(season_id, division_id):
    url = f"https://www.faceit.com/api/team-leagues/v2/teams/seasons/{season_id}/registrations"
    r = requests.get(url, params={"division_id": division_id})
    if r.status_code != 200:
        print(f"Ошибка запроса для division {division_id}: {r.status_code}")
        return []
    return r.json().get("payload", [])

# Собираем все команды
all_teams = []

for div_name, ids in DIVISION_IDS.items():
    for div_id in ids:
        teams = fetch_teams(SEASON_ID, div_id)
        for t in teams:
            t["division"] = div_name
        all_teams.extend(teams)

print(f"Всего команд получено: {len(all_teams)}")

# Фильтруем СНГ и убираем дубликаты по league_team_id
unique_teams = {}
for team in all_teams:
    country = team.get("country_code")
    if country not in CIS_COUNTRIES:
        continue
    team_id = team.get("league_team_id")
    if team_id in unique_teams:
        continue
    unique_teams[team_id] = {
        "slug": make_slug(team.get("name")),
        "name": team.get("name"),
        "logo": team.get("avatar_url", ""),
        "flag": country_to_flag(country),
        "division": team.get("division"),
        "stats": {"wins": 0, "losses": 0},
        "players": [],
        "matches": [],
        "faceit": {"team_id": team_id, "status": team.get("status"), "country": country},
    }

auto_teams = list(unique_teams.values())

# Сохраняем JSON
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(auto_teams, f, ensure_ascii=False, indent=2)
print(f"Создан {OUTPUT_JSON} с {len(auto_teams)} командами СНГ")

# Генерируем JS
js_content = "const autoTeams = " + json.dumps(auto_teams, ensure_ascii=False, indent=2)
js_content += "\n\nexport default autoTeams\n"

with open(OUTPUT_JS, "w", encoding="utf-8") as f:
    f.write(js_content)
print(f"Создан {OUTPUT_JS} с {len(auto_teams)} командами СНГ")