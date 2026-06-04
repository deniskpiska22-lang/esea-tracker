import json
import re

# Список стран, которые нужны
CIS_COUNTRIES = {"RU", "BY", "KZ"}

# Загрузка JSON со всеми дивизионами
with open("tools/teams.json", "r", encoding="utf-8") as f:
    teams = json.load(f)["payload"]

# Словарь для уникальности по league_team_id
unique_teams = {}

# Функции для slug и флага
def make_slug(name):
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug

def country_to_flag(country):
    flags = {
        "RU": "/flags/russia.svg",
        "BY": "/flags/bel.svg",
        "KZ": "/flags/kaz.svg",
    }
    return flags.get(country, "/flags/unknown.svg")

# Фильтруем
for team in teams:
    country = team.get("country_code")
    division = team.get("division", "Advanced")  # если нет поля division, ставим Advanced

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
        "division": division,
        "stats": {"wins": 0, "losses": 0},
        "players": [],
        "matches": [],
        "faceit": {
            "team_id": team_id,
            "status": team.get("status"),
            "country": country,
        }
    }

auto_teams = list(unique_teams.values())

# Генерация JS
js_content = "const autoTeams = "
js_content += json.dumps(auto_teams, ensure_ascii=False, indent=2)
js_content += "\n\nexport default autoTeams\n"

with open("src/data/autoTeams.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Создан src/data/autoTeams.js с {len(auto_teams)} командами СНГ")