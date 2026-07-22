import { Link, useLocation } from "react-router-dom";

const tabs = [
  { label: "Overview", suffix: "" },
  { label: "Matches", suffix: "/matches" },
  { label: "Players", suffix: "/players" },
  { label: "Map Stats", suffix: "/maps" },
  { label: "Statistics", suffix: "/stats" },
];

function TeamTabs({ slug }) {
  const location = useLocation();

  return (
    <nav className="overflow-x-auto border-b border-white/[0.07]">
      <div className="flex min-w-max gap-2 pb-3">
        {tabs.map((tab) => {
          const to = `/teams/${slug}${tab.suffix}`;
          const active = location.pathname === to;

          return (
            <Link
              key={tab.label}
              to={to}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                active
                  ? "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default TeamTabs;
