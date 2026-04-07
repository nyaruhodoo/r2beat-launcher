import { spawnGameProcess } from '@src/main/spawn'
import { parentPort } from 'worker_threads'

// 监听主线程的消息
parentPort?.on(
  'message',
  async ({
    gameExePath,
    args,
    gamePath,
  }: {
    gameExePath: string
    gamePath: string
    args: string[]
  }) => {
    try {
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

      // 1. 立即返回 PID
      const pid = gameProcess.pid
      parentPort?.postMessage({ type: 'PID_READY', pid })

      // 确保子进程可以独立存在
      gameProcess.unref()

      // 2. 监听退出事件并转发
      gameProcess.on('exit', (code, signal) => {
        parentPort?.postMessage({ type: 'EXITED', code, signal, pid })
      })

      gameProcess.on('error', (err) => {
        parentPort?.postMessage({ type: 'ERROR', error: err.message, pid })
      })
    } catch (error) {
      parentPort?.postMessage({
        type: 'ERROR',
        error: error instanceof Error ? error.message : '启动失败',
      })
    }
  },
)
