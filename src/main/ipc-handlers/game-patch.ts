import { createReadStream, createWriteStream } from 'fs'
import { readFile, writeFile, mkdir, unlink, stat, copyFile, rm } from 'fs/promises'
import { join, relative } from 'path'
import { parse, stringify } from 'ini'
import lzma from 'lzma-native'
import { Parser } from 'tsv'
import type { IpcListener, IpcEmitter } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents, IpcRendererEvents } from '../../ipc/contracts'
import type { PatchInfo } from '@src/types'
import { http } from '../http'
import { Utils } from '../utils'

const tsxParser = new Parser('\t', { header: false })

/**
 * 游戏客户端版本更新：远程版本号、补丁列表下载、补丁包下载解压、应用到游戏目录
 */
export function registerGamePatchHandlers(
  ipc: IpcListener<IpcMainEvents>,
  emitter: IpcEmitter<IpcRendererEvents>,
): void {
  ipc.handle('get-remote-version', async () => {
    const url = 'https://r2beat-cdn.xiyouxi.com/live/vpatch/patchVersionInfo.txt'
    try {
      const { data: text } = await http.get<string>(url, { responseType: 'text' })
      const parsePatchVersionInfo = parse(text) as {
        useropen?: Record<string, boolean>
        masteropen?: Record<string, boolean>
        versionend?: Record<string, boolean>
      }

      const useropen = Object.keys(parsePatchVersionInfo.useropen ?? {})

      if (useropen.length === 0) {
        throw new Error('未找到 [useropen]')
      }

      return { success: true, version: useropen[useropen.length - 1] }
    } catch (error) {
      console.error('[Main] 获取远程版本异常:', error)
      return { success: false, error: '获取远程版本时发生异常' }
    }
  })

  ipc.handle('download-patch-lists', async (_event, versions, keepLatestOnly = true) => {
    try {
      if (!Array.isArray(versions) || versions.length === 0) {
        throw new Error('版本列表为空')
      }

      const validVersions = versions.filter((v) => typeof v === 'string' && /^\d+$/.test(v))
      if (validVersions.length === 0) {
        throw new Error('没有有效的版本号')
      }

      const appRoot = Utils.getTargetDir()
      const targetDir = join(appRoot, 'patch', 'lst')

      try {
        if (!(await Utils.exists(targetDir))) {
          await mkdir(targetDir, { recursive: true })
        }
      } catch (error) {
        console.error('[Main] 创建 patch/lst 目录失败:', error)
        throw new Error('创建本地目录失败')
      }

      const localFiles: { version: string; filePath: string }[] = []

      for (const version of validVersions) {
        const fileName = `${version}.lst.txt`
        const filePath = join(targetDir, fileName)

        if (await Utils.exists(filePath)) {
          console.log(`[Main] 补丁列表已存在，跳过: ${fileName}`)
          localFiles.push({ version, filePath })
          continue
        }

        const url = `https://r2beat-cdn.xiyouxi.com/live/vpatch/${version}/${version}.lst`
        console.log('[Main] 开始下载补丁列表:', url)

        try {
          await Utils.downloadFile(url, filePath)
          localFiles.push({ version, filePath })
          console.log('[Main] 补丁列表下载完成:', filePath)
        } catch (error) {
          const errorMsg = `下载补丁列表失败: ${url} - ${error instanceof Error ? error.message : String(error)}`
          console.error('[Main]', errorMsg)
          throw new Error(errorMsg)
        }
      }

      let patches: {
        version: string
        filePath: string
        patchFileName: string
        targetFileName: string
        originalSize: number
        compressedSize: number
        checksum: number
        downloadUrl: string
      }[] = []

      let totalSize = 0

      for (const { version, filePath } of localFiles) {
        try {
          const content = await readFile(filePath, 'utf-8')
          const parserRow: [string, string, number, number, number][] = tsxParser
            .parse(content)
            .filter((i) => {
              return i.length === 5
            })

          const parserRowList = parserRow.map((i) => {
            totalSize += i[2]

            return {
              version,
              filePath,
              patchFileName: i[0],
              targetFileName: i[1] === 'VLauncher_New.exe' ? 'VLauncher.exe' : i[1],
              originalSize: i[2],
              compressedSize: i[3],
              checksum: i[4],
              downloadUrl: `http://r2beat-cdn.xiyouxi.com/live/vpatch/${version}/${i[0]}`,
            }
          })

          patches.push(...parserRowList)
        } catch (error) {
          const errorMsg = `解析补丁列表失败: ${filePath} - ${error instanceof Error ? error.message : String(error)}`
          console.error('[Main]', errorMsg)
          throw new Error(errorMsg)
        }
      }

      if (keepLatestOnly && patches.length > 0) {
        const latestMap = new Map<string, (typeof patches)[number]>()

        for (const patch of patches) {
          const key = patch.targetFileName
          const existing = latestMap.get(key)

          if (!existing) {
            latestMap.set(key, patch)
            continue
          }

          const vNew = parseInt(patch.version, 10)
          const vOld = parseInt(existing.version, 10)

          if (!Number.isNaN(vNew) && !Number.isNaN(vOld)) {
            if (vNew > vOld) {
              latestMap.set(key, patch)
            }
          } else if (patch.version > existing.version) {
            latestMap.set(key, patch)
          }
        }

        patches = Array.from(latestMap.values())
        totalSize = patches.reduce((sum, p) => sum + (p.originalSize || 0), 0)
      }

      return {
        success: true,
        totalSize,
        patches,
      }
    } catch (error) {
      console.error('[Main] download-patch-lists 处理失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载补丁列表时发生未知错误',
      }
    }
  })

  ipc.handle('download-patch-files', async (event, info) => {
    try {
      const patches = info?.patches ?? []
      if (!Array.isArray(patches) || patches.length === 0) {
        throw new Error('没有可下载的补丁文件')
      }

      const appRoot = Utils.getTargetDir()
      const targetDir = join(appRoot, 'patch', 'file')

      try {
        if (!(await Utils.exists(targetDir))) {
          await mkdir(targetDir, { recursive: true })
        }
      } catch (error) {
        console.error('[Main] 创建 patch/file 目录失败:', error)
        throw new Error('创建补丁文件目录失败')
      }

      const totalFiles = patches.length
      const downloadFractions = Array.from<number>({ length: totalFiles }).fill(0)
      const decompressFractions = Array.from<number>({ length: totalFiles }).fill(0)

      let lastProgressTime = 0

      const emitProgress = (
        index: number,
        stage: 'download' | 'decompress' | 'skip',
        currentFileDownloadFraction: number,
        currentFileDecompressFraction: number,
        targetFileName?: string,
        message?: string,
      ) => {
        downloadFractions[index] = currentFileDownloadFraction
        decompressFractions[index] = currentFileDecompressFraction

        let sum = 0
        for (let i = 0; i < totalFiles; i++) {
          const fileProgress = downloadFractions[i] * 0.5 + decompressFractions[i] * 0.5
          sum += fileProgress
        }
        const overallProgress = sum / totalFiles
        const percent = Math.min(100, Number((overallProgress * 100).toFixed(2)))

        const now = Date.now()
        if (percent < 100 && now - lastProgressTime < 2000) {
          return
        }
        lastProgressTime = now

        emitter.send(event.sender, 'patch-progress', {
          percent,
          stage,
          targetFileName,
          message,
        })
      }

      emitProgress(0, 'download', 0, 0, undefined, '开始更新补丁')

      const processSinglePatch = async (
        patch: (typeof patches)[number],
        patchIndex: number,
      ) => {
        let downloadFraction = 0
        let decompressFraction = 0
        const targetFileName = patch.targetFileName
        if (!targetFileName || !patch.downloadUrl) {
          return
        }

        let outDir = targetDir
        let outFileName = targetFileName

        if (targetFileName.includes('\\') || targetFileName.includes('/')) {
          const pathParts = targetFileName.split(/[\\/]/)
          outFileName = pathParts[pathParts.length - 1]

          if (pathParts.length > 1) {
            const dirParts = pathParts.slice(0, -1)
            outDir = join(targetDir, ...dirParts)

            if (!(await Utils.exists(outDir))) {
              await mkdir(outDir, { recursive: true })
              console.log(`[Main] 已创建目录: ${outDir}`)
            }
          }
        }

        const outPath = join(outDir, outFileName)

        if (await Utils.exists(outPath)) {
          console.log('[Main] 目标文件已存在，跳过下载与解压:', outPath)
          downloadFraction = 1
          decompressFraction = 1
          emitProgress(
            patchIndex,
            'skip',
            downloadFraction,
            decompressFraction,
            targetFileName,
            '目标文件已存在，跳过',
          )
          return
        }

        const tmpPath = join(outDir, patch.patchFileName || `${outFileName}.lzma`)
        console.log('[Main] 开始下载补丁文件:', patch.downloadUrl)

        try {
          await Utils.downloadFile(patch.downloadUrl, tmpPath, (_downloaded, _total, progress) => {
            downloadFraction = progress
            emitProgress(
              patchIndex,
              'download',
              downloadFraction,
              decompressFraction,
              targetFileName,
              '补丁下载中',
            )
          })

          console.log('[Main] 补丁文件下载完成，开始解压:', tmpPath)

          downloadFraction = 1
          emitProgress(
            patchIndex,
            'download',
            downloadFraction,
            decompressFraction,
            targetFileName,
            '补丁下载完成',
          )

          let totalDecompressBytes = 0
          try {
            const statResult = await stat(tmpPath)
            totalDecompressBytes = statResult.size
          } catch {
            totalDecompressBytes = 0
          }

          await new Promise<void>((resolve, reject) => {
            const decoder = lzma.createDecompressor()
            const source = createReadStream(tmpPath)
            const dest = createWriteStream(outPath)

            let decompressedBytes = 0

            source.on('data', (chunk) => {
              decompressedBytes += chunk.length
              if (totalDecompressBytes > 0) {
                decompressFraction = Math.min(1, decompressedBytes / totalDecompressBytes)
                emitProgress(
                  patchIndex,
                  'decompress',
                  downloadFraction,
                  decompressFraction,
                  targetFileName,
                  '补丁解压中',
                )
              }
            })

            source.on('error', (err) => reject(err))
            dest.on('error', (err) => reject(err))
            dest.on('finish', () => resolve())

            source.pipe(decoder).pipe(dest)
          })

          await Utils.safeExecute(
            () => unlink(tmpPath),
            `[Main] 删除临时补丁文件失败（可忽略）: ${tmpPath}`,
          )

          console.log('[Main] 补丁解压完成:', outPath)
          decompressFraction = 1
          emitProgress(
            patchIndex,
            'decompress',
            downloadFraction,
            decompressFraction,
            targetFileName,
            '补丁解压完成',
          )
        } catch (error) {
          const errorMsg = `处理补丁文件失败: ${patch.downloadUrl} - ${error instanceof Error ? error.message : String(error)}`
          console.error('[Main]', errorMsg)
          throw new Error(errorMsg)
        }
      }

      await Utils.runConcurrent(patches, processSinglePatch)

      emitProgress(totalFiles - 1, 'decompress', 1, 1, undefined, '所有补丁文件处理完成')

      return {
        success: true,
      }
    } catch (error) {
      console.error('[Main] download-patch-files 处理失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载并解压补丁文件时发生未知错误',
      }
    }
  })

  ipc.handle('apply-patch-files', async (_event, gamePath, latestVersion) => {
    try {
      if (!gamePath || !latestVersion) {
        throw new Error('游戏路径或版本号为空')
      }

      await Utils.checkGameRunning()

      const appRoot = Utils.getTargetDir()
      const patchRoot = join(appRoot, 'patch')
      const patchFileDir = join(patchRoot, 'file')

      if (!(await Utils.exists(patchFileDir))) {
        throw new Error('未找到补丁文件目录')
      }

      const allFiles = (await Utils.getAllFilesInDir(patchFileDir, { recursive: true })).map(
        (f) => ({
          path: f.path,
          relativePath: relative(patchFileDir, f.path),
        }),
      )
      let hasDeleteFileList = false
      let deleteFileList: string[] = []

      for (const file of allFiles) {
        const relativePath = file.relativePath
        const normalizedPath = relativePath.replace(/\\/g, '/').toLowerCase()

        if (normalizedPath.endsWith('deletefilelist.dat')) {
          hasDeleteFileList = true
          console.log(`[Main] 检测到 DeleteFileList.dat: ${relativePath}`)

          await Utils.safeExecute(async () => {
            const deleteFileListContent = await readFile(file.path, 'utf-8')
            deleteFileList = deleteFileListContent
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line && !line.startsWith('#') && !line.startsWith(';'))

            console.log(
              `[Main] 预读取 DeleteFileList.dat，包含 ${deleteFileList.length} 个待删除文件`,
            )
            console.log('[Main] 待删除文件列表:', deleteFileList)
          }, '[Main] 预读取 DeleteFileList.dat 失败')
          break
        }
      }

      for (const file of allFiles) {
        const src = file.path
        const relativePath = file.relativePath

        let destDir = gamePath
        let destFileName = relativePath

        if (relativePath.includes('\\') || relativePath.includes('/')) {
          const pathParts = relativePath.split(/[\\/]/)
          destFileName = pathParts[pathParts.length - 1]

          if (pathParts.length > 1) {
            const dirParts = pathParts.slice(0, -1)
            destDir = join(gamePath, ...dirParts)

            if (!(await Utils.exists(destDir))) {
              await mkdir(destDir, { recursive: true })
              console.log(`[Main] 已创建目录: ${destDir}`)
            }
          }
        }

        const dest = join(destDir, destFileName)

        const normalizedRelativePath = relativePath.replace(/[\\/]/g, '/')
        const shouldDelete = deleteFileList.some((deletePath) => {
          const normalizedDeletePath = deletePath.replace(/[\\/]/g, '/')
          return (
            normalizedRelativePath === normalizedDeletePath ||
            normalizedRelativePath.endsWith('/' + normalizedDeletePath) ||
            normalizedDeletePath === normalizedRelativePath
          )
        })

        if (shouldDelete || (await Utils.exists(dest))) {
          const isInDeleteList = deleteFileList.some((deletePath) => {
            const normalizedDeletePath = deletePath.replace(/[\\/]/g, '/')
            const normalizedDestPath = relativePath.replace(/[\\/]/g, '/')
            return normalizedDestPath === normalizedDeletePath
          })

          if (isInDeleteList || (await Utils.exists(dest))) {
            try {
              if (await Utils.exists(dest)) {
                const statResult = await stat(dest)
                if (statResult.isFile()) {
                  console.log(`[Main] 复制前删除目标文件: ${dest}`)
                  await unlink(dest)
                  await new Promise((resolve) => setTimeout(resolve, 100))
                }
              }
            } catch (deleteError) {
              console.warn(`[Main] 无法删除目标文件（可能正在使用）: ${dest}`, deleteError)
              if ((deleteError as NodeJS.ErrnoException).code === 'EBUSY') {
                console.log(`[Main] 文件被锁定，尝试等待后重试删除: ${dest}`)
                let retryCount = 0
                const maxRetries = 5
                while (retryCount < maxRetries) {
                  await new Promise((resolve) => setTimeout(resolve, 500))
                  try {
                    await unlink(dest)
                    console.log(`[Main] 重试删除成功: ${dest}`)
                    break
                  } catch {
                    retryCount++
                    if (retryCount >= maxRetries) {
                      console.error(`[Main] 重试 ${maxRetries} 次后仍无法删除文件: ${dest}`)
                      throw new Error(`无法删除被锁定的文件: ${dest}`)
                    }
                  }
                }
              } else {
                throw deleteError
              }
            }
          }
        }

        let copySuccess = false
        let copyRetryCount = 0
        const maxCopyRetries = 3

        while (!copySuccess && copyRetryCount < maxCopyRetries) {
          try {
            await copyFile(src, dest)
            console.log(`[Main] 已复制补丁文件: ${relativePath} -> ${dest}`)
            copySuccess = true
          } catch (copyError) {
            const err = copyError as NodeJS.ErrnoException
            if (err.code === 'EBUSY' && copyRetryCount < maxCopyRetries - 1) {
              copyRetryCount++
              console.warn(
                `[Main] 复制文件被锁定，等待后重试 (${copyRetryCount}/${maxCopyRetries}): ${dest}`,
              )
              await Utils.safeExecute(async () => {
                if (await Utils.exists(dest)) {
                  await unlink(dest)
                }
              }, `[Main] 复制前删除目标文件失败: ${dest}`)
              await new Promise((resolve) => setTimeout(resolve, 500))
            } else {
              throw copyError
            }
          }
        }
      }

      try {
        const patchIniPath = join(gamePath, 'PatchInfo', 'Patch.ini')
        if (await Utils.exists(patchIniPath)) {
          const iniContent = await readFile(patchIniPath, 'utf-8')
          const patchInfo = parse(iniContent) as PatchInfo
          const versionNum = Number(latestVersion)
          if (!Number.isNaN(versionNum)) {
            if (!patchInfo.patch) patchInfo.patch = {}
            patchInfo.patch.version = latestVersion
            await writeFile(patchIniPath, stringify(patchInfo), 'utf-8')
          }
        }
      } catch (error) {
        console.warn('[Main] 更新 Patch.ini 版本号失败（忽略）：', error)
        throw error
      }

      if (hasDeleteFileList && deleteFileList.length > 0) {
        await Utils.safeExecute(async () => {
          console.log('[Main] 开始处理 DeleteFileList.dat 中剩余的待删除文件')

          const copiedFiles = new Set<string>()
          for (const file of allFiles) {
            const normalizedPath = file.relativePath.replace(/[\\/]/g, '/')
            copiedFiles.add(normalizedPath)
          }

          for (const filePath of deleteFileList) {
            try {
              const normalizedFilePath = filePath.replace(/[\\/]/g, '/')

              if (copiedFiles.has(normalizedFilePath)) {
                console.log(`[Main] 跳过已处理的文件: ${filePath}`)
                continue
              }

              const pathParts = normalizedFilePath.split('/').filter((p) => p)

              const targetPath = join(gamePath, ...pathParts)

              console.log(`[Main] 尝试删除文件: ${filePath} -> ${targetPath}`)

              if (await Utils.exists(targetPath)) {
                const statResult = await stat(targetPath)
                if (statResult.isFile()) {
                  let deleteSuccess = false
                  let deleteRetryCount = 0
                  const maxDeleteRetries = 5

                  while (!deleteSuccess && deleteRetryCount < maxDeleteRetries) {
                    try {
                      await unlink(targetPath)
                      console.log(`[Main] ✓ 已删除文件: ${targetPath}`)
                      deleteSuccess = true
                    } catch (deleteError) {
                      const err = deleteError as NodeJS.ErrnoException
                      if (err.code === 'EBUSY' && deleteRetryCount < maxDeleteRetries - 1) {
                        deleteRetryCount++
                        console.warn(
                          `[Main] 文件被锁定，等待后重试删除 (${deleteRetryCount}/${maxDeleteRetries}): ${targetPath}`,
                        )
                        await new Promise((resolve) => setTimeout(resolve, 500))
                      } else {
                        throw deleteError
                      }
                    }
                  }
                } else {
                  console.warn(`[Main] 跳过删除（是目录而非文件）: ${targetPath}`)
                }
              } else {
                console.warn(`[Main] 文件不存在，跳过删除: ${targetPath}`)
              }
            } catch (error) {
              console.error(`[Main] 删除文件失败: ${filePath}`, error)
            }
          }
          console.log('[Main] DeleteFileList.dat 处理完成')
        }, '[Main] 处理 DeleteFileList.dat 失败')
      } else {
        console.log('[Main] 本次更新不包含 DeleteFileList.dat，跳过文件删除')
      }

      try {
        await rm(patchRoot, { recursive: true, force: true })
      } catch (error) {
        console.warn('[Main] 清空 patch 目录失败（忽略）：', error)
        throw new Error('[Main] 清空 patch 目录失败')
      }

      return { success: true }
    } catch (error) {
      console.error('[Main] apply-patch-files 失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '应用补丁文件时发生未知错误',
      }
    }
  })
}
