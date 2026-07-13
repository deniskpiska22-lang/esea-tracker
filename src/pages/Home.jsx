export default function Home() {

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">

      <h1 className="text-4xl font-bold">
        ESEA Tracker
      </h1>

      <p className="mt-2 text-gray-400">
        Follow CIS teams in ESEA.
      </p>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">


        {/* Upcoming Matches */}

        <div className="
          bg-[#0f141a]
          border border-white/5
          rounded-2xl
          p-6
        ">

          <h2 className="text-xl font-semibold mb-6">
            Upcoming Matches
          </h2>

          <div className="text-gray-500">
            No upcoming matches
          </div>

        </div>



        {/* Recent Results */}

        <div className="
          bg-[#0f141a]
          border border-white/5
          rounded-2xl
          p-6
        ">

          <h2 className="text-xl font-semibold mb-6">
            Recent Results (24h)
          </h2>

          <div className="text-gray-500">
            No recent matches
          </div>

        </div>


      </div>

    </div>
  );
}