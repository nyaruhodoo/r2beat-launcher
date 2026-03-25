import type { WebUserInfo } from '@globalTypes'
import { webLogin } from './web-login'
import { logInfo } from '../log'

/** 与 check-web-login 一致：同时执行的账号数上限 */
const REFRESH_WEB_USERS_CONCURRENCY = 3

/**
 * 并发为每个账号重新执行网页登录，得到新 token（必须全部成功，否则抛错并中止未领取任务）。
 */
export async function refreshWebUsersConcurrent(users: WebUserInfo[]): Promise<WebUserInfo[]> {
  if (users.length === 0) return []

  const results: WebUserInfo[] = new Array(users.length)
  let cursor = 0
  let aborted = false

  const pickNext = (): number | undefined => {
    if (aborted) return undefined
    const i = cursor++
    if (i >= users.length) return undefined
    return i
  }

  async function worker(): Promise<void> {
    while (!aborted) {
      const i = pickNext()
      if (i === undefined) return
      const user = users[i]
      try {
        logInfo(`正在刷新 ${user.remark ?? user.username} 登录态`)

        const refreshed = await webLogin({
          username: user.username,
          password: user.password,
          remark: user.remark,
        })
        results[i] = { ...refreshed, disable: user.disable }
      } catch (e) {
        aborted = true
        throw e
      }
    }
  }

  const poolSize = Math.min(REFRESH_WEB_USERS_CONCURRENCY, users.length)
  await Promise.all(Array.from({ length: poolSize }, () => worker()))

  return results
}
