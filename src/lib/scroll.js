const jobs = new Set();
let queued = false;
let listening = false;

function flush() {
  queued = false;
  for (const job of jobs) job();
}

function request() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(flush);
}

export function onScrollFrame(job) {
  if (!listening) {
    listening = true;
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
  }
  jobs.add(job);
  request();
  return () => jobs.delete(job);
}
