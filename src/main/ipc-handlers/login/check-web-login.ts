import type { WebUserInfo } from '@src/types'
import { http } from '../../http'
import { logInfo } from '../../log'
import { MainUtils } from '../../main-utils'

const GET_USER_COIN_URL = 'http://external-api.xiyouxi.com/api/gift/getUserCoin'

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
    throw new Error(`「${user.remark || user.username}」登录临近过期`)
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
 * 并发校验各账号 web 登录态（并行度见 {@link MainUtils.runConcurrent} 默认上限）；
 * 任一失败则不再领取新任务；已在进行中的 HTTP 请求仍会跑完（未接 axios Abort）。
 * 失败错误向上抛出，由 IPC 层 catch。
 */
export async function checkWebLoginForUsers(users: WebUserInfo[]): Promise<CheckWebLoginResult> {
  if (users.length === 0) {
    return { userInfoList: [] }
  }

  await MainUtils.runConcurrent(users, async (user) => {
    logInfo(`正在检查「${user.remark || user.username}」登录态`)
    await verifySingleUser(user)
  })

  return { userInfoList: users }
}
