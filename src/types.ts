export interface UserInfo {
  username: string
  password: string
  rememberPassword?: boolean
  remark?: string
}

export interface WebUserInfo {
  username: string
  password: string
  remark?: string
  token: string
  disable: boolean
  time: number
}

/** 抽奖仓库 / getGiftList 单条物品 */
export interface GiftItem {
  character_name: string
  created_at: string
  idx: number
  // 同道具是一样的
  item_code: string
  // 不同天数的不一样
  item_id: string
  item_name: string
  message: string | null
  payment_idx: number
  server_name: string | null
  status: number
  status_name: string
  type: number
  user_id: string
  vfun_user_id: string
}

/** 赠送确认载荷：完整道具行 + 赠送人（启动器侧填写） */
export interface GiftItemWithGiver extends GiftItem {
  giverName: string
}

/** get-gift-list 返回行：物品 + 可选账号信息 */
export interface GiftItemTableRow extends GiftItem {
  accountUsername?: string
  accountRemark?: string
}

/** processGiftData 按 item_code 分组后的汇总行 */
export interface GiftGroupedData {
  name: string
  total: string
  // 当作道具类型使用即可，天数的算一类，永久的是一类
  code: string
  imgCode: string
  _countValue: number
  _unit: string
  list: GiftItem[]
}

export interface AnnouncementData {
  idx: number
  user_id: string
  language: string
  section: number
  title: string
  created_at: string
}

// 进程优先级（仅 Windows 有效）
export type ProcessPriority = 'realtime' | 'high' | 'abovenormal' | 'normal' | 'belownormal' | 'low'

// 游戏设置
export interface GameSettings {
  gamePath: string
  /** 本地图库路径，用于 GamePreview 组件显示图片 */
  localImageLibrary: string
  /** 封面图 object-position，默认 center top */
  localImageObjectPosition: 'center top' | 'center' | 'center bottom'
  autoUpdate: boolean
  /** 启动游戏后最小化到系统托盘 */
  minimizeToTrayOnLaunch: boolean
  processPriority: ProcessPriority
  // 降低NP优先级（GameMon检测）
  lowerNPPriority: boolean
  // 屏蔽字
  isShieldWordDisabled: boolean
  // 屏蔽登录器更新检查
  isLauncherUpdateDisabled: boolean
  // 关闭tcp登录
  isTcpLoginDisabled: boolean
}

/**
 * 觉醒应用配置完整类型
 */
export interface GameConfig {
  FONT?: {
    FILEPATH?: string
    WIDTH?: string
    HEIGHT?: string
  }
  USER?: {
    PORT?: string
  }
  VIDEO?: {
    WIDTH?: string
    HEIGHT?: string
    FULLSCREEN?: string
    OUTLINE?: string
    OUTLINING?: string
  }
  MACRO?: {
    F1?: string
    F2?: string
    F3?: string
    F4?: string
  }
  QUICKJOIN?: {
    JOIN?: string
    INVITE?: string
  }
  SOUND?: {
    BG?: string
    EFFECT?: string
    BGVOL?: string
    EFFECTVOL?: string
  }
  EFFECT?: {
    BARRIER?: string
    CHARACTER?: string
    CLUBCHARACTER?: string
    CLUBBG?: string
  }
  TOURNAMENT?: {
    STAR?: string
    MOON?: string
    SUN?: string
    IMAGE?: string
  }
  SCREENSHOT?: {
    GAME?: string
    ROOM?: string
  }
  MOUSE?: {
    SPEED?: string
  }
  EXE?: {
    FILE?: string
    PARAM?: string
    USER_BEGIN?: string
    USER_END?: string
  }
  CONTROL?: {
    KEYBOARD?: string
    KEYBOARDNEW?: string
  }
  RYTHMESTONE?: {
    POS?: string
  }
  JUDGMENT?: {
    ONOFF?: string
  }
  RANKING?: {
    ONOFF?: string
  }
  HARDKEY?: {
    KEY0?: string
    KEY1?: string
    KEY2?: string
    KEY3?: string
    KEY4?: string
    KEY5?: string
  }
  EASYKEY?: {
    KEY0?: string
    KEY1?: string
    KEY2?: string
    KEY3?: string
  }
  RNOTECOMBO?: {
    EASY?: string
    NORMAL?: string
    HARD?: string
  }
  SETCHATTING?: {
    CUR?: string
    FIR?: string
    WIS?: string
    SYS?: string
    WISSET?: string
    MOVE?: string
  }
  SIGN?: {
    ONOFF?: string
  }
  BLICK?: {
    FRAME_BEFORE?: string
    FRAME_AFTER?: string
    GREAT?: string
    COOL?: string
  }
  EVENT?: {
    ID_1005?: string
    ID_1006?: string
    NOTICE_102?: string
    NOTICE_103?: string
    NOTICE_104?: string
    NOTICE_108?: string
    NOTICE_110?: string
    ENABLE_RAFFLE?: string
    eventPassItem?: string
  }
  CONTROLKEY?: {
    KEYUP?: string
    KEYDOWN?: string
    KEYLEFT?: string
    KEYRIGHT?: string
    KEYSHIFT?: string
    KEYCTRL?: string
  }
  RHYTHMSTONE?: {
    POS?: string
  }
  RANKLEVEL?: {
    ONOFF?: string
  }
  JITTER?: {
    ONOFF?: string
  }
  GARDEN?: {
    GARDENSOIL?: string
    GARDENSHOP?: string
  }
  SHOP?: {
    ISUSEDDIAMONDTOKEN?: string
  }
}

/**
 * 觉醒版本配置补丁文件
 */
export interface PatchInfo {
  patch?: {
    // 补丁目标文件名
    filename?: string
    // 补丁文件路径（空字符串表示默认路径）
    path?: string
    // 补丁版本号
    version?: string
    // 语言编码（如 kr 表示韩语）
    langcode?: string
    // 补丁下载基础 URL
    patchurl?: string
    // 启动器横幅图片 URL
    bannerurl?: string
    // 登录页面 URL
    loginurl?: string
    // 预处理命令/参数（空字符串表示无）
    prerocess?: string // 注：疑似拼写错误，可能应为 preprocess
    // 前置参数
    paramfront?: string
    // 后置参数
    paramback?: string
    // 新参数
    newparam?: string
    // 是否显示参数（0 表示不显示）
    showparam?: string
    // 时间戳/校验值
    tick?: string
    // 客户端恢复/完整包下载 URL
    Recovery?: string
  }
}

export interface PatchUpdateFile {
  // 补丁文件名，例如 00026_000001.lzma
  patchFileName: string
  // 目标文件名，例如 Game.exe
  targetFileName: string
  // 补丁文件对应的版本号（例如 00026）
  version: string
  // 补丁列表文件在本地的完整路径
  filePath: string
  // 原始文件大小
  originalSize: number
  // 压缩后文件大小
  compressedSize: number
  // 可选：校验值
  checksum: number
  // 补丁下载地址
  downloadUrl: string
}

export interface PatchUpdateInfo {
  /** 需要下载的补丁总大小（字节） */
  totalSize?: number
  /** 需要下载的补丁明细列表 */
  patches?: PatchUpdateFile[]
}

export interface DownloadPatchListsResult {
  success: boolean

  /** 失败时的错误信息 */
  error?: string

  /** 需要下载的补丁总大小（字节） */
  totalSize?: number

  /** 需要下载的补丁明细列表 */
  patches?: PatchUpdateFile[]
}

export interface DownloadPatchFilesResult {
  success: boolean
  /** 实际下载并解压成功的文件（目标文件名列表） */
  downloaded?: string[]
  /** 因已存在而跳过的文件（目标文件名列表） */
  skipped?: string[]
  /** 失败时的错误信息 */
  error?: string
}

export interface PatchProgressPayload {
  /** 总进度百分比，0-100（下载与解压各占 50%） */
  percent: number
  /** 当前阶段：download=下载，decompress=解压，skip=已存在跳过 */
  stage: 'download' | 'decompress' | 'skip'
  /** 当前处理的目标文件名（例如 Game.exe） */
  targetFileName?: string
  /** 可选的描述信息，便于调试 */
  message?: string
}

export interface DownloadPatchOptions {
  /** 是否只保留同名补丁中的最新版本，默认 true */
  keepLatestOnly?: boolean
}

export interface ApplyPatchFilesResult {
  success: boolean
  error?: string
}

export interface CopyPakToGameResult {
  success: boolean
  destPath?: string
  error?: string
}

export interface MovePakToModsResult {
  success: boolean
  destPath?: string
  error?: string
}

export interface DeletePakResult {
  success: boolean
  error?: string
}

export interface PakFileInfo {
  /** 文件名（含扩展名） */
  name: string
  /** 文件的完整路径（绝对路径） */
  path: string
}

export interface GetPaksResult {
  success: boolean
  /** 游戏安装目录下的补丁（名称包含中文的 .pak） */
  gamePaks: PakFileInfo[]
  /** 启动器根目录 mods 目录下的本地补丁（若目录不存在则为空数组） */
  modsPaks: PakFileInfo[]
  error?: string
}

export interface ScreenshotFileInfo {
  name: string
  path: string
}

export interface GetScreenshotsResult {
  success: boolean
  files: ScreenshotFileInfo[]
  error?: string
}

export interface ClearScreenshotsResult {
  success: boolean
  error?: string
}

export interface R2BeatNoticeData {
  result: number
  data: {
    // 公告索引ID
    idx: number
    // 服务编码
    service_code: string
    // 分区标识
    section: number
    // 语言类型（cn 表示中文）
    language: string
    // 公告标题
    title: string
    // 发布者昵称（空字符串）
    nickname: string
    // 公告内容（包含HTML标签）
    content: string
    // 图片列表（当前为null）
    images: null | string[] // 兼容可能的非null场景，定义为null或字符串数组
    // 公告状态（1 通常表示有效）
    status: number
    // 用户ID（当前为null）
    user_id: null | number | string // 兼容可能的非null场景
    // 点赞数
    like_count: number
    // 评论数（冗余字段，和comments_count一致）
    comment_count: number
    // 管理员标识（1 表示管理员发布）
    admin_flag: number
    // 创建时间
    created_at: string
    // 更新时间
    updated_at: string
    // 置顶标识（0 表示未置顶）
    top_flag: number
    // 发布者IP地址
    user_ip: string
    // 用户点赞状态（0 表示未点赞）
    user_like_status: number
    // 评论数
    comments_count: number
    // 管理员图标URL
    admin_icon: string
  }
}
