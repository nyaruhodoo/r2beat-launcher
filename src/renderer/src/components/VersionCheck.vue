<template>
  <div class="version-check-container">
    <div class="version-info">
      <div class="version-icon">🔍</div>
      <div class="version-details">
        <div>
          <div class="version-label">本地版本</div>
          <div class="version-number">
            <span v-if="isLoading">加载中...</span>
            <span v-else>{{ currentVersion }}</span>
          </div>
        </div>
        <div>
          <div class="version-label">远程版本</div>
          <div class="version-number">{{ latestVersion }}</div>
        </div>
      </div>
    </div>

    <div class="version-patch-info">
      <!-- 底部区域加载中状态，避免首次请求和切换时闪烁 -->
      <div v-if="isVersionSectionLoading" class="version-status loading">
        <div class="status-icon">⏳</div>
        <div class="status-text">正在加载版本信息...</div>
      </div>

      <template v-else>
        <div v-if="showProgressBar" class="patch-progress">
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
              <span v-if="totalSizeGbText">({{ totalSizeGbText }} GB)</span>
              <span v-if="hasGameExe"> (包含 Game.exe) </span>
            </span>
            <span v-else>已是最新版本</span>
          </div>
          <button v-if="needsUpdate" class="update-btn" @click="handleUpdate">立即更新</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@renderer/composables/useToast'
import { checkRemoteVersionTime } from '@config'
import { GameSettings, PatchProgressPayload, PatchUpdateInfo } from '@types'
import { ref, onMounted, watch, computed } from 'vue'
import useInterval from 'vue-hooks-plus/lib/useInterval'

interface Props {
  gameSettings?: GameSettings
}

const props = defineProps<Props>()
const { error: showError, success: showSuccess } = useToast()

const currentVersion = ref('--')
const latestVersion = ref('--')
const needsUpdate = ref(false)
const isLoading = ref(false)

const preDownloadList = ref<PatchUpdateInfo>()

// 补丁下载/解压进度（来自主进程 IPC）
const patchProgressPercent = ref<number | null>(null)
const patchProgressStage = ref<PatchProgressPayload['stage']>()
const patchProgressFileName = ref<string>('')

// 底部版本信息区域加载状态（远程版本 + 预下载列表）
const isVersionSectionLoading = ref(true)

const showProgressBar = computed(() => {
  return patchProgressPercent.value !== null && patchProgressPercent.value < 100
})

const patchProgressTitle = computed(() => {
  const stage = patchProgressStage.value
  if (stage === 'download') return '正在下载'
  if (stage === 'decompress') return '正在解压'
  if (stage === 'skip') return '已跳过'
  return '处理中'
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

const updateStatus = (): string[] => {
  const local = currentVersion.value
  const remote = latestVersion.value

  const versionsToUpdate: string[] = []

  if (!local || !remote || local === '--' || remote === '--') {
    needsUpdate.value = false
    return versionsToUpdate
  }

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

  return versionsToUpdate
}

// 使用计算属性提取 gamePath，便于监听
const gamePathComputed = computed(() => props.gameSettings?.gamePath || '')

// 读取本地版本
const loadLocalVersion = async () => {
  const path = gamePathComputed.value
  if (!path || path.trim() === '') {
    currentVersion.value = '未设置'
    return
  }

  isLoading.value = true
  try {
    const result = await window.api.readPatchInfo?.(path)
    if (result?.success && result.data) {
      currentVersion.value = result.data.patch.version.toString().padStart(5, '0')
    } else {
      currentVersion.value = '读取失败'
      console.error('读取 Patch.ini 失败:', result?.error)
    }
  } catch (error) {
    console.error('读取本地版本失败:', error)
    currentVersion.value = '读取失败'
  } finally {
    isLoading.value = false
    updateStatus()
  }
}

// 获取远程版本
const loadRemoteVersion = async (isLoading?: boolean) => {
  if (isLoading) {
    isVersionSectionLoading.value = true
  }

  try {
    const result = await window.api.getRemoteVersion?.()
    if (result?.success && result.version) {
      latestVersion.value = result.version
    } else {
      throw new Error(result?.error)
    }
  } catch (error) {
    console.error('获取远程版本异常:', error)
    showError('获取远程版本异常')
    latestVersion.value = '--'
  } finally {
    isVersionSectionLoading.value = false
    await getPreDownloadList()
  }
}

const getPreDownloadList = async () => {
  const updateList = updateStatus()
  if (!updateList.length) {
    preDownloadList.value = undefined
    return
  }
  try {
    const res = await window.api.downloadPatchLists?.(updateList)

    if (!res?.success) {
      throw new Error(res?.error || '下载补丁列表失败')
    }

    preDownloadList.value = {
      totalSize: res.totalSize,
      patches: res.patches
    }

    props.gameSettings?.autoUpdate && handleUpdate()
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
    showError('暂无可用的补丁信息，请先检查版本')
    return
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
    const res = await window.api.downloadPatchFiles?.(
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

    const applyRes = await window.api.applyPatchFiles?.(gamePath, latest)
    if (!applyRes?.success) {
      throw new Error(applyRes?.error || '应用补丁失败')
    }

    await loadLocalVersion()

    showSuccess('已更新到最新版本')
  } catch (error) {
    console.error('[Renderer] 更新失败:', error)
    showError(error instanceof Error ? error.message : '更新失败')
  } finally {
    patchProgressPercent.value = null
    patchProgressStage.value = undefined
    patchProgressFileName.value = ''
  }
}

// 组件挂载时加载版本
onMounted(() => {
  // 订阅主进程推送的补丁进度
  window.api.onPatchProgress?.((payload: PatchProgressPayload) => {
    patchProgressPercent.value = payload.percent
    patchProgressStage.value = payload.stage
    patchProgressFileName.value = payload.targetFileName ?? ''

    console.log(
      `[PatchProgress] ${payload.percent.toFixed(2)}% - ${payload.stage} - ${payload.targetFileName ?? ''} ${
        payload.message ?? ''
      }`
    )
  })

  loadLocalVersion()
  loadRemoteVersion(true)
})

// 监听游戏路径变化，自动重新加载版本
watch(gamePathComputed, () => {
  loadLocalVersion()
})

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
