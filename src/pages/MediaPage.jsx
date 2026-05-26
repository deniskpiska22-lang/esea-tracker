import posts from "../data/posts"

function MediaPage() {
  return (
    <div className="bg-[#0f1419] min-h-screen text-white px-4 md:px-8 py-8">

      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-10">

        <h1 className="text-4xl md:text-5xl font-bold text-orange-500">
          Media
        </h1>

        <p className="text-gray-400 mt-3 text-lg">
          Community posts, rankings updates and CIS scene highlights.
        </p>

      </div>

      {/* POSTS */}
      <div className="max-w-4xl mx-auto grid gap-6">

        {[...posts].reverse().map((post) => (
          <div
            key={post.id}
            className="bg-[#141922] border border-gray-800 rounded-2xl overflow-hidden shadow-xl"
          >

            {/* TOP */}
            <div className="flex items-center gap-4 p-5 border-b border-gray-800">

              <img
                src={post.logo}
                alt={post.team}
                className="w-12 h-12 object-contain"
              />

              <div>
                <h2 className="font-bold text-lg">
                  {post.team}
                </h2>

                <p className="text-gray-500 text-sm">
                  {post.time}
                </p>
              </div>

            </div>

            {/* TEXT */}
            <div className="p-5">

              <p className="text-gray-300 text-lg mb-5">
                {post.text}
              </p>

              {/* IMAGE */}
              <img
                src={post.image}
                alt="post"
                className="rounded-xl border border-gray-800 w-full"
              />

              {/* BUTTON */}
              <a
                href={post.link}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-5 bg-orange-500 hover:bg-orange-600 transition px-5 py-3 rounded-xl font-semibold"
              >
                Open Post
              </a>

            </div>

          </div>
        ))}

      </div>
    </div>
  )
}

export default MediaPage