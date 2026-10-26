import { useLocation } from 'react-router-dom';
import Link from './SiteLink.jsx';
import { matchBackLink } from '../utils/matchNavigation.js';
import { tx } from '../i18n/translate.js';
export default function MatchBackLink({ fallbackTeamSlug }) {
  const { state } = useLocation();
  const back = matchBackLink(state, fallbackTeamSlug);
  return <Link to={back.to} className="text-orange-400 hover:text-orange-300">{tx(back.label)}</Link>;
}
