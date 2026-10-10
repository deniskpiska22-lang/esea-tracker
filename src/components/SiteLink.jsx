import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { TeamUrlContext } from '../context/TeamUrlContext.js';
import { teamPublicPath } from '../utils/teamProfileUrls.js';
export default function SiteLink({ to, ...props }) {
  const teams = useContext(TeamUrlContext);
  return <Link {...props} to={teamPublicPath(to, teams)} />;
}
