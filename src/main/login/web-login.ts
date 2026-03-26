import { UserInfo, WebUserInfo } from '@src/types'
import { http } from '../http'

interface XiyouxiWebLoginJson {
  // 你妈的喜游戏...
  status: string | number
  code?: number
  data: {
    access_token: string
    expires_in: number
    /** 同步码列表（各子系统的授权链接） */
    sync_code: string[]
  }
}

export const webLogin = async (userInfo: UserInfo): Promise<WebUserInfo> => {
  if (!userInfo.password || !userInfo.username) throw new Error(`未正确获取userInfo`)

  const formData = new FormData()
  formData.append('username', userInfo.username)
  formData.append('password', userInfo.password)

  const { data: result } = await http.post<XiyouxiWebLoginJson>(
    `https://www.xiyouxi.com/api/login?${Date.now()}`,
    formData,
  )

  if (result.status !== 'success')
    throw new Error(`${userInfo.remark ?? userInfo.username} ${JSON.stringify(result.data)}`)

  // 5. 提取 access_token（做多层数据校验，避免报错）
  const accessToken = result?.data?.access_token
  if (!accessToken) {
    throw new Error('响应数据中未找到 access_token')
  }

  console.log(`[Web Login]: ${userInfo.remark ?? userInfo.username} 已获取token`)
  return {
    username: userInfo?.username,
    password: userInfo?.password,
    token: `Bearer ${accessToken}`,
    time: Date.now(),
    disable: false,
    remark: userInfo?.remark,
  }
}
