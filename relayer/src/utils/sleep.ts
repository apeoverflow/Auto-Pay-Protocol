/**
 * Abort-aware sleep. Resolves after `ms` OR immediately when the signal
 * aborts. Safe to await inside worker loops for graceful shutdown.
 *
 * Extracted from five copies previously scattered across the indexer,
 * webhook sender, points worker, email sender, approval monitor, and
 * ipfs-retry worker.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    const timeout = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout)
      resolve()
    }, { once: true })
  })
}
