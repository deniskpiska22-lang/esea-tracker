import { Link, useParams } from "react-router-dom";
import teams from "../data/teams";
import mapsData from "../data/maps";

function MapsPage() {
  const { slug } = useParams();

  const team = teams.find((t) => t.slug === slug);
  const teamMaps = mapsData?.[slug] ?? [];

  return (
    <div className="bg-[#0b0f14] min-h-screen text-white px-4 py-8">
      <div className="max-w-6xl mx-auto">

        <Link
          to={`/team/${slug}`}
          className="text-orange-400 hover:text-orange-300"
        >
          ← Back to Team
        </Link>

        <h1 className="text-4xl font-black mt-4 mb-8">
          {team?.name} Maps
        </h1>

        <div className="space-y-4">

  {teamMaps.map((map) => (

    <div
      key={map.name}
      className="
        bg-[#111823]
        border
        border-[#243041]
        rounded-2xl
        p-5
      "
    >

      <div className="flex justify-between items-center mb-3">

        <div>

          <div className="text-xl font-bold">
            {map.name}
          </div>

          <div className="text-gray-500 text-sm">
            {map.played} games played
          </div>

        </div>

        <div className="text-2xl font-black text-orange-400">
          {map.winrate}%
        </div>

      </div>

      <div className="w-full bg-[#1c2635] rounded-full h-3">

        <div
          className="bg-orange-500 h-3 rounded-full"
          style={{
            width: `${map.winrate}%`
          }}
        />

      </div>

    </div>

  ))}

</div>

      </div>
    </div>
  );
}

export default MapsPage;