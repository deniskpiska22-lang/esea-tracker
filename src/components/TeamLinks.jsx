import { FaTwitter, FaInstagram, FaTwitch, FaGlobe } from "react-icons/fa"
import { SiFaceit } from "react-icons/si"

export default function TeamLinks({ links }) {
  return (
    <div className="flex gap-4 items-center text-gray-300">

      {links?.website && (
        <a href={links.website} target="_blank">
          <FaGlobe className="hover:text-white transition" />
        </a>
      )}

      {links?.twitter && (
        <a href={links.twitter} target="_blank">
          <FaTwitter className="hover:text-blue-400 transition" />
        </a>
      )}

      {links?.instagram && (
        <a href={links.instagram} target="_blank">
          <FaInstagram className="hover:text-pink-400 transition" />
        </a>
      )}

      {links?.twitch && (
        <a href={links.twitch} target="_blank">
          <FaTwitch className="hover:text-purple-400 transition" />
        </a>
      )}

      {links?.faceit && (
        <a href={links.faceit} target="_blank">
          <SiFaceit className="hover:text-orange-400 transition" />
        </a>
      )}

    </div>
  )
}