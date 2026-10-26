export const INITIAL_AUTH_STATE = { session: null, user: null, profile: null, loading: true, profileError: null };

// Publish session + profile readiness together. Auth callbacks must return
// synchronously; profile requests run in a later task outside Supabase's lock.
export function createAuthSessionLoader({ loadProfile, onChange, defer = callback => setTimeout(callback, 0) }) {
  let state = INITIAL_AUTH_STATE;
  let generation = 0;
  let disposed = false;
  let initialized = false;
  let pending = Promise.resolve();
  const publish = next => { state = next; if (!disposed) onChange(state); };

  function setSession(session, { reload = false } = {}) {
    if (disposed) return Promise.resolve();
    const user = session?.user ?? null;
    const sameUser = initialized && state.user?.id === user?.id;
    initialized = true;
    if (sameUser && !reload) {
      publish({ ...state, session, user });
      return pending;
    }
    const request = ++generation;
    publish({ session, user, profile: sameUser ? state.profile : null,
      loading: !!user && (!sameUser || state.loading || !state.profile), profileError: null });
    if (!user) return Promise.resolve();
    pending = new Promise(resolve => defer(resolve)).then(async () => {
      if (disposed || request !== generation) return;
      try {
        const profile = await loadProfile(user.id);
        if (!disposed && request === generation) publish({ ...state, profile, loading: false, profileError: null });
      } catch (error) {
        if (!disposed && request === generation) publish({ ...state, loading: false, profileError: error });
      }
    });
    return pending;
  }
  return {
    setSession,
    refreshProfile: () => setSession(state.session, { reload: true }),
    dispose: () => { disposed = true; generation++; },
  };
}
