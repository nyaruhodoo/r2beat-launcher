<template>
  <div class="launch-button-container">
    <button
      class="launch-btn"
      :class="{ launching: isLaunching, disabled: isDisabled }"
      :disabled="isDisabled"
      @click="handleLaunch"
    >
      <span v-if="!isLaunching" class="btn-icon">🚀</span>
      <span v-else class="btn-icon loading">⏳</span>
      <span class="btn-text">{{ isLaunching ? '启动中...' : '启动游戏' }}</span>
    </button>

    <!-- 服务端状态显示 -->
    <div class="server-status" :class="`status-${serverStatus}`">
      <span class="status-dot"></span>
      <span class="status-text">{{ getStatusText(serverStatus) }}</span>
    </div>

    <!-- 自动登录复选框 -->
    <Checkbox v-if="serverStatus === 'unknown'" v-model="autoLoginEnabled"
      >服务器正常后自动登录</Checkbox
    >

    <!-- 服务端状态异常对话框 -->
    <ServerStatusDialog
      :visible="showStatusDialog"
      @continue="handleContinueLogin"
      @cancel="handleCancelDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { GameSettings, UserInfo } from '@types'
import { ref, onMounted, computed } from 'vue'
import { useInterval, useLocalStorageState } from 'vue-hooks-plus'
import { useToast } from '../composables/useToast'
import Checkbox from './Checkbox.vue'
import ServerStatusDialog from './ServerStatusDialog.vue'
import { checkServerStatusTime, checkUnknownServerStatusTime } from '@config'

interface Props {
  userInfo?: UserInfo
  gameSettings?: GameSettings
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'login-required'): void
}>()

const isLaunching = ref(false)
const isDisabled = ref(false)

// 服务端状态
type ServerStatus = 'unknown' | 'normal'
const serverStatus = ref<ServerStatus>('normal')

// 服务端状态对话框显示状态
const showStatusDialog = ref(false)

// 自动登录相关
const autoLoginEnabled = ref(false)

// 缓存上次检测时间戳
const [lastCheckTimestamp, setLastCheckTimestamp] = useLocalStorageState<number>(
  'r2beat_server_status_last_check'
)

// 获取状态文本
const getStatusText = (status: ServerStatus): string => {
  switch (status) {
    case 'normal':
      return '正常'
    default:
      return '异常'
  }
}

// 检测服务端状态
const checkServerStatus = async () => {
  try {
    const encodedUsername = 'dnZ4NjQyODg2Mw=='
    const encodedPassword = 'NjQyODg2MTc0'

    const username = props.userInfo?.username || atob(encodedUsername)
    const password = props.userInfo?.password || atob(encodedPassword)

    const result = await window.api.tcpLogin?.(username, password)

    const previousStatus = serverStatus.value

    /**
     * 1005 不知道是什么东西，暂时也算作正常登录
     */
    if (result?.status === 'SUCCESS' || result?.data?.CommandID === 1005) {
      // 登录成功，服务正常
      serverStatus.value = 'normal'

      // 如果之前是异常状态，现在恢复正常：
      if (previousStatus === 'unknown') {
        if (autoLoginEnabled.value) {
          // 开启了自动登录：自动启动游戏，但不弹系统通知
          autoLoginEnabled.value = false
          executeLaunch()
        } else {
          // 未开启自动登录：仅通过系统通知告知用户服务已恢复
          window.api.showNotification?.('服务器状态已恢复正常', '现在可以尝试重新启动游戏。')
        }
      }
    } else {
      throw new Error(result?.message)
    }
  } catch (error) {
    // 发生错误，服务异常
    console.error('[LaunchButton] 检测服务端状态失败:', error)
    serverStatus.value = 'unknown'
  } finally {
    // 更新检测时间戳
    setLastCheckTimestamp(Date.now())
  }
}

// 组件初始化时检测服务端状态（带缓存）
onMounted(() => {
  const now = Date.now()
  const lastCheck = lastCheckTimestamp.value

  // 如果距离上次检测超过一分钟，则重新检测
  if (!lastCheck || now - lastCheck >= checkUnknownServerStatusTime) {
    checkServerStatus()
  } else {
    // 在一分钟内，跳过检测
    console.log('[LaunchButton] 距离上次检测不足一分钟，跳过检测')
  }
})

// Toast 提示
const { error: showError, success: showSuccess } = useToast()

/**
 * 根据目标TCP包总长度，生成以mujica填充的命令行参数
 */
// function generateCommandLine(totalTcpLength: number): string {
//   // 核心规则：填充字符串长度 = TCP总长度 - 12
//   const requiredStrLength = totalTcpLength - 12

//   // 边界校验：确保填充字符串长度为正整数
//   if (!Number.isInteger(totalTcpLength) || totalTcpLength < 12) {
//     throw new Error(`目标长度需为大于12的整数，当前输入为${totalTcpLength}`)
//   }

//   // 定义填充的核心字符串
//   const fillWord = 'mujica'
//   const fillWordLen = fillWord.length

//   // 循环拼接mujica并截取到目标长度
//   let filledStr = ''
//   const repeatTimes = Math.floor(requiredStrLength / fillWordLen)
//   const remainLength = requiredStrLength % fillWordLen
//   // 拼接完整重复的部分 + 剩余部分
//   filledStr = fillWord.repeat(repeatTimes) + fillWord.slice(0, remainLength)

//   // 生成最终命令行参数
//   return `${filledStr}|1`
// }

const handleLaunch = async () => {
  if (isLaunching.value || isDisabled.value) return

  // 检查登录状态
  if (!props.userInfo) {
    emit('login-required')
    return
  }

  // 使用传入的 gameSettings
  const latestSettings = props.gameSettings

  // 检查游戏路径是否设置
  if (!latestSettings?.gamePath || latestSettings.gamePath.trim() === '') {
    showError('请先在设置中配置游戏安装目录')
    return
  }

  // 检查服务端状态
  if (serverStatus.value !== 'normal') {
    // 显示状态选择对话框
    showStatusDialog.value = true
    return
  }

  // 执行启动游戏逻辑
  await executeLaunch()
}

// 执行启动游戏
const executeLaunch = async () => {
  if (isLaunching.value || isDisabled.value) return

  // 检查登录状态
  if (!props.userInfo?.password || !props.userInfo?.username) {
    emit('login-required')
    return
  }

  // 使用传入的 gameSettings
  const latestSettings = props.gameSettings

  // 检查游戏路径是否设置
  if (!latestSettings?.gamePath || latestSettings.gamePath.trim() === '') {
    showError('请先在设置中配置游戏安装目录')
    return
  }

  isLaunching.value = true
  isDisabled.value = true

  try {
    const result = await window.api.launchGame?.(
      latestSettings.gamePath,
      // 单纯生成占位符只会发起登陆包，不会进一步请求，或许需要调整更多逻辑
      // `xyxOpen|${generateCommandLine(props.userInfo.username?.length + props.userInfo.password.length + 10)}`,
      // 使用指定格式的则会发起完整登录流程 (抄他妈的！)
      `xyxOpen|${props.userInfo.username}|||0|1|${props.userInfo.password}|3|4|`,
      latestSettings.minimizeToTrayOnLaunch || false,
      latestSettings.processPriority || 'normal',
      latestSettings.lowerNPPriority || false
    )

    if (result?.success) {
      !props.gameSettings?.minimizeToTrayOnLaunch && showSuccess('游戏启动成功！')
    } else {
      throw new Error(result?.error)
    }
  } catch (error) {
    if (error instanceof Error) {
      console.log(error)
      if (error.message.includes('EACCES')) {
        showError('权限不足，请以管理员身份运行')
      } else {
        showError(error.message || '启动游戏失败')
      }
    }
  } finally {
    isLaunching.value = false
    isDisabled.value = false
  }
}

// 处理继续登录
const handleContinueLogin = () => {
  showStatusDialog.value = false
  executeLaunch()
}

// 处理取消对话框
const handleCancelDialog = () => {
  showStatusDialog.value = false
  autoLoginEnabled.value = false
}

// 计算状态检查间隔时间：unknown 状态 60 秒，normal 状态 10 分钟
const statusCheckInterval = computed(() => {
  if (serverStatus.value === 'unknown') {
    return checkUnknownServerStatusTime
  } else if (serverStatus.value === 'normal') {
    return checkServerStatusTime
  }
  return undefined
})

// 使用 useInterval 持续检查服务端状态
useInterval(() => {
  checkServerStatus()
}, statusCheckInterval)
</script>

<style scoped>
.launch-button-container {
  display: flex;
  flex-direction: column;
  justify-content: end;
  align-items: center;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.launch-btn {
  position: relative;
  padding: 18px 60px;
  font-size: 20px;
  font-weight: 700;
  color: white;
  background: var(--gradient-primary-dark);
  border: none;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  min-width: 200px;
  justify-content: center;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: var(--gradient-shine-light);
    transition: left 0.5s;
  }

  &:hover::before {
    left: 100%;
  }

  &:hover:not(.disabled):not(.launching) {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 12px 40px rgba(255, 107, 157, 0.6);
  }

  &:active:not(.disabled):not(.launching) {
    transform: translateY(-1px) scale(1.02);
  }

  &.launching {
    background: var(--gradient-primary);
    cursor: wait;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-icon {
    font-size: 24px;
    display: inline-block;

    &.loading {
      animation: spin 1s linear infinite;
    }
  }

  .btn-text {
    position: relative;
    z-index: 1;
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: var(--shadow-lg);
  }
  50% {
    box-shadow: 0 8px 40px rgba(255, 182, 193, 0.8);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 服务端状态显示 */
.server-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 400;

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-text {
    color: var(--color-text-tertiary);
    font-size: 13px;
  }

  /* 未知状态 - 黄色 */
  &.status-unknown .status-dot {
    background: #ffc107;
  }

  /* 正常状态 - 绿色 */
  &.status-normal .status-dot {
    background: #4caf50;
  }

  /* 维护状态 - 红色 */
  &.status-maintenance .status-dot {
    background: #f44336;
  }
}
</style>
