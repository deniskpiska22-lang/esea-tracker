export const championships = [
  {
    id: "f404458c-3ff0-4b6a-abdf-89a6b13694ca",
    name: "S58 EU Advanced Central - Regular Season",
    season: 58,
    region: "EU",
    division: "Advanced",
    group: "Central",
    stage: "regular",
    active: true,
  },
  {
    id: "54f32bd1-55d3-4353-8818-79f57ef7a65b",
    name: "S58 EU Main A - Regular Season",
    season: 58,
    region: "EU",
    division: "Main",
    group: "A",
    stage: "regular",
    active: true,
  },
  {
    id: "8961a4f3-2860-4545-87db-1ce1e32c7e13",
    name: "S58 EU Main B - Regular Season",
    season: 58,
    region: "EU",
    division: "Main",
    group: "B",
    stage: "regular",
    active: true,
  },
  {
    id: "de368982-42fc-428e-9d2e-cfdbaa7d6363",
    name: "S58 EU Intermediate A - Regular Season",
    season: 58,
    region: "EU",
    division: "Intermediate",
    group: "A",
    stage: "regular",
    active: true,
  },
  {
    id: "b453b0b9-f5e5-4f08-964d-d127691243d0",
    name: "S58 EU Intermediate B - Regular Season",
    season: 58,
    region: "EU",
    division: "Intermediate",
    group: "B",
    stage: "regular",
    active: true,
  },
  ...[
    ["df648492-2f7f-44ac-abbe-1d179a38d7c3", "A"],
    ["c1641aae-0e63-4564-a571-927091687b5b", "B"],
    ["4cc00188-c9af-472d-b2cc-d60091f9834e", "C"],
    ["dde840d0-cb47-49c9-9ac4-a51a11991c42", "D"],
  ].map(([id, group]) => ({
    id,
    name: `S58 EU Entry ${group} - Regular Season`,
    season: 58,
    region: "EU",
    division: "Entry",
    group,
    stage: "regular",
    active: true,
  })),
];

export function findChampionship(value) {
  if (!value) return championships[0];

  const normalized = value.toLowerCase();
  return championships.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.name.toLowerCase().includes(normalized)
  );
}
