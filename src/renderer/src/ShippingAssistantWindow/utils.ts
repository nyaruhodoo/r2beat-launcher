import { GiftGroupedData } from '@src/types'

export class Utils {
  /**
   * 计算相对时间
   */
  static formatRelativePastZh(ts: number | undefined | null) {
    if (ts == null) return '—'

    const now = Date.now()
    const diffSec = Math.floor((now - ts) / 1000)
    if (diffSec < 60) return '刚刚'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin} 分钟前`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} 小时前`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay < 30) return `${diffDay} 天前`
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /**
   * 生成导出txt文件名
   */
  static formatExportFileName(fileName: string) {
    const date = new Date()

    // 补零工具
    const pad = (num: number) => num.toString().padStart(2, '0')

    // 格式化时间：YYYY-MM-DD HH:mm:ss（24小时制）
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1)
    const day = pad(date.getDate())
    const hours = pad(date.getHours())
    const minutes = pad(date.getMinutes())
    const seconds = pad(date.getSeconds())

    const dateStr = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`

    return `${fileName}_${dateStr}.txt`
  }

  /**
   * 获取喜游戏道具图片
   */
  static createItemImgUrl(row: GiftGroupedData) {
    return `https://r2beat-web-cdn.xiyouxi.com/images/sub/gift/item/${row.imgCode}.png`
  }

  /**
   * 文本时间转时间戳
   */
  static parseCreatedAtToTs(text: string) {
    const ts = Date.parse(text)
    return Number.isNaN(ts) ? 0 : ts
  }

  /**
   * 检查字符是否是纯英文数字
   */
  static looksLikeLatinPinyinQuery(kw: string) {
    return /^[a-z0-9\s]+$/i.test(kw.trim()) && /^[a-z0-9]+$/i.test(kw.replace(/\s+/g, ''))
  }

  /**
   * 获取字符串码点
   */
  static firstCharCodePoint(name: string) {
    const t = (name ?? '').trim()
    if (!t.length) return -1
    return t.codePointAt(0) ?? -1
  }

  /**
   * 用于码点排序
   */
  static compareByFirstCodePointAsc(a: string, b: string) {
    const ca = this.firstCharCodePoint(a)
    const cb = this.firstCharCodePoint(b)
    if (ca !== cb) return ca - cb
    return (a || '').localeCompare(b || '', 'zh-CN')
  }
}
