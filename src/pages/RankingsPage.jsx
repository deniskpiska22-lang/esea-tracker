import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";

import teams from "../data/teams";
import { supabase } from "../lib/supabaseClient";


const DIVISIONS = [
  "All",
  "Advanced",
  "Main",
  "Intermediate",
  "Entry",
];

const REGIONS = [
  "All",
  "Europe",
  "North America",
  "South America",
  "Asia",
  "Oceania",
  "Africa",
];

const REGION_BY_COUNTRY = {
  AL: "Europe",
  AD: "Europe",
  AT: "Europe",
  BA: "Europe",
  BE: "Europe",
  BG: "Europe",
  BY: "Europe",
  CH: "Europe",
  CY: "Europe",
  CZ: "Europe",
  DE: "Europe",
  DK: "Europe",
  EE: "Europe",
  ES: "Europe",
  FI: "Europe",
  FR: "Europe",
  GB: "Europe",
  GE: "Europe",
  GR: "Europe",
  HR: "Europe",
  HU: "Europe",
  IE: "Europe",
  IS: "Europe",
  IT: "Europe",
  LI: "Europe",
  LT: "Europe",
  LU: "Europe",
  LV: "Europe",
  MC: "Europe",
  MD: "Europe",
  ME: "Europe",
  MK: "Europe",
  MT: "Europe",
  NL: "Europe",
  NO: "Europe",
  PL: "Europe",
  PT: "Europe",
  RO: "Europe",
  RS: "Europe",
  RU: "Europe",
  SE: "Europe",
  SI: "Europe",
  SK: "Europe",
  SM: "Europe",
  TR: "Europe",
  UA: "Europe",

  US: "North America",
  CA: "North America",
  MX: "North America",
  CR: "North America",
  CU: "North America",
  DO: "North America",
  GT: "North America",
  HN: "North America",
  JM: "North America",
  PA: "North America",
  PR: "North America",

  AR: "South America",
  BO: "South America",
  BR: "South America",
  CL: "South America",
  CO: "South America",
  EC: "South America",
  PE: "South America",
  PY: "South America",
  UY: "South America",
  VE: "South America",

  AM: "Asia",
  AZ: "Asia",
  BD: "Asia",
  CN: "Asia",
  HK: "Asia",
  ID: "Asia",
  IL: "Asia",
  IN: "Asia",
  IQ: "Asia",
  IR: "Asia",
  JP: "Asia",
  JO: "Asia",
  KG: "Asia",
  KH: "Asia",
  KR: "Asia",
  KZ: "Asia",
  LB: "Asia",
  LK: "Asia",
  MN: "Asia",
  MY: "Asia",
  NP: "Asia",
  PH: "Asia",
  PK: "Asia",
  QA: "Asia",
  SA: "Asia",
  SG: "Asia",
  SY: "Asia",
  TH: "Asia",
  TJ: "Asia",
  TM: "Asia",
  TW: "Asia",
  AE: "Asia",
  UZ: "Asia",
  VN: "Asia",

  AU: "Oceania",
  NZ: "Oceania",
  FJ: "Oceania",

  DZ: "Africa",
  EG: "Africa",
  GH: "Africa",
  KE: "Africa",
  MA: "Africa",
  NG: "Africa",
  TN: "Africa",
  ZA: "Africa",
};

const COUNTRY_NAMES = {
  AL: "Albania",
  AD: "Andorra",
  AR: "Argentina",
  AM: "Armenia",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BA: "Bosnia and Herzegovina",
  BD: "Bangladesh",
  BE: "Belgium",
  BG: "Bulgaria",
  BO: "Bolivia",
  BR: "Brazil",
  BY: "Belarus",
  CA: "Canada",
  CH: "Switzerland",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  CR: "Costa Rica",
  CU: "Cuba",
  CY: "Cyprus",
  CZ: "Czechia",
  DE: "Germany",
  DK: "Denmark",
  DO: "Dominican Republic",
  DZ: "Algeria",
  EC: "Ecuador",
  EE: "Estonia",
  EG: "Egypt",
  ES: "Spain",
  FI: "Finland",
  FJ: "Fiji",
  FR: "France",
  GB: "United Kingdom",
  GE: "Georgia",
  GH: "Ghana",
  GR: "Greece",
  GT: "Guatemala",
  HK: "Hong Kong",
  HN: "Honduras",
  HR: "Croatia",
  HU: "Hungary",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IN: "India",
  IQ: "Iraq",
  IR: "Iran",
  IS: "Iceland",
  IT: "Italy",
  JM: "Jamaica",
  JO: "Jordan",
  JP: "Japan",
  KE: "Kenya",
  KG: "Kyrgyzstan",
  KH: "Cambodia",
  KR: "South Korea",
  KZ: "Kazakhstan",
  LB: "Lebanon",
  LI: "Liechtenstein",
  LK: "Sri Lanka",
  LT: "Lithuania",
  LU: "Luxembourg",
  LV: "Latvia",
  MA: "Morocco",
  MC: "Monaco",
  MD: "Moldova",
  ME: "Montenegro",
  MK: "North Macedonia",
  MN: "Mongolia",
  MT: "Malta",
  MX: "Mexico",
  MY: "Malaysia",
  NG: "Nigeria",
  NL: "Netherlands",
  NO: "Norway",
  NP: "Nepal",
  NZ: "New Zealand",
  PA: "Panama",
  PE: "Peru",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  PR: "Puerto Rico",
  PT: "Portugal",
  PY: "Paraguay",
  QA: "Qatar",
  RO: "Romania",
  RS: "Serbia",
  RU: "Russia",
  SA: "Saudi Arabia",
  SE: "Sweden",
  SG: "Singapore",
  SI: "Slovenia",
  SK: "Slovakia",
  SM: "San Marino",
  SY: "Syria",
  TH: "Thailand",
  TJ: "Tajikistan",
  TM: "Turkmenistan",
  TN: "Tunisia",
  TR: "Turkey",
  TW: "Taiwan",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VE: "Venezuela",
  VN: "Vietnam",
  ZA: "South Africa",
};

const POPULAR_COUNTRIES_BY_REGION = {
  Europe: [
    "DK",
    "FI",
    "FR",
    "DE",
    "NL",
    "NO",
    "PL",
    "PT",
    "RO",
    "RU",
    "SE",
    "TR",
    "UA",
    "GB",
  ],

  "North America": [
    "US",
    "CA",
    "MX",
  ],

  "South America": [
    "BR",
    "AR",
    "CL",
    "PE",
    "UY",
  ],

  Asia: [
    "CN",
    "MN",
    "JP",
    "KR",
    "IN",
    "IL",
    "KZ",
  ],

  Oceania: [
    "AU",
    "NZ",
  ],

  Africa: [
    "ZA",
    "EG",
    "MA",
    "TN",
  ],
};

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeSlug(value) {
  return normalizeText(value)
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9а-яё-]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCountry(value) {
  const country = String(value ?? "")
    .trim()
    .toUpperCase();

  if (country === "UK") {
    return "GB";
  }

  return country;
}

function normalizeDivision(value) {
  const division = normalizeText(value);

  if (division.includes("advanced")) {
    return "Advanced";
  }

  if (division.includes("intermediate")) {
    return "Intermediate";
  }

  if (division.includes("entry")) {
    return "Entry";
  }

  if (division.includes("main")) {
    return "Main";
  }

  return value ? String(value) : "—";
}

function getRatingRowSlug(row) {
  return (
    row?.team_slug ??
    row?.slug ??
    row?.teamSlug ??
    ""
  );
}

function getRatingRowId(row) {
  return (
    row?.team_id ??
    row?.teamId ??
    row?.faceit_team_id ??
    row?.faceitTeamId ??
    row?.id ??
    null
  );
}

function getRatingRowName(row) {
  return (
    row?.team_name ??
    row?.name ??
    row?.teamName ??
    ""
  );
}

function getRatingValue(row) {
  const value =
    row?.points ??
    row?.rating ??
    row?.current_rating ??
    row?.currentRating ??
    row?.elo ??
    row?.score;

  const number = Number(value);

  return Number.isFinite(number)
    ? Math.round(number)
    : null;
}

function getInitialRatingValue(row) {
  const value =
    row?.initial_points ??
    row?.initial_rating ??
    row?.initialPoints ??
    row?.initialRating ??
    row?.starting_rating ??
    row?.startingRating;

  const number = Number(value);

  return Number.isFinite(number)
    ? Math.round(number)
    : null;
}

function getPreviousRatingValue(row) {
  const value =
    row?.previous_points ??
    row?.previous_rating ??
    row?.previousPoints ??
    row?.previousRating;

  const number = Number(value);

  return Number.isFinite(number)
    ? Math.round(number)
    : null;
}

function getPointsChange(
  row,
  period = "update"
) {
  const value =
    period === "week"
      ? (
          row?.weekly_points_change ??
          row?.weeklyPointsChange
        )
      : (
          row?.points_change ??
          row?.rating_change ??
          row?.pointsChange ??
          row?.ratingChange
        );

  const number = Number(value);

  return Number.isFinite(number)
    ? Math.round(number)
    : 0;
}

function getRankChange(
  row,
  period = "update"
) {
  const value =
    period === "week"
      ? (
          row?.weekly_rank_change ??
          row?.weeklyRankChange
        )
      : (
          row?.rank_change ??
          row?.position_change ??
          row?.rankChange ??
          row?.positionChange
        );

  const number = Number(value);

  return Number.isFinite(number)
    ? Math.round(number)
    : 0;
}

function getLogo(staticTeam, ratingRow) {
  return (
    staticTeam?.logo ??
    staticTeam?.logoUrl ??
    staticTeam?.logo_url ??
    staticTeam?.avatar ??
    ratingRow?.logo ??
    ratingRow?.logo_url ??
    null
  );
}

function getCountry(staticTeam, ratingRow) {
  return normalizeCountry(
    staticTeam?.country ??
      staticTeam?.countryCode ??
      staticTeam?.country_code ??
      ratingRow?.country ??
      ratingRow?.country_code ??
      ""
  );
}

function getDivision(staticTeam, ratingRow) {
  return normalizeDivision(
    staticTeam?.division ??
      staticTeam?.leagueDivision ??
      ratingRow?.division ??
      ratingRow?.league_division ??
      ""
  );
}

function getFlagUrl(country) {
  if (!country || country.length !== 2) {
    return null;
  }

  return `https://flagcdn.com/24x18/${country.toLowerCase()}.png`;
}

function ChangeText({
  value,
  inverse = false,
}) {
  const change = Number(value) || 0;

  if (change === 0) {
    return null;
  }

  const positive = inverse
    ? change < 0
    : change > 0;

  return (
    <span
      className={`ml-2 inline-flex min-w-[34px] items-center text-xs font-bold ${
        positive
          ? "text-emerald-400"
          : "text-red-400"
      }`}
    >
      {change > 0 ? `+${change}` : change}
    </span>
  );
}

function TeamLogo({
  src,
  name,
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/[0.04] text-sm font-bold text-gray-500">
        {String(name || "?")
          .trim()
          .slice(0, 1)
          .toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      className="h-10 w-10 shrink-0 object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function CountryFlag({
  country,
  name,
}) {
  const [failed, setFailed] = useState(false);
  const flagUrl = getFlagUrl(country);

  if (!flagUrl || failed) {
    return (
      <div
        className="h-[18px] w-6 shrink-0 rounded-sm border border-white/10 bg-white/[0.04]"
        title={country || "Unknown country"}
      />
    );
  }

  return (
    <img
      src={flagUrl}
      alt={name || country}
      title={name || country}
      className="h-[18px] w-6 shrink-0 rounded-sm object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function RankingsPage() {
  const [ratingRows, setRatingRows] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");

  const [
    selectedDivision,
    setSelectedDivision,
  ] = useState("All");

  const [
    selectedRegion,
    setSelectedRegion,
  ] = useState("All");

  const [
    selectedCountry,
    setSelectedCountry,
  ] = useState("All");

  const [openRegion, setOpenRegion] =
    useState(null);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [changePeriod, setChangePeriod] =
    useState("update");

  useEffect(() => {
    let mounted = true;

    async function loadRatings() {
      if (!supabase) {
        if (mounted) {
          setError(
            "Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
          );
          setLoading(false);
        }

        return;
      }

      setLoading(true);
      setError("");

      // PostgREST caps an unbounded select() at 1000 rows — with 1092+
      // teams in team_ratings, that silently dropped whichever ~90 rows
      // happened to sort last, with no error to surface. Page through
      // .range() until a page comes back short instead.
      const PAGE_SIZE = 1000;
      const allRows = [];
      let requestError = null;

      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error: pageError } =
          await supabase
            .from("team_ratings")
            .select("*")
            .range(from, from + PAGE_SIZE - 1);

        if (pageError) {
          requestError = pageError;
          break;
        }

        const page = Array.isArray(data) ? data : [];
        allRows.push(...page);

        if (page.length < PAGE_SIZE) {
          break;
        }
      }

      if (!mounted) {
        return;
      }

      if (requestError) {
        console.error(
          "Failed to load team ratings:",
          requestError
        );

        setError(
          requestError.message ||
            "Failed to load team ratings."
        );
        setRatingRows([]);
        setLoading(false);
        return;
      }

      setRatingRows(allRows);
      setLoading(false);
    }

    loadRatings();

    let channel = null;

    if (supabase) {
      channel = supabase
        .channel("team-ratings-rankings-page")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "team_ratings",
          },
          () => {
            loadRatings();
          }
        )
        .subscribe();
    }

    return () => {
      mounted = false;

      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const staticTeams = useMemo(
    () =>
      Array.isArray(teams)
        ? teams
        : [],
    []
  );

  const staticTeamIndexes = useMemo(() => {
    const bySlug = new Map();
    const byId = new Map();
    const byName = new Map();

    staticTeams.forEach((team) => {
      const slug = normalizeSlug(team?.slug);
      const id = String(
        team?.id ??
          team?.teamId ??
          team?.faceitTeamId ??
          team?.faceit_team_id ??
          ""
      ).trim();
      const name = normalizeText(team?.name);

      if (slug) {
        bySlug.set(slug, team);
      }

      if (id) {
        byId.set(id, team);
      }

      if (name) {
        byName.set(name, team);
      }
    });

    return {
      bySlug,
      byId,
      byName,
    };
  }, [staticTeams]);

  const mergedTeams = useMemo(() => {
    const fromRatings = ratingRows
      .map((ratingRow) => {
        const ratingSlug = normalizeSlug(
          getRatingRowSlug(ratingRow)
        );

        const ratingId = String(
          getRatingRowId(ratingRow) ?? ""
        ).trim();

        const ratingName = normalizeText(
          getRatingRowName(ratingRow)
        );

        const staticTeam =
          staticTeamIndexes.bySlug.get(
            ratingSlug
          ) ??
          staticTeamIndexes.byId.get(
            ratingId
          ) ??
          staticTeamIndexes.byName.get(
            ratingName
          ) ??
          null;

        const name =
          staticTeam?.name ??
          getRatingRowName(ratingRow) ??
          "Unknown team";

        const slug =
          staticTeam?.slug ??
          getRatingRowSlug(ratingRow) ??
          normalizeSlug(name);

        const rating =
          getRatingValue(ratingRow);

        if (rating === null) {
          return null;
        }

        const country = getCountry(
          staticTeam,
          ratingRow
        );

        const division = getDivision(
          staticTeam,
          ratingRow
        );

        return {
          id:
            getRatingRowId(ratingRow) ??
            staticTeam?.id ??
            slug,
          slug,
          name,
          logo: getLogo(
            staticTeam,
            ratingRow
          ),
          country,
          region:
            REGION_BY_COUNTRY[country] ??
            "Other",
          division,
          points: rating,
          pointsChange: getPointsChange(ratingRow, changePeriod),
          rankChange: getRankChange(ratingRow, changePeriod),
        };
      })
      .filter(Boolean);

    return fromRatings;
  }, [
    ratingRows,
    staticTeamIndexes,
  ]);

  const sortedTeams = useMemo(() => {
    return [...mergedTeams]
      .sort((first, second) => {
        const pointsDifference =
          second.points - first.points;

        if (pointsDifference !== 0) {
          return pointsDifference;
        }

        return String(
          first.name
        ).localeCompare(
          String(second.name),
          "en"
        );
      })
      .map((team, index) => ({
        ...team,
        rank: index + 1,
      }));
  }, [mergedTeams]);

const teamCountByCountry = useMemo(() => {
  const counts = {};

  sortedTeams.forEach((team) => {
    if (!team.country) {
      return;
    }

    counts[team.country] =
      (counts[team.country] || 0) + 1;
  });

  return counts;
}, [sortedTeams]);

const teamCountByRegion = useMemo(() => {
  const counts = {};

  sortedTeams.forEach((team) => {
    if (!team.region || team.region === "Other") {
      return;
    }

    counts[team.region] =
      (counts[team.region] || 0) + 1;
  });

  return counts;
}, [sortedTeams]);

const openedRegionCountries = useMemo(() => {
  if (!openRegion) {
    return [];
  }

  return (
    POPULAR_COUNTRIES_BY_REGION[openRegion] || []
  ).filter(
    (countryCode) =>
      Number(teamCountByCountry[countryCode]) > 0
  );
}, [openRegion, teamCountByCountry]);

const visibleCountryGroups = useMemo(() => {
  const regions =
    selectedRegion === "All"
      ? [
          "North America",
          "South America",
          "Europe",
          "Asia",
          "Oceania",
          "Africa",
        ]
      : [selectedRegion];

  return regions
    .map((region) => {
      const countries =
        POPULAR_COUNTRIES_BY_REGION[region] || [];

      const availablePopularCountries =
        countries.filter(
          (countryCode) =>
            Number(
              teamCountByCountry[countryCode]
            ) > 0
        );

      return {
        region,
        countries:
          availablePopularCountries,
      };
    })
    .filter(
      (group) =>
        group.countries.length > 0
    );
}, [
  selectedRegion,
  teamCountByCountry,
]);

useEffect(() => {
  if (selectedCountry === "All") {
    return;
  }

  const countryRegion =
    REGION_BY_COUNTRY[selectedCountry];

  if (
    selectedRegion !== "All" &&
    countryRegion !== selectedRegion
  ) {
    setSelectedCountry("All");
  }
}, [
  selectedRegion,
  selectedCountry,
]);

  const filteredTeams = useMemo(() => {
    const query = normalizeText(
      searchQuery
    );

    return sortedTeams
  .filter((team) => {
    const divisionMatches =
      selectedDivision === "All" ||
      team.division === selectedDivision;

    const regionMatches =
      selectedRegion === "All" ||
      team.region === selectedRegion;

    const countryMatches =
      selectedCountry === "All" ||
      team.country === selectedCountry;

    const countryName =
      COUNTRY_NAMES[team.country] ??
      team.country;

    const searchMatches =
      !query ||
      normalizeText(team.name).includes(query) ||
      normalizeText(team.slug).includes(query) ||
      normalizeText(countryName).includes(query);

    return (
      divisionMatches &&
      regionMatches &&
      countryMatches &&
      searchMatches
    );
  })
  .map((team, index) => ({
    ...team,
    displayRank: index + 1,
  }));
  }, [
    sortedTeams,
    selectedDivision,
    selectedRegion,
    selectedCountry,
    searchQuery,
  ]);

  const filtersActive =
    selectedDivision !== "All" ||
    selectedRegion !== "All" ||
    selectedCountry !== "All" ||
    searchQuery.trim() !== "";

  function clearFilters() {
    setSelectedDivision("All");
    setSelectedRegion("All");
    setSelectedCountry("All");
    setOpenRegion(null);
    setSearchQuery("");
  }

  function handleRegionClick(region) {
    if (region === "All") {
      setSelectedRegion("All");
      setSelectedCountry("All");
      setOpenRegion(null);
      return;
    }

    setSelectedRegion(region);
    setSelectedCountry("All");
    setOpenRegion((currentRegion) =>
      currentRegion === region ? null : region
    );
  }

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Team Rankings
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              ESEA team ranking based on match results
            </p>
          </div>

          <div className="rounded-lg border border-white/5 bg-[#0c1016] px-4 py-2 text-sm text-gray-400">
            Teams:{" "}
            <span className="font-bold text-white">
              {filteredTeams.length}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#0a0e14] p-4">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
              Division
            </div>

            <div className="flex flex-wrap gap-2">
              {DIVISIONS.map(
                (division) => (
                  <button
                    type="button"
                    key={division}
                    onClick={() =>
                      setSelectedDivision(
                        division
                      )
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      selectedDivision ===
                      division
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-500/10"
                        : "border border-white/5 bg-[#0f131a] text-gray-300 hover:border-white/10 hover:bg-[#121a25]"
                    }`}
                  >
                    {division}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Region
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => handleRegionClick("All")}
                    className={`flex h-11 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm font-semibold transition ${
                      selectedRegion === "All"
                        ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/10"
                        : "border-white/5 bg-[#0f131a] text-gray-300 hover:border-orange-500/20 hover:bg-[#121a25]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="text-base">🌍</span>
                      <span className="truncate">World</span>
                    </span>

                    <span
                      className={`shrink-0 text-xs ${
                        selectedRegion === "All"
                          ? "text-white/80"
                          : "text-gray-600"
                      }`}
                    >
                      {sortedTeams.length}
                    </span>
                  </button>

                  {REGIONS.filter(
                    (region) => region !== "All"
                  ).map((region) => {
                    const active =
                      selectedRegion === region;

                    const opened =
                      openRegion === region;

                    return (
                      <button
                        type="button"
                        key={region}
                        onClick={() =>
                          handleRegionClick(region)
                        }
                        className={`flex h-11 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm font-semibold transition ${
                          active
                            ? "border-orange-500/50 bg-orange-500/15 text-orange-400"
                            : "border-white/5 bg-[#0f131a] text-gray-300 hover:border-orange-500/20 hover:bg-[#121a25]"
                        }`}
                      >
                        <span className="min-w-0 truncate">
                          {region}
                        </span>

                        <span className="flex shrink-0 items-center gap-2">
                          <span
                            className={`text-xs ${
                              active
                                ? "text-orange-300"
                                : "text-gray-600"
                            }`}
                          >
                            {teamCountByRegion[region] || 0}
                          </span>

                          <span
                            className={`text-xs transition-transform duration-200 ${
                              opened ? "rotate-180" : ""
                            }`}
                          >
                            ▼
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="ranking-search"
                  className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500"
                >
                  Search
                </label>

                <input
                  id="ranking-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(event.target.value)
                  }
                  placeholder="Search team..."
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#0f131a] px-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-orange-500/60"
                />
              </div>
            </div>

            {openRegion && (
              <div className="mt-3 overflow-hidden rounded-xl border border-orange-500/15 bg-[#080c12]">
                <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {openRegion}
                    </div>

                    <div className="mt-0.5 text-xs text-gray-500">
                      Choose a country or keep the whole region selected
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpenRegion(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] text-gray-500 transition hover:border-white/10 hover:text-white"
                    aria-label="Close country selector"
                  >
                    ×
                  </button>
                </div>

                <div className="p-3">
                  {openedRegionCountries.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-gray-500">
                      No countries with ranked teams found in this region.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRegion(openRegion);
                          setSelectedCountry("All");
                        }}
                        className={`flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                          selectedCountry === "All" &&
                          selectedRegion === openRegion
                            ? "bg-orange-500/15 text-orange-400"
                            : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <span className="text-base">🌐</span>

                        <span className="min-w-0 flex-1 truncate">
                          All {openRegion}
                        </span>

                        <span className="shrink-0 text-xs text-gray-600">
                          {teamCountByRegion[openRegion] || 0}
                        </span>
                      </button>

                      {openedRegionCountries.map(
                        (countryCode) => {
                          const active =
                            selectedCountry === countryCode;

                          const countryName =
                            COUNTRY_NAMES[countryCode] ||
                            countryCode;

                          const count =
                            teamCountByCountry[countryCode] || 0;

                          return (
                            <button
                              type="button"
                              key={countryCode}
                              onClick={() => {
                                setSelectedRegion(openRegion);
                                setSelectedCountry(
                                  active ? "All" : countryCode
                                );
                              }}
                              className={`flex min-h-10 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                                active
                                  ? "bg-orange-500/15 text-orange-400"
                                  : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                              }`}
                            >
                              <CountryFlag
                                country={countryCode}
                                name={countryName}
                              />

                              <span className="min-w-0 flex-1 truncate">
                                {countryName}
                              </span>

                              <span
                                className={`shrink-0 text-xs ${
                                  active
                                    ? "text-orange-300"
                                    : "text-gray-600"
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {filtersActive && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-[#070a0f] px-4 py-3">
              <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                {selectedDivision !==
                  "All" && (
                  <span className="rounded-md bg-white/5 px-2 py-1">
                    Division:{" "}
                    <strong className="text-white">
                      {selectedDivision}
                    </strong>
                  </span>
                )}

                {selectedRegion !==
                  "All" && (
                  <span className="rounded-md bg-white/5 px-2 py-1">
                    Region:{" "}
                    <strong className="text-white">
                      {selectedRegion}
                    </strong>
                  </span>
                )}

                {selectedCountry !==
                  "All" && (
                  <span className="rounded-md bg-white/5 px-2 py-1">
                    Country:{" "}
                    <strong className="text-white">
                      {COUNTRY_NAMES[
                        selectedCountry
                      ] ??
                        selectedCountry}
                    </strong>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-semibold text-orange-400 transition hover:text-orange-300"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      
      <div className="mx-auto max-w-7xl px-4 pt-5 md:px-8">
        <div className="flex items-center justify-end gap-2">
          <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600">
            Changes
          </span>

          <button
            type="button"
            onClick={() => setChangePeriod("update")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              changePeriod === "update"
                ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                : "border-white/5 bg-[#0f131a] text-gray-500 hover:text-white"
            }`}
          >
            Last update
          </button>

          <button
            type="button"
            onClick={() => setChangePeriod("week")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              changePeriod === "week"
                ? "border-orange-500/30 bg-orange-500/10 text-orange-400"
                : "border-white/5 bg-[#0f131a] text-gray-500 hover:text-white"
            }`}
          >
            7 days
          </button>
        </div>
      </div>

<div className="mx-auto max-w-7xl p-4 md:p-8">
        {loading ? (
          <div className="rounded-xl border border-white/5 bg-[#0c1016] p-10 text-center text-gray-400">
            Loading rankings...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
            <div className="font-semibold text-red-400">
              Failed to load rankings
            </div>

            <div className="mt-2 text-sm text-red-300/80">
              {error}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[110px_minmax(360px,2fr)_190px_170px] rounded-xl border border-white/5 bg-[#0f141a] px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">
                <div>Rank</div>
                <div>Team</div>
                <div>Rating</div>
                <div>Division</div>
              </div>

              <div className="mt-3 space-y-2">
                {filteredTeams.length ===
                0 ? (
                  <div className="rounded-xl border border-white/5 bg-[#0c1016] p-10 text-center text-gray-500">
                    No teams found
                  </div>
                ) : (
                  filteredTeams.map(
                    (team) => {
                      const countryName =
                        COUNTRY_NAMES[
                          team.country
                        ] ??
                        team.country ??
                        "Unknown country";

                      return (
                        <Link
                          key={
                            team.id ??
                            team.slug
                          }
                          to={`/teams/${team.slug}`}
                          className="group relative grid grid-cols-[110px_minmax(360px,2fr)_190px_170px] items-center overflow-hidden rounded-xl border border-white/5 bg-[#0c1016] px-4 py-3 transition-all duration-200 hover:z-10 hover:-translate-y-[2px] hover:border-orange-500/20 hover:bg-[#121a25] hover:shadow-[0_14px_35px_rgba(0,0,0,0.6)]"
                        >
                          <div className="flex items-center font-bold">
                            <span
                              className={
                                team.rank <= 3
                                  ? "text-orange-400"
                                  : "text-gray-300"
                              }
                            >
                              #{team.displayRank}
                            </span>

                            <ChangeText
                              value={
                                team.rankChange
                              }
                            />
                          </div>

                          <div className="flex min-w-0 items-center gap-3">
                            <CountryFlag
                              country={
                                team.country
                              }
                              name={
                                countryName
                              }
                            />

                            <TeamLogo
                              src={team.logo}
                              name={team.name}
                            />

                            <div className="min-w-0">
                              <div className="truncate font-semibold text-white transition group-hover:text-orange-400">
                                {team.name}
                              </div>

                              <div className="mt-0.5 truncate text-xs text-gray-600">
                                {countryName}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center">
                            <span className="text-base font-bold text-white">
                              {team.points}
                            </span>

                            <ChangeText
                              value={
                                team.pointsChange
                              }
                            />
                          </div>

                          <div>
                            <span className="inline-flex rounded-md border border-orange-500/15 bg-orange-500/5 px-2.5 py-1 text-sm font-semibold text-orange-400">
                              {team.division ||
                                "—"}
                            </span>
                          </div>
                        </Link>
                      );
                    }
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RankingsPage;