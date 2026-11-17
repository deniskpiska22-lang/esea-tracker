export async function runCoachJobs({ jobs, state, run, save, now = Date.now, stopping = () => false }) {
  for (const job of jobs) {
    if (stopping()) break;
    const previous = state.jobs[job.name] || {};
    if (previous.nextAt > now()) continue;
    const eligibleAt = job.eligibleAt ? await job.eligibleAt() : 0;
    if (eligibleAt > now()) {
      state.jobs[job.name] = { ...previous, nextAt: eligibleAt };
      await save();
      continue;
    }
    const status = { ...previous, nextAt: now() + job.interval, running: true };
    state.jobs[job.name] = status;
    await save();
    try { status.result = await run(job); }
    catch (error) { status.result = { code: 1, error: error.message }; }
    status.running = false;
    status.finishedAt = new Date(now()).toISOString();
    status.nextAt = now() + job.interval;
    await save();
  }
}
