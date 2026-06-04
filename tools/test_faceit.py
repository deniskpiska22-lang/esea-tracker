import requests

url = "https://www.faceit.com/api/team-leagues/v2/teams/seasons/a4ec16e0-348c-455c-aaf3-96711737c397/registrations"

r = requests.get(url)

print("Status:", r.status_code)
print(r.text[:1000])