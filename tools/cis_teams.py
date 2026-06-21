import json

CIS_COUNTRIES = {
    "RU",
    "UA",
    "BY",
    "KZ",
    "UZ",
    "KG",
    "TJ",
    "TM",
    "AM",
    "AZ",
    "MD"
}

with open("tools/teams.json", "r", encoding="utf-8") as f:
    data = json.load(f)

cis_teams = []

for team in data.get("payload", []):
    country = team.get("country_code")

    if country in CIS_COUNTRIES:
        cis_teams.append({
            "name": team.get("name"),
            "nickname": team.get("nickname"),
            "country": country,
            "team_id": team.get("league_team_id"),
            "avatar": team.get("avatar_url"),
            "status": team.get("status")
        })

print(f"Найдено СНГ команд: {len(cis_teams)}")

for team in cis_teams:
    print(f"{team['country']} | {team['name']}")

with open(
    "tools/cis_teams.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        cis_teams,
        f,
        ensure_ascii=False,
        indent=2
    )

print("\nСохранено в tools/cis_teams.json")