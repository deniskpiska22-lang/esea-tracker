// Chromium's accessibility tree identifies the public Coach slot by its label.
export function coachNicknameFromRoster(nodes, teamId, season) {
  const value = node => node?.name?.value?.trim() || '';
  const role = node => node?.role?.value;
  const byId = new Map(nodes.map(node => [node.nodeId, node]));
  const heading = nodes.find(node => role(node) === 'heading' && value(node) === 'Active League Roster');
  const seasonLink = nodes.some(node => role(node) === 'link' && /^REGION\b/i.test(value(node)) &&
    node.properties?.some(property => property.name === 'url' &&
      /\/league\/ESEA(?:%20| )League\//i.test(property.value?.value || '')));
  const seasonButton = nodes.some(node => role(node) === 'button' && value(node) === `Season ${season}`);
  if (!heading || !seasonLink || !seasonButton) return null;

  function walk(node) {
    return node ? [node, ...(node.childIds || []).flatMap(id => walk(byId.get(id)))] : [];
  }

  for (let node = byId.get(heading.parentId); node; node = byId.get(node.parentId)) {
    const children = walk(node).filter(child => !child.ignored);
    const start = children.indexOf(heading);
    const end = children.findIndex((child, index) => index > start && role(child) === 'heading');
    const roster = children.slice(start + 1, end < 0 ? undefined : end);
    const rosterLink = roster.some(child => role(child) === 'link' && child.properties?.some(property =>
      property.name === 'url' && new RegExp(`/teams/${teamId}/leagues(?:[?#]|$)`, 'i').test(property.value?.value || '')));
    if (!rosterLink) continue;
    const label = roster.findIndex(child => role(child) === 'StaticText' && /^Coach(?: Optional)?$/i.test(value(child)));
    if (label < 0) continue;
    const people = roster.slice(label + 1).filter(child => ['button', 'link'].includes(role(child)))
      .map(value).filter(nick => /^[A-Za-z0-9_-]{2,36}$/.test(nick) && !/^(optional|add|coach)$/i.test(nick));
    return people.length === 1 ? people[0] : null;
  }
  return null;
}
