import TeamLinks from "./TeamLinks"

export default function TeamCard({ team }) {
  return (
    <div className="group relative bg-[#0f1419] border border-white/10 rounded-2xl p-5 w-full max-w-md overflow-hidden transition hover:border-white/20 hover:scale-[1.02]">

      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 pointer-events-none" />

      <div className="flex items-center justify-between relative">
        
        <div className="flex items-center gap-3">
          <img
            src={team.logo}
            alt={team.name}
            className="w-12 h-12 rounded-lg object-cover border border-white/10"
          />

          <div>
            <h2 className="text-white font-semibold text-lg">
              {team.name}
            </h2>
            <p className="text-gray-400 text-sm">
              {team.region || "EU"}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-400">RANK</p>
          <p className="text-white font-bold text-lg">
            #{team.rank}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5 relative">
        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs">POINTS</p>
          <p className="text-white font-semibold">{team.points}</p>
        </div>

        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs">WINS</p>
          <p className="text-green-400 font-semibold">{team.wins}</p>
        </div>

        <div className="bg-white/5 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs">LOSS</p>
          <p className="text-red-400 font-semibold">{team.losses}</p>
        </div>
      </div>

      <div className="mt-5 relative">
        <p className="text-gray-400 text-xs mb-2">PLAYERS</p>
        <div className="flex flex-wrap gap-2">
          {team.players?.map((p, i) => (
            <span
              key={i}
              className="bg-white/5 px-2 py-1 rounded-md text-xs text-gray-300"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 relative">
        <TeamLinks links={team.socials} />
      </div>
    </div>
  )
}