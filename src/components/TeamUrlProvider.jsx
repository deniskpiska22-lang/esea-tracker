import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTeamCatalog } from '../hooks/useTeamCatalog.js';
import { TeamUrlContext } from '../context/TeamUrlContext.js';
import { teamPublicPath } from '../utils/teamProfileUrls.js';
export default function TeamUrlProvider({ children }) {
  const { teams } = useTeamCatalog();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const target = teamPublicPath(location.pathname, teams);
    if (target !== location.pathname) navigate(target + location.search + location.hash, { replace: true });
  }, [location.pathname, location.search, location.hash, teams, navigate]);
  return <TeamUrlContext.Provider value={teams}>{children}</TeamUrlContext.Provider>;
}
