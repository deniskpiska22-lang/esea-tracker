function About() {
  return (
    <div className="min-h-screen text-white bg-[#05070a]">

      {/* background glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,140,0,0.06),transparent_60%)] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-12 relative">

        

        {/* TITLE BLOCK */}
        <div className="mb-12">

          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            About <span className="text-orange-500">Esea Tracker</span>
          </h1>

          <p className="text-gray-400 mt-4 max-w-3xl leading-7">
            An independent ranking platform for ESEA teams.
            Our goal is to track progress, support the competitive scene, and build a unified ranking for semi-professional teams.
          </p>

        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CARD */}
          <div className="bg-[#0c1016] border border-white/5 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-orange-500/20 transition">

            <h2 className="text-lg font-semibold text-orange-400 mb-4">
              Project
            </h2>

            <p className="text-gray-300 leading-7">
              ESEA Tracker was created to give more visibility to teams outside the tier-one scene.
              Many teams in Advanced, Main, Intermediate, and Entry receive little or no media coverage.
            </p>

            <p className="text-gray-400 leading-7 mt-4">
              The ranking is based on match results, consistency, and division strength.
            </p>

          </div>

          {/* CARD */}
          <div className="bg-[#0c1016] border border-white/5 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-orange-500/20 transition">

            <h2 className="text-lg font-semibold text-orange-400 mb-4">
              Features
            </h2>

            <ul className="space-y-2 text-gray-300">
              <li>• ESEA team rankings</li>
              <li>• Team pages with analytics</li>
              <li>• Division-based structure</li>
              <li>• Statistics and ranking trends</li>
              <li>• Mobile-first interface</li>
            </ul>

          </div>

          {/* CARD */}
          <div className="bg-[#0c1016] border border-white/5 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-orange-500/20 transition">

            <h2 className="text-lg font-semibold text-orange-400 mb-4">
              Ranking system
            </h2>

            <div className="space-y-4 text-gray-300">

              <div>
                <div className="text-white font-medium">Advanced</div>
                <div className="text-gray-400 text-sm">
                  Higher multiplier and match weight
                </div>
              </div>

              <div>
                <div className="text-white font-medium">Main</div>
                <div className="text-gray-400 text-sm">
                  Consistency and win bonuses
                </div>
              </div>

              <div>
                <div className="text-white font-medium">Intermediate / Entry</div>
                <div className="text-gray-400 text-sm">
                  Progress and baseline win rate
                </div>
              </div>

            </div>

          </div>

          {/* CARD */}
          <div className="bg-[#0c1016] border border-white/5 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:border-orange-500/20 transition">

            <h2 className="text-lg font-semibold text-orange-400 mb-4">
              Creator
            </h2>

            <p className="text-gray-300 leading-7">
              The project was created by a CS2 coach working with developing players and teams.
            </p>

            <p className="text-gray-400 leading-7 mt-4">
              The focus is on growing the scene and increasing the visibility of promising players.
            </p>

            <div className="mt-6 space-y-2">

              <a
                href="https://t.me/LisssTzz1"
                target="_blank"
                rel="noreferrer"
                className="text-orange-400 hover:text-orange-300 transition block"
              >
                Telegram → @LisssTzz1
              </a>

              <a
                href="mailto:deadinsidick11@mail.ru"
                className="text-orange-400 hover:text-orange-300 transition block"
              >
                Email → deadinsidick11@mail.ru
              </a>

            </div>

          </div>

        </div>

      </div>
    </div>
  )
}

export default About