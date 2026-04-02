import axios from 'axios'

/**
 * 主进程 HTTP 客户端
 */
export const http = axios.create({
  timeout: 15000,
})
