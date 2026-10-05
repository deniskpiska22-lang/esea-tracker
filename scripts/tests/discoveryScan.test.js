import test from "node:test";
import assert from "node:assert/strict";
import { retryAfterMs, runDiscoveryScan } from "../lib/discoveryScan.js";

function harness(overrides = {}) {
  const persisted = [];
  const saved = [];
  const calls = [];
  let clock = 100000;
  return {
    persisted, saved, calls,
    options: {
      jobs: [{ id: "a" }, { id: "b" }, { id: "c" }],
      now: () => clock, sleep: async (ms) => { clock += ms; },
      intervalMs: 1500, checkpoint: async (state) => persisted.push(state),
      saveRows: async (rows) => saved.push(...rows),
      fetchPage: async (job, offset) => { calls.push([job.id, offset]); return { rows: [{ id: job.id }], done: true }; },
      ...overrides,
    },
  };
}

test("429 stops the whole scan, retains saved pages and resumes the failed source", async () => {
  const h = harness();
  h.options.fetchPage = async (job, offset) => {
    h.calls.push([job.id, offset]);
    if (job.id === "b") throw Object.assign(new Error("429"), { status: 429, retryAfterMs: 1800000 });
    return { rows: [{ id: job.id }], done: true };
  };
  const result = await runDiscoveryScan(h.options);
  assert.deepEqual(h.calls, [["a", 0], ["b", 0]]);
  assert.deepEqual(h.saved, [{ id: "a" }]);
  assert.equal(result.state.nextId, "b");
  assert.equal(result.state.retryAt, 1901500);
  const blocked = harness({ state: result.state });
  await runDiscoveryScan(blocked.options);
  assert.equal(blocked.calls.length, 0);
  const resumed = harness({ state: { ...result.state, retryAt: 0 }, maxRequests: 1 });
  await runDiscoveryScan(resumed.options);
  assert.deepEqual(resumed.calls, [["b", 0]]);
});

test("pagination persists its offset and saves pages before advancing the cursor", async () => {
  const h = harness({ maxRequests: 2 });
  h.options.fetchPage = async (job, offset) => {
    h.calls.push([job.id, offset]);
    return { rows: [{ id: `${job.id}-${offset}` }], done: false, nextOffset: offset + 100 };
  };
  const result = await runDiscoveryScan(h.options);
  assert.deepEqual(h.calls, [["a", 0], ["a", 100]]);
  assert.equal(result.state.offset, 200);
  const resumed = harness({ state: result.state, maxRequests: 1 });
  await runDiscoveryScan(resumed.options);
  assert.deepEqual(resumed.calls, [["a", 200]]);
});

test("a database failure never advances past unsaved matches", async () => {
  const h = harness({ saveRows: async () => { throw new Error("database unavailable"); } });
  await assert.rejects(runDiscoveryScan(h.options), /database unavailable/);
  assert.equal(h.persisted.length, 0);
});

test("bounded scans rotate through the entire team list instead of restarting at A", async () => {
  const h = harness({ maxRequests: 2 });
  const result = await runDiscoveryScan(h.options);
  assert.equal(result.state.nextId, "c");
  const resumed = harness({ state: result.state, maxRequests: 2 });
  await runDiscoveryScan(resumed.options);
  assert.deepEqual(resumed.calls.map(([id]) => id), ["c", "a"]);
});

test("budget ends a scan before the next request and retains its cursor", async () => {
  const h = harness({ budgetMs: 1000 });
  const result = await runDiscoveryScan(h.options);
  assert.equal(h.calls.length, 1);
  assert.equal(result.state.nextId, "b");
});

test("authorization errors fail visibly; repeated throttling increases cooldown", async () => {
  const auth = harness({ fetchPage: async () => { throw Object.assign(new Error("unauthorized"), { status: 401 }); } });
  await assert.rejects(runDiscoveryScan(auth.options), /unauthorized/);
  const h = harness({ state: { nextId: "b", rateLimitCount: 2 },
    fetchPage: async () => { throw Object.assign(new Error("429"), { status: 429 }); } });
  const result = await runDiscoveryScan(h.options);
  assert.equal(result.state.retryAt, 3700000);
});

test("Retry-After supports both seconds and HTTP dates", () => {
  assert.equal(retryAfterMs("30", 0), 30000);
  assert.equal(retryAfterMs("Thu, 01 Jan 1970 00:01:00 GMT", 0), 60000);
  assert.equal(retryAfterMs("invalid", 0), 0);
});
