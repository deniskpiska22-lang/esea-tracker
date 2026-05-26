import { Link, useLocation } from "react-router-dom"
import { useState } from "react"

const teams = [
  {
    rank: 1,
    slug: "cybershoke-prospects",
    logo: "/logos/cybershoke.png",
    name: "CYBERSHOKE Prospects",
    flag: "/flags/russia.svg",
    points: 380,
    change: +24,
    record: "9-5",
    division: "Advanced",
  },
  {
    rank: 2,
    slug: "eternal-premium",
    logo: "/logos/ep.png",
    name: "eternal premium",
    flag: "/flags/russia.svg",
    points: 350,
    change: -4,
    record: "9-5",
    division: "Advanced",
  },
  {
    rank: 3,
    slug: "new-vision",
    logo: "/logos/newwision.png",
    flag: "/flags/russia.svg",
    name: "NEW VISION",
    points: 356,
    change: +4,
    record: "10-4",
    division: "Advanced",
  },
  {
    rank: 4,
    slug: "donstu-esports",
    logo: "/logos/donstu.png",
    flag: "/flags/russia.svg",
    name: "DONSTU ESPORTS",
    points: 368,
    change: +18,
    record: "12-2",
    division: "Advanced",
  },
   {
    rank: 5,
    slug: "quazar",
    logo: "/logos/quazar.png",
    flag: "/flags/russia.svg",
    name: "QUAZAR",
    points: 346,
    change: -2,
    record: "10-4",
    division: "Advanced",
  },
    {
    rank: 6,
    slug: "bankapepsi",
    logo: "/logos/pepsi.png",
    flag: "/flags/russia.svg",
    name: "bankaPEPSI",
    points: 344,
    change: -2,
    record: "8-6",
    division: "Advanced",
  },
    {
    rank: 7,
    slug: "enjoy",
    logo: "/logos/enjoy.png",
    flag: "/flags/russia.svg",
    name: "Enjoy",
    points: 370,
    change: +26,
    record: "10-4",
    division: "Advanced",
  },
    {
    rank: 8,
    slug: "jumbo-team",
    logo: "/logos/jumbo.png",
    flag: "/flags/russia.svg",
    name: "Jumbo team",
    points: 342,
    record: "8-6",
    division: "Advanced",
  },
      {
    rank: 9,
    slug: "aurora-young-blud",
    logo: "/logos/aurora.png",
    name: "Aurora Young Blud",
    flag: "/flags/russia.svg",
    points: 348,
    change: +8,
    record: "9-5",
    division: "Advanced",
  },
       {
    rank: 10,
    slug: "young-tigeres",
    logo: "/logos/youngtigeres.png",
    name: "Young TigeRES",
    flag: "/flags/russia.svg",
    points: 338,
    record: "10-4",
    division: "Main",
  },
         {
    rank: 11,
    slug: "vpprodigy",
    logo: "/logos/vpp.png",
    name: "VPProdigy",
    flag: "/flags/russia.svg",
    points: 336,
    record: "9-5",
    division: "Advanced",
  },
           {
    rank: 12,
    slug: "arch",
    logo: "/logos/arch.png",
    name: "Arch",
    flag: "/flags/russia.svg",
    points: 334,
    record: "10-3",
    division: "Advanced",
  },
            {
    rank: 13,
    slug: "lfo-corh9k",
    logo: "/logos/sornyak.png",
    name: "LFO_COPH9K",
    flag: "/flags/russia.svg",
    points: 332,
    record: "8-6",
    division: "Advanced",
  },
              {
    rank: 14,
    slug: "wingmanlfo",
    logo: "/logos/wingman.png",
    name: "WingmanLFO",
    flag: "/flags/russia.svg",
    points: 330,
    record: "7-7",
    division: "Advanced",
  },
               {
    rank: 15,
    slug: "ex-peep",
    logo: "/logos/peep.png",
    name: "ex-PeeP",
    flag: "/flags/russia.svg",
    points: 331,
    change: +3,
    record: "8-6",
    division: "Advanced",
  },
                 {
    rank: 16,
    slug: "golovastiki",
    logo: "/logos/vpf2.png",
    name: "golovastiki",
    flag: "/flags/russia.svg",
    points: 326,
    record: "12-2",
    division: "Main",
  },
                   {
    rank: 17,
    slug: "gamesport",
    logo: "/logos/gamesport.png",
    name: "GAMESPORT",
    flag: "/flags/russia.svg",
    points: 324,
    record: "10-4",
    division: "Main",
  },
                     {
    rank: 18,
    slug: "xcity",
    logo: "/logos/xcity.png",
    name: "Xcity",
    flag: "/flags/russia.svg",
    points: 322,
    record: "10-4",
    division: "Main",
  },
                       {
    rank: 19,
    slug: "tsa-green",
    logo: "/logos/tsagreen.png",
    name: "TSA Green",
    flag: "/flags/russia.svg",
    points: 320,
    record: "10-4",
    division: "Main",
  },
                         {
    rank: 20,
    slug: "mellren",
    logo: "/logos/mellren.png",
    name: "mellren",
    flag: "/flags/bel.svg",
    points: 318,
    record: "9-5",
    division: "Main",
  },
                           {
    rank: 21,
    slug: "nemesis-academy",
    logo: "/logos/nemesis.png",
    name: "Nemesis Academy",
    flag: "/flags/russia.svg",
    points: 316,
    record: "9-5",
    division: "Main",
  },
                           {
    rank: 22,
    slug: "duggedup",
    logo: "/logos/duggedup.png",
    name: "Duggedup",
    flag: "/flags/russia.svg",
    points: 314,
    record: "9-5",
    division: "Main",
  },
                            {
    rank: 23,
    slug: "roc-team",
    logo: "/logos/rocteam.png",
    name: "ROC Team",
    flag: "/flags/russia.svg",
    points: 312,
    record: "9-5",
    division: "Main",
  },
                            {
    rank: 24,
    slug: "partizan",
    logo: "/logos/partizan.png",
    name: "PARTIZAN",
    flag: "/flags/russia.svg",
    points: 310,
    record: "9-5",
    division: "Main",
  },
                            {
    rank: 25,
    slug: "csgopositive",
    logo: "/logos/csgopositive.png",
    name: "CSGOPOSITIVE",
    flag: "/flags/russia.svg",
    points: 325,
    change: +17,
    record: "11-3",
    division: "Main",
  },
                              {
    rank: 26,
    slug: "graf-monte-cristo",
    logo: "/logos/graf.png",
    name: "Graf Monte-Cristo",
    flag: "/flags/russia.svg",
    points: 306,
    record: "14-0",
    division: "intermediate",
  },
                                      {
    rank: 27,
    slug: "saqa-omuk",
    logo: "/logos/saqa.png",
    name: "SAQA OMUK",
    flag: "/flags/russia.svg",
    points: 304,
    record: "12-2",
    division: "Intermediate",
  },
                                    {
    rank: 28,
    slug: "baks-esports",
    logo: "/logos/baks.png",
    name: "BAKS Esports",
    flag: "/flags/russia.svg",
    points: 366,
    change: +64,
    record: "13-1",
    division: "Entry",
  },
                                {
    rank: 29,
    slug: "aogiri",
    logo: "/logos/aogiri.png",
    name: "Aogiri",
    flag: "/flags/russia.svg",
    points: 300,
    record: "13-1",
    division: "intermediate",
  },
  
                              {
    rank: 30,
    slug: "platoon-beta",
    logo: "/logos/platoon.png",
    name: "PLATOON BETA",
    flag: "/flags/bel.svg",
    points: 298,
    record: "8-6",
    division: "Main",
  },
                              {
    rank: 31,
    slug: "wnt",
    logo: "/logos/wnt.png",
    name: "wnT",
    flag: "/flags/russia.svg",
    points: 296,
    record: "8-6",
    division: "Main",
  },
                                {
    rank: 32,
    slug: "playfire",
    logo: "/logos/playfire.png",
    name: "playfire",
    flag: "/flags/russia.svg",
    points: 294,
    record: "8-6",
    division: "Main",
  },
                                  {
    rank: 33,
    slug: "olympia",
    logo: "/logos/olympia.png",
    name: "OLYMPIA",
    flag: "/flags/russia.svg",
    points: 292,
    record: "8-6",
    division: "Main",
      },
                                  {
    rank: 34,
    slug: "iuhop",
    name: "iuhop",
    flag: "/flags/russia.svg",
    points: 290,
    record: "12-2",
    division: "Entry",
      },
                                  {
    rank: 35,
    slug: "fartflow",
    logo: "/logos/fartflow.png",
    name: "FartFlow",
    flag: "/flags/russia.svg",
    points: 288,
    record: "12-2",
    division: "Entry",
      },
                                  {
    rank: 36,
    slug: "bhemanha",
    name: "BHemanha",
    flag: "/flags/russia.svg",
    points: 286,
    record: "12-2",
    division: "Entry",
  },
                                      {
    rank: 37,
    slug: "way-In-future",
    logo: "/logos/way.png",
    name: "Way In Future",
    flag: "/flags/russia.svg",
    points: 284,
    record: "7-7",
    division: "Main",
      },
                                            {
    rank: 38,
    slug: "hodes",
    logo: "/logos/hodes.png",
    name: "HODES",
    flag: "/flags/bel.svg",
    points: 284,
    record: "11-3",
    division: "Entry",
      },
                                      {
    rank: 39,
    slug: "lynx",
    logo: "/logos/lynx.png",
    name: "LYNX",
    flag: "/flags/russia.svg",
    points: 282,
    record: "11-3",
    division: "Entry",
      },
                                      {
    rank: 40,
    slug: "trafficpills-esports",
    name: "TrafficPills Esports",
    flag: "/flags/russia.svg",
    points: 280,
    record: "11-3",
    division: "Entry",
      },
                                      {
    rank: 41,
    slug: "kda-team",
    logo: "/logos/kda.png",
    name: "KDA Team",
    flag: "/flags/russia.svg",
    points: 278,
    record: "11-3",
    division: "Entry",
      },
                                      {
    rank: 42,
    slug: "fortis",
    logo: "/logos/fortis.png",
    name: "FORTIS",
    flag: "/flags/russia.svg",
    points: 276,
    record: "11-3",
    division: "Entry",
  },
                                      {
    rank: 43,
    slug: "redtigersgaming",
    logo: "/logos/red.png",
    name: "RedTigersGaming",
    flag: "/flags/russia.svg",
    points: 274,
    record: "7-7",
    division: "Main",
  },
                                      {
    rank: 44,
   slug: "kislyakk",
   logo: "/logos/kislyak.png",
    name: "KISLYAKK",
    flag: "/flags/russia.svg",
    points: 272,
    record: "7-7",
    division: "Main",
  },
                                       {
    rank: 45,
     slug: "wobuzhidao",
     logo: "/logos/wobuzhidao.png",
    name: "Wobuzhidao",
    flag: "/flags/russia.svg",
    points: 270,
    record: "7-7",
    division: "Main",
  },
                                       {
    rank: 46,
    slug: "p7ay3r5",
    logo: "/logos/p7.png",
    name: "P7AY3R5",
    flag: "/flags/russia.svg",
    points: 268,
    record: "7-7",
    division: "Main",
  },
                                         {
    rank: 47,
    slug: "dire",
    logo: "/logos/dire.png",
    name: "Dire",
    flag: "/flags/russia.svg",
    points: 266,
    record: "7-7",
    division: "Main",
  },
                                         {
    rank: 48,
    slug: "z17",
    logo: "/logos/z17.png",
    name: "Z17",
    flag: "/flags/russia.svg",
    points: 264,
    record: "7-7",
    division: "Main",
  },
                                          {
    rank: 49,
    slug: "aeternum",
    logo: "/logos/aeternum.png",
    name: "AETERNUM",
    flag: "/flags/russia.svg",
    points: 262,
    record: "7-7",
    division: "Main",
  },
                                            {
    rank: 50,
    slug: "donatrix",
    logo: "/logos/donatrix.png",
    name: "Donatrix",
    flag: "/flags/russia.svg",
    points: 260,
    record: "11-3",
    division: "Intermediate",
  },
                                            {
    rank: 51,
    slug: "sakura",
    logo: "/logos/sakura.png",
    name: "Sakura",
    flag: "/flags/russia.svg",
    points: 258,
    record: "11-3",
    division: "Intermediate",
  },
                                            {
    rank: 52,
    slug: "allinners",
    logo: "/logos/allinners.png",
    name: "ALLINNERS",
    flag: "/flags/kaz.svg",
    points: 256,
    record: "11-3",
    division: "Intermediate",
  },
  
                                          {
    rank: 53,
    slug: "godbless",
    logo: "/logos/godbles.png",
    name: "Godbless",
    flag: "/flags/russia.svg",
    points: 254,
    record: "6-8",
    division: "Main",
  },
                                          {
     rank: 54,
    slug: "aokigahara",
    logo: "/logos/aokigahara.png",
    name: "aokigahara",
    flag: "/flags/russia.svg",
    points: 252,
    record: "6-8",
    division: "Main",
  },
                                            {
    rank: 55,
    slug: "m33",
    logo: "/logos/m33.png",
    name: "M33",
    flag: "/flags/russia.svg",
    points: 250,
    record: "6-8",
    division: "Main",
  },
                                              {
    rank: 56,
    slug: "prem3adpotbi",
    logo: "/logos/prem.png",
    name: "Prem3aDPOTbl",
    flag: "/flags/russia.svg",
    points: 248,
    record: "10-4",
    division: "Intermediate",
  },
                                                {
    rank: 57,
    slug: "team-ka6anbi",
    logo: "/logos/kabani.png",
    name: "TEAM KA6ANbl",
    flag: "/flags/russia.svg",
    points: 246,
    record: "10-4",
    division: "Intermediate",
  },
                                                {
    rank: 58,
    slug: "wapa",
    logo: "/logos/wapa.png",
    name: "WaPa",
    flag: "/flags/russia.svg",
    points: 244,
    record: "10-4",
    division: "Intermediate",
  },
                                                  {
    rank: 59,
    slug: "infernals",
    name: "iNFERNALES",
    flag: "/flags/russia.svg",
    points: 242,
    record: "5-9",
    division: "Main",
  },
                                                  {
    rank: 60,
    slug: "dzungarz",
    name: "dzungarz",
    flag: "/flags/russia.svg",
    points: 240,
    record: "5-9",
    division: "Main",
  },
                                                    {
    rank: 61,
    slug: "sunthraw",
    logo: "/logos/sunthraw.png",
    name: "SUNTHRAW",
    flag: "/flags/russia.svg",
    points: 238,
    record: "9-5",
    division: "Intermediate",
  },
                                                    {
    rank: 62,
    slug: "3nation",
    name: "3Nation",
    flag: "/flags/russia.svg",
    points: 236,
    record: "9-5",
    division: "Intermediate",
  },
                                                      {
    rank: 63,
    slug: "yelets-esports",
    logo: "/logos/yelets.png",
    name: "Yelets Esports",
    flag: "/flags/russia.svg",
    points: 234,
    record: "9-5",
    division: "Intermediate",
  },
                                                      {
    rank: 64,
    slug: "1337",
    name: "1337",
    flag: "/flags/russia.svg",
    points: 232,
    record: "9-5",
    division: "Intermediate",
  },
                                                      {
    rank: 65,
    slug: "turtles",
    logo: "/logos/turtles.png",
    name: "TURTLES",
    flag: "/flags/russia.svg",
    points: 230,
    record: "9-5",
    division: "Intermediate",
  },
                                                      {
    rank: 66,
    slug: "teamworkers",
    logo: "/logos/teamwork.png",
    name: "TEAMWORKERS",
    flag: "/flags/russia.svg",
    points: 228,
    record: "9-5",
    division: "Intermediate",
  },
                                                        {
    rank: 67,
    slug: "weclear",
    logo: "/logos/weclear.png",
    name: "WeClear",
    flag: "/flags/russia.svg",
    points: 227,
    record: "10-4",
    division: "Entry",
  },
                                                        {
    rank: 68,
    slug: "mayak-arena",
    logo: "/logos/mayakarena.png",
    name: "MAYAK ARENA",
    flag: "/flags/russia.svg",
    points: 226,
    record: "10-4",
    division: "Entry",
  },
                                                        {
    rank: 69,
    slug: "lan1t",
    logo: "/logos/lan1t.png",
    name: "LAN1T",
    flag: "/flags/russia.svg",
    points: 224,
    record: "10-4",
    division: "Entry",
  },
                                                        {
    rank: 70,
    slug: "vexar",
    logo: "/logos/vexar.png",
    name: "Vexar",
    flag: "/flags/russia.svg",
    points: 222,
    record: "10-4",
    division: "Entry",
  },
                                                          {
    rank: 71,
    slug: "prius",
    logo: "/logos/prius.png",
    name: "Prius",
    flag: "/flags/russia.svg",
    points: 220,
    record: "10-4",
    division: "Entry",
  },
                                                          {
    rank: 72,
    slug: "goodjob",
    logo: "/logos/good.png",
    name: "GoodJob",
    flag: "/flags/bel.svg",
    points: 218,
    record: "10-4",
    division: "Entry",
  },
                                                          {
    rank: 73,
    slug: "lanklan",
    name: "LanKlan",
    flag: "/flags/russia.svg",
    points: 216,
    record: "10-4",
    division: "Entry",
  },
                                                          {
    rank: 74,
    slug: "fate",
    logo: "/logos/fate.png",
    name: "FATE",
    flag: "/flags/russia.svg",
    points: 214,
    record: "10-4",
    division: "Entry",
  },
                                                            {
    rank: 75,
    slug: "aeris",
    logo: "/logos/aeris.png",
    name: "AERIS",
    flag: "/flags/russia.svg",
    points: 212,
    record: "10-4",
    division: "Entry",
  },
                                                            {
    rank: 76,
    slug: "dnk",
    logo: "/logos/dnk.png",
    name: "DNK",
    flag: "/flags/kaz.svg",
    points: 210,
    record: "10-4",
    division: "Entry",
  },
                                                            {
    rank: 77,
    slug: "homo-sapiens",
    name: "homo_sapiens",
    flag: "/flags/russia.svg",
    points: 208,
    record: "10-4",
    division: "Entry",
  },
                                                            {
    rank: 78,
    slug: "cerberus",
    logo: "/logos/cerberus.png",
    name: "CERBERUS",
    flag: "/flags/russia.svg",
    points: 206,
    record: "10-4",
    division: "Entry",
  },
                                                        {
    rank: 79,
    slug: "ablaze-team",
    logo: "/logos/ablaze.png",
    name: "ABlaze Team",
    flag: "/flags/russia.svg",
    points: 204,
    record: "4-10",
    division: "Main",
  },
                                                          {
    rank: 80,
    slug: "drags",
    logo: "/logos/drags.png",
    name: "dragS",
    flag: "/flags/russia.svg",
    points: 202,
    record: "3-11",
    division: "Main",
  },
                                                            {
    rank: 81,
    slug: "force -syndicate",
    logo: "/logos/force.png",
    name: "Force Syndicate",
    flag: "/flags/russia.svg",
    points: 200,
    record: "8-6",
    division: "Intermediate",
  },
                                                            {
    rank: 82,
    slug: "all-eyes-on-me",
    logo: "/logos/alleyes.png",
    name: "all eyes on me",
    flag: "/flags/russia.svg",
    points: 198,
    record: "8-6",
    division: "Intermediate",
  },
                                                            {
    rank: 83,
    slug: "lqnely",
    logo: "/logos/iqneli.png",
    name: "lqnely",
    flag: "/flags/russia.svg",
    points: 196,
    record: "8-6",
    division: "Intermediate",
  },
                                                            {
    rank: 84,
    slug: "eon",
    logo: "/logos/eon.png",
    name: "Eon",
    flag: "/flags/russia.svg",
    points: 194,
    record: "8-6",
    division: "Intermediate",
  },
                                                            {
    rank: 85,
    slug: "clickbate",
    logo: "/logos/clickbate.png",
    name: "ClickBate",
    flag: "/flags/russia.svg",
    points: 192,
    record: "8-6",
    division: "Intermediate",
  },
                                                              {
    rank: 86,
    slug: "fak1e-lab",
    logo: "/logos/fakie.png",
    name: "Fak1E Lab",
    flag: "/flags/russia.svg",
    points: 190,
    record: "9-5",
    division: "Entry",
  },
                                                              {
    rank: 87,
    slug: "mana",
    name: "MANA",
    flag: "/flags/russia.svg",
    points: 188,
    record: "9-5",
    division: "Entry",
  },
                                                              {
    rank: 88,
    slug: "smokinsexxystyle",
    logo: "/logos/smoki.png",
    name: "SmokinSexxyStyle",
    flag: "/flags/russia.svg",
    points: 186,
    record: "9-5",
    division: "Entry",
  },
                                                              {
    rank: 89,
    slug: "eternal",
    logo: "/logos/eternal.png",
    name: "eternal",
    flag: "/flags/russia.svg",
    points: 184,
    record: "9-5",
    division: "Entry",
  },
                                                              {
    rank: 90,
    slug: "fusion",
    logo: "/logos/fusion.png",
    name: "FUSION",
    flag: "/flags/russia.svg",
    points: 182,
    record: "9-5",
    division: "Entry",
  },
                                                                {
    rank: 91,
    slug: "posle-zavoda",
    name: "POSLE ZAVODA",
    flag: "/flags/russia.svg",
    points: 180,
    record: "9-5",
    division: "Entry",
  },
                                                                {
    rank: 92,
    slug: "thekomyakz",
    logo: "/logos/thekom.png",
    name: "THEKOMYAKZ",
    flag: "/flags/russia.svg",
    points: 178,
    record: "9-5",
    division: "Entry",
  },
                                                                {
    rank: 93,
    slug: "nightmare-esports",
    logo: "/logos/nightmare.png",
    name: "Nightmare Esports",
    flag: "/flags/russia.svg",
    points: 176,
    record: "9-5",
    division: "Entry",
  },
                                                                {
    rank: 94,
    slug: "s1wka-team",
    logo: "/logos/siwka.png",
    name: "S1WKA Team",
    flag: "/flags/russia.svg",
    points: 174,
    record: "9-5",
    division: "Entry",
  },
                                                                  {
    rank: 95,
    slug: "flame-guardians",
    logo: "/logos/flameguardians.png",
    name: "Flame Guardians",
    flag: "/flags/russia.svg",
    points: 173,
    record: "7-7",
    division: "Intermediate",
  },
                                                              {
    rank: 96,
    slug: "ne-priehali",
    logo: "/logos/nepriehali.png",
    name: "NE PRIEHALI",
    flag: "/flags/russia.svg",
    points: 172,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 97,
    slug: "magic-fairies",
    logo: "/logos/magic.png",
    name: "Magic Fairies",
    flag: "/flags/russia.svg",
    points: 170,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 98,
    slug: "youth4ez",
    logo: "/logos/you.png",
    name: "YouTH4eZ",
    flag: "/flags/russia.svg",
    points: 168,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 99,
    slug: "ronins",
    name: "Ronins",
    flag: "/flags/russia.svg",
    points: 166,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 100,
    slug: "donstu youngsters",
    logo: "/logos/donstuyoung.png",
    name: "DONSTU YOUNGSTERS",
    flag: "/flags/russia.svg",
    points: 164,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 101,
    slug: "quazar school",
    logo: "/logos/quazarschool.png",
    name: "QUAZAR SCHOOL",
    flag: "/flags/russia.svg",
    points: 162,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 102,
    slug: "gsq",
    logo: "/logos/gsq.png",
    name: "GSQ",
    flag: "/flags/russia.svg",
    points: 160,
    record: "7-7",
    division: "Intermediate",
  },
                                                                  {
    rank: 103,
    slug: "c0b0r",
    name: "c0b0r",
    flag: "/flags/russia.svg",
    points: 158,
    record: "6-8",
    division: "Intermediate",
  },
                                                                  {
    rank: 104,
    slug: "eca-esports",
    logo: "/logos/eca.png",
    name: "ECA Esports",
    flag: "/flags/russia.svg",
    points: 156,
    record: "9-5",
    division: "Entry",
  },
                                                                  {
    rank: 105,
    slug: "pivstar",
    name: "pivstar",
    flag: "/flags/russia.svg",
    points: 154,
    record: "9-5",
    division: "Entry",
  },
                                                                  {
    rank: 106,
    slug: "fnbet",
    logo: "/logos/fnb.png",
    name: "FNbet",
    flag: "/flags/russia.svg",
    points: 152,
    record: "9-5",
    division: "Entry",
  },
                                                                  {
    rank: 107,
    slug: "urat",
    name: "UraT",
    flag: "/flags/russia.svg",
    points: 150,
    record: "9-5",
    division: "Entry",
  },
                                                                    {
    rank: 108,
    slug: "unknowns",
    logo: "/logos/unknow.png",
    name: "unknowns",
    flag: "/flags/russia.svg",
    points: 148,
    record: "9-5",
    division: "Entry",
  },
                                                                    {
    rank: 109,
    slug: "dodg3rs",
    logo: "/logos/dodg.png",
    name: "dodg3rs",
    flag: "/flags/russia.svg",
    points: 146,
    record: "9-5",
    division: "Entry",
  },
                                                                    {
    rank: 110,
    slug: "sixseven",
    logo: "/logos/sixseven.png",
    name: "SixSeven",
    points: 144,
    record: "9-5",
    division: "Entry",
  },
                                                                      {
    rank: 111,
    slug: "stubborn-boys",
    name: "Stubborn Boys",
    flag: "/flags/russia.svg",
    points: 142,
    record: "8-6",
    division: "Entry",
  },
                                                                        {
    rank: 112,
    slug: "critical",
    logo: "/logos/critical.png",
    name: "Critical",
    flag: "/flags/russia.svg",
    points: 140,
    record: "8-6",
    division: "Entry",
  },
                                                                        {
    rank: 113,
    slug: "mephi",
    logo: "/logos/mephi.png",
    name: "MEPHI",
    flag: "/flags/russia.svg",
    points: 138,
    record: "8-6",
    division: "Entry",
  },
                                                                        {
    rank: 114,
    slug: "zbk",
    logo: "/logos/zbk.png",
    name: "ZBK",
    flag: "/flags/russia.svg",
    points: 136,
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 115,
    slug: "ha-ncuxotponhbix",
    logo: "/logos/ha.png",
    name: "Ha ncuxoTPonHblx",
    flag: "/flags/russia.svg",
    points: 132,
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 116,
    slug: "kynetic",
    logo: "/logos/kynetic.png",
    name: "Kynetic",
    flag: "/flags/russia.svg",
    points: 130,
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 117,
    slug: "outsiders",
    logo: "/logos/out.png",
    name: "Outsiders",
    flag: "/flags/russia.svg",
    points: 128,
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 118,
    slug: "m0nkeys",
    logo: "/logos/monkeys.png",
    name: "m0nkeys",
    flag: "/flags/russia.svg",
    points: 126,
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 119,
    slug: "1minute",
    logo: "/logos/1min.png",
    name: "1Minute",
    flag: "/flags/russia.svg",
    points: 124,
    record: "8-6",
    division: "Entry",
  },
                                                                            {
    rank: 120,
    slug: "only-gamers",
    logo: "/logos/only.png",
    name: "ONLY GAMERS",
    flag: "/flags/uzb.svg",
    points: 122,
    record: "8-6",
    division: "Entry",
  },
                                                                            {
    rank: 121,
    slug: "inputlag-enjoyers",
    logo: "/logos/input.png",
    name: "inputlag enjoyers",
    flag: "/flags/russia.svg",
    points: 120,
    record: "8-6",
    division: "Entry",
  },
                                                                            {
    rank: 122,
    slug: "justtag",
    name: "JustTag",
    flag: "/flags/russia.svg",
    points: 118,
    record: "8-6",
    division: "Entry",
  },
                                                                              {
    rank: 123,
    slug: "leetcase",
    logo: "/logos/leet.png",
    name: "LeetCase",
    flag: "/flags/russia.svg",
    points: 116,
    record: "8-6",
    division: "Entry",
  },
                                                                              {
    rank: 124,
    slug: "w1nks",
    logo: "/logos/winks.png",
    name: "W1NKS",
    flag: "/flags/russia.svg",
    points: 114,
    record: "8-6",
    division: "Entry",
  },
                                                                              {
    rank: 125,
    slug: "bestaimmers",
    logo: "/logos/best.png",
    name: "bestAIMMERS",
    flag: "/flags/russia.svg",
    points: 112,
    record: "8-6",
    division: "Entry",
  },
                                                                              {
    rank: 126,
    slug: "the-relics",
    logo: "/logos/relics.png",
    name: "The Relics",
    flag: "/flags/russia.svg",
    points: 110,
    record: "8-6",
    division: "Entry",
  },
                                                                                {
    rank: 127,
    slug: "kagen",
    logo: "/logos/kagen.png",
    name: "KageN",
    flag: "/flags/russia.svg",
    points: 108,
    record: "8-6",
    division: "Entry",
  },
                                                                                {
    rank: 128,
    slug: "back2back",
    name: "back2back",
    flag: "/flags/russia.svg",
    points: 106,
    record: "8-6",
    division: "Entry",
  },
                                                                                {
    rank: 129,
    slug: "full-dobro",
    logo: "/logos/full.png",
    name: "Full Dobro",
    flag: "/flags/russia.svg",
    points: 104,
    record: "8-6",
    division: "Entry",
  },
                                                                                  {
    rank: 130,
    slug: "ronin",
    logo: "/logos/ronin.png",
    name: "RONIN",
    flag: "/flags/kaz.svg",
    points: 102,
    record: "7-7",
    division: "Entry",
  },

                                                                                  {
    rank: 131,
    slug: "emlight",
    logo: "/logos/eml.png",
    name: "Emlight",
    flag: "/flags/russia.svg",
    points: 101,
    record: "7-7",
    division: "Entry",
  },
                                                                                    {
    rank: 132,
    slug: "cybercom",
    logo: "/logos/cybercom.png",
    name: "CYBERCOM",
    flag: "/flags/russia.svg",
    points: 100,
    record: "7-7",
    division: "Entry",
  },
]

function App() {
  const location = useLocation()

  const [selectedDivision, setSelectedDivision] =
    useState("All")

  const isActive = (path) => location.pathname === path

  // 🔥 SORT BY POINTS
  const sortedTeams = [...teams].sort(
    (a, b) => b.points - a.points
  )

  // 🔥 FILTER DIVISIONS
  const filteredTeams =
    selectedDivision === "All"
      ? sortedTeams
      : sortedTeams.filter(
          (team) =>
            team.division === selectedDivision
        )

  return (
    <div className="bg-[#0f1419] min-h-screen text-white overflow-x-hidden">

      {/* NAVBAR */}
      <nav className="border-b border-gray-800 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">

          {/* LOGO */}
          <h1 className="text-xl md:text-2xl font-bold text-orange-500 text-center">
            Esea Tracker
          </h1>

          {/* NAV LINKS */}
          <div className="flex gap-4 md:gap-8 text-sm flex-wrap justify-center">

            <Link
              to="/"
              className={`transition ${
                isActive("/")
                  ? "text-white border-b-2 border-orange-500 pb-1"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Rankings
            </Link>

            <Link
              to="/Media"
              className={`transition ${
                isActive("/teams")
                  ? "text-white border-b-2 border-orange-500 pb-1"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Media
            </Link>

            <Link
              to="/about"
              className={`transition ${
                isActive("/about")
                  ? "text-white border-b-2 border-orange-500 pb-1"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              About
            </Link>

          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto p-4 md:p-8">

        {/* TITLE */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

          <h2 className="text-2xl md:text-4xl font-bold">
            CIS Team Rankings ESEA
          </h2>

          {/* FILTERS */}
          <div className="flex flex-wrap gap-2">

            {[
              "All",
              "Advanced",
              "Main",
              "Intermediate",
              "Entry",
            ].map((division) => (

              <button
                key={division}
                onClick={() =>
                  setSelectedDivision(division)
                }
                className={`px-4 py-2 rounded-lg border transition text-sm ${
                  selectedDivision === division
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-[#1a1f26] border-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {division}
              </button>

            ))}

          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <div className="bg-[#141922] rounded-xl overflow-hidden border border-gray-800 shadow-xl min-w-[1000px]">

            {/* HEADER */}
            <div
              className="
                grid
                grid-cols-[80px_2fr_170px_120px_140px]
                bg-[#1f2630]
                p-4
                text-gray-400
                font-semibold
                text-sm
                uppercase
                tracking-wide
              "
            >
              <div>Rank</div>

              <div>Team</div>

              <div className="pl-4">
                Points
              </div>

              <div className="pl-2">
                Record
              </div>

              <div>Division</div>
            </div>

            {/* ROWS */}
            {filteredTeams.map((team, index) => (

              <Link
                key={team.slug}
                to={`/teams/${team.slug}`}
                className={`
                  grid
                  grid-cols-[80px_2fr_170px_120px_140px]
                  p-4
                  border-t
                  border-gray-800
                  transition
                  duration-150
                  items-center
                  ${
                    index === 0
                      ? "bg-yellow-500/10"
                      : "hover:bg-[#2a313d]"
                  }
                `}
              >

                {/* RANK */}
                <div className="text-gray-300 font-medium">
                  #{index + 1}
                </div>

                {/* TEAM */}
                <div className="flex items-center gap-3 min-w-0">

                  {/* FLAG */}
                  <img
                    src={team.flag}
                    alt="flag"
                    className="w-5 h-5 rounded-sm object-cover flex-shrink-0"
                  />

                  {/* LOGO */}
                  <img
                    src={team.logo}
                    alt={team.name}
                    className="w-9 h-9 object-contain flex-shrink-0"
                  />

                  {/* NAME */}
                  <span className="font-semibold hover:text-orange-400 transition truncate">
                    {team.name}
                  </span>

                </div>

                {/* POINTS */}
                <div className="flex items-center gap-2 pl-4">

                  <span className="text-gray-300 font-medium">
                    {team.points}
                  </span>

                  {/* CHANGE UP */}
                  {team.change > 0 && (
                    <span className="text-green-400 text-sm font-bold">
                      ▲ +{team.change}
                    </span>
                  )}

                  {/* CHANGE DOWN */}
                  {team.change < 0 && (
                    <span className="text-red-400 text-sm font-bold">
                      ▼ {team.change}
                    </span>
                  )}

                  {/* NO CHANGE */}
                  {team.change === 0 && (
                    <span className="text-gray-500 text-sm font-bold">
                      —
                    </span>
                  )}

                </div>

                {/* RECORD */}
                <div className="text-gray-300 pl-2">
                  {team.record}
                </div>

                {/* DIVISION */}
                <div className="text-orange-400 font-medium">
                  {team.division}
                </div>

              </Link>

            ))}

          </div>
        </div>

      </div>
    </div>
  )
}

export default App