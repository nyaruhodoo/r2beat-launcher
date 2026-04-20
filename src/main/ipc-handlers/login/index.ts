import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../../ipc/contracts'
import { sendTcpLoginRequest } from './tcp-login'
import { webLogin } from './web-login'
import { checkWebLoginForUsers } from './check-web-login'
import { refreshWebUsersConcurrent } from './refresh-web-users'
import { logError, logInfo, logSuccess } from '../../log'
import axios from 'axios'

/** TCP 与网页登录、登录态检查与刷新 */
export function registerLoginHandlers(ipc: IpcListener<IpcMainEvents>): void {
  ipc.handle('tcp-login', async (_, username, password, serverIp) => {
    try {
      if (!username || !password) {
        throw new Error('用户名和密码不能为空')
      }

      console.log(`[Main] 收到 TCP 登录请求: ${username}`)
      const result = await sendTcpLoginRequest(username, password, serverIp)

      if (result.status === 'SUCCESS') {
        return {
          success: true,
          status: result.status,
          message: result.message,
          data: result.data,
        }
      }

      return {
        success: false,
        status: result.status,
        error: result.message || '登录失败',
        data: result.data,
      }
    } catch (error) {
      console.error('[Main] TCP 登录失败:', error)
      return {
        success: false,
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'TCP 登录时发生未知错误',
      }
    }
  })

  ipc.handle('get-server-ip', async () => {
    try {
      // 注意：此处转换为 GitHub 的 Raw 原始文件地址
      const RAW_URL =
        'https://raw.githubusercontent.com/nyaruhodoo/r2beat-launcher/main/src/config.ts'

      const response = await axios.get(RAW_URL, { timeout: 10000 })
      const content = response.data as string

      const regex = /tcpLoginIp\s*:\s*['"]([^'"]+)['"]/
      const match = content.match(regex)

      if (!match || !match[1]) {
        throw new Error('未找到服务器IP地址')
      }

      return {
        success: true,
        serverIp: match[1],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取服务器IP失败'
      logError(message)

      return {
        success: false,
        error: message,
      }
    }
  })

  ipc.handle('web-login', async (_, userInfoParams) => {
    const userInfo = await webLogin(userInfoParams)

    return {
      success: true,
      userInfo,
    }
  })

  ipc.handle('check-web-login', async (_, userInfoList) => {
    try {
      logInfo(`正在检查登录态，当前已启用 ${userInfoList.length} 个账号`)
      const result = await checkWebLoginForUsers(userInfoList)
      logSuccess(`${userInfoList.length} 个账号，登录态检查成功`)

      return {
        success: true,
        userInfoList: result.userInfoList,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `登录态检查失败`

      logError(message)

      return {
        success: false,
        error: message,
      }
    }
  })

  ipc.handle('refresh-web-users', async (_, userInfoList) => {
    try {
      const userInfoListOut = await refreshWebUsersConcurrent(userInfoList)
      logSuccess(`${userInfoList.length} 个账号登录态已刷新`)

      return {
        success: true,
        userInfoList: userInfoListOut,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `刷新网页登录态失败`

      logError(message)

      return {
        success: false,
        error: message,
      }
    }
  })
}
