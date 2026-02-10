import { Socket } from 'net'

// 服务器配置
const SERVER_HOST = '114.117.135.107'
const SERVER_PORT = 28004
const CONNECTION_TIMEOUT = 10000 // 10秒超时

// 登录响应结果类型
export interface LoginResponse {
  status: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'UNKNOWN'
  message: string
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
}

/**
 * 构造游戏登录 TCP 包的 Buffer
 * @param username 账号
 * @param password 密码
 * @returns 完整的登录数据包 Buffer
 */
export function createLoginPacket(username: string, password: string): Buffer {
  // 准备数据 Buffer，使用 ascii 编码
  const userBuffer = Buffer.from(username, 'ascii')
  const passBuffer = Buffer.from(password, 'ascii')

  const userLen = userBuffer.length
  const passLen = passBuffer.length

  // 命令ID (1) + 账号长度字节 (1) + 账号内容 (N) + 密码长度字节 (4) + 密码内容 (M) + 填充 (4)
  const PAYLOAD_LENGTH = 1 + 1 + userLen + 4 + passLen + 4

  // 包头魔数(4) + 负载长度(4) + 负载内容(PAYLOAD_LENGTH)
  const TOTAL_LENGTH = 8 + PAYLOAD_LENGTH

  const packet = Buffer.alloc(TOTAL_LENGTH)
  let offset = 0

  // 0-3: 包头魔数 (FF 01 00 00) - Big Endian
  packet.writeUInt32BE(0xff010000, offset)
  offset += 4

  // 4-7: 负载长度 (PAYLOAD_LENGTH) - Little Endian
  packet.writeUInt32LE(PAYLOAD_LENGTH, offset)
  offset += 4

  // 8: 命令 ID (05) - UInt8 (登录命令)
  packet.writeUInt8(0x05, offset)
  offset += 1

  // 9: 账号长度 (N) - UInt8
  packet.writeUInt8(userLen, offset)
  offset += 1

  // 10: 账号内容 (N 字节)
  userBuffer.copy(packet, offset)
  offset += userLen

  // 10+N: 密码长度 (M) - UInt32 Little Endian
  packet.writeUInt32LE(passLen, offset)
  offset += 4

  // 14+N: 密码内容 (M 字节)
  passBuffer.copy(packet, offset)
  offset += passLen

  // 14+N+M: 结束填充 (00 00 00 00) - 4字节 Little Endian
  packet.writeUInt32LE(0x00000000, offset)

  return packet
}

/**
 * 深度解析登录成功 (CommandID=1000) 时的负载数据
 */
function parseSuccessPayload(data: Buffer, startOffset: number) {
  let offset = startOffset
  const payload: {
    Username?: string
    LoginTicket?: string
    EncryptionKey?: number
    UserID?: number
  } = {}

  // 1. 账号长度 (4字节 Little Endian)
  const usernameLength = data.readUInt32LE(offset)
  offset += 4
  // 2. 账号内容
  payload.Username = data.toString('ascii', offset, offset + usernameLength)
  offset += usernameLength

  // 3. 登录凭证长度 (Ticket Len)
  const ticketLength = data.readUInt32LE(offset)
  offset += 4
  // 4. 登录凭证 (Ticket)
  payload.LoginTicket = data.toString('ascii', offset, offset + ticketLength)
  offset += ticketLength

  // 5. 加密密钥 (4字节)
  payload.EncryptionKey = data.readUInt32LE(offset)
  offset += 4

  // 6. 用户 ID (4字节)
  payload.UserID = data.readUInt32LE(offset)
  offset += 4

  return payload
}

/**
 * 解析登录响应包，并根据状态码判断结果
 * @param data 服务器返回的 Buffer 数据
 * @returns 解析后的结果对象
 */
function parseLoginResponse(data: Buffer): LoginResponse {
  if (data.length < 21) {
    // 至少要能读取到 CommandID 之后的第一个 ErrorCode/保留字段
    return { status: 'ERROR', message: '数据不完整或连接提前断开' }
  }

  let offset = 0

  // 读取关键的头部字段
  const MagicHeader = data.readUInt32BE(offset).toString(16).toUpperCase()
  offset += 4

  const PayloadLength = data.readUInt32LE(offset)
  offset += 4

  const CommandID = data.readUInt32LE(offset) // 状态码/命令 ID
  offset += 4

  const SessionID = data.readUInt32LE(offset)
  offset += 4

  // 统一将基本信息打包
  const basicInfo = {
    MagicHeader: MagicHeader,
    PayloadLength: PayloadLength,
    CommandID: CommandID,
    SessionID: SessionID
  }

  // === 核心状态判断与解析 ===

  if (CommandID === 1000) {
    // 登录成功 (E8 03 00 00)
    return {
      status: 'SUCCESS',
      message: '登录成功',
      data: {
        ...basicInfo,
        // 成功负载的解析从 ErrorCode 之后开始，即 offset=20
        ...parseSuccessPayload(data, offset)
      }
    }
  } else if (CommandID === 48) {
    // 账号不存在 (30 00 00 00)
    return {
      status: 'FAILURE',
      message: '登录失败：账号不存在',
      data: basicInfo
    }
  } else if (CommandID === 47) {
    // 密码错误 (2F 00 00 00)
    return {
      status: 'FAILURE',
      message: '登录失败：密码错误',
      data: basicInfo
    }
  } else {
    // 其他未知错误
    return {
      status: 'UNKNOWN',
      message: `收到未知响应状态码: ${CommandID}`,
      data: basicInfo
    }
  }
}

/**
 * 发送 TCP 登录请求
 * @param username 用户名
 * @param password 密码
 * @returns Promise<LoginResponse> 登录响应结果
 */
export function sendTcpLoginRequest(username: string, password: string): Promise<LoginResponse> {
  return new Promise((resolve, reject) => {
    // 创建登录包
    const loginPacket = createLoginPacket(username, password)

    // 创建 TCP 客户端
    const client = new Socket()

    // 设置超时
    client.setTimeout(CONNECTION_TIMEOUT)

    // 连接成功回调
    client.connect(SERVER_PORT, SERVER_HOST, () => {
      console.log(`[TCP Login] 已连接到服务器: ${SERVER_HOST}:${SERVER_PORT}`)
      console.log(`[TCP Login] 正在发送登录包...`)

      // 发送登录包
      client.write(loginPacket, (err) => {
        if (err) {
          console.error('[TCP Login] 发送数据失败:', err)
          client.destroy()
          reject(new Error(`发送登录包失败: ${err.message}`))
        } else {
          console.log('[TCP Login] 登录包发送成功，等待服务器响应...')
        }
      })
    })

    // 接收服务器响应
    client.on('data', (data: Buffer) => {
      console.log(`[TCP Login] 接收到服务器响应 (${data.length} 字节)`)

      // 解析响应
      const result = parseLoginResponse(data)

      console.log(`[TCP Login] 登录结果: ${result.status} - ${result.message}`)

      if (result.status === 'SUCCESS') {
        console.log(
          `[TCP Login] 用户ID: ${result.data?.UserID}, 登录凭证: ${result.data?.LoginTicket}`
        )
      }

      // 关闭连接
      client.end()

      // 返回结果
      resolve(result)
    })

    // 连接关闭
    client.on('end', () => {
      console.log('[TCP Login] 连接已断开')
      reject(new Error('TCP链接被意外中断，请30秒后重试'))
    })

    // 连接错误
    client.on('error', (err: Error) => {
      console.error('[TCP Login] TCP 连接错误:', err.message)
      client.destroy()
      reject(new Error(`TCP 连接错误: ${err.message}`))
    })

    // 超时处理
    client.on('timeout', () => {
      console.error('[TCP Login] 连接超时')
      client.destroy()
      reject(new Error('连接超时'))
    })
  })
}
