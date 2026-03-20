export const webLogin = async (userInfo: {
  username?: string
  password?: string
}): Promise<string> => {
  if (!userInfo.password || !userInfo.username) throw new Error(`未正确获取userInfo`)

  try {
    // 1. 构建 FormData 表单数据
    const formData = new FormData()
    formData.append('username', userInfo?.username)
    formData.append('password', userInfo?.password)

    // 2. 发送 POST 请求
    const response = await fetch(`https://www.xiyouxi.com/api/login?${Date.now()}}`, {
      method: 'POST',
      body: formData, // 自动设置 Content-Type: multipart/form-data
      headers: {
        // 无需手动设置 Content-Type，fetch 会自动根据 FormData 生成（包含boundary）
        // 如需自定义其他请求头可在此添加，例如：
        // 'Accept': 'application/json'
      },
    })

    // 3. 检查请求是否成功
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }

    // 4. 解析 JSON 响应体
    const result = await response.json()

    // 5. 提取 access_token（做多层数据校验，避免报错）
    const accessToken = result?.data?.access_token
    if (!accessToken) {
      throw new Error('响应数据中未找到 access_token')
    }

    console.log('获取到的 access_token:', accessToken)
    return `Bearer ${accessToken}` // 返回提取的 token
  } catch (error) {
    console.error('请求或解析失败:', error)
    throw error // 抛出错误供上层处理
  }
}
