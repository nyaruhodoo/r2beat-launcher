import type { WebUserInfo } from '@src/types'
import { webLogin } from './web-login'
import { logInfo } from '../../log'
import { MainUtils } from '../../main-utils'

/**
 * 并发为每个账号重新执行网页登录，得到新 token（必须全部成功，否则抛错并中止未领取任务）。
 */
export async function refreshWebUsersConcurrent(users: WebUserInfo[]): Promise<WebUserInfo[]> {
  return MainUtils.runConcurrent(users, async (user) => {
    logInfo(`正在刷新「${user.remark || user.username}」登录态`)

    const refreshed = await webLogin({
      username: user.username,
      password: user.password,
      remark: user.remark,
    })
    return { ...refreshed, disable: user.disable }
  })
}
