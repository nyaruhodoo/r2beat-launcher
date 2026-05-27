import { Socket } from 'net'

// 服务器配置
const SERVER_HOST = '43.137.89.168'
const SERVER_PORT = 28004
const CONNECTION_TIMEOUT = 15000

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
  // 1. 将字符串转为 Buffer
  const usernameBuf = Buffer.from(username, 'utf8')
  const passwordBuf = Buffer.from(password, 'utf8')

  // 2. 计算内层载荷长度 (从指令码 05 开始到末尾占位符)
  // 核心公式: 1字节(命令) + 1字节(账号长) + 账号实际长 + 4字节(密码长) + 密码实际长 + 4字节(结尾0)
  const innerPayloadLen = 1 + 1 + usernameBuf.length + 4 + passwordBuf.length + 4

  // 3. 构建内层二进制数据
  const innerBufSize = 2 + 2 + 4 + innerPayloadLen // ff01(2) + 0000(2) + 长度(4) + 载荷
  const innerBuf = Buffer.alloc(innerBufSize)

  let offset = 0
  // 写入固定头部标识 ff 01
  innerBuf.writeUInt16BE(0xff01, offset)
  offset += 2
  // 写入占位符 00 00
  innerBuf.writeUInt16BE(0x0000, offset)
  offset += 2
  // 写入内层载荷长度 (小端序)
  innerBuf.writeUInt32LE(innerPayloadLen, offset)
  offset += 4
  // 写入登录指令码 05
  innerBuf.writeUInt8(0x05, offset)
  offset += 1
  // 写入账号长度 (1字节)
  innerBuf.writeUInt8(usernameBuf.length, offset)
  offset += 1
  // 写入账号明文
  usernameBuf.copy(innerBuf, offset)
  offset += usernameBuf.length
  // 写入密码长度 (4字节，小端序)
  innerBuf.writeUInt32LE(passwordBuf.length, offset)
  offset += 4
  // 写入密码明文
  passwordBuf.copy(innerBuf, offset)
  offset += passwordBuf.length
  // 写入内层结尾填充 00 00 00 00
  innerBuf.writeUInt32LE(0x00000000, offset)
  offset += 4

  // 4. 将内层数据转换为 Base64 字符串 Buffer
  const b64String = innerBuf.toString('base64')
  const b64Buf = Buffer.from(b64String, 'ascii')

  // 5. 构建外层 TCP 完整数据包
  // 核心公式: 4字节(魔数) + 1字节(B64长) + B64实际长 + 1字节(结尾80)
  const outerPayloadLen = 4 + 1 + b64Buf.length + 1
  const totalPacketSize = 4 + outerPayloadLen // 加上最前面的4字节总长度字段
  const outerBuf = Buffer.alloc(totalPacketSize)

  let outerOffset = 0
  // 写入外层剩余包体总长度 (小端序)
  outerBuf.writeUInt32LE(outerPayloadLen, outerOffset)
  outerOffset += 4
  // 写入固定魔数头部 70 00 1a 42 (大端序写入保持原本的字节流顺序)
  outerBuf.writeUInt32BE(0x70001a42, outerOffset)
  outerOffset += 4
  // 写入 Base64 字符串的长度 (1字节)
  outerBuf.writeUInt8(b64Buf.length, outerOffset)
  outerOffset += 1
  // 写入 Base64 字符串载荷
  b64Buf.copy(outerBuf, outerOffset)
  outerOffset += b64Buf.length
  // 写入固定包尾 80
  outerBuf.writeUInt8(0x80, outerOffset)
  outerOffset += 1

  return outerBuf
}

/**
 * 深度解析登录成功 (CommandID=1000) 时的负载数据
 * 依据真实成功包结构：UserID(4) + UsernameLen(4) + Username(N) + TicketLen(4) + Ticket(N) + EncryptionKey(4)
 */
function parseSuccessPayload(segmentPayload: Buffer, startOffset: number) {
  let offset = startOffset
  const payload: {
    Username?: string
    LoginTicket?: string
    EncryptionKey?: number
    UserID?: number
  } = {}

  // 1. 用户 ID (4字节 Little Endian，紧跟在 CommandID 后面)
  payload.UserID = segmentPayload.readUInt32LE(offset)
  offset += 4

  // 2. 账号长度 (4字节 Little Endian)
  const usernameLength = segmentPayload.readUInt32LE(offset)
  offset += 4

  // 3. 账号内容
  payload.Username = segmentPayload.toString('ascii', offset, offset + usernameLength)
  offset += usernameLength

  // 4. 登录凭证长度 (Ticket Len)
  const ticketLength = segmentPayload.readUInt32LE(offset)
  offset += 4

  // 5. 登录凭证 (Ticket)
  payload.LoginTicket = segmentPayload.toString('ascii', offset, offset + ticketLength)
  offset += ticketLength

  // 6. 加密密钥 (4字节)
  payload.EncryptionKey = segmentPayload.readUInt32LE(offset)
  offset += 4

  return payload
}

/**
 * 解析登录响应包，并根据状态码判断结果
 * @param rawData 服务器返回的 原始 Buffer 数据
 * @returns 解析后的结果对象
 */
export function parseLoginResponse(rawData: Buffer): LoginResponse {
  // ==================== 1. 剥离外层 TCP 包装 ====================

  // 基础长度边界检查
  if (rawData.length < 12) {
    return { status: 'ERROR', message: '数据不完整或连接提前断开' }
  }

  // 打印 Hex Dump 视图方便终端调试
  console.log(`--- Buffer Length: ${rawData.length} bytes ---`)
  for (let i = 0; i < rawData.length; i += 16) {
    const chunk = rawData.slice(i, i + 16)
    const hex = Array.from(chunk)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(47, ' ')
    const ascii = Array.from(chunk)
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('')
    const offsetStr = i.toString(16).padStart(4, '0').toUpperCase()
    console.log(`[${offsetStr}]  ${hex}  │  ${ascii}`)
  }

  // 验证 6 字节的外层协议固定魔数 70 00 1a 01 01 42
  const expectedMagic = Buffer.from([0x70, 0x00, 0x1a, 0x01, 0x01, 0x42])
  if (!rawData.subarray(4, 10).equals(expectedMagic)) {
    return { status: 'ERROR', message: '非法的外层协议魔数，解析终止' }
  }

  // ==================== 2. 解码 LEB128 格式的 Base64 长度 ====================
  let b64Len = 0
  let shift = 0
  let offset = 10 // 从第 10 字节开始计算变长长度

  while (offset < rawData.length) {
    const byte = rawData.readUInt8(offset)
    b64Len |= (byte & 0x7f) << shift
    offset++
    if ((byte & 0x80) === 0) break // 最高位为 0 代表读取结束
    shift += 7
    if (shift > 28) {
      return { status: 'ERROR', message: 'LEB128 长度解析越界异常' }
    }
  }

  if (rawData.length < offset + b64Len) {
    return { status: 'ERROR', message: 'TCP 实际包体长度小于 Base64 声明长度' }
  }

  // 提取 Base64 文本并还原为真实的内层多段业务流二进制数据
  const b64Str = rawData.toString('ascii', offset, offset + b64Len)
  const data = Buffer.from(b64Str, 'base64')

  // ==================== 3. 内层多业务片段（Segments）流扫描 ====================
  let innerOffset = 0
  let targetSegment: {
    magic: string
    payloadLength: number
    commandID: number
    payload: Buffer
  } | null = null

  // 线性扫描内层所有片段，直至捕捉到关心的状态业务包 (47, 48, 1000)
  while (innerOffset + 8 <= data.length) {
    const magic = data.readUInt16BE(innerOffset).toString(16).toUpperCase()
    const payloadLength = data.readUInt32LE(innerOffset + 4)
    innerOffset += 8

    if (innerOffset + payloadLength > data.length) break

    const segmentPayload = data.subarray(innerOffset, innerOffset + payloadLength)
    innerOffset += payloadLength

    if (payloadLength >= 4) {
      const currentCommandID = segmentPayload.readUInt32LE(0)
      if (currentCommandID === 47 || currentCommandID === 48 || currentCommandID === 1000) {
        targetSegment = {
          magic,
          payloadLength,
          commandID: currentCommandID,
          payload: segmentPayload,
        }
        // 如果扫描到了最终的成功包(1000)，直接终止扫描
        if (currentCommandID === 1000) break
      }
    }
  }

  if (!targetSegment) {
    return { status: 'ERROR', message: '内层业务载荷未匹配到有效的状态片段' }
  }

  // 组装业务基本字段信息
  const basicInfo = {
    MagicHeader: targetSegment.magic,
    PayloadLength: targetSegment.payloadLength,
    CommandID: targetSegment.commandID,
    SessionID: targetSegment.payloadLength >= 8 ? targetSegment.payload.readUInt32LE(4) : 0,
    ErrorCode: 0,
  }

  // ==================== 4. 状态判定与输出映射 ====================
  if (targetSegment.commandID === 1000) {
    return {
      status: 'SUCCESS',
      message: '登录成功',
      data: {
        ...basicInfo,
        // 从第 4 字节（即越过 CommandID）开始提取明文对象
        ...parseSuccessPayload(targetSegment.payload, 4),
      },
    }
  } else if (targetSegment.commandID === 48) {
    return {
      status: 'FAILURE',
      message: '登录失败：账号不存在',
      data: basicInfo,
    }
  } else if (targetSegment.commandID === 47) {
    return {
      status: 'FAILURE',
      message: '登录失败：密码错误',
      data: basicInfo,
    }
  } else {
    return {
      status: 'UNKNOWN',
      message: `收到未知响应状态码: ${targetSegment.commandID}`,
      data: basicInfo,
    }
  }
}

/**
 * 发送 TCP 登录请求
 * @param username 用户名
 * @param password 密码
 * @returns Promise<LoginResponse> 登录响应结果
 */
export function sendTcpLoginRequest(
  username: string,
  password: string,
  serverIp: string,
): Promise<LoginResponse> {
  return new Promise((resolve, reject) => {
    // 创建登录包
    const loginPacket = createLoginPacket(username, password)

    // 创建 TCP 客户端
    const client = new Socket()

    // 设置超时
    client.setTimeout(CONNECTION_TIMEOUT)

    // 连接成功回调
    client.connect(SERVER_PORT, serverIp ?? SERVER_HOST, () => {
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
          `[TCP Login] 用户ID: ${result.data?.UserID}, 登录凭证: ${result.data?.LoginTicket}`,
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
