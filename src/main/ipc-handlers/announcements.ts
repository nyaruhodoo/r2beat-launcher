import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../ipc/contracts'
import type { AnnouncementData, R2BeatNoticeData } from '@src/types'
import { http } from '../http'

/** 官方公告列表与详情 */
export function registerAnnouncementHandlers(ipc: IpcListener<IpcMainEvents>): void {
  ipc.handle('get-announcement-detail', async (_event, args) => {
    const { idx } = args
    const fetchUrl = `https://external-api.xiyouxi.com/api/vfunlounge/posts/r2beat/all/${idx}`

    try {
      const { data } = await http.get<R2BeatNoticeData>(fetchUrl)

      if (data.result !== 1) {
        throw new Error('获取公告详情失败')
      }

      return { success: true, data: data.data }
    } catch (error) {
      console.error('[Main] 获取公告详情异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取公告详情时发生异常',
      }
    }
  })

  ipc.handle('get-announcements', async () => {
    try {
      const urls = ['https://external-api.xiyouxi.com/api/lounge/posts/r2beat/all/latest/7']

      const responses = await Promise.all(
        urls.map(async (url, index) => {
          try {
            const { data: result } = await http.get<{
              data: AnnouncementData[]
              result: number
            }>(url)

            if (result && result.data && Array.isArray(result.data)) {
              return result.data
            } else {
              console.warn(`[Main] Unexpected response format from URL ${index + 1}:`, result)
              throw new Error(`[Main] Unexpected response format from URL ${index + 1}:`)
            }
          } catch (error) {
            console.error(`[Main] Error fetching ${url}:`, error)
            return []
          }
        }),
      )

      const allAnnouncements = responses.flat()

      allAnnouncements.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateB - dateA
      })

      return allAnnouncements
    } catch (error) {
      console.error('[Main] 获取公告失败:', error)
      return []
    }
  })
}
