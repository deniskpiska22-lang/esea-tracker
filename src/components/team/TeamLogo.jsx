import { useState } from "react";

function TeamLogo({ src, name, className = "" }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.04] font-black text-slate-600 ${className}`}
      >
        {String(name || "?").trim().slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      className={`object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

export default TeamLogo;
