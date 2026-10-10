import { useState } from "react";
import { countryName } from "../utils/countries.js";
import { tx } from "../i18n/translate.js";

export default function CountryFlag({ country, className = "h-[18px] w-6", size }) {
  const code = String(country || "").trim().toUpperCase();
  const [failedCode, setFailedCode] = useState(null);
  const label = countryName(code) || tx("Unknown country");
  const dimensions = size === "sm" ? "h-[14px] w-5" : className;
  const classes = `inline-block shrink-0 rounded-sm object-cover align-middle ${dimensions}`;

  if (!countryName(code) || failedCode === code) {
    return <span role="img" aria-label={label} title={label} className={`${classes} border border-white/10 bg-white/[0.04]`} />;
  }

  return <img src={`https://flagcdn.com/24x18/${code.toLowerCase()}.png`}
    alt={label} title={label} width="24" height="18" loading="lazy"
    className={classes} onError={() => setFailedCode(code)} />;
}
