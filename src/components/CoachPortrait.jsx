import { useState } from 'react';

export default function CoachPortrait({ avatar, teamLogo }) {
  const [failed, setFailed] = useState(null);
  return <>
    {teamLogo && <img className="absolute inset-0 h-full w-full object-contain opacity-15" src={teamLogo} alt="" />}
    {avatar && failed !== avatar
      ? <img className="relative h-full w-full object-cover" src={avatar} alt="" loading="lazy" onError={() => setFailed(avatar)} />
      : <img className="relative h-[92%] w-full object-contain object-bottom" src="/player-silhouette.png" alt="" loading="lazy" />}
  </>;
}
