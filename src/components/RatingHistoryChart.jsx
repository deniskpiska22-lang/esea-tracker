import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function RatingHistoryChart({ data }) {
  return (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  initialDimension={{ width: 640, height: 384 }}
                >
                  <LineChart
                    data={data}
                  >
                    <CartesianGrid
                      stroke="rgba(148,163,184,0.10)"
                      strokeDasharray="4 6"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="week"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "#64748b",
                        fontSize: 12,
                      }}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "#64748b",
                        fontSize: 12,
                      }}
                      domain={[
                        "dataMin - 30",
                        "dataMax + 30",
                      ]}
                    />

                    <Tooltip
                      formatter={(
                        value,
                        name,
                        item
                      ) => {
                        if (
                          name === "rating"
                        ) {
                          const rank =
                            item?.payload?.rank;

                          return [
                            rank
                              ? `${value} · World #${rank}`
                              : value,
                            "Rating",
                          ];
                        }

                        return [
                          value,
                          name,
                        ];
                      }}
                      contentStyle={{
                        background: "#090d13",
                        border:
                          "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "14px",
                        color: "#fff",
                        boxShadow:
                          "0 20px 50px rgba(0,0,0,0.35)",
                      }}
                      labelStyle={{
                        color: "#94a3b8",
                      }}
                      itemStyle={{
                        color: "#fb923c",
                        fontWeight: 800,
                      }}
                      cursor={{
                        stroke:
                          "rgba(251,146,60,0.25)",
                      }}
                    />

                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="rating"
                      stroke="#f97316"
                      strokeWidth={4}
                      dot={{
                        r: 3,
                        fill: "#f97316",
                        stroke: "#101720",
                        strokeWidth: 2,
                      }}
                      activeDot={{
                        r: 6,
                        fill: "#fb923c",
                        stroke: "#101720",
                        strokeWidth: 3,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
  );
}
