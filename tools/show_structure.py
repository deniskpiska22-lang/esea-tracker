import json

with open("tools/season_tree.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for region in data["payload"]["regions"]:
    print("\nREGION:", region["name"])

    for division in region["divisions"]:
        print("\nDIVISION:", division["name"])

        for stage in division["stages"]:
            print("  STAGE:", stage["name"])

            for conf in stage["conferences"]:
                print(
                    "    CONF:",
                    conf["name"],
                    conf["championship_id"]
                )