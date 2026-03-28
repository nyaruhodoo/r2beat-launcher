import { join } from 'path'
import { writeFile } from 'fs/promises'
import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../../ipc/contracts'
import type { ProcessPriority } from '@src/types'
import { spawnGameProcess, spawnDetached, spawnPromise } from '../../spawn'
import { patchPak } from './patch-pak'
import { hookDll } from './hook-dll'
import { Utils } from '../../utils'

/** 启动游戏、补丁 pak、进程优先级 */
export function registerLaunchGameHandlers(ipc: IpcListener<IpcMainEvents>): void {
  ipc.handle(
    'launch-game',
    async (
      _,
      {
        gamePath,
        launchArgs,
        processPriority,
        lowerNPPriority,
        username,
        password,
        isShieldWordDisabled,
      },
    ) => {
      try {
        if (!gamePath || gamePath.trim() === '') {
          throw new Error('游戏路径未设置，请在设置中配置游戏安装目录')
        }
        if (!username || !password) {
          throw new Error('用户名或密码为空')
        }

        const gameExePath = join(gamePath, 'Game.exe')
        if (!(await Utils.exists(gameExePath))) {
          throw new Error(`找不到游戏文件: ${gameExePath} 请检查游戏安装目录是否正确`)
        }

        const pakPath = join(gamePath, 'rnr_script.pak')
        const xyxIdFilePath = join(gamePath, 'xyxID.txt')

        const tasks: Promise<unknown>[] = []

        if (await Utils.exists(pakPath)) {
          tasks.push(
            patchPak({
              pakPath,
              isShieldWordDisabled,
            }),
          )
        }

        tasks.push(
          Utils.safeExecute(async () => {
            await writeFile(xyxIdFilePath, username.trim(), 'utf-8')
            console.log(`[Main] 已更新 xyxID.txt: ${username.trim()}`)
          }, '[Main] 写入 xyxID.txt 失败'),
        )

        await Promise.allSettled(tasks)

        const args: string[] = []
        if (launchArgs && launchArgs.trim() !== '') {
          const argParts = launchArgs.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || []
          args.push(...argParts.map((arg: string) => arg.replace(/^"|"$/g, '')))
        }

        console.log(`[Main] 启动游戏: ${gameExePath}`)
        console.log(`[Main] 命令行参数:`, args)

        const gameProcess = await spawnGameProcess(
          gameExePath,
          args,
          {
            cwd: gamePath,
          },
          (code, signal) => {
            console.log(`[Main] 游戏进程退出: code=${code}, signal=${signal}`)
          },
        )

        if (!gameProcess.pid) throw new Error('启动游戏进程失败，无法获取进程ID')

        if (launchArgs === 'xyxOpen') {
          await hookDll({
            pid: gameProcess.pid,
            username,
            password,
          })
        }

        Utils.safeExecute(() => {
          const { promise, resolve } = Promise.withResolvers()

          if (process.platform !== 'win32') {
            resolve(undefined)
            return promise
          }

          const priorityKey: ProcessPriority = processPriority || 'normal'
          const priorityMap: Record<ProcessPriority, number> = {
            realtime: 256,
            high: 128,
            abovenormal: 32768,
            normal: 32,
            belownormal: 16384,
            low: 64,
          }

          const priorityValue = priorityMap[priorityKey] ?? priorityMap.normal

          console.log(
            `[Main] 开始设置游戏进程优先级: pid=${gameProcess.pid}, priority=${priorityKey}(${priorityValue})`,
          )

          spawnDetached('wmic', [
            'process',
            'where',
            `processid=${gameProcess.pid}`,
            'CALL',
            'setpriority',
            String(priorityValue),
          ])

          if (lowerNPPriority) {
            let checkCount = 0
            const maxChecks = 15

            const intervalId = setInterval(() => {
              checkCount++
              if (checkCount > maxChecks) {
                clearInterval(intervalId)
                console.warn('[Main] 未发现 GameMon 相关进程（已超时）')
                resolve(undefined)
                return
              }

              Utils.safeExecute(async () => {
                const result = await spawnPromise('wmic', ['process', 'get', 'Name,ProcessId'], {
                  collectStdout: true,
                  collectStderr: false,
                })

                const lines = result.stdout
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)

                const matches: Array<{ name: string; pid: number }> = []
                for (const line of lines) {
                  const match = line.match(/^(.*\S)\s+(\d+)$/)
                  if (match) {
                    const name = match[1].trim()
                    const pid = Number(match[2])
                    if (name.includes('GameMon')) {
                      matches.push({ name, pid })
                    }
                  }
                }

                if (matches.length > 0) {
                  console.log('[Main] 已检测到包含关键字 "GameMon" 的进程：', matches)
                  clearInterval(intervalId)

                  const targetPriorityValue = 64
                  const processPromises = matches.map(async ({ name, pid }) => {
                    await Utils.safeExecute(async () => {
                      console.log(
                        `[Main] 已将进程优先级设置为最低: ${name} (pid=${pid}, priority=${targetPriorityValue})`,
                      )
                      await spawnDetached('wmic', [
                        'process',
                        'where',
                        `processid=${pid}`,
                        'CALL',
                        'setpriority',
                        String(targetPriorityValue),
                      ])
                    }, `[Main] 设置进程优先级失败: ${name} (pid=${pid})`)
                  })

                  await Promise.all(processPromises)
                  resolve(undefined)
                }
              }, '设置 GameMon 进程优先级失败')
            }, 1000)
          } else {
            resolve(undefined)
          }

          return promise
        }, '调整进程优先级时发生错误')

        return { success: true }
      } catch (error) {
        console.error('[Main] 启动游戏时发生错误:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '启动游戏时发生未知错误',
        }
      }
    },
  )
}
