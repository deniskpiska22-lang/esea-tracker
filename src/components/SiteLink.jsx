import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TeamUrlContext } from '../context/TeamUrlContext.js';
import { teamPublicPath } from '../utils/teamProfileUrls.js';
import { matchLinkState } from '../utils/matchNavigation.js';
export default function SiteLink({ to, state, ...props }) {
  const teams = useContext(TeamUrlContext);
  const location = useLocation();
  return <Link {...props} state={matchLinkState(to, location, state)} to={teamPublicPath(to, teams)} />;
}
