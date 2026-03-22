import axios from 'axios'

/**
 * 主进程 HTTP 客户端（与历史 ky 行为对齐：固定超时、不重试）
 */
export const http = axios.create({
  timeout: 10000,
})
