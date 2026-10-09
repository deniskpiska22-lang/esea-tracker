export function parseVetoSteps(payload) {
  const tickets = payload?.payload?.tickets || payload?.tickets;

  if (!Array.isArray(tickets)) {
    return null;
  }

  const mapTicket = tickets.find(
    (ticket) => ticket?.entity_type === "map"
  );
  const entities = mapTicket?.entities;

  if (!Array.isArray(entities) || entities.length === 0) {
    return null;
  }

  const sorted = entities
    .slice()
    .sort((a, b) => Number(a.round || 0) - Number(b.round || 0));

  const deciderIndex = sorted.length - 1;

  return sorted.map((entity, index) => ({
    map: entity.guid,
    action:
      index === deciderIndex
        ? "Decider"
        : entity.status === "pick"
          ? "Picked"
          : "Banned",
    selectedBy:
      index === deciderIndex
        ? null
        : entity.selected_by === "faction1" ||
            entity.selected_by === "faction2"
          ? entity.selected_by
          : null,
    round: Number(entity.round || 0),
  }));
}

