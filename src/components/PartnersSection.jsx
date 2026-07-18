import React from "react";

const partners = [
  {
    name: "CIS Finder",
    description:
      "Find a team, players, and new opportunities in the CS2 community.",
    logo: "/partners/cis-finder.png",
    url: "https://example.com",
    cta: "Visit CIS Finder",
    featured: true,
  },
];

export default function PartnersSection() {
  const partner = partners[0];

  return (
    <section className="px-4 py-10 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0c121b]">
          <div className="relative p-6 md:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.14),transparent_38%)]" />

            <div className="relative grid items-center gap-7 lg:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080d14] p-3">
                  <img
                    src={partner.logo}
                    alt={`${partner.name} logo`}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-orange-300">
                    Official Community Partner
                  </div>

                  <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">
                    ESEA Tracker × {partner.name}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400 md:text-base">
                    {partner.description}
                  </p>
                </div>
              </div>

              <a
                href={partner.url}
                target="_blank"
                rel="noreferrer sponsored"
                className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3.5 text-sm font-black text-white transition hover:bg-orange-400"
              >
                {partner.cta} ↗
              </a>
            </div>
          </div>

          <div className="border-t border-white/[0.06] bg-white/[0.02] px-6 py-3 text-center text-xs text-gray-600 md:px-8">
            A community partner helping CS2 players find teams and opportunities.
          </div>
        </div>
      </div>
    </section>
  );
}