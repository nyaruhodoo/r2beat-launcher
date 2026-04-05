import { join } from 'path'
import { writeFile } from 'fs/promises'
import type { IpcListener } from '@electron-toolkit/typed-ipc/main'
import type { IpcMainEvents } from '../../../ipc/contracts'
import type { ProcessPriority } from '@src/types'
import { spawnGameProcess, spawnDetached } from '../../spawn'
import { patchPak } from './patch-pak'
import { hookDll } from './hook-dll'
import { MainUtils } from '../../main-utils'
import _psList from 'ps-list'

// @ts-expect-error  不知道原因，暂时这样修正
const psList: typeof _psList = typeof _psList === 'function' ? _psList : _psList.default

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
        if (!(await MainUtils.exists(gameExePath))) {
          throw new Error(`找不到游戏文件: ${gameExePath} 请检查游戏安装目录是否正确`)
        }

        const pakPath = join(gamePath, 'rnr_script.pak')
        const xyxIdFilePath = join(gamePath, 'xyxID.txt')

        const tasks: Promise<unknown>[] = []

        if (await MainUtils.exists(pakPath)) {
          tasks.push(
            patchPak({
              pakPath,
              isShieldWordDisabled,
            }),
          )
        }

        tasks.push(
          MainUtils.safeExecute(async () => {
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

        // console.log(`[Main] 启动游戏: ${gameExePath}`)
        // console.log(`[Main] 命令行参数:`, args)

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

        console.log('[Main] 启动游戏成功')

        if (launchArgs === 'xyxOpen') {
          await hookDll({
            pid: gameProcess.pid,
            username,
            password,
          })
        }

        MainUtils.safeExecute(() => {
          const { promise, resolve, reject } = Promise.withResolvers()

          if (process.platform !== 'win32') {
            reject()
            return promise
          }

          if (processPriority && processPriority !== 'normal') {
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
          }

          if (lowerNPPriority) {
            let checkCount = 0
            const maxChecks = 15

            const intervalId = setInterval(async () => {
              checkCount++
              if (checkCount > maxChecks) {
                console.warn('[Main] 未发现 GameMon 相关进程（已超时）')
                clearInterval(intervalId)
                reject()
                return
              }

              const list = await psList()
              const gameMonList = list.filter((i) => {
                return i.name.includes('GameMon')
              })

              if (gameMonList.length > 0) {
                console.log('[Main] 已检测到包含关键字 "GameMon" 的进程：')
                clearInterval(intervalId)

                const targetPriorityValue = 64
                const processPromises = gameMonList.map(async ({ name, pid }) => {
                  await spawnDetached('wmic', [
                    'process',
                    'where',
                    `processid=${pid}`,
                    'CALL',
                    'setpriority',
                    String(targetPriorityValue),
                  ])

                  console.log(
                    `[Main] 已将进程优先级设置为最低: ${name} (pid=${pid}, priority=${targetPriorityValue})`,
                  )
                })

                await Promise.all(processPromises)
                resolve(undefined)
              }
            }, 2000)
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
