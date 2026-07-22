import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#090d13] px-4 py-3 shadow-2xl">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-black text-orange-400">
        {payload[0]?.value} rating
      </div>
    </div>
  );
}

function RatingHistory({ data }) {
  return (
    <section className="rounded-[24px] border border-white/[0.07] bg-[#101722] p-5 md:p-7">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-400">
            Progress
          </div>

          <h2 className="mt-1 text-2xl font-black text-white">
            Rating history
          </h2>
        </div>

        <div className="text-sm text-slate-600">
          Updated after rating recalculation
        </div>
      </div>

      {data.length ? (
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                stroke="rgba(148,163,184,0.13)"
                strokeDasharray="4 6"
                vertical
              />

              <XAxis
                dataKey="week"
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
              />

              <YAxis
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                domain={["dataMin - 40", "dataMax + 40"]}
              />

              <Tooltip content={<CustomTooltip />} />

              <Line
                type="monotone"
                dataKey="rating"
                stroke="#fb923c"
                strokeWidth={4}
                dot={{
                  r: 4,
                  fill: "#fb923c",
                  stroke: "#101722",
                  strokeWidth: 3,
                }}
                activeDot={{
                  r: 6,
                  fill: "#fdba74",
                  stroke: "#101722",
                  strokeWidth: 3,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-14 text-center text-sm text-slate-500">
          Rating history is not available yet.
        </div>
      )}
    </section>
  );
}

export default RatingHistory;
