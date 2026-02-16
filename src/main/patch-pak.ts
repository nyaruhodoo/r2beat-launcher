import { readFile, writeFile } from 'fs/promises'

const SEARCH_STR = 'filter.txt'
const REPLACE_STR = 'filte1.txt'

/**
 * 补丁函数：从文件末尾向前搜索并替换
 */
export const patchPak = async ({
  pakPath,
  isShieldWordDisabled
}: {
  pakPath: string
  isShieldWordDisabled?: boolean
}) => {
  try {
    // 1. 读取文件（注意：如果是数GB的文件，建议使用流式读写，这里沿用你的 Buffer 方案）
    const buffer = await readFile(pakPath)

    // 根据开关状态决定：当前要找什么，以及要换成什么
    const target = isShieldWordDisabled ? SEARCH_STR : REPLACE_STR
    const replacement = isShieldWordDisabled ? REPLACE_STR : SEARCH_STR

    console.log(`-----------------------------------------------`)
    console.log(`文件路径: ${pakPath}`)
    console.log(`执行模式: ${isShieldWordDisabled ? '禁用屏蔽词' : '启用屏蔽词'}`)

    // 2. 从后往前搜索 (lastIndexOf)
    const index = buffer.lastIndexOf(target)

    if (index === -1) {
      console.log(`ℹ️ 未找到待修改内容 "${target}"，可能已经处于目标状态。`)
      return
    }

    console.log(`✨ 匹配成功！位置: 0x${index.toString(16).toUpperCase()}`)
    console.log(`修改内容: "${target}" -> "${replacement}"`)

    // 3. 原位修改内存中的 Buffer
    buffer.write(replacement, index, 'utf8')

    // 4. 写回文件 (添加 await 确保保存完成)
    await writeFile(pakPath, buffer)

    console.log(`✅ 补丁应用成功！`)
  } catch (err) {
    console.error('❌ 操作失败:', err instanceof Error ? err.message : err)
  } finally {
    console.log(`-----------------------------------------------`)
  }
}
