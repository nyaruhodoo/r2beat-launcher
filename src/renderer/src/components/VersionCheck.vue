<template>
  <div class="version-check-container">
    <div class="version-info">
      <div class="version-icon">🔍</div>
      <div class="version-details">
        <div>
          <div class="version-label">本地版本</div>
          <div class="version-number">
            {{ currentVersion }}
          </div>
        </div>
        <div>
          <div class="version-label">远程版本</div>
          <div class="version-number">{{ latestVersion }}</div>
        </div>
      </div>
    </div>

    <div class="version-patch-info">
      <div v-if="showProgressBar || isApplyPatch" class="patch-progress">
        <div class="progress-header">
          <div class="progress-title">
            <span class="status-icon">⏳</span>
            <span>{{ patchProgressTitle }}</span>
            <span class="progress-percent">{{ (patchProgressPercent ?? 0).toFixed(2) }}%</span>
          </div>
          <div v-if="patchProgressFileName" class="progress-file">
            {{ patchProgressFileName }}
          </div>
        </div>

        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${patchProgressPercent ?? 0}%` }" />
        </div>
      </div>

      <div
        v-else
        class="version-status"
        :class="{ 'needs-update': needsUpdate, 'up-to-date': !needsUpdate }"
      >
        <div class="status-icon">
          <span v-if="needsUpdate">⚠️</span>
          <span v-else>✅</span>
        </div>
        <div class="status-text">
          <span v-if="needsUpdate">
            新版本
            <span>({{ totalSizeGbText ? `${totalSizeGbText}GB` : '正在计算中' }})</span>
            <span v-if="hasGameExe"> (包含 Game.exe) </span>
          </span>
          <span v-else>已是最新版本</span>
        </div>
        <button v-if="needsUpdate" class="update-btn" @click="handleUpdate">立即更新</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@renderer/composables/useToast'
import { checkRemoteVersionTime } from '@config'
import type { GameSettings, PatchProgressPayload, PatchUpdateInfo } from '@types'
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import useInterval from 'vue-hooks-plus/lib/useInterval'
import { ipcEmitter, ipcListener } from '@renderer/ipc'

interface Props {
  gameSettings?: GameSettings
}

const props = defineProps<Props>()
const { error: showError, success: showSuccess } = useToast()

const currentVersion = ref('--')
const latestVersion = ref('--')
// 是否需要更新（远程版本号大于本地版本号）
const needsUpdate = ref(false)
const preDownloadList = ref<PatchUpdateInfo>()

// 补丁下载/解压进度（来自主进程 IPC）
const patchProgressPercent = ref<number | null>(null)
const patchProgressStage = ref<PatchProgressPayload['stage']>()
const patchProgressFileName = ref<string>('')

// 记录更新是否出错，如果出错则不再自动更新
const hasUpdateError = ref(false)
// 是否正在应用补丁(避免无UI显示，进度条本身没考虑到这一步)
const isApplyPatch = ref(false)

const showProgressBar = computed(() => {
  return patchProgressPercent.value !== null && patchProgressPercent.value < 100
})

const patchProgressTitle = computed(() => {
  const percent = patchProgressPercent.value ?? 0
  const stage = patchProgressStage.value

  if (isApplyPatch.value) {
    return '正在应用补丁'
  }

  if (!stage || percent <= 0) {
    return '准备更新补丁'
  }

  if (stage === 'download') {
    return '正在下载'
  }

  if (stage === 'decompress') {
    return '正在解压'
  }

  if (stage === 'skip') {
    return '文件已存在，跳过处理'
  }

  return '正在处理'
})

const totalSizeGbText = computed<string | null>(() => {
  if (!preDownloadList.value || typeof preDownloadList.value.totalSize !== 'number') return null
  const gb = preDownloadList.value.totalSize / (1024 * 1024 * 1024)
  if (!Number.isFinite(gb) || gb <= 0) return null
  return gb.toFixed(2)
})

const hasGameExe = computed<boolean | null>(() => {
  const patches = preDownloadList.value?.patches
  if (!Array.isArray(patches) || patches.length === 0) return null
  return patches.some((p) => p.targetFileName?.toLowerCase() === 'game.exe')
})

// 使用计算属性提取 gamePath，便于watch监听
const gamePathComputed = computed(() => props.gameSettings?.gamePath || '')

// 读取本地版本
const loadLocalVersion = async () => {
  const path = gamePathComputed.value
  if (!path || path.trim() === '') {
    return
  }

  try {
    const result = await ipcEmitter.invoke('read-patch-info', path)
    if (result?.success && result.data) {
      currentVersion.value = result.data.patch.version.toString().padStart(5, '0')
      // currentVersion.value = '00033'

      updateStatus()
    } else {
      throw new Error(result?.error)
    }
  } catch (error) {
    console.error('读取本地版本失败:', error)
  }
}

// 获取远程版本
const loadRemoteVersion = async () => {
  try {
    const result = await ipcEmitter.invoke('get-remote-version')
    if (result?.success && result.version) {
      const newRemote = result.version
      const oldRemote = latestVersion.value
      latestVersion.value = newRemote

      // 首次加载不提示；仅在后续轮询中检测到远程版本变化时提醒
      if (+oldRemote && newRemote !== oldRemote) {
        ipcEmitter.send('show-notification', {
          title: '发现新的游戏版本',
          body: `远程版本已更新至 ${newRemote}，建议尽快更新游戏客户端。`
        })
      }

      getPreDownloadList()
    } else {
      throw new Error(result?.error)
    }
  } catch (error) {
    console.error('获取远程版本异常:', error)
    showError('获取远程版本异常')
    latestVersion.value = '--'
  }
}

/**
 * 计算是否有新版本
 */
const updateStatus = () => {
  const local = currentVersion.value
  const remote = latestVersion.value

  const versionsToUpdate: string[] = []

  const localNum = parseInt(local, 10)
  const remoteNum = parseInt(remote, 10)

  if (Number.isNaN(localNum) || Number.isNaN(remoteNum)) {
    needsUpdate.value = false
    return versionsToUpdate
  }

  if (remoteNum > localNum) {
    needsUpdate.value = true
    // 生成缺失版本列表：从本地下一版到远程最新（包含远程），保持原有宽度补零
    const width = Math.max(remote.length, local.length, 1)

    for (let v = localNum + 1; v <= remoteNum; v++) {
      versionsToUpdate.push(v.toString().padStart(width, '0'))
    }
  } else {
    needsUpdate.value = false
  }

  // 重置数据，已无需要更新内容
  if (versionsToUpdate.length === 0) {
    preDownloadList.value = undefined
    hasUpdateError.value = false
  }

  return versionsToUpdate
}

/**
 * 获取预下载文件列表
 */
const getPreDownloadList = async () => {
  const updateList = updateStatus()
  if (!updateList.length) return

  try {
    const res = await ipcEmitter.invoke('download-patch-lists', updateList)

    if (!res?.success) {
      throw new Error(res?.error)
    }

    preDownloadList.value = {
      totalSize: res.totalSize,
      patches: res.patches
    }

    // 只有在自动更新开启且之前没有更新错误时才自动更新
    if (props.gameSettings?.autoUpdate && !hasUpdateError.value) {
      handleUpdate()
    }
  } catch (error) {
    console.error('下载补丁列表异常:', error)
    showError(error instanceof Error ? error.message : '下载补丁列表异常')
    preDownloadList.value = undefined
  }
}

/**
 * 更新主逻辑
 */
const handleUpdate = async () => {
  // 根据预下载列表触发实际补丁下载与解压
  if (!preDownloadList.value || !preDownloadList.value.patches?.length) {
    throw new Error('暂无可用的补丁信息，请先检查版本')
  }

  // 安全检查：不支持包含 .diff 后缀的二进制补丁
  const hasDiffPatch = preDownloadList.value.patches.some((p) => {
    const patchName = p.patchFileName?.toLowerCase?.() ?? ''
    const targetName = p.targetFileName?.toLowerCase?.() ?? ''
    return patchName.endsWith('.diff') || targetName.endsWith('.diff')
  })

  if (hasDiffPatch) {
    throw new Error('检测到 diff 补丁，请使用官方启动器更新')
  }

  // 点击更新时，先显示进度条（主进程会持续推送）
  patchProgressPercent.value = 0
  patchProgressStage.value = 'download'
  patchProgressFileName.value = ''

  try {
    const res = await ipcEmitter.invoke(
      'download-patch-files',
      JSON.parse(JSON.stringify(preDownloadList.value))
    )

    if (!res?.success) {
      throw new Error(res?.error || '更新失败')
    }

    const gamePath = gamePathComputed.value
    const latest = latestVersion.value
    if (!gamePath || !latest) {
      throw new Error('游戏路径或远程版本为空，无法应用补丁')
    }

    isApplyPatch.value = true

    const applyRes = await ipcEmitter.invoke('apply-patch-files', gamePath, latest)
    if (!applyRes?.success) {
      throw new Error(applyRes?.error || '应用补丁失败')
    }

    await loadLocalVersion()

    // 更新成功，重置错误状态
    hasUpdateError.value = false
    showSuccess('已更新到最新版本')
  } catch (error) {
    console.error('[Renderer] 更新失败:', error)
    // 更新失败，记录错误状态，后续不再自动更新
    hasUpdateError.value = true
    showError(error instanceof Error ? error.message : '更新失败')
  } finally {
    patchProgressPercent.value = null
    patchProgressStage.value = undefined
    patchProgressFileName.value = ''
    isApplyPatch.value = false
  }
}

onMounted(() => {
  // 订阅更新进度事件
  const off = ipcListener.on('patch-progress', (_event, payload: PatchProgressPayload) => {
    patchProgressPercent.value = payload.percent
    patchProgressStage.value = payload.stage
    patchProgressFileName.value = payload.targetFileName ?? ''

    console.log(
      `[PatchProgress] ${payload.percent.toFixed(2)}% - ${payload.stage} - ${payload.targetFileName ?? ''} ${
        payload.message ?? ''
      }`
    )
  })
  onUnmounted(() => off?.())

  // 初始化版本数据
  loadLocalVersion()
  loadRemoteVersion()
})

// 监听游戏路径变化，重新加载本地版本
watch(gamePathComputed, () => {
  loadLocalVersion()
})

// 定时检测远程版本更新
useInterval(() => {
  loadRemoteVersion()
}, checkRemoteVersionTime)
</script>

<style scoped>
.version-check-container {
  background: var(--color-bg-card);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal);
}

.version-info {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--color-border);

  .version-icon {
    font-size: 32px;
  }

  .version-details {
    flex: 1;
    display: flex;
    justify-content: space-around;
    text-align: center;
  }
}

.version-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-bottom: 5px;
}

.version-number {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}

.version-patch-info {
  height: 61px;
  display: flex;
  align-items: center;

  > * {
    width: 100%;
  }
}

.version-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  transition: all 0.3s ease;

  &.up-to-date {
    background: var(--color-success-bg);
    border: 1px solid var(--color-success-border);
  }

  &.needs-update {
    background: var(--color-warning-bg);
    border: 1px solid var(--color-warning-border);
  }

  .status-icon {
    font-size: 24px;
  }

  .status-text {
    flex: 1;
    font-size: 14px;
    color: var(--color-text-primary);
  }
}

.patch-progress {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.progress-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.progress-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: 14px;
  min-width: 0;
}

.progress-percent {
  margin-left: auto;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
  font-family: 'Courier New', monospace;
}

.progress-file {
  color: var(--color-text-tertiary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Courier New', monospace;
}

.progress-track {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--color-bg-card-hover);
  border: 1px solid var(--color-border);
}

.progress-fill {
  height: 100%;
  width: 0%;
  background: var(--gradient-primary);
  border-radius: 999px;
  transition: width 0.2s ease;
}

.update-btn {
  padding: 8px 20px;
  background: var(--gradient-primary);
  border: none;
  border-radius: 20px;
  color: white;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-button-active);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-button-hover);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
