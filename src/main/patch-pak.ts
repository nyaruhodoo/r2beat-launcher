import { FileHandle, open } from 'fs/promises'

const SEARCH_STR = 'filter.txt'
const REPLACE_STR = 'filte1.txt'

/**
 * 补丁函数
 */
export const patchPak = async ({
  pakPath,
  isShieldWordDisabled
}: {
  pakPath: string
  isShieldWordDisabled?: boolean
}) => {
  let fileHandle: FileHandle | undefined
  try {
    // 1. 以读写模式打开文件 (r+)
    fileHandle = await open(pakPath, 'r+')

    // 2. 获取文件状态，计算扫描起始位置
    const { size } = await fileHandle.stat()
    const scanSize = Math.floor(size * 0.3) // 仅后30%
    const startPos = size - scanSize

    // 3. 仅读取这 30% 到 Buffer
    const buffer = Buffer.alloc(scanSize)
    await fileHandle.read(buffer, 0, scanSize, startPos)

    const target = isShieldWordDisabled ? SEARCH_STR : REPLACE_STR
    const replacement = isShieldWordDisabled ? REPLACE_STR : SEARCH_STR

    // 4. 在局部 Buffer 中从后往前找
    const indexInBuffer = buffer.lastIndexOf(target)

    if (indexInBuffer === -1) {
      console.log(`ℹ️ 后30%区域未找到 "${target}"，停止操作。`)
      return
    }

    // 计算在原始文件中的真实偏移量
    const fileIndex = startPos + indexInBuffer
    console.log(`✨ 匹配成功！文件偏移: 0x${fileIndex.toString(16).toUpperCase()}`)

    // 5. 使用 write 直接修改文件的特定位置，而不是重写整个文件
    const replacementBuf = Buffer.from(replacement, 'utf8')
    await fileHandle.write(replacementBuf, 0, replacementBuf.length, fileIndex)

    console.log(`✅ 原位补丁成功！写入 ${replacementBuf.length} 字节。`)
  } catch (err) {
    console.error('❌ 操作失败:', err instanceof Error ? err.message : err)
  } finally {
    // 6. 务必关闭文件句柄
    if (fileHandle) await fileHandle.close()
  }
}
