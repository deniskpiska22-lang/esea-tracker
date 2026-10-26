import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthSessionLoader } from '../src/utils/authSession.js';
const session = id => ({ user: { id } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function setup(loadProfile) {
  const states = [], tasks = [];
  const loader = createAuthSessionLoader({ loadProfile, onChange: state => states.push(state), defer: callback => tasks.push(callback) });
  return { loader, states, latest: () => states.at(-1), flush: async () => { for (const task of tasks.splice(0)) task(); await Promise.resolve(); } };
}

test('reload waits for admin profile: no ready state can trigger a premature redirect', async () => {
  const request = deferred();
  const app = setup(() => request.promise);
  const pending = app.loader.setSession(session('admin'));
  assert.equal(app.latest().loading, true);
  await app.flush();
  assert.equal(app.latest().loading, true);
  request.resolve({ id: 'admin', is_admin: true });
  await pending;
  assert.equal(app.latest().loading, false);
  assert.equal(app.latest().profile.is_admin, true);
  assert.ok(app.states.every(state => state.loading || state.profile?.is_admin));
});
test('initial-session and getSession results share one deferred profile request', async () => {
  let requests = 0;
  const app = setup(async id => { requests++; return { id, is_admin: true }; });
  const pending = app.loader.setSession(session('admin'));
  app.loader.setSession(session('admin'));
  assert.equal(requests, 0, 'no Supabase request inside auth callback');
  await app.flush(); await pending;
  assert.equal(requests, 1);
  assert.equal(app.latest().profile.is_admin, true);
});
test('sign-out during restoration cannot restore stale admin privileges', async () => {
  const request = deferred(); const app = setup(() => request.promise);
  const pending = app.loader.setSession(session('admin')); await app.flush();
  await app.loader.setSession(null);
  request.resolve({ id: 'admin', is_admin: true }); await pending;
  assert.deepEqual(app.latest(), { session: null, user: null, profile: null, loading: false, profileError: null });
});
test('switching accounts ignores the old profile even when it arrives last', async () => {
  const old = deferred(); const app = setup(id => id === 'admin' ? old.promise : Promise.resolve({ id, is_admin: false }));
  const pendingOld = app.loader.setSession(session('admin')); await app.flush();
  const pendingNew = app.loader.setSession(session('member')); await app.flush(); await pendingNew;
  old.resolve({ id: 'admin', is_admin: true }); await pendingOld;
  assert.equal(app.latest().user.id, 'member'); assert.equal(app.latest().profile.is_admin, false);
});
test('network failure keeps the session and allows profile retry', async () => {
  let requests = 0;
  const error = new Error('Network unavailable');
  const app = setup(async id => { if (++requests === 1) throw error; return { id, is_admin: true }; });
  const first = app.loader.setSession(session('admin')); await app.flush(); await first;
  assert.equal(app.latest().user.id, 'admin'); assert.equal(app.latest().profileError, error);
  assert.equal(app.latest().loading, false);
  const retry = app.loader.refreshProfile(); assert.equal(app.latest().loading, true);
  await app.flush(); await retry;
  assert.equal(app.latest().profileError, null); assert.equal(app.latest().profile.is_admin, true);
});
test('token refresh keeps loaded content, then applies freshly loaded permissions', async () => {
  let admin = true;
  const app = setup(async id => ({ id, is_admin: admin }));
  const first = app.loader.setSession(session('admin')); await app.flush(); await first;
  admin = false;
  const refreshed = app.loader.setSession({ ...session('admin'), access_token: 'refreshed' }, { reload: true });
  assert.equal(app.latest().loading, false); assert.equal(app.latest().profile.is_admin, true);
  await app.flush(); await refreshed;
  assert.equal(app.latest().profile.is_admin, false);
});
test('unmount discards late requests; ordinary users never gain admin rights', async () => {
  const request = deferred(); const app = setup(() => request.promise);
  const pending = app.loader.setSession(session('member')); await app.flush();
  app.loader.dispose(); const count = app.states.length;
  request.resolve({ id: 'member', is_admin: false }); await pending;
  assert.equal(app.states.length, count);
  const member = setup(async id => ({ id, is_admin: false }));
  const ready = member.loader.setSession(session('member')); await member.flush(); await ready;
  assert.equal(member.latest().loading, false); assert.equal(member.latest().profile.is_admin, false);
});
