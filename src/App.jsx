import { useState, useMemo, useEffect, useRef } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import ScrollToTop from "./components/ScrollToTop";

const teams = [
  {
    rank: 1,
    slug: "cybershoke-prospects",
    logo: "/logos/cybershoke.png",
    name: "CYBERSHOKE Prospects",
    flag: "/flags/russia.svg",
    points: 374,
    change: -3,
    record: "9-5",
    division: "Advanced",
  },
  {
    rank: 2,
    slug: "eternal-premium",
    logo: "/logos/ep.png",
    name: "eternal premium",
    flag: "/flags/russia.svg",
    points: 370,
    change: +8,
    record: "9-5",
    division: "Advanced",
  },
  {
    rank: 3,
    slug: "new-vision",
    logo: "/logos/newwision.png",
    flag: "/flags/russia.svg",
    name: "NEW VISION",
    points: 377,
    change: +10,
    record: "10-4",
    division: "Advanced",
  },
  {
    rank: 4,
    slug: "donstu-esports",
    logo: "/logos/donstu.png",
    flag: "/flags/russia.svg",
    name: "DONSTU ESPORTS",
    points: 385,
    change: +8,
    record: "12-2",
    division: "Advanced",
  },
   {
    rank: 5,
    slug: "quazar",
    logo: "/logos/quazar.png",
    flag: "/flags/russia.svg",
    name: "QUAZAR",
    points: 389,
    change: +34,
    record: "10-4",
    division: "Advanced",
  },
    {
    rank: 6,
    slug: "bankapepsi",
    logo: "/logos/pepsi.png",
    flag: "/flags/russia.svg",
    name: "bankaPEPSI",
    points: 349,
    change: +8,
    record: "8-6",
    division: "Advanced",
  },
    {
    rank: 7,
    slug: "enjoy",
    logo: "/logos/enjoy.png",
    flag: "/flags/russia.svg",
    name: "Enjoy",
    points: 364,
    change: -3,
    record: "10-4",
    division: "Advanced",
  },
    {
    rank: 8,
    slug: "jumbo-team",
    logo: "/logos/jumbo.png",
    flag: "/flags/russia.svg",
    name: "Jumbo team",
    points: 349,
    change: +10,
    record: "8-6",
    division: "Advanced",
  },
      {
    rank: 9,
    slug: "aurora-young-blud",
    logo: "/logos/aurora.png",
    name: "Aurora Young Blud",
    flag: "/flags/russia.svg",
    points: 342,
    change: -3,
    record: "9-5",
    division: "Advanced",
  },
       {
    rank: 10,
    slug: "young-tigeres",
    logo: "/logos/youngtigeres.png",
    name: "Young TigeRES",
    flag: "/flags/russia.svg",
    points: 361,
    change: +18,
    record: "10-4",
    division: "Main",
  },
         {
    rank: 11,
    slug: "vpprodigy",
    logo: "/logos/vpp.png",
    name: "VPProdigy",
    flag: "/flags/russia.svg",
    points: 342,
    change: -6,
    record: "9-5",
    division: "Advanced",
  },
           {
    rank: 12,
    slug: "arch",
    logo: "/logos/arch.png",
    name: "Arch",
    flag: "/flags/russia.svg",
    points: 359,
    change: +16,
    record: "10-3",
    division: "Advanced",
  },
            {
    rank: 13,
    slug: "lfo-corh9k",
    logo: "/logos/sornyak.png",
    name: "LFO_COPH9K",
    flag: "/flags/russia.svg",
    points: 339,
    change: +10,
    record: "8-6",
    division: "Advanced",
  },
              {
    rank: 14,
    slug: "uust",
    logo: "/logos/wingman.png",
    name: "UUST_Esports",
    flag: "/flags/russia.svg",
    points: 356,
    change: +10,
    record: "7-7",
    division: "Advanced",
  },
               {
    rank: 15,
    slug: "ex-peep",
    logo: "/logos/peep.png",
    name: "ex-PeeP",
    flag: "/flags/russia.svg",
    points: 325,
    change: -3,
    record: "8-6",
    division: "Advanced",
  },
                 {
    rank: 16,
    slug: "golovastiki",
    logo: "/logos/vpf2.png",
    name: "golovastiki",
    flag: "/flags/russia.svg",
    points: 336,
    change: -6,
    record: "12-2",
    division: "Main",
  },
                   {
    rank: 17,
    slug: "gamesport",
    logo: "/logos/gamesport.png",
    name: "GAMESPORT",
    flag: "/flags/russia.svg",
    points: 344,
    change: +16,
    record: "10-4",
    division: "Main",
  },
                     {
    rank: 18,
    slug: "xcity",
    logo: "/logos/xcity.png",
    name: "Xcity",
    flag: "/flags/russia.svg",
    points: 330,
    change: +4,
    record: "10-4",
    division: "Main",
  },
                       {
    rank: 19,
    slug: "tsa-green",
    logo: "/logos/tsagreen.png",
    name: "TSA Green",
    flag: "/flags/russia.svg",
    points: 336,
    change: -3,
    record: "10-4",
    division: "Main",
  },
                         {
    rank: 20,
    slug: "mellren",
    logo: "/logos/mellren.png",
    name: "mellren",
    flag: "/flags/bel.svg",
    points: 344,
    change: +7,
    record: "9-5",
    division: "Main",
  },
                           {
    rank: 21,
    slug: "nemesis-academy",
    logo: "/logos/nemesis.png",
    name: "Nemesis Academy",
    flag: "/flags/russia.svg",
    points: 329,
    change: +5,
    record: "9-5",
    division: "Main",
  },
                           {
    rank: 22,
    slug: "duggedup",
    logo: "/logos/duggedup.png",
    name: "Duggedup",
    flag: "/flags/russia.svg",
    points: 327,
    change: -4,
    record: "9-5",
    division: "Main",
  },
                            {
    rank: 23,
    slug: "roc-team",
    logo: "/logos/rocteam.png",
    name: "ROC Team",
    flag: "/flags/russia.svg",
    points: 314,
    record: "9-5",
    division: "Main",
  },
                            {
    rank: 24,
    slug: "partizan",
    logo: "/logos/partizan.png",
    name: "PARTIZAN",
    flag: "/flags/russia.svg",
    points: 347,
    change: +20,
    record: "9-5",
    division: "Main",
  },
                            {
    rank: 25,
    slug: "csgopositive",
    logo: "/logos/csgopositive.png",
    name: "CSGOPOSITIVE",
    flag: "/flags/russia.svg",
    points: 338,
    change: +8,
    record: "11-3",
    division: "Main",
  },
                              {
    rank: 26,
    slug: "graf-monte-cristo",
    logo: "/logos/graf.png",
    name: "Graf Monte-Cristo",
    flag: "/flags/russia.svg",
    points: 325,
    change: +21,
    record: "14-0",
    division: "Intermediate",
  },
                                      {
    rank: 27,
    slug: "saqa-omuk",
    logo: "/logos/saqa.png",
    name: "SAQA OMUK",
    flag: "/flags/russia.svg",
    points: 331,
    change: +5,
    record: "12-2",
    division: "Intermediate",
  },
                                    {
    rank: 28,
    slug: "baks-esports",
    logo: "/logos/baks.png",
    name: "BAKS Esports",
    flag: "/flags/russia.svg",
    points: 370,
    change: -5,
    record: "13-1",
    division: "Entry",
  },
                                {
    rank: 29,
    slug: "aogiri",
    logo: "/logos/aogiri.png",
    name: "Aogiri",
    flag: "/flags/russia.svg",
    points: 316,
    change: +4,
    record: "13-1",
    division: "Intermediate",
  },
  
                              {
    rank: 30,
    slug: "platoon-beta",
    logo: "/logos/platoon.png",
    name: "PLATOON BETA",
    flag: "/flags/bel.svg",
    points: 312,
    change: -3,
    record: "8-6",
    division: "Main",
  },
                              {
    rank: 31,
    slug: "wnt",
    logo: "/logos/wnt.png",
    name: "wnT",
    flag: "/flags/russia.svg",
    points: 311,
    change: -2,
    record: "8-6",
    division: "Main",
  },
                                {
    rank: 32,
    slug: "playfire",
    logo: "/logos/playfire.png",
    name: "playfire",
    flag: "/flags/russia.svg",
    points: 287,
    change: -4,
    record: "8-6",
    division: "Main",
  },
                                  {
    rank: 33,
    slug: "olympia",
    logo: "/logos/olympia.png",
    name: "OLYMPIA",
    flag: "/flags/russia.svg",
    points: 306,
    change: +6,
    record: "8-6",
    division: "Main",
      },
                                  {
    rank: 34,
    slug: "clutch-studio-agency",
    name: "Clutch Studio Agency",
    flag: "/flags/russia.svg",
    points: 321,
    change: +12,
    record: "12-2",
    division: "Entry",
      },
                                  {
    rank: 35,
    slug: "fartflow",
    logo: "/logos/fartflow.png",
    name: "FartFlow",
    flag: "/flags/russia.svg",
    points: 290,
    change: -6,
    record: "12-2",
    division: "Entry",
      },
                                  {
    rank: 36,
    slug: "bhemanha",
    name: "BHemanha",
    flag: "/flags/russia.svg",
    points: 308,
    change: +3,
    record: "12-2",
    division: "Entry",
  },
                                      {
    rank: 37,
    slug: "way-In-future",
    logo: "/logos/way.png",
    name: "Way In Future",
    flag: "/flags/russia.svg",
    points: 316,
    change: +16,
    record: "7-7",
    division: "Main",
      },
                                            {
    rank: 38,
    slug: "goldrushers",
    logo: "/logos/hodes.png",
    name: "GoldRushers",
    flag: "/flags/bel.svg",
    points: 302,
    change: -3,
    record: "11-3",
    division: "Entry",
      },
                                      {
    rank: 39,
    slug: "lynx",
    logo: "/logos/lynx.png",
    name: "LYNX",
    flag: "/flags/russia.svg",
    points: 304,
    change: +3,
    record: "11-3",
    division: "Entry",
      },
                                      {
    rank: 40,
    slug: "trafficpills-esports",
    name: "TrafficPills Esports",
    flag: "/flags/bel.svg",
    points: 301,
    change: +1,
    record: "11-3",
    division: "Entry",
      },
                                      {
    rank: 41,
    slug: "kda-team",
    logo: "/logos/kda.png",
    name: "KDA Team",
    flag: "/flags/russia.svg",
    points: 298,
    change: +12,
    record: "11-3",
    division: "Entry",
      },
                                      {
    rank: 42,
    slug: "fortis",
    logo: "/logos/fortis.png",
    name: "FORTIS",
    flag: "/flags/russia.svg",
    points: 281,
    change: -4,
    record: "11-3",
    division: "Entry",
  },
                                      {
    rank: 43,
    slug: "redtigersgaming",
    logo: "/logos/red.png",
    name: "RedTigersGaming",
    flag: "/flags/russia.svg",
    points: 298,
    change: +16,
    record: "7-7",
    division: "Main",
  },
                                      {
    rank: 44,
   slug: "kislyakk",
   logo: "/logos/kislyak.png",
    name: "KISLYAKK",
    flag: "/flags/russia.svg",
    points: 276,
    change: -4,
    record: "7-7",
    division: "Main",
  },
                                       {
    rank: 45,
     slug: "wobuzhidao",
     logo: "/logos/wobuzhidao.png",
    name: "Wobuzhidao",
    flag: "/flags/russia.svg",
    points: 264,
    
    record: "7-7",
    division: "Main",
  },
                                       {
    rank: 46,
    slug: "p7ay3r5",
    logo: "/logos/p7.png",
    name: "P7AY3R5",
    flag: "/flags/russia.svg",
    points: 273,
    
    record: "7-7",
    division: "Main",
  },
                                         {
    rank: 47,
    slug: "dire",
    logo: "/logos/dire.png",
    name: "Dire",
    flag: "/flags/russia.svg",
    points: 261,
    
    record: "7-7",
    division: "Main",
  },
                                         {
    rank: 48,
    slug: "z17",
    logo: "/logos/z17.png",
    name: "Z17",
    flag: "/flags/russia.svg",
    points: 313,
    change: +10,
    record: "7-7",
    division: "Main",
  },
                                          {
    rank: 49,
    slug: "aeternum",
    logo: "/logos/aeternum.png",
    name: "AETERNUM",
    flag: "/flags/russia.svg",
    points: 255,
    change: -4,
    record: "7-7",
    division: "Main",
  },
                                            {
    rank: 50,
    slug: "donatrix",
    logo: "/logos/donatrix.png",
    name: "Donatrix",
    flag: "/flags/russia.svg",
    points: 267,
    change: +3,
    record: "11-3",
    division: "Intermediate",
  },
                                            {
    rank: 51,
    slug: "sakura",
    logo: "/logos/sakura.png",
    name: "Sakura",
    flag: "/flags/russia.svg",
    points: 278,
    change: +4,
    record: "11-3",
    division: "Intermediate",
  },
                                            {
    rank: 52,
    slug: "allinners",
    logo: "/logos/allinners.png",
    name: "ALLINNERS",
    flag: "/flags/kaz.svg",
    points: 267,
    change: -5,
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
    points: 247,
  
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
    points: 267,
    change: +12,
    record: "10-4",
    division: "Intermediate",
  },
                                                {
    rank: 57,
    slug: "team-ka6anbi",
    logo: "/logos/kabani.png",
    name: "TEAM KA6ANbl",
    flag: "/flags/russia.svg",
    points: 247,
    change: -5,
    record: "10-4",
    division: "Intermediate",
  },
                                                {
    rank: 58,
    slug: "wapa",
    logo: "/logos/wapa.png",
    name: "WaPa",
    flag: "/flags/russia.svg",
    points: 258,
    change: -3,
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
    points: 253,
    change: +9,
    record: "9-5",
    division: "Intermediate",
  },
                                                    {
    rank: 62,
    slug: "3nation",
    name: "3Nation",
    flag: "/flags/russia.svg",
    points: 246,
    change: +3,
    record: "9-5",
    division: "Intermediate",
  },
                                                      {
    rank: 63,
    slug: "yelets-esports",
    logo: "/logos/yelets.png",
    name: "Yelets Esports",
    flag: "/flags/russia.svg",
    points: 238,
    change: -3,
    record: "9-5",
    division: "Intermediate",
  },
                                                      {
    rank: 64,
    slug: "1337",
    name: "1337",
    flag: "/flags/russia.svg",
    points: 259,
    change: +7,
    record: "9-5",
    division: "Intermediate",
  },
                                                      {
    rank: 65,
    slug: "turtles",
    logo: "/logos/turtles.png",
    name: "TURTLES",
    flag: "/flags/russia.svg",
    points: 245,
    change: +10,
    record: "9-5",
    division: "Intermediate",
  },
                                                      {
    rank: 66,
    slug: "teamworkers",
    logo: "/logos/teamwork.png",
    name: "TEAMWORKERS",
    flag: "/flags/russia.svg",
    points: 221,
    
    record: "9-5",
    division: "Intermediate",
  },
                                                        {
    rank: 67,
    slug: "weclear",
    logo: "/logos/weclear.png",
    name: "WeClear",
    flag: "/flags/russia.svg",
    points: 265,
    change: +17,
    record: "10-4",
    division: "Entry",
  },
                                                        {
    rank: 68,
    slug: "mayak-arena",
    logo: "/logos/mayakarena.png",
    name: "MAYAK ARENA",
    flag: "/flags/russia.svg",
    points: 242,
    change: -4,
    record: "10-4",
    division: "Entry",
  },
                                                        {
    rank: 69,
    slug: "lan1t",
    logo: "/logos/lan1t.png",
    name: "LAN1T",
    flag: "/flags/russia.svg",
    points: 253,
    change: +18,
    record: "10-4",
    division: "Entry",
  },
                                                        {
    rank: 70,
    slug: "vexar",
    logo: "/logos/vexar.png",
    name: "Vexar",
    flag: "/flags/russia.svg",
    points: 227,
    change: -5,
    record: "10-4",
    division: "Entry",
  },
                                                          {
    rank: 71,
    slug: "prius",
    logo: "/logos/prius.png",
    name: "Prius",
    flag: "/flags/russia.svg",
    points: 221,
   
    record: "10-4",
    division: "Entry",
  },
                                                          {
    rank: 72,
    slug: "goodjob",
    logo: "/logos/good.png",
    name: "GoodJob",
    flag: "/flags/bel.svg",
    points: 225,
    change: -4,
    record: "10-4",
    division: "Entry",
  },
                                                          {
    rank: 73,
    slug: "lanklan",
    name: "LanKlan",
    flag: "/flags/russia.svg",
    points: 225,
    change: -4,
    record: "10-4",
    division: "Entry",
  },
                                                          {
    rank: 74,
    slug: "fate",
    logo: "/logos/fate.png",
    name: "FATE",
    flag: "/flags/russia.svg",
    points: 230,
    change: +3,
    record: "10-4",
    division: "Entry",
  },
                                                            {
    rank: 75,
    slug: "aeris",
    logo: "/logos/aeris.png",
    name: "AERIS",
    flag: "/flags/russia.svg",
    points: 229,
     change: +4,
    record: "10-4",
    division: "Entry",
  },
                                                            {
    rank: 76,
    slug: "dnk",
    logo: "/logos/dnk.png",
    name: "DNK",
    flag: "/flags/kaz.svg",
    points: 234,
    change: +18,
    record: "10-4",
    division: "Entry",
  },
                                                            {
    rank: 77,
    slug: "homo-sapiens",
    name: "homo_sapiens",
    flag: "/flags/russia.svg",
    points: 225,
    change: +4,
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
    slug: "force-syndicate",
    logo: "/logos/force.png",
    name: "Force Syndicate",
    flag: "/flags/russia.svg",
    points: 217,
    change: +7,
    record: "8-6",
    division: "Intermediate",
  },
                                                            {
    rank: 82,
    slug: "all-eyes-on-me",
    logo: "/logos/alleyes.png",
    name: "all eyes on me",
    flag: "/flags/russia.svg",
    points: 227,
    change: +13,
    record: "8-6",
    division: "Intermediate",
  },
                                                            {
    rank: 83,
    slug: "lqnely",
    logo: "/logos/iqneli.png",
    name: "lqnely",
    flag: "/flags/russia.svg",
    points: 198,
   
    record: "8-6",
    division: "Intermediate",
  },
                                                            {
    rank: 84,
    slug: "eon",
    logo: "/logos/eon.png",
    name: "Eon",
    flag: "/flags/russia.svg",
    points: 185,
    
    record: "8-6",
    division: "Intermediate",
  },
                                                            {
    rank: 85,
    slug: "clickbate",
    logo: "/logos/clickbate.png",
    name: "ClickBate",
    flag: "/flags/russia.svg",
    points: 201,
    change: -4,
    record: "8-6",
    division: "Intermediate",
  },
                                                              {
    rank: 86,
    slug: "fak1e-lab",
    logo: "/logos/fakie.png",
    name: "Fak1E Lab",
    flag: "/flags/russia.svg",
    points: 220,
    change: +16,
    record: "9-5",
    division: "Entry",
  },
                                                              {
    rank: 87,
    slug: "mana",
    name: "MANA",
    flag: "/flags/russia.svg",
    points: 223,
    change: +23,
    record: "9-5",
    division: "Entry",
  },
                                                              {
    rank: 88,
    slug: "smokinsexxystyle",
    logo: "/logos/smoki.png",
    name: "SmokinSexxyStyle",
    flag: "/flags/russia.svg",
    points: 189,
   
    record: "9-5",
    division: "Entry",
  },
                                                              {
    rank: 89,
    slug: "eternal",
    logo: "/logos/eternal.png",
    name: "eternal",
    flag: "/flags/russia.svg",
    points: 187,
   
    record: "9-5",
    division: "Entry",
  },
                                                              {
    rank: 90,
    slug: "fusion",
    logo: "/logos/fusion.png",
    name: "FUSION",
    flag: "/flags/russia.svg",
    points: 185,
    
    record: "9-5",
    division: "Entry",
  },
                                                                {
    rank: 91,
    slug: "posle-zavoda",
    name: "POSLE ZAVODA",
    flag: "/flags/russia.svg",
    points: 184,
    
    record: "9-5",
    division: "Entry",
  },
                                                                {
    rank: 92,
    slug: "thekomyakz",
    logo: "/logos/thekom.png",
    name: "THEKOMYAKZ",
    flag: "/flags/russia.svg",
    points: 181,
    
    record: "9-5",
    division: "Entry",
  },
                                                                {
    rank: 93,
    slug: "nightmare-esports",
    logo: "/logos/nightmare.png",
    name: "Nightmare Esports",
    flag: "/flags/russia.svg",
    points: 213,
    change: +23,
    record: "9-5",
    division: "Entry",
  },
                                                                {
    rank: 94,
    slug: "s1wka-team",
    logo: "/logos/siwka.png",
    name: "S1WKA Team",
    flag: "/flags/russia.svg",
    points: 184,
    change: -4,
    record: "9-5",
    division: "Entry",
  },
                                                                  {
    rank: 95,
    slug: "flame-guardians",
    logo: "/logos/flameguardians.png",
    name: "Flame Guardians",
    flag: "/flags/russia.svg",
    points: 196,
    change: +6,
    record: "7-7",
    division: "Intermediate",
  },
                                                              {
    rank: 96,
    slug: "ne-priehali",
    logo: "/logos/nepriehali.png",
    name: "NE PRIEHALI",
    flag: "/flags/russia.svg",
    points: 165,
    change: -4,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 97,
    slug: "magic-fairies",
    logo: "/logos/magic.png",
    name: "Magic Fairies",
    flag: "/flags/russia.svg",
    points: 183,
    change: -4,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 98,
    slug: "youth4ez",
    logo: "/logos/you.png",
    name: "YouTH4eZ",
    flag: "/flags/russia.svg",
    points: 162,
    
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 99,
    slug: "ronins",
    name: "Ronins",
    flag: "/flags/russia.svg",
    points: 178,
    change: -3,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 100,
    slug: "donstu-youngsters",
    logo: "/logos/donstuyoung.png",
    name: "DONSTU YOUNGSTERS",
    flag: "/flags/russia.svg",
    points: 186,
    change: +6,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 101,
    slug: "quazar-school",
    logo: "/logos/quazarschool.png",
    name: "QUAZAR SCHOOL",
    flag: "/flags/russia.svg",
    points: 165,
    change: -4,
    record: "7-7",
    division: "Intermediate",
  },
                                                                {
    rank: 102,
    slug: "gsq",
    logo: "/logos/gsq.png",
    name: "GSQ",
    flag: "/flags/russia.svg",
    points: 189,
    change: -2,
    record: "7-7",
    division: "Intermediate",
  },
                                                                  {
    rank: 103,
    slug: "c0b0r",
    name: "c0b0r",
    flag: "/flags/russia.svg",
    points: 163,
    
    record: "6-8",
    division: "Intermediate",
  },
                                                                  {
    rank: 104,
    slug: "eca-esports",
    logo: "/logos/eca.png",
    name: "ECA Esports",
    flag: "/flags/russia.svg",
    points: 165,
    change: +3,
    record: "9-5",
    division: "Entry",
  },
                                                                  {
    rank: 105,
    slug: "pivstar",
    name: "pivstar",
    flag: "/flags/russia.svg",
    points: 164,
    change: -4,
    record: "9-5",
    division: "Entry",
  },
                                                                  {
    rank: 106,
    slug: "fnbet",
    logo: "/logos/fnb.png",
    name: "FNbet",
    flag: "/flags/russia.svg",
    points: 177,
    change: +11,
    record: "9-5",
    division: "Entry",
  },
                                                                  {
    rank: 107,
    slug: "urat",
    name: "UraT",
    flag: "/flags/russia.svg",
    points: 169,
    change: +5,
    record: "9-5",
    division: "Entry",
  },
                                                                    {
    rank: 108,
    slug: "unknowns",
    logo: "/logos/unknow.png",
    name: "unknowns",
    flag: "/flags/russia.svg",
    points: 199,
    change: +23,
    record: "9-5",
    division: "Entry",
  },
                                                                    {
    rank: 109,
    slug: "dodg3rs",
    logo: "/logos/dodg.png",
    name: "dodg3rs",
    flag: "/flags/russia.svg",
    points: 144,
    change: -4,
    record: "9-5",
    division: "Entry",
  },
                                                                    {
    rank: 110,
    slug: "sixseven",
    logo: "/logos/sixseven.png",
    name: "SixSeven",
    flag: "/flags/russia.svg",
    points: 153,
    change: -4,
    record: "9-5",
    division: "Entry",
  },
                                                                      {
    rank: 111,
    slug: "stubborn-boys",
    name: "Stubborn Boys",
    flag: "/flags/bel.svg",
    points: 144,
    change: -4,
    record: "8-6",
    division: "Entry",
  },
                                                                        {
    rank: 112,
    slug: "critical",
    logo: "/logos/critical.png",
    name: "Critical",
    flag: "/flags/russia.svg",
    points: 152,
    change: -4,
    record: "8-6",
    division: "Entry",
  },
                                                                        {
    rank: 113,
    slug: "mephi",
    logo: "/logos/mephi.png",
    name: "MEPHI",
    flag: "/flags/russia.svg",
    points: 149,
    change: -4,
    record: "8-6",
    division: "Entry",
  },
                                                                        {
    rank: 114,
    slug: "zbk",
    logo: "/logos/zbk.png",
    name: "ZBK",
    flag: "/flags/russia.svg",
    points: 131,
    
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 115,
    slug: "ha-ncuxotponhbix",
    logo: "/logos/ha.png",
    name: "Ha ncuxoTPonHblx",
    flag: "/flags/russia.svg",
    points: 127,
    
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 116,
    slug: "kynetic",
    logo: "/logos/kynetic.png",
    name: "Kynetic",
    flag: "/flags/russia.svg",
    points: 133,
    
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 117,
    slug: "outsiders",
    logo: "/logos/out.png",
    name: "Outsiders",
    flag: "/flags/russia.svg",
    points: 123,
    
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 118,
    slug: "m0nkeys",
    logo: "/logos/monkeys.png",
    name: "m0nkeys",
    flag: "/flags/russia.svg",
    points: 129,
   
    record: "8-6",
    division: "Entry",
  },
                                                                          {
    rank: 119,
    slug: "1minute",
    logo: "/logos/1min.png",
    name: "1Minute",
    flag: "/flags/russia.svg",
    points: 135,
    change: -4,
    record: "8-6",
    division: "Entry",
  },
                                                                            {
    rank: 120,
    slug: "only-gamers",
    logo: "/logos/only.png",
    name: "ONLY GAMERS",
    flag: "/flags/uzb.svg",
    points: 126,
    
    record: "8-6",
    division: "Entry",
  },
                                                                            {
    rank: 121,
    slug: "inputlag-enjoyers",
    logo: "/logos/input.png",
    name: "inputlag enjoyers",
    flag: "/flags/russia.svg",
    points: 123,
    
    record: "8-6",
    division: "Entry",
  },
                                                                            {
    rank: 122,
    slug: "justtag",
    name: "JustTag",
    flag: "/flags/russia.svg",
    points: 113,
    
    record: "8-6",
    division: "Entry",
  },
                                                                              {
    rank: 123,
    slug: "leetcase",
    logo: "/logos/leet.png",
    name: "LeetCase",
    flag: "/flags/russia.svg",
    points: 146,
    change: -2,
    record: "8-6",
    division: "Entry",
  },
                                                                              {
    rank: 124,
    slug: "w1nks",
    logo: "/logos/winks.png",
    name: "W1NKS",
    flag: "/flags/russia.svg",
    points: 110,
    
    record: "8-6",
    division: "Entry",
  },
                                                                              {
    rank: 125,
    slug: "bestaimmers",
    logo: "/logos/best.png",
    name: "bestAIMMERS",
    flag: "/flags/russia.svg",
    points: 108,
    
    record: "8-6",
    division: "Entry",
  },
                                                                              {
    rank: 126,
    slug: "the-relics",
    logo: "/logos/relics.png",
    name: "The Relics",
    flag: "/flags/russia.svg",
    points: 113,
    
    record: "8-6",
    division: "Entry",
  },
                                                                                {
    rank: 127,
    slug: "kagen",
    logo: "/logos/kagen.png",
    name: "KageN",
    flag: "/flags/russia.svg",
    points: 103,
    
    record: "8-6",
    division: "Entry",
  },
                                                                                {
    rank: 128,
    slug: "back2back",
    name: "back2back",
    flag: "/flags/russia.svg",
    points: 117,
    change: -4,
    record: "8-6",
    division: "Entry",
  },
                                                                                {
    rank: 129,
    slug: "full-dobro",
    logo: "/logos/full.png",
    name: "Full Dobro",
    flag: "/flags/russia.svg",
    points: 100,
    
    record: "8-6",
    division: "Entry",
  },
                                                                                  {
    rank: 130,
    slug: "ronin",
    logo: "/logos/ronin.png",
    name: "RONIN",
    flag: "/flags/kaz.svg",
    points: 121,
    change: +7,
    record: "7-7",
    division: "Entry",
  },

                                                                                  {
    rank: 131,
    slug: "emlight",
    logo: "/logos/eml.png",
    name: "Emlight",
    flag: "/flags/russia.svg",
    points: 97,
    
    record: "7-7",
    division: "Entry",
  },
                                                                                    {
    rank: 132,
    slug: "cybercom",
    logo: "/logos/cybercom.png",
    name: "CYBERCOM",
    flag: "/flags/russia.svg",
    points: 96,
    
    record: "7-7",
    division: "Entry",
  },
    {
    rank: 133,
     slug: "kittadiena",
     logo: "/logos/kitta.png",
    name: "KittaDiena",
    flag: "/flags/russia.svg",
    points: 262,
    record: "7-7",
    division: "Main",
  }
]

function App() {
  const location = useLocation()
  const navigate = useNavigate()

  const [selectedDivision, setSelectedDivision] = useState("All")
  const [showModal, setShowModal] = useState(false)

  const [teamName, setTeamName] = useState("")
  const [faceitLink, setFaceitLink] = useState("")
  const [contact, setContact] = useState("")
  const [note, setNote] = useState("")

  const [search, setSearch] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [divisionSearch, setDivisionSearch] = useState("")

  const searchRef = useRef(null)

  const isActive = (path) => location.pathname === path

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.points - a.points),
    []
  )
const divisions = [
  "All",
  "Advanced",
  "Main",
  "Intermediate",
  "Entry"
]

const filteredDivisions = divisions.filter((division) =>
  division.toLowerCase().includes(divisionSearch.toLowerCase())
)

const filteredTeams =
  selectedDivision === "All"
    ? sortedTeams
    : sortedTeams.filter(
        (team) => team.division === selectedDivision
      )

  const submitTeam = async () => {
    try {
      const response = await fetch("/api/submit-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName,
          faceitLink,
          contact,
          note,
        }),
      })

      await response.json()

      alert("Application sent ✅")
      setShowModal(false)

      setTeamName("")
      setFaceitLink("")
      setContact("")
      setNote("")
    } catch (error) {
      console.error(error)
      alert("Something went wrong ❌")
    }
  }

  // ENTER + ESC
  const handleSearchKey = (e) => {
    if (e.key === "Enter" && search.trim()) {
      const found = sortedTeams.find((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
      )

      if (found) {
        navigate(`/teams/${found.slug}`)
        setShowSearch(false)
        setSearch("")
      }
    }

    if (e.key === "Escape") {
      setShowSearch(false)
      setSearch("")
    }
  }

  // OUTSIDE CLICK + ESC
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setShowSearch(false)
        setSearch("")
      }
    }

    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearch(false)
        setSearch("")
      }
    }

    window.addEventListener("keydown", handleKey)
    window.addEventListener("mousedown", handleClick)

    return () => {
      window.removeEventListener("keydown", handleKey)
      window.removeEventListener("mousedown", handleClick)
    }
  }, [])

  return (
    <div className="min-h-screen text-white bg-[#05070a]">

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-[#0b0f14]/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">

          <Link
            to="/"
            className="text-xl md:text-2xl font-bold text-orange-500 hover:text-orange-400 transition"
          >
            Esea Tracker
          </Link>

          <div className="flex gap-6 text-sm">
            {["/", "/Media", "/about"].map((path) => (
              <Link
                key={path}
                to={path}
                className={`transition ${
                  isActive(path)
                    ? "text-white border-b border-orange-500"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {path === "/"
                  ? "Rankings"
                  : path.replace("/", "").replace("Media", "Media").replace("about", "About")}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">

            {/* SEARCH BUTTON */}
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-lg bg-[#0f131a] border border-white/5 text-gray-400 hover:text-white hover:bg-[#121a25] transition"
            >
              🔍
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="bg-[#0f131a] border border-white/5 text-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-[#121a25] hover:text-white transition"
            >
              Submit Team
            </button>

          </div>
        </div>
      </nav>

<div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
  <div className="flex flex-wrap gap-2">

    <button
      onClick={() => setSelectedDivision("All")}
      className={`px-4 py-2 rounded-lg text-sm transition ${
        selectedDivision === "All"
          ? "bg-orange-500 text-white"
          : "bg-[#0f131a] border border-white/5 text-gray-300 hover:bg-[#121a25]"
      }`}
    >
      All
    </button>

    {divisions
      .filter((d) =>
        d.toLowerCase().includes(divisionSearch.toLowerCase())
      )
      .filter((d) => d !== "All")
      .map((division) => (
        <button
          key={division}
          onClick={() => setSelectedDivision(division)}
          className={`px-4 py-2 rounded-lg text-sm transition ${
            selectedDivision === division
              ? "bg-orange-500 text-white"
              : "bg-[#0f131a] border border-white/5 text-gray-300 hover:bg-[#121a25]"
          }`}
        >
          {division}
        </button>
      ))}

  </div>


</div>

      {/* TABLE (UNCHANGED) */}
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">

            <div className="grid grid-cols-[80px_2fr_170px_120px_140px] bg-[#0f141a] p-4 text-gray-400 text-sm font-semibold rounded-xl border border-white/5">
              <div>Rank</div>
              <div>Team</div>
              <div>Points</div>
              <div>Record</div>
              <div>Division</div>
            </div>

            <div className="space-y-2 mt-3">
              {filteredTeams.map((team, index) => {

                const change = team.change ?? 0

                let indicator = (
                  <span className="ml-2 text-gray-500 text-xs">•</span>
                )

                if (change > 0) {
                  indicator = (
                    <span className="ml-2 text-green-400 text-xs">
                      ▲ +{change}
                    </span>
                  )
                } else if (change < 0) {
                  indicator = (
                    <span className="ml-2 text-red-400 text-xs">
                      ▼ {change}
                    </span>
                  )
                }

                return (
                  <Link
                    key={team.slug}
                    to={`/teams/${team.slug}`}
                    className="
                      group grid grid-cols-[80px_2fr_170px_120px_140px]
                      items-center
                      p-4
                      bg-[#0c1016]
                      border border-white/5
                      rounded-xl
                      relative overflow-hidden
                      transition-all duration-300
                      hover:-translate-y-[3px]
                      hover:bg-[#121a25]
                      hover:border-orange-500/20
                      hover:shadow-[0_18px_45px_rgba(0,0,0,0.75)]
                      hover:z-10
                    "
                  >

                    <div className="text-orange-400 font-bold">
                      #{index + 1}
                    </div>

                    <div className="flex items-center gap-3 min-w-0">
                      <img src={team.flag} className="w-5 h-5" />
                      <img src={team.logo} className="w-9 h-9" />
                      <span className="truncate font-semibold group-hover:text-orange-400 transition">
                        {team.name}
                      </span>
                    </div>

                    <div className="font-semibold flex items-center">
                      {team.points}
                      {indicator}
                    </div>

                    <div className="text-gray-300">
                      {team.record}
                    </div>

                    <div className="text-orange-400 font-medium">
                      {team.division}
                    </div>

                  </Link>
                )
              })}
            </div>

          </div>
        </div>
      </div>

      {/* SEARCH (CENTER MODAL - HLTV STYLE) */}
      {showSearch && (
        <div
          className="fixed inset-0 bg-black/70 flex items-start justify-center pt-28 z-50"
          onClick={() => {
            setShowSearch(false)
            setSearch("")
          }}
        >
          <div
            ref={searchRef}
            className="w-full max-w-2xl bg-[#0b0f14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >

            {/* INPUT */}
            <div className="p-4 border-b border-white/5">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKey}
                placeholder="Search teams..."
                className="w-full p-3 bg-[#0f131a] text-white outline-none rounded-lg"
              />
            </div>

            {/* RESULTS */}
            <div className="max-h-[400px] overflow-y-auto">

              {sortedTeams
                .filter((t) =>
                  t.name.toLowerCase().includes(search.toLowerCase())
                )
                .slice(0, 8)
                .map((team) => (
                  <div
                    key={team.slug}
                    onClick={() => {
                      navigate(`/teams/${team.slug}`)
                      setShowSearch(false)
                      setSearch("")
                    }}
                    className="
                      flex items-center gap-3 p-3
                      hover:bg-[#121a25]
                      cursor-pointer
                      transition
                      border-b border-white/5
                    "
                  >

                    <img src={team.flag} className="w-5 h-5" />
                    <img src={team.logo} className="w-8 h-8" />

                    <div className="flex flex-col">
                      <span className="text-white font-medium">
                        {team.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {team.division} • {team.points} pts
                      </span>
                    </div>

                  </div>
                ))}

              {search && sortedTeams.filter((t) =>
                t.name.toLowerCase().includes(search.toLowerCase())
              ).length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  No teams found
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* MODAL (UNCHANGED) */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#0b0f14] p-6 rounded-xl w-[400px]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg mb-2">Submit Team</h2>

            <input
              className="w-full p-2 mb-2 bg-[#121a25] rounded"
              placeholder="Team Name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />

            <input
              className="w-full p-2 mb-2 bg-[#121a25] rounded"
              placeholder="Faceit Link"
              value={faceitLink}
              onChange={(e) => setFaceitLink(e.target.value)}
            />

            <input
              className="w-full p-2 mb-2 bg-[#121a25] rounded"
              placeholder="Contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />

            <textarea
              className="w-full p-2 mb-3 bg-[#121a25] rounded"
              placeholder="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button
              onClick={submitTeam}
              className="bg-orange-500 w-full py-2 rounded hover:bg-orange-600 transition"
            >
              Send
            </button>
          </div>
        </div>
      )}

{/* FEEDBACK BUTTON */}
<a
  href="https://t.me/LisssTzz1" // <- замени на свой Telegram
  target="_blank"
  rel="noopener noreferrer"
  className="
    fixed
    bottom-4
    right-4
    bg-orange-500
    hover:bg-orange-600
    text-white
    font-bold
    px-4
    py-3
    rounded-full
    shadow-lg
    transition-colors
    z-50
  "
>
  💬 Feedback
</a>

    </div>
  )
}

export default App