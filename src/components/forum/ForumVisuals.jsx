import {
  FiActivity,
  FiArrowUpRight,
  FiCheck,
  FiCompass,
  FiCrosshair,
  FiMessageCircle,
  FiMessageSquare,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import Link from "../SiteLink.jsx";
import { tx } from "../../i18n/translate.js";

export function ForumCategoryIcon({ category, ...props }) {
  const Icon =
    {
      esea: FiActivity,
      recruitment: FiUsers,
      tactics: FiCrosshair,
      feedback: FiCompass,
    }[category] || FiMessageSquare;
  return <Icon aria-hidden="true" {...props} />;
}
export function ForumArtwork() {
  return (
    <div className="forum-artwork" aria-hidden="true">
      <div className="forum-artwork-orbit" />
      <div className="forum-artwork-orbit forum-artwork-orbit-inner" />
      <span className="forum-artwork-node forum-artwork-node-a">
        <FiUsers />
      </span>
      <span className="forum-artwork-node forum-artwork-node-b">
        <FiCrosshair />
      </span>
      <div className="forum-artwork-chat">
        <FiMessageCircle />
        <span>
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="forum-artwork-signal">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
export function ForumGuidelines() {
  return (
    <section className="forum-side-card">
      <div className="forum-side-icon">
        <FiShield aria-hidden="true" />
      </div>
      <h2>{tx("Community rules")}</h2>
      <p>{tx("Good discussions start with respect.")}</p>
      <ul className="forum-guidelines">
        {[
          "Respect other members.",
          "Keep discussions on topic.",
          "No spam or personal data.",
        ].map((text) => (
          <li key={text}>
            <FiCheck aria-hidden="true" />
            <span>{tx(text)}</span>
          </li>
        ))}
      </ul>
      <div className="forum-side-note">
        <FiShield aria-hidden="true" />
        <span>{tx("Report problems to moderators.")}</span>
      </div>
    </section>
  );
}
export function ForumWelcome({ user }) {
  return (
    <section className="forum-side-card forum-welcome">
      <div className="forum-side-icon">
        <FiMessageSquare aria-hidden="true" />
      </div>
      <h2>{tx("Your voice belongs here.")}</h2>
      <p>{tx("Talk matches, share experience and meet the ESEA community.")}</p>
      <Link
        to={user ? "/forum/new" : "/register"}
        className="forum-side-action"
      >
        {tx(user ? "Create topic" : "Join the community")}
        <FiArrowUpRight aria-hidden="true" />
      </Link>
      <span className="forum-open-note">
        {tx("Everyone can read the forum.")}
      </span>
    </section>
  );
}
export function ForumEmptyState({ filtered, category, onReset }) {
  return (
    <div className="forum-empty">
      <div className="forum-empty-art" aria-hidden="true">
        <span />
        <FiMessageSquare />
        <FiMessageCircle className="forum-empty-secondary" />
      </div>
      <h3>
        {tx(
          filtered
            ? "No topics match these filters."
            : "No topics yet. Start the first discussion.",
        )}
      </h3>
      <p>
        {tx(
          filtered
            ? "Try another search or reset the filters."
            : "Ask a question, share an idea or find your next teammate.",
        )}
      </p>
      {filtered ? (
        <button
          type="button"
          className="forum-button forum-button-secondary"
          onClick={onReset}
        >
          {tx("Reset filters")}
        </button>
      ) : (
        <Link
          to={`/forum/new${category ? `?category=${category}` : ""}`}
          className="forum-button"
        >
          {tx("Start a discussion")}
          <FiArrowUpRight aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
