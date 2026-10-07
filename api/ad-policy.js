// Vercel supplies this country from the connecting IP, independently of browser language.
export function getAdPolicy(countryHeader) {
  const country = typeof countryHeader === "string" ? countryHeader.trim().toUpperCase() : "";
  const knownCountry = /^[A-Z]{2}$/.test(country) && !["XX", "ZZ", "T1"].includes(country);
  return { adsEnabled: knownCountry && country !== "RU" };
}

export default function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("CDN-Cache-Control", "no-store");
  response.setHeader("Vercel-CDN-Cache-Control", "no-store");
  response.setHeader("Vary", "X-Vercel-IP-Country");
  return response.status(200).json(getAdPolicy(request.headers["x-vercel-ip-country"]));
}
