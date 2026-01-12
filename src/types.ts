export interface UserInfo {
  username?: string
  password?: string
  rememberPassword?: boolean
  remark?: string
}

export interface AnnouncementData {
  idx: number
  user_id: string
  language: string
  section: number
  title: string
  created_at: string
}

export type Theme = 'light' | 'dark'

// 进程优先级（仅 Windows 有效）
export type ProcessPriority = 'realtime' | 'high' | 'abovenormal' | 'normal' | 'belownormal' | 'low'

// 游戏设置
export interface GameSettings {
  gamePath: string
  autoUpdate: boolean
  closeOnLaunch: boolean
  launchArgs: string
  processPriority: ProcessPriority
  lowerNPPriority?: boolean // 降低NP优先级（GameMon检测）
}

/**
 * 应用配置完整类型
 */
export interface AppConfig {
  FONT: {
    FILEPATH: string // 字体文件路径
    WIDTH: number // 字体渲染宽度
    HEIGHT: number // 字体渲染高度
  }
  USER: {
    PORT: number // 端口号
  }
  VIDEO: {
    WIDTH: number // 视频宽度
    HEIGHT: number // 视频高度
    FULLSCREEN: number // 全屏模式 0=关闭 1=开启
    OUTLINE: number // 轮廓大小
    OUTLINING: number // 轮廓效果 0=关闭 1=开启
  }
  MACRO: {
    F1: string // F1宏指令
    F2: string // F2宏指令
    F3: string // F3宏指令
    F4: string // F4宏指令
  }
  QUICKJOIN: {
    JOIN: number // 快速加入 0=关闭 1=开启
    INVITE: number // 邀请 0=关闭 1=开启
  }
  SOUND: {
    BG: number // 背景音乐开关 0=关闭 1=开启
    EFFECT: number // 音效开关 0=关闭 1=开启
    BGVOL: number // 背景音乐音量
    EFFECTVOL: number // 音效音量
  }
  EFFECT: {
    BARRIER: number // 屏障特效 0=关闭 1=开启
    CHARACTER: number // 角色特效 0=关闭 1=开启
    CLUBCHARACTER: number // 俱乐部角色特效 0=关闭 1=开启
    CLUBBG: number // 俱乐部背景特效 0=关闭 1=开启
  }
  TOURNAMENT: {
    STAR: number // 星星特效 0=关闭 1=开启
    MOON: number // 月亮特效 0=关闭 1=开启
    SUN: number // 太阳特效 0=关闭 1=开启
    IMAGE: number // 图片特效 0=关闭 1=开启
  }
  SCREENSHOT: {
    GAME: number // 游戏截图 0=关闭 1=开启
    ROOM: number // 房间截图 0=关闭 1=开启
  }
  MOUSE: {
    SPEED: number // 鼠标速度
  }
  EXE: {
    FILE: string // 执行文件名称
    PARAM: string // 启动参数
    USER_BEGIN: number // 用户起始ID
    USER_END: number // 用户结束ID
  }
  CONTROL: {
    KEYBOARD: number // 旧键盘控制 0=关闭 1=开启
    KEYBOARDNEW: number // 新键盘控制 0=关闭 1=开启
  }
  RYTHMESTONE: {
    POS: number // 节奏石位置（拼写变体）
  }
  JUDGMENT: {
    ONOFF: number // 判定显示 0=关闭 1=开启
  }
  RANKING: {
    ONOFF: number // 排名显示 0=关闭 1=开启
  }
  HARDKEY: {
    KEY0: number
    KEY1: number
    KEY2: number
    KEY3: number
    KEY4: number
    KEY5: number
  }
  EASYKEY: {
    KEY0: number
    KEY1: number
    KEY2: number
    KEY3: number
  }
  RNOTECOMBO: {
    EASY: number // 简单难度连击显示 0=关闭 1=开启
    NORMAL: number // 普通难度连击显示 0=关闭 1=开启
    HARD: number // 困难难度连击显示 0=关闭 1=开启
  }
  SETCHATTING: {
    CUR: number // 当前聊天
    FIR: number // 好友聊天
    WIS: number // 世界聊天
    SYS: number // 系统聊天
    WISSET: number // 世界聊天设置
    MOVE: number // 聊天框移动
  }
  SIGN: {
    ONOFF: number // 签名显示 0=关闭 1=开启
  }
  BLICK: {
    FRAME_BEFORE: string // 判定前帧数（原始值为字符串类型）
    FRAME_AFTER: number // 判定后帧数
    GREAT: number // GREAT判定帧数
    COOL: number // COOL判定帧数
  }
  EVENT: {
    ID_1005: number
    ID_1006: number
    NOTICE_102: number
    NOTICE_103: number
    NOTICE_104: number
    NOTICE_108: number
    NOTICE_110: number
    ENABLE_RAFFLE: number // 抽奖开启 0=关闭 1=开启
    eventPassItem: number // 活动道具通行证 0=关闭 1=开启
  }
  CONTROLKEY: {
    KEYUP: number // 上键
    KEYDOWN: number // 下键
    KEYLEFT: number // 左键
    KEYRIGHT: number // 右键
    KEYSHIFT: number // Shift键
    KEYCTRL: number // Ctrl键
  }
  RHYTHMSTONE: {
    POS: number // 节奏石位置（正确拼写版本）
  }
  RANKLEVEL: {
    ONOFF: number // 等级排名显示 0=关闭 1=开启
  }
  JITTER: {
    ONOFF: number // 抖动效果 0=关闭 1=开启
  }
  GARDEN: {
    GARDENSOIL: number // 花园土壤 0=关闭 1=开启
    GARDENSHOP: number // 花园商店 0=关闭 1=开启
  }
  SHOP: {
    ISUSEDDIAMONDTOKEN: number // 钻石代币使用 0=关闭 1=开启
  }
}

export interface PatchInfo {
  patch: {
    // 补丁目标文件名
    filename: string
    // 补丁文件路径（空字符串表示默认路径）
    path: string
    // 补丁版本号
    version: number
    // 语言编码（如 kr 表示韩语）
    langcode: string
    // 补丁下载基础 URL
    patchurl: string
    // 启动器横幅图片 URL
    bannerurl: string
    // 登录页面 URL
    loginurl: string
    // 预处理命令/参数（空字符串表示无）
    prerocess: string // 注：疑似拼写错误，可能应为 preprocess
    // 前置参数
    paramfront: string
    // 后置参数
    paramback: string
    // 新参数
    newparam: string
    // 是否显示参数（0 表示不显示）
    showparam: number
    // 时间戳/校验值
    tick: number
    // 客户端恢复/完整包下载 URL
    Recovery: string
  }
}

export interface ContextBridgeApi {
  windowShow?: () => void
  windowMinimize?: () => void
  windowClose?: () => void
  getAnnouncements?: () => Promise<AnnouncementData[]>
  getAnnouncementDetail?: (
    path: string,
    idx: number
  ) => Promise<{
    success: boolean
    data?: { idx: number; section: number; content: string }
    error?: string
  }>
  selectFolder?: (currentPath?: string) => Promise<string | null>
  launchGame?: (
    gamePath: string,
    launchArgs?: string,
    closeOnLaunch?: boolean,
    processPriority?: ProcessPriority,
    lowerNPPriority?: boolean
  ) => Promise<{ success: boolean; error?: string }>
  readPatchInfo?: (
    gamePath: string
  ) => Promise<{ success: boolean; data?: PatchInfo; error?: string }>
  readConfigIni?: (gamePath: string) => Promise<{
    success: boolean
    exists: boolean
    data?: AppConfig
    error?: string
  }>
  writeConfigIni?: (
    gamePath: string,
    configJson: AppConfig
  ) => Promise<{ success: boolean; error?: string }>
  getRemoteVersion?: () => Promise<{ success: boolean; version?: string; error?: string }>
  openAnnouncementDetail?: (detail: AnnouncementData) => void
  onAnnouncementDetail?: (callback: (detail: AnnouncementData) => void) => void
  windowMinimizeCurrent?: () => void
  windowCloseCurrent?: () => void
  openRechargeCenter?: () => void
  getRandomGameImage?: () => Promise<{
    success: boolean
    imagePath?: string
    fileName?: string
    error?: string
  }>
  tcpLogin?: (
    username: string,
    password: string
  ) => Promise<{
    success: boolean
    status?: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'UNKNOWN'
    message?: string
    data?: {
      MagicHeader?: string
      PayloadLength?: number
      CommandID?: number
      SessionID?: number
      Username?: string
      LoginTicket?: string
      EncryptionKey?: number
      UserID?: number
    }
    error?: string
  }>
}

export interface Announcementlist {
  result: number
  data: {
    current_page: number
    data: { idx: number; section: number; content: string }[]
  }
}
