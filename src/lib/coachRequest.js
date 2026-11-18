function retryDelay(signal) {
  return new Promise((resolve,reject) => {
    const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new Error('Request aborted'));};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},500);
    if (signal?.aborted) abort(); else signal?.addEventListener('abort',abort,{once:true});
  });
}
// One bounded retry for temporary read failures. Missing coaches are final;
// aborts from route changes must never launch another request.
export async function requestCoachData(url,{signal,fetchImpl=fetch,wait=retryDelay}={}) {
  for (let attempt=0;attempt<2;attempt++) {
    if (signal?.aborted) throw new Error('Request aborted');
    try {
      const response=await fetchImpl(url,{signal});
      if (attempt===0 && (response.status>=500 || response.status===429)) {
        await wait(signal); continue;
      }
      return {status:response.status,data:response.ok ? await response.json() : null};
    } catch(error) {
      if (signal?.aborted || attempt===1) throw error;
      await wait(signal);
    }
  }
}
