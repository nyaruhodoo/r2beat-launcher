function minutesToMilliseconds(minutes: number) {
  if (typeof minutes !== 'number' || isNaN(minutes)) {
    throw new Error('输入必须是有效的数值类型（数字），例如 1、2.5、0.1 等')
  }

  const milliseconds = minutes * 60 * 1000

  return milliseconds
}

/**
 * 游戏版本检查间隔时间
 */
export const checkRemoteVersionTime = minutesToMilliseconds(10)

/**
 * 系统公告检查间隔时间
 */
export const checkAnnouncementsTime = minutesToMilliseconds(5)

/**
 * 服务端状态检测间隔时间(正常)
 */
export const checkServerStatusTime = minutesToMilliseconds(5)

/**
 * 服务端状态检测间隔时间(维护)
 */
export const checkUnknownServerStatusTime = minutesToMilliseconds(1)

/**
 * 登录器版本检查间隔时间
 */
export const checkUpdateIntervalTime = minutesToMilliseconds(30)

/**
 * 窗口大小
 */
export const windowWidth = 1280 * 0.9
export const windowHeight = 720 * 0.9
export const minWindowWidth = 1024
export const minWindowHeight = 768
