import fs from 'fs/promises'

const SEARCH_STR = 'filter.txt'
const REPLACE_STR = 'filte1.txt'

export const patchPak = async ({
  pakPath,
  isShieldWordDisabled
}: {
  pakPath: string
  isShieldWordDisabled?: boolean
}) => {
  try {
    // 1. 读取文件
    const buffer = await fs.readFile(pakPath)
    const fileSize = buffer.length
    const halfPoint = Math.floor(fileSize / 2)

    console.log(`-----------------------------------------------`)
    console.log(`文件名称: ${pakPath}`)
    console.log(`文件大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`)
    console.log(`搜索范围: 后 50% (从 0x${halfPoint.toString(16).toUpperCase()} 开始)`)

    // 2. 从后 50% 处开始搜索
    const index = buffer.indexOf(isShieldWordDisabled ? SEARCH_STR : REPLACE_STR, halfPoint)

    if (index === -1) {
      console.log(`❌ 未能在后 50% 区域找到 "${isShieldWordDisabled ? SEARCH_STR : REPLACE_STR}"。`)
      console.log(`-----------------------------------------------`)
      return
    }

    console.log(`✨ 匹配成功！`)
    console.log(`偏移地址: 0x${index.toString(16).toUpperCase()}`)
    console.log(`原始数据: "${buffer.toString('utf8', index, index + SEARCH_STR.length)}"`)

    // 3. 原位修改 Buffer
    buffer.write(isShieldWordDisabled ? REPLACE_STR : SEARCH_STR, index, 'utf8')

    // 4. 写回文件
    fs.writeFile(pakPath, buffer)

    console.log(`✅ 修改已应用: "${isShieldWordDisabled ? REPLACE_STR : SEARCH_STR}"`)
  } catch (err) {
    console.error('操作过程中出现异常:', err)
  } finally {
    console.log(`-----------------------------------------------`)
  }
}
