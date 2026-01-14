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

    <div
      class="version-status"
      :class="{ 'needs-update': needsUpdate, 'up-to-date': !needsUpdate }"
    >
      <div class="status-icon">
        <span v-if="needsUpdate">⚠️</span>
        <span v-else>✅</span>
      </div>
      <div class="status-text">
        <span v-if="needsUpdate">发现新版本，建议更新</span>
        <span v-else>已是最新版本</span>
      </div>
      <button v-if="needsUpdate" class="update-btn" @click="handleUpdate">立即更新</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { GameSettings } from '@types'
import { ref, onMounted, watch, computed } from 'vue'
import useInterval from 'vue-hooks-plus/lib/useInterval'

interface Props {
  gameSettings?: GameSettings
}

const props = defineProps<Props>()

const currentVersion = ref('--')
const latestVersion = ref('--')
const needsUpdate = ref(false)
const isLoading = ref(false)

const updateStatus = () => {
  const local = currentVersion.value
  const remote = latestVersion.value

  if (!local || !remote || local === '--' || remote === '--') {
    needsUpdate.value = false
    return
  }

  const localNum = parseInt(local, 10)
  const remoteNum = parseInt(remote, 10)

  if (Number.isNaN(localNum) || Number.isNaN(remoteNum)) {
    needsUpdate.value = false
    return
  }

  needsUpdate.value = remoteNum > localNum
}

// 使用计算属性提取 gamePath，便于监听
const gamePath = computed(() => props.gameSettings?.gamePath || '')

// 读取本地版本
const loadLocalVersion = async () => {
  const path = gamePath.value
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
const loadRemoteVersion = async () => {
  try {
    const result = await window.api.getRemoteVersion?.()
    if (result?.success && result.version) {
      latestVersion.value = result.version
    } else {
      console.error('获取远程版本失败:', result?.error)
      latestVersion.value = '--'
    }
  } catch (error) {
    console.error('获取远程版本异常:', error)
    latestVersion.value = '--'
  } finally {
    updateStatus()
  }
}

// 监听游戏路径变化，自动重新加载版本
watch(gamePath, () => {
  loadLocalVersion()
})

// 组件挂载时加载版本
onMounted(() => {
  loadLocalVersion()
  loadRemoteVersion()
})

// 10分钟刷一次
useInterval(
  () => {
    loadRemoteVersion()
  },
  1000 * 60 * 10
)

const handleUpdate = () => {
  // 这里后续可以添加实际的更新逻辑
  console.log('开始更新...')
}
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
