const GIVE_TASK_CONCURRENCY = 3

/**
 * 并发执行 worker，最大并发数为 {@link GIVE_TASK_CONCURRENCY} 与队列长度中的较小值。
 * 任一任务抛错后不再领取新任务（已在执行中的任务会继续跑完），并向上抛出该错误。
 */
export async function runConcurrent<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const n = items.length
  if (!n) return

  let cursor = 0
  let aborted = false

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
        aborted = true
        throw e
      }
    }
  }

  const pool = Math.min(GIVE_TASK_CONCURRENCY, n)
  await Promise.all(Array.from({ length: pool }, () => runWorker()))
}
