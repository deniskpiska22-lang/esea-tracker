import { useState } from 'react';

export default function RatingForecastLogo({ catalogLogo, matchLogo }) {
  const [failed, setFailed] = useState([]);
  // Match records can retain a CDN URL from before the team changed its logo.
  const src = [catalogLogo, matchLogo].find(url => url && !failed.includes(url));

  return src ? (
    <img key={src} src={src} alt="" className="h-9 w-9 shrink-0 object-contain"
      onError={() => setFailed(previous => [...previous, src])} />
  ) : (
    <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0b0f14] text-xs font-black text-slate-600">
      ?
    </div>
  );
}
