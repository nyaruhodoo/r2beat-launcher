import { spawn, ChildProcess, SpawnOptions } from 'child_process'

/**
 * Spawn 执行结果
 */
export interface SpawnResult {
  /** 退出码，null 表示进程被终止 */
  code: number | null
  /** 标准输出内容 */
  stdout: string
  /** 标准错误输出内容 */
  stderr: string
  /** 进程 PID */
  pid: number | undefined
}

/**
 * Spawn 选项
 */
export interface SpawnPromiseOptions extends SpawnOptions {
  /** 是否收集 stdout 输出（默认 true） */
  collectStdout?: boolean
  /** 是否收集 stderr 输出（默认 true） */
  collectStderr?: boolean
  /** 超时时间（毫秒），0 表示不超时（默认 0） */
  timeout?: number
}

/**
 * 封装 spawn 为 Promise
 * @param command 命令
 * @param args 参数数组
 * @param options 选项
 * @returns Promise<SpawnResult>
 */
export function spawnPromise(
  command: string,
  args: string[] = [],
  options: SpawnPromiseOptions = {}
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const { collectStdout = true, collectStderr = true, timeout = 0, ...spawnOptions } = options

    // 如果需要收集输出，确保 stdio 配置正确
    if (collectStdout || collectStderr) {
      if (!spawnOptions.stdio) {
        spawnOptions.stdio = [
          'ignore',
          collectStdout ? 'pipe' : 'ignore',
          collectStderr ? 'pipe' : 'ignore'
        ]
      }
    }

    const child: ChildProcess = spawn(command, args, spawnOptions)

    let stdout = ''
    let stderr = ''

    // 收集 stdout
    if (collectStdout && child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })
    }

    // 收集 stderr
    if (collectStderr && child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })
    }

    // 处理错误
    child.on('error', (error) => {
      reject(error)
    })

    // 处理进程退出
    child.on('close', (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        pid: child.pid
      })
    })

    // 处理超时
    if (timeout > 0) {
      const timeoutId = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM')
          reject(new Error(`进程执行超时 (${timeout}ms)`))
        }
      }, timeout)

      child.on('close', () => {
        clearTimeout(timeoutId)
      })
    }

    // 如果是 detached 模式，调用 unref（如果可用）
    if (spawnOptions.detached && child.unref) {
      child.unref()
    }
  })
}

/**
 * 快速执行命令（fire and forget，不等待结果）
 * 适用于 detached 模式的后台任务
 * @param command 命令
 * @param args 参数数组
 * @param options 选项
 * @returns Promise<void> 立即 resolve，不等待进程完成
 */
export function spawnDetached(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      detached: true,
      stdio: 'ignore'
    })

    child.on('error', (error) => {
      reject(error)
    })

    // detached 模式下，立即 resolve
    if (child.unref) {
      child.unref()
    }

    // 给一个短暂的延迟，确保进程启动成功
    setImmediate(() => {
      resolve()
    })
  })
}

/**
 * 启动游戏进程（detached 模式）
 * 返回 ChildProcess 对象，用于获取 pid 和监听事件
 * @param command 命令
 * @param args 参数数组
 * @param options 选项
 * @param onExit 可选的退出回调函数
 * @returns Promise<ChildProcess> 返回进程对象
 */
export function spawnGameProcess(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      detached: true,
      stdio: 'ignore'
    })

    // 处理启动错误
    child.on('error', (error) => {
      reject(error)
    })

    // 监听进程退出（用于日志记录）
    if (onExit) {
      child.on('exit', (code, signal) => {
        onExit(code, signal)
      })
    }

    // 进程启动成功后立即 resolve
    // 使用 setImmediate 确保进程已经启动
    setImmediate(() => {
      resolve(child)
    })
  })
}
