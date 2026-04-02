const GIVE_TASK_CONCURRENCY = 3

type RunConcurrentOptions = {
  /**
   * 为 `true`（默认）：任一任务失败后不再领取新任务，并向上抛出该错误（已在执行中的任务会继续跑完）。
   * 为 `false`：单项失败不影响后续下标；全部尝试结束后，若存在失败则抛出其中第一个错误。
   */
  abortOnError?: boolean
}

/**
 * 并发执行 worker，最大并发数为 {@link GIVE_TASK_CONCURRENCY} 与队列长度中的较小值。
 */
export async function runConcurrent<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  options: RunConcurrentOptions = {
    abortOnError: true,
  },
): Promise<void> {
  const n = items.length
  if (!n) return

  let cursor = 0
  let aborted = false
  const errors: unknown[] = []

  const pickNext = (): number | undefined => {
    if (aborted) return undefined
    const i = cursor++
    if (i >= n) return undefined
    return i
  }

  async function runWorker() {
    while (!aborted) {
      const i = pickNext()
      if (i === undefined) return
      try {
        await worker(items[i])
      } catch (e) {
        if (options.abortOnError) {
          aborted = true
          throw e
        }
        errors.push(e)
      }
    }
  }

  const pool = Math.min(GIVE_TASK_CONCURRENCY, n)
  await Promise.all(Array.from({ length: pool }, () => runWorker()))

  if (!options.abortOnError && errors.length > 0) {
    throw new Error(`有 ${errors.length} 个道具发货失败`)
  }
}
