import type { WebUserInfo } from '@globalTypes'
import { http } from '../http'
import { logInfo } from '../log'

const GET_USER_COIN_URL = 'http://external-api.xiyouxi.com/api/gift/getUserCoin'

/** 同时校验的账号数上限 */
const CHECK_WEB_LOGIN_CONCURRENCY = 3

export interface GetUserCoinResponse {
  code?: number
  status?: number
  message?: string
  balance?: string
}

export type CheckWebLoginResult = { userInfoList: WebUserInfo[] }

/**
 * 对单个账号调用 getUserCoin 校验 web 登录态；失败则抛错。
 */
async function verifySingleUser(user: WebUserInfo): Promise<void> {
  // 老实说，我都不知道他啥时候过期，太邪乎了
  if (Date.now() - user.time > 1000 * 60 * 30) {
    throw new Error(`${user.remark ?? user.username} token 临近过期`)
  }

  const token = user.token
  const { data } = await http.post<GetUserCoinResponse>(
    GET_USER_COIN_URL,
    {},
    {
      headers: { Authorization: token },
    },
  )

  if (!data.balance) {
    console.log(`[Main Web Login]: ${user.remark ?? user.username}: ${data.message ?? '未知错误'}`)
    throw new Error(`${user.remark ?? user.username} token 已过期`)
  }
}

/**
 * 并发校验各账号 web 登录态（最多 {@link CHECK_WEB_LOGIN_CONCURRENCY} 路）；
 * 任一失败则置位 `aborted`，其余 worker 不再领取新任务并尽快结束；
 * 已在进行中的 HTTP 请求仍会跑完（未接 axios Abort）。失败错误向上抛出，由 IPC 层 catch。
 */
export async function checkWebLoginForUsers(users: WebUserInfo[]): Promise<CheckWebLoginResult> {
  if (users.length === 0) {
    return { userInfoList: [] }
  }

  let cursor = 0
  let aborted = false
  const pickNext = (): WebUserInfo | undefined => {
    if (aborted) return undefined
    const i = cursor++
    if (i >= users.length) return undefined
    return users[i]
  }

  async function worker(): Promise<void> {
    while (!aborted) {
      const user = pickNext()
      if (!user) return

      logInfo(`正在检查 ${user.remark ?? user.username} 登录态`)
      try {
        await verifySingleUser(user)
      } catch (e) {
        aborted = true
        throw e
      }
    }
  }

  const poolSize = Math.min(CHECK_WEB_LOGIN_CONCURRENCY, users.length)
  await Promise.all(Array.from({ length: poolSize }, () => worker()))

  return { userInfoList: users }
}
