import React from "react"
import { Link } from "react-router-dom"
import posts from "../data/posts"

function MediaPage() {
  return (
    <div className="min-h-screen text-white bg-[#05070a]">

      {/* background glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,140,0,0.06),transparent_60%)] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 relative">

       

        {/* FEED */}
        <div className="space-y-5">

          {[...posts].reverse().map((post) => (
            <div
              key={post.id}
              className="
                bg-[#0b0f14]
                border border-white/5
                rounded-xl
                overflow-hidden
                shadow-[0_8px_22px_rgba(0,0,0,0.55)]
                hover:border-orange-500/20
                transition
              "
            >

              {/* TOP BAR */}
              <div className="flex items-center gap-4 p-4 border-b border-white/5">

                <img
                  src={post.logo}
                  alt={post.team}
                  className="w-9 h-9 rounded-md object-contain"
                />

                <div className="flex flex-col">
                  <span className="font-semibold text-white text-sm">
                    {post.team}
                  </span>

                  <span className="text-xs text-gray-500">
                    {post.time}
                  </span>
                </div>

              </div>

              {/* CONTENT */}
              <div className="p-4">

                <p className="text-gray-300 leading-7 mb-4 text-base">
                  {post.text}
                </p>

                {/* IMAGE — NO HOVER EFFECT AT ALL */}
                <div className="overflow-hidden rounded-lg border border-white/5">
                  <img
                    src={post.image}
                    alt="post"
                    className="w-full block"
                  />
                </div>

                {/* ACTION */}
                <div className="mt-4 flex justify-end">

                  <a
                    href={post.link}
                    target="_blank"
                    rel="noreferrer"
                    className="
                      bg-orange-500/90
                      hover:bg-orange-500
                      px-4 py-2
                      rounded-lg
                      font-semibold
                      text-sm
                      transition
                      shadow-[0_0_15px_rgba(255,140,0,0.10)]
                    "
                  >
                    Open Post
                  </a>

                </div>

              </div>

            </div>
          ))}

        </div>

      </div>
    </div>
  )
}

export default MediaPage