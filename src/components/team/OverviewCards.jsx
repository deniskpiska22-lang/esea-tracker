function OverviewCards({ stats, rating, ratingLoading, streak }) {
  const cards = [
    {
      label: "Matches",
      value: stats.total,
      accent: "text-white",
      line: "from-slate-500/0 via-slate-300/40 to-slate-500/0",
    },
    {
      label: "Wins",
      value: stats.wins,
      accent: "text-emerald-400",
      line: "from-emerald-500/0 via-emerald-400/70 to-emerald-500/0",
    },
    {
      label: "Win rate",
      value: `${stats.winrate}%`,
      accent: "text-orange-400",
      line: "from-orange-500/0 via-orange-400/70 to-orange-500/0",
    },
    {
      label: "Current streak",
      value: streak,
      accent: String(streak).startsWith("W")
        ? "text-emerald-400"
        : String(streak).startsWith("L")
          ? "text-rose-400"
          : "text-white",
      line: "from-sky-500/0 via-sky-400/50 to-sky-500/0",
    },
    {
      label: "Rating",
      value: ratingLoading ? "..." : rating,
      accent: "text-sky-400",
      line: "from-sky-500/0 via-sky-400/60 to-sky-500/0",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101722] p-5"
        >
          <div
            className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${card.line}`}
          />

          <div className="text-sm font-medium text-slate-500">
            {card.label}
          </div>

          <div className={`mt-2 text-3xl font-black ${card.accent}`}>
            {card.value}
          </div>
        </div>
      ))}
    </section>
  );
}

export default OverviewCards;
