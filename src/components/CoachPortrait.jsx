import { useState } from 'react';

export default function CoachPortrait({ teamLogo, className = 'size-12 rounded-lg' }) {
  const [failedLogo, setFailedLogo] = useState(null);
  return <span aria-hidden="true" className={`relative flex shrink-0 items-end justify-center overflow-hidden bg-[#182532] ring-1 ring-white/10 ${className}`}>
    {teamLogo && failedLogo !== teamLogo && <img src={teamLogo} alt="" loading="lazy"
      className="absolute inset-0 h-full w-full scale-[1.3] object-contain opacity-20 grayscale"
      onError={() => setFailedLogo(teamLogo)} />}
    <img src="/player-silhouette.png" alt="" loading="lazy"
      className="relative z-10 h-[92%] w-full object-contain object-bottom" />
  </span>;
}
