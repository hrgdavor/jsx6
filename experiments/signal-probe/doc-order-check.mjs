/** Run the trace doc examples in-process with diagnostics on. */
globalThis.__TRACE_DIAG = true
const files = ['watch.js', 'source-ref.js', 'state.js', 'recording.js', 'session.js']
for (const f of files) {
  console.log(`\n===== ${f} =====`)
  try {
    await import(new URL(`../../libs/signal/doc/trace/examples/${f}`, import.meta.url).href)
    console.log(`${f}: ok`)
  } catch (e) {
    console.log(`${f}: FAILED — ${e.message}`)
  }
}
