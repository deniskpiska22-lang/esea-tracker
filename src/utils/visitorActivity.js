// Signals improve confidence; they cannot prove a visitor is a human.
export const MIN_VISIBLE_MS = 5000;
export const INTERACTION_WINDOW_MS = 180000;
export function qualifiedActivity(activity) {
  return Boolean(activity && Number.isFinite(activity.visibleMs) && activity.visibleMs >= MIN_VISIBLE_MS
    && Number.isFinite(activity.interactionAgeMs) && activity.interactionAgeMs >= 0
    && activity.interactionAgeMs <= INTERACTION_WINDOW_MS);
}
export function createActivityTracker({ now = Date.now, visible = true } = {}) {
  let visibleSince = visible ? now() : null;
  let lastInteraction = null;
  return {
    visibility(isVisible) { visibleSince = isVisible ? now() : null; },
    interact(event) { if (event.isTrusted && visibleSince !== null) lastInteraction = now(); },
    snapshot() {
      if (visibleSince === null || lastInteraction === null) return null;
      return { visibleMs: Math.max(0, now() - visibleSince), interactionAgeMs: Math.max(0, now() - lastInteraction) };
    },
  };
}
