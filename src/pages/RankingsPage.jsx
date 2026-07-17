import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import playerTeams from "../data/playerTeams.json";
import playerAverageRatings from "../data/playerAverageRatings.json";

// Добавь сюда свои команды.
const teams = [


  {
    rank: 3,
    slug: "new-vision",
    logo: "/logos/newwision.png",
    flag: "/flags/russia.svg",
    name: "NEW VISION",
    points: 373,
    
    record: "0-0",
    division: "Advanced",
  },
  {
    rank: 4,
    slug: "donstu-esports",
    logo: "/logos/donstu.png",
    flag: "/flags/russia.svg",
    name: "DONSTU ESPORTS",
    points: 398,
    
    record: "0-0",
    division: "Advanced",
  },
   {
    rank: 5,
    slug: "quazar",
    logo: "/logos/quazar.png",
    flag: "/flags/russia.svg",
    name: "QUAZAR",
    points: 420,
    
    record: "0-0",
    division: "Advanced",
  },
    {
    rank: 6,
    slug: "bankapepsi",
    logo: "/logos/pepsi.png",
    flag: "/flags/russia.svg",
    name: "bankaPEPSI",
    points: 349,
    
    record: "0-0",
    division: "Advanced",
  },
    {
    rank: 7,
    slug: "enjoy",
    logo: "/logos/enjoy.png",
    flag: "/flags/russia.svg",
    name: "Enjoy",
    points: 364,
    
    record: "0-0",
    division: "Advanced",
  },
    {
    rank: 8,
    slug: "jumbo-team",
    logo: "/logos/jumbo.png",
    flag: "/flags/russia.svg",
    name: "Jumbo team",
    points: 349,
    
    record: "0-0",
    division: "Advanced",
  },
      {
    rank: 9,
    slug: "aurora-young-blud",
    logo: "/logos/aurora.png",
    name: "Aurora Young Blud",
    flag: "/flags/russia.svg",
    points: 100,
    
    record: "0-0",
    division: "Entry",
  },
       {
    rank: 10,
    slug: "young-tigeres",
    logo: "/logos/youngtigeres.png",
    name: "Young TigeRES",
    flag: "/flags/russia.svg",
    points: 357,
    
    record: "0-0",
    division: "Main",
  },
         {
    rank: 11,
    slug: "vpprodigy",
    logo: "/logos/vpp.png",
    name: "VPProdigy",
    flag: "/flags/russia.svg",
    points: 342,
    
    record: "0-0",
    division: "Advanced",
  },
           {
    rank: 12,
    slug: "arch",
    logo: "/logos/arch.png",
    name: "Arch",
    flag: "/flags/russia.svg",
    points: 359,
    
    record: "0-0",
    division: "Advanced",
  },
            {
    rank: 13,
    slug: "lfo-corh9k",
    logo: "/logos/sornyak.png",
    name: "LFO_COPH9K",
    flag: "/flags/russia.svg",
    points: 339,
    
    record: "0-0",
    division: "Advanced",
  },
              {
    rank: 14,
    slug: "uust",
    logo: "/logos/wingman.png",
    name: "UUST_Esports",
    flag: "/flags/russia.svg",
    points: 373,
    
    record: "0-0",
    division: "Advanced",
  },
               {
    rank: 15,
    slug: "nexora",
    logo: "/logos/peep.png",
    name: "Nexora",
    flag: "/flags/russia.svg",
    points: 325,
    
    record: "0-0",
    division: "Advanced",
  },
                 {
    rank: 16,
    slug: "golovastiki",
    logo: "/logos/vpf2.png",
    name: "golovastiki",
    flag: "/flags/russia.svg",
    points: 331,
    
    record: "0-0",
    division: "Main",
  },
                   {
    rank: 17,
    slug: "gamesport",
    logo: "/logos/gamesport.png",
    name: "GAMESPORT",
    flag: "/flags/russia.svg",
    points: 340,
    
    record: "0-0",
    division: "Main",
  },
                     {
    rank: 18,
    slug: "xcity",
    logo: "/logos/xcity.png",
    name: "Xcity",
    flag: "/flags/russia.svg",
    points: 330,
    
    record: "0-0",
    division: "Main",
  },
                       {
    rank: 19,
    slug: "tsa-green",
    logo: "/logos/tsagreen.png",
    name: "TSA Green",
    flag: "/flags/russia.svg",
    points: 359,
    
    record: "0-0",
    division: "Advanced",
  },
                         {
    rank: 20,
    slug: "mellren",
    logo: "/logos/mellren.png",
    name: "mellren",
    flag: "/flags/bel.svg",
    points: 341,
    
    record: "0-0",
    division: "Advanced",
  },
                           {
    rank: 21,
    slug: "nemesis-academy",
    logo: "/logos/nemesis.png",
    name: "Nemesis Academy",
    flag: "/flags/russia.svg",
    points: 329,
    
    record: "0-0",
    division: "Main",
  },
                           {
    rank: 22,
    slug: "duggedup",
    logo: "/logos/duggedup.png",
    name: "Duggedup",
    flag: "/flags/russia.svg",
    points: 327,
    
    record: "0-0",
    division: "Main",
  },
                            {
    rank: 23,
    slug: "hugo",
    logo: "/logos/hugo.png",
    name: "hugo",
    flag: "/flags/russia.svg",
    points: 314,
    record: "0-0",
    division: "Main",
  },
                            {
    rank: 24,
    slug: "partizan",
    logo: "/logos/partizan.png",
    name: "PARTIZAN",
    flag: "/flags/russia.svg",
    points: 344,
    
    record: "0-0",
    division: "Main",
  },
                            {
    rank: 25,
    slug: "csgopositive",
    logo: "/logos/csgopositive.png",
    name: "CSGOPOSITIVE",
    flag: "/flags/russia.svg",
    points: 338,
    
    record: "0-0",
    division: "Main",
  },
                              {
    rank: 26,
    slug: "graf-monte-cristo",
    logo: "/logos/graf.png",
    name: "Graf Monte-Cristo",
    flag: "/flags/russia.svg",
    points: 344,
    
    record: "0-0",
    division: "Intermediate",
  },
                                      {
    rank: 27,
    slug: "saqa-omuk",
    logo: "/logos/saqa.png",
    name: "SAQA OMUK",
    flag: "/flags/russia.svg",
    points: 326,
    
    record: "0-0",
    division: "Main",
  },
                                    {
    rank: 28,
    slug: "baks-esports",
    logo: "/logos/baks.png",
    name: "BAKS Esports",
    flag: "/flags/russia.svg",
    points: 410,
    
    record: "0-0",
    division: "Main",
  },
                                {
    rank: 29,
    slug: "aogiri",
    logo: "/logos/aogiri.png",
    name: "Aogiri",
    flag: "/flags/russia.svg",
    points: 317,
    
    record: "0-0",
    division: "Main",
  },
  
                              {
    rank: 30,
    slug: "375",
    logo: "/logos/375.png",
    name: "375",
    flag: "/flags/bel.svg",
    points: 312,
    
    record: "0-0",
    division: "Main",
  },
                              {
    rank: 31,
    slug: "wnt",
    logo: "/logos/wnt.png",
    name: "wnT",
    flag: "/flags/russia.svg",
    points: 311,
    
    record: "0-0",
    division: "Main",
  },
                                {
    rank: 32,
    slug: "playfire",
    logo: "/logos/playfire.png",
    name: "playfire",
    flag: "/flags/russia.svg",
    points: 287,
    
    record: "0-0",
    division: "Main",
  },
                                  {
    rank: 36,
    slug: "bhemanha",
    name: "BHemanha",
    flag: "/flags/russia.svg",
    points: 306,
    
    record: "0-0",
    division: "Intermediate",
  },
                                      {
    rank: 37,
    slug: "way-In-future",
    logo: "/logos/way.png",
    name: "Way In Future",
    flag: "/flags/russia.svg",
    points: 316,
    
    record: "0-0",
    division: "Main",
      },

                                      {
    rank: 39,
    slug: "lynx",
    logo: "/logos/lynx.png",
    name: "LYNX",
    flag: "/flags/russia.svg",
    points: 321,
    
    record: "0-0",
    division: "Main",
      },
                                      {
    rank: 40,
    slug: "trafficpills-esports",
    name: "TrafficPills Esports",
    flag: "/flags/bel.svg",
    logo: "/logos/traffic.png",
    points: 306,
    
    record: "0-0",
    division: "Main",
      },
                                      {
    rank: 41,
    slug: "kda-team",
    logo: "/logos/kda.png",
    name: "KDA Team",
    flag: "/flags/russia.svg",
    points: 314,
    
    record: "0-0",
    division: "Main",
      },

                                      {
    rank: 43,
    slug: "redtigersgaming",
    logo: "/logos/red.png",
    name: "RedTigersGaming",
    flag: "/flags/russia.svg",
    points: 298,
    
    record: "0-0",
    division: "Main",
  },

                                       {
    rank: 45,
     slug: "wobuzhidao",
     logo: "/logos/wobuzhidao.png",
    name: "Wobuzhidao",
    flag: "/flags/russia.svg",
    points: 264,
    
    record: "0-0",
    division: "Main",
  },
                                       {
    rank: 46,
    slug: "m33",
    logo: "/logos/m33.png",
    name: "M33",
    flag: "/flags/russia.svg",
    points: 273,
    
    record: "0-0",
    division: "Main",
  },
                                         {
    rank: 47,
    slug: "dire",
    logo: "/logos/dire.png",
    name: "Dire",
    flag: "/flags/russia.svg",
    points: 261,
    
    record: "0-0",
    division: "Main",
  },
                                         {
    rank: 48,
    slug: "goldrashers",
    logo: "/logos/z17.png",
    name: "GoldRashers",
    flag: "/flags/russia.svg",
    points: 311,
    
    record: "0-0",
    division: "Advanced",
  },


                                            {
    rank: 51,
    slug: "sakura",
    logo: "/logos/sakura.png",
    name: "Sakura",
    flag: "/flags/russia.svg",
    points: 281,
    
    record: "0-0",
    division: "Main",
  },

  
                                          {
    rank: 53,
    slug: "k1ll3rz",
    logo: "/logos/godbles.png",
    name: "k1LL3RZ",
    flag: "/flags/russia.svg",
    points: 254,
    record: "0-0",
    division: "Main",
  },
                                          {
     rank: 54,
    slug: "aokigahara",
    logo: "/logos/aokigahara.png",
    name: "aokigahara",
    flag: "/flags/russia.svg",
    points: 247,
  
    record: "0-0",
    division: "Main",
  },

                                                {
    rank: 57,
    slug: "team-ka6anbi",
    logo: "/logos/kabani.png",
    name: "TEAM KA6ANbl",
    flag: "/flags/russia.svg",
    points: 247,
    
    record: "0-0",
    division: "Intermediate",
  },

                                                  {
    rank: 59,
    slug: "infernals",
    name: "iNFERNALES",
    flag: "/flags/russia.svg",
    points: 242,
    record: "0-0",
    division: "Main",
  },

                                                    {
    rank: 61,
    slug: "sunthraw",
    logo: "/logos/sunthraw.png",
    name: "SUNTHRAW",
    flag: "/flags/russia.svg",
    points: 253,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                    {
    rank: 62,
    slug: "3nation",
    name: "3Nation",
    flag: "/flags/russia.svg",
    points: 246,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                      {
    rank: 63,
    slug: "yelets-esports",
    logo: "/logos/yelets.png",
    name: "Yelets Esports",
    flag: "/flags/russia.svg",
    points: 238,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                      {
    rank: 64,
    slug: "1337",
    name: "1337",
    flag: "/flags/russia.svg",
    logo: "/logos/1337.png",
    points: 254,
    
    record: "0-0",
    division: "Main",
  },

                                                      {
    rank: 66,
    slug: "teamworkers",
    logo: "/logos/teamwork.png",
    name: "TEAMWORKERS",
    flag: "/flags/russia.svg",
    points: 221,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                        {
    rank: 67,
    slug: "weclear",
    logo: "/logos/weclear.png",
    name: "WeClear",
    flag: "/flags/russia.svg",
    points: 287,
    
    record: "0-0",
    division: "Main",
  },
                                                        {
    rank: 68,
    slug: "mayak-arena",
    logo: "/logos/mayakarena.png",
    name: "MAYAK ARENA",
    flag: "/flags/russia.svg",
    points: 242,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                        {
    rank: 69,
    slug: "lan1t",
    logo: "/logos/lan1t.png",
    name: "LAN1T",
    flag: "/flags/russia.svg",
    points: 256,
    
    record: "0-0",
    division: "Entry",
  },
                                                          {
    rank: 74,
    slug: "fate",
    logo: "/logos/fate.png",
    name: "FATE",
    flag: "/flags/russia.svg",
    points: 226,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                            {
    rank: 75,
    slug: "aeris",
    logo: "/logos/aeris.png",
    name: "AERIS",
    flag: "/flags/russia.svg",
    points: 229,
    
    record: "0-0",
    division: "Entry",
  },
                                                            {
    rank: 76,
    slug: "dnk",
    logo: "/logos/dnk.png",
    name: "DNK",
    flag: "/flags/kaz.svg",
    points: 234,
    
    record: "0-0",
    division: "Advanced",
  },
                                                        {
    rank: 79,
    slug: "ablaze-team",
    logo: "/logos/ablaze.png",
    name: "ABlaze Team",
    flag: "/flags/russia.svg",
    points: 204,
    record: "0-0",
    division: "Main",
  },
                                                          {
    rank: 80,
    slug: "drags",
    logo: "/logos/drags.png",
    name: "dragS",
    flag: "/flags/russia.svg",
    points: 202,
    record: "0-0",
    division: "Main",
  },
                                                            {
    rank: 81,
    slug: "force-syndicate",
    logo: "/logos/force.png",
    name: "Force Syndicate",
    flag: "/flags/russia.svg",
    points: 217,
    
    record: "0-0",
    division: "Entry",
  },
                                                            {
    rank: 84,
    slug: "eon",
    logo: "/logos/eon.png",
    name: "Eon",
    flag: "/flags/russia.svg",
    points: 185,
    
    record: "0-0",
    division: "Intermediate",
  },

                                                              {
    rank: 86,
    slug: "fak1e-lab",
    logo: "/logos/fakie.png",
    name: "Fak1E Lab",
    flag: "/flags/russia.svg",
    points: 216,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                              {
    rank: 87,
    slug: "mana",
    name: "MANA",
    flag: "/flags/russia.svg",
    points: 220,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                              {
    rank: 88,
    slug: "smokinsexxystyle",
    logo: "/logos/smoki.png",
    name: "SmokinSexxyStyle",
    flag: "/flags/russia.svg",
    points: 189,
   
    record: "0-0",
    division: "Entry",
  },

                                                              {
    rank: 90,
    slug: "bcgame-academy",
    logo: "/logos/fusion.png",
    name: "BCGame Academy",
    flag: "/flags/russia.svg",
    points: 185,
    
    record: "0-0",
    division: "Entry",
  },
                                                                {
    rank: 93,
    slug: "nightmare-esports",
    logo: "/logos/nightmare.png",
    name: "Nightmare Esports",
    flag: "/flags/russia.svg",
    points: 210,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                              {
    rank: 96,
    slug: "agency-of-violence",
    logo: "/logos/nepriehali.png",
    name: "Agency of Violence",
    flag: "/flags/russia.svg",
    points: 165,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                                {
    rank: 97,
    slug: "ewe_posidim",
    logo: "/logos/magic.png",
    name: "ewe_posidim",
    flag: "/flags/russia.svg",
    points: 183,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                                {
    rank: 99,
    slug: "ronins",
    name: "Ronins",
    flag: "/flags/russia.svg",
    points: 178,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                                {
    rank: 101,
    slug: "quazar-school",
    logo: "/logos/quazarschool.png",
    name: "QUAZAR SCHOOL",
    flag: "/flags/russia.svg",
    points: 165,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                                  {
    rank: 106,
    slug: "fnbet",
    logo: "/logos/fnb.png",
    name: "FNbet",
    flag: "/flags/russia.svg",
    points: 177,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                                    {
    rank: 108,
    slug: "unknowns",
    logo: "/logos/unknow.png",
    name: "unknowns",
    flag: "/flags/russia.svg",
    points: 199,
    
    record: "0-0",
    division: "Main",
  },

                                                                      {
    rank: 111,
    slug: "stubborn-boys",
    name: "Stubborn Boys",
    flag: "/flags/bel.svg",
    logo: "/logos/stubb.png",
    points: 144,
    
    record: "0-0",
    division: "Entry",
  },
                                                                        {
    rank: 112,
    slug: "critical",
    logo: "/logos/critical.png",
    name: "Critical",
    flag: "/flags/russia.svg",
    points: 152,
    
    record: "0-0",
    division: "Entry",
  },
                                                                          {
    rank: 117,
    slug: "outsiders",
    logo: "/logos/out.png",
    name: "Outsiders",
    flag: "/flags/russia.svg",
    points: 123,
    
    record: "0-0",
    division: "Entry",
  },

                                                                          {
    rank: 119,
    slug: "1minute",
    logo: "/logos/1min.png",
    name: "1Minute",
    flag: "/flags/russia.svg",
    points: 135,
    
    record: "0-0",
    division: "Entry",
  },
                                                                            {
    rank: 120,
    slug: "only-gamers",
    logo: "/logos/only.png",
    name: "ONLY GAMERS",
    flag: "/flags/uzb.svg",
    points: 126,
    
    record: "0-0",
    division: "Entry",
  },
                                                                              {
    rank: 123,
    slug: "leetcase",
    logo: "/logos/leet.png",
    name: "LeetCase",
    flag: "/flags/russia.svg",
    points: 143,
    
    record: "0-0",
    division: "Intermediate",
  },
                                                                                {
    rank: 128,
    slug: "back2back",
    name: "back2back",
    flag: "/flags/russia.svg",
    logo: "/logos/b2b.png",
    points: 117,
    
    record: "0-0",
    division: "Entry",
  },
                                                                                  {
    rank: 130,
    slug: "ronin",
    logo: "/logos/ronin.png",
    name: "RONIN",
    flag: "/flags/kaz.svg",
    points: 121,
    
    record: "0-0",
    division: "Entry",
  },

                                                                                  {
    rank: 131,
    slug: "emlight",
    logo: "/logos/eml.png",
    name: "Emlight",
    flag: "/flags/russia.svg",
    points: 97,
    
    record: "0-0",
    division: "Entry",
  },
    {
    rank: 133,
     slug: "kittadiena",
     logo: "/logos/kitta.png",
    name: "KittaDiena",
    flag: "/flags/russia.svg",
    points: 262,
    record: "0-0",
    division: "Main",
  },
  {
    rank: 133,
     slug: "riset",
     logo: "/logos/riset.png",
    name: "Riset",
    flag: "/flags/russia.svg",
    points: 100,
    record: "0-0",
    division: "Entry",
  },
  {
    rank: 134,
     slug: "chikiryau",
     logo: "/logos/Chikiryau.png",
    name: "Chikiryau",
    flag: "/flags/russia.svg",
    points: 100,
    record: "0-0",
    division: "Entry",
  }
  
];

const DIVISIONS = [
  "All",
  "Advanced",
  "Main",
  "Intermediate",
  "Entry",
];

function RankingsPage() {
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const [selectedDivision, setSelectedDivision] = useState("All");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [faceitLink, setFaceitLink] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.points - a.points),
    []
  );

  const searchablePlayers = useMemo(() => {
    return Object.keys(playerTeams).map((nickname) => ({
      nickname,
      team: playerTeams[nickname],
      rating: playerAverageRatings[nickname] ?? null,
    }));
  }, []);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredSearchTeams = useMemo(() => {
    if (!normalizedSearch) return [];

    return sortedTeams
      .filter((team) =>
        team.name.toLowerCase().includes(normalizedSearch)
      )
      .slice(0, 5);
  }, [normalizedSearch, sortedTeams]);

  const filteredPlayers = useMemo(() => {
    if (!normalizedSearch) return [];

    return searchablePlayers
      .filter((player) =>
        player.nickname.toLowerCase().includes(normalizedSearch)
      )
      .slice(0, 5);
  }, [normalizedSearch, searchablePlayers]);

  const filteredTeams = useMemo(() => {
    if (selectedDivision === "All") return sortedTeams;

    return sortedTeams.filter(
      (team) => team.division === selectedDivision
    );
  }, [selectedDivision, sortedTeams]);

  const closeSearch = () => {
    setShowSearch(false);
    setSearch("");
  };

  const openTeam = (team) => {
    navigate(`/teams/${team.slug}`);
    closeSearch();
  };

  const openPlayer = (player) => {
    navigate(`/players/${encodeURIComponent(player.nickname)}`);
    closeSearch();
  };

  const handleSearchKey = (event) => {
    if (event.key === "Escape") {
      closeSearch();
      return;
    }

    if (event.key !== "Enter" || !normalizedSearch) return;

    if (filteredSearchTeams.length > 0) {
      openTeam(filteredSearchTeams[0]);
      return;
    }

    if (filteredPlayers.length > 0) {
      openPlayer(filteredPlayers[0]);
    }
  };

  useEffect(() => {
    if (!showSearch) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeSearch();
    };

    const handleMouseDown = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        closeSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [showSearch]);

  const submitTeam = async () => {
    if (!teamName.trim() || !faceitLink.trim() || !contact.trim()) {
      alert("Fill in Team Name, Faceit Link and Contact");
      return;
    }

    try {
      const response = await fetch("/api/submit-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.trim(),
          faceitLink: faceitLink.trim(),
          contact: contact.trim(),
          note: note.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to send");
        return;
      }

      alert("Team submitted successfully!");
      setTeamName("");
      setFaceitLink("");
      setContact("");
      setNote("");
      setShowModal(false);
    } catch (error) {
      console.error(error);
      alert("Server error");
    }
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      <div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Rankings</h1>
            <p className="mt-1 text-sm text-gray-500">
              ESEA team ranking by points
            </p>
          </div>

        </div>

        <div className="flex flex-wrap gap-2">
          {DIVISIONS.map((division) => (
            <button
              type="button"
              key={division}
              onClick={() => setSelectedDivision(division)}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                selectedDivision === division
                  ? "bg-orange-500 text-white"
                  : "border border-white/5 bg-[#0f131a] text-gray-300 hover:bg-[#121a25]"
              }`}
            >
              {division}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[80px_2fr_170px_120px_140px] rounded-xl border border-white/5 bg-[#0f141a] p-4 text-sm font-semibold text-gray-400">
              <div>Rank</div>
              <div>Team</div>
              <div>Points</div>
              <div>Record</div>
              <div>Division</div>
            </div>

            <div className="mt-3 space-y-2">
              {filteredTeams.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-[#0c1016] p-8 text-center text-gray-500">
                  No teams added
                </div>
              ) : (
                filteredTeams.map((team, index) => {
                  const change = team.change ?? 0;

                  let indicator = (
                    <span className="ml-2 text-xs text-gray-500">•</span>
                  );

                  if (change > 0) {
                    indicator = (
                      <span className="ml-2 text-xs text-green-400">
                        ▲ +{change}
                      </span>
                    );
                  } else if (change < 0) {
                    indicator = (
                      <span className="ml-2 text-xs text-red-400">
                        ▼ {change}
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={team.slug}
                      to={`/teams/${team.slug}`}
                      className="group relative grid grid-cols-[80px_2fr_170px_120px_140px] items-center overflow-hidden rounded-xl border border-white/5 bg-[#0c1016] p-4 transition-all duration-300 hover:z-10 hover:-translate-y-[3px] hover:border-orange-500/20 hover:bg-[#121a25] hover:shadow-[0_18px_45px_rgba(0,0,0,0.75)]"
                    >
                      <div className="font-bold text-orange-400">
                        #{index + 1}
                      </div>

                      <div className="flex min-w-0 items-center gap-3">
                        {team.flag ? (
                          <img src={team.flag} alt="" className="h-5 w-5 object-contain" />
                        ) : (
                          <div className="h-5 w-5 rounded bg-white/5" />
                        )}

                        {team.logo ? (
                          <img src={team.logo} alt="" className="h-9 w-9 object-contain" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-white/5" />
                        )}

                        <span className="truncate font-semibold transition group-hover:text-orange-400">
                          {team.name}
                        </span>
                      </div>

                      <div className="flex items-center font-semibold">
                        {team.points}
                        {indicator}
                      </div>

                      <div className="text-gray-300">
                        {team.record || "0-0"}
                      </div>

                      <div className="font-medium text-orange-400">
                        {team.division}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {showSearch && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-4 pt-28"
          onClick={closeSearch}
        >
          <div
            ref={searchRef}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/5 p-4">
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={handleSearchKey}
                placeholder="Search teams or players..."
                className="w-full rounded-lg bg-[#0f131a] p-3 text-white outline-none placeholder:text-gray-600 focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="max-h-[450px] overflow-y-auto">
              {!normalizedSearch && (
                <div className="p-6 text-center text-gray-500">
                  Enter a team or player name
                </div>
              )}

              {filteredSearchTeams.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                    Teams
                  </div>

                  {filteredSearchTeams.map((team) => (
                    <button
                      type="button"
                      key={team.slug}
                      onClick={() => openTeam(team)}
                      className="flex w-full items-center gap-3 border-b border-white/5 p-3 text-left transition hover:bg-[#121a25]"
                    >
                      {team.flag ? (
                        <img src={team.flag} alt="" className="h-5 w-5 object-contain" />
                      ) : (
                        <div className="h-5 w-5 rounded bg-white/5" />
                      )}

                      {team.logo ? (
                        <img src={team.logo} alt="" className="h-9 w-9 object-contain" />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-white/5" />
                      )}

                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium text-white">
                          {team.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {team.division} · {team.points} pts
                        </span>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {filteredPlayers.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold uppercase text-gray-500">
                    Players
                  </div>

                  {filteredPlayers.map((player) => {
                    const playerTeam = teams.find(
                      (team) =>
                        team.name === player.team ||
                        team.slug === player.team
                    );

                    return (
                      <button
                        type="button"
                        key={player.nickname}
                        onClick={() => openPlayer(player)}
                        className="flex w-full items-center justify-between border-b border-white/5 p-3 text-left transition hover:bg-[#121a25]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                            {playerTeam?.logo && (
                              <img
                                src={playerTeam.logo}
                                alt=""
                                className="absolute inset-0 h-full w-full scale-125 object-contain opacity-20"
                              />
                            )}

                            <img
                              src={`/players/${player.nickname}.png`}
                              alt={player.nickname}
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = "/player-silhouette.png";
                              }}
                              className="relative z-10 h-12 w-12 object-cover"
                            />
                          </div>

                          <div className="flex flex-col">
                            <span className="font-medium text-white">
                              {player.nickname}
                            </span>
                            <span className="text-xs text-gray-400">
                              {player.team || "No team"}
                            </span>
                          </div>
                        </div>

                        {typeof player.rating === "number" && (
                          <span className="text-sm font-medium text-green-400">
                            {player.rating.toFixed(2)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}

              {normalizedSearch &&
                filteredSearchTeams.length === 0 &&
                filteredPlayers.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    No results found
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-xl border border-white/10 bg-[#0b0f14] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold">Submit Team</h2>

            <input
              className="mb-2 w-full rounded bg-[#121a25] p-2 outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Team Name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
            />

            <input
              className="mb-2 w-full rounded bg-[#121a25] p-2 outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Faceit Link"
              value={faceitLink}
              onChange={(event) => setFaceitLink(event.target.value)}
            />

            <input
              className="mb-2 w-full rounded bg-[#121a25] p-2 outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
            />

            <textarea
              className="mb-3 min-h-24 w-full resize-y rounded bg-[#121a25] p-2 outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full rounded border border-white/5 bg-[#121a25] py-2 text-gray-300 transition hover:bg-[#17202c]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitTeam}
                className="w-full rounded bg-orange-500 py-2 font-medium transition hover:bg-orange-600"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RankingsPage;