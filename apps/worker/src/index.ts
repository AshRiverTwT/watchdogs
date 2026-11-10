// Scheduler, watcher and mail jobs (pg-boss) are added in slices 4 and 5.
const source = process.env.SHOW_SOURCE ?? "mock";
console.log(`[worker] started, show source: ${source}`);

const keepAlive = setInterval(() => {}, 60_000);
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    clearInterval(keepAlive);
    console.log(`[worker] ${sig}, exiting`);
    process.exit(0);
  });
}
