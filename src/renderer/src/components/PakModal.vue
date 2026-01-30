<template>
  <Modal
    :visible="visible"
    title="补丁"
    title-icon="⚙️"
    confirm-text="保存"
    cancel-text="关闭"
    @close="handleClose"
    @confirm="handleConfirm"
    @cancel="handleClose"
  >
    <div
      class="pak-section"
      :class="{ 'is-dragging': isDragging }"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <p class="pak-desc">勾选表示启用该补丁，取消勾选表示停用该补丁。</p>
      <div v-if="mergedPaks.length > 0" class="pak-list">
        <div v-for="item in mergedPaks" :key="item.name" class="pak-item-row">
          <Checkbox v-model="selected[item.name]">
            {{ item.name }}
          </Checkbox>
          <button class="pak-delete" @click="handleDeleteClick(item.name)">删除</button>
        </div>
      </div>
      <div v-else class="pak-empty">暂无可管理的补丁</div>
      <div v-if="isDragging" class="pak-drag-overlay">
        <div class="pak-drag-content">
          <div class="pak-drag-icon">📦</div>
          <div class="pak-drag-text">松开鼠标以添加补丁</div>
        </div>
      </div>
      <a
        href="https://pan.baidu.com/s/1Tcuq05V7Ao-bDQ9NT8wvGw?pwd=2zeg"
        target="_blank"
        class="pak-repo-link"
      >
        📦 补丁仓库
      </a>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from './Modal.vue'
import useEventListener from 'vue-hooks-plus/lib/useEventListener'
import Checkbox from './Checkbox.vue'
import { confirm } from '@renderer/composables/useConfirm'
import { useToast } from '@renderer/composables/useToast'

interface MergedPakItem {
  name: string
  modsPath?: string
  gamePath?: string
}

const props = defineProps<{
  visible: boolean
  gamePath?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const handleClose = () => {
  emit('close')
}

const { success: showSuccess, error: showError } = useToast()

// 合并后的补丁数据（按名字去重）
const mergedPaks = ref<MergedPakItem[]>([])

// 记录初始「是否在游戏目录中启用」的状态，用于对比确认时的变化
const originalEnabledMap = ref<Record<string, boolean>>({})

// 当前勾选状态：true 表示希望该补丁存在于游戏目录中
const selected = ref<Record<string, boolean>>({})

// 拖拽状态
const isDragging = ref(false)
const dragCounter = ref(0)

// 调用主进程 IPC 获取 pak 列表，并按名称进行合并
const getPaks = async () => {
  if (!props.gamePath) return

  const res = await window.api.getPaks?.(props.gamePath)
  console.log(res)
  if (res?.success) {
    const map: Record<string, MergedPakItem> = {}
    const enabledMap: Record<string, boolean> = {}
    const selectedMap: Record<string, boolean> = {}

    // 本地 mods 目录中的补丁
    for (const item of res.modsPaks ?? []) {
      const exist = map[item.name] ?? { name: item.name }
      exist.modsPath = item.path
      map[item.name] = exist
    }

    // 游戏目录中的补丁
    for (const item of res.gamePaks ?? []) {
      const exist = map[item.name] ?? { name: item.name }
      exist.gamePath = item.path
      map[item.name] = exist
    }

    const merged = Object.values(map)
    mergedPaks.value = merged

    // 初始状态：是否在游戏目录中启用
    for (const item of merged) {
      const enabled = !!item.gamePath
      enabledMap[item.name] = enabled
      selectedMap[item.name] = enabled
    }

    originalEnabledMap.value = enabledMap
    selected.value = selectedMap
  } else {
    console.error(res?.error)
  }
}

// 点击删除按钮：同时删除本地 / 游戏目录下的补丁（如果存在）
const handleDeleteClick = async (name: string) => {
  const item = mergedPaks.value.find((p) => p.name === name)
  if (!item) return

  try {
    await confirm({
      title: '删除补丁',
      message: `确定要删除补丁 "${name}" 吗？此操作会同时删除本地和游戏目录下的文件（若存在），且不可撤销。`,
      confirmText: '删除',
      cancelText: '取消'
    })

    // 删除本地 mods 目录中的补丁
    if (item.modsPath) {
      const res = await window.api.deletePak?.(item.modsPath)
      if (!res?.success) {
        console.error('[PakModal] 删除本地补丁失败:', res?.error)
      }
    }

    // 删除游戏目录中的补丁
    if (item.gamePath) {
      const res = await window.api.deletePak?.(item.gamePath)
      if (!res?.success) {
        console.error('[PakModal] 删除游戏目录补丁失败:', res?.error)
      }
    }

    // 从列表和状态中移除该补丁
    mergedPaks.value = mergedPaks.value.filter((p) => p.name !== name)
    delete originalEnabledMap.value[name]
    delete selected.value[name]
  } catch {
    // 用户取消操作，无需处理
  }
}

// 确认按钮：根据当前勾选状态统一执行复制/移动操作
const handleConfirm = async () => {
  if (!props.gamePath) {
    emit('close')
    return
  }

  // 对比「原始启用状态」和「当前选中状态」，决定需要执行的操作
  for (const item of mergedPaks.value) {
    const name = item.name
    const wasEnabled = originalEnabledMap.value[name] ?? false
    const nowEnabled = selected.value[name] ?? false

    // 状态未变化，无需处理
    if (wasEnabled === nowEnabled) continue

    // 原来未启用，现在启用：需要从 mods 复制到游戏目录
    if (!wasEnabled && nowEnabled) {
      if (!item.modsPath) {
        console.error('[PakModal] 无法启用补丁（缺少本地 mods 路径）:', name)
        continue
      }
      const res = await window.api.copyPakToGame?.(item.modsPath, props.gamePath)
      if (!res?.success) {
        console.error('[PakModal] 复制补丁到游戏目录失败:', res?.error)
      }
    }

    // 原来已启用，现在禁用：需要从游戏目录移动回 mods
    if (wasEnabled && !nowEnabled) {
      if (!item.gamePath) {
        console.error('[PakModal] 无法移除补丁（缺少游戏目录路径）:', name)
        continue
      }
      const res = await window.api.movePakToMods?.(item.gamePath)
      if (!res?.success) {
        console.error('[PakModal] 移动补丁到 mods 目录失败:', res?.error)
      }
    }
  }

  // 操作完成后关闭弹窗，并重新拉取一次列表以刷新状态
  await getPaks()
  emit('close')
}

// ESC 键关闭弹框
useEventListener('keydown', (event) => {
  if (event.key === 'Escape' && props.visible) {
    handleClose()
  }
})

// 拖拽处理
const handleDragEnter = (event: DragEvent) => {
  if (!props.gamePath) return
  event.preventDefault()
  dragCounter.value++
  if (dragCounter.value === 1) {
    isDragging.value = true
  }
}

const handleDragOver = (event: DragEvent) => {
  if (!props.gamePath) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  dragCounter.value--
  if (dragCounter.value === 0) {
    isDragging.value = false
  }
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
  dragCounter.value = 0

  if (!props.gamePath) {
    showError('请先设置游戏路径')
    return
  }

  const files = event.dataTransfer?.files
  if (!files || files.length === 0) {
    return
  }

  // 处理所有拖拽的文件
  const pakFiles: File[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.name.toLowerCase().endsWith('.pak')) {
      pakFiles.push(file)
    }
  }

  if (pakFiles.length === 0) {
    showError('请拖拽 .pak 格式的补丁文件')
    return
  }

  // 复制每个 pak 文件到游戏目录
  let successCount = 0
  let failCount = 0

  for (const file of pakFiles) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      // 将 ArrayBuffer 转换为 Uint8Array，主进程会将其转换为 Buffer
      const uint8Array = new Uint8Array(arrayBuffer)

      // 通过 IPC 传递文件数据到主进程保存
      const res = await window.api.savePakToGame?.(file.name, uint8Array, props.gamePath)
      if (res?.success) {
        successCount++
      } else {
        failCount++
        console.error('[PakModal] 保存补丁失败:', res?.error)
        showError(`保存文件 "${file.name}" 失败: ${res?.error || '未知错误'}`)
      }
    } catch (error) {
      failCount++
      console.error('[PakModal] 处理文件失败:', error, file)
      showError(`处理文件 "${file.name}" 时发生错误`)
    }
  }

  // 显示结果
  if (successCount > 0) {
    showSuccess(`成功添加 ${successCount} 个补丁`)
    // 刷新列表
    await getPaks()
  }
  if (failCount > 0) {
    showError(`添加失败 ${failCount} 个补丁`)
  }
}

// 弹窗打开时自动获取一次 pak 列表
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      void getPaks()
    } else {
      // 关闭时重置拖拽状态
      isDragging.value = false
      dragCounter.value = 0
    }
  }
)
</script>

<style scoped>
.pak-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text-primary);
}

.pak-section {
  position: relative;
}

.pak-section.is-dragging {
  border: 2px dashed var(--color-primary);
  border-radius: 12px;
  background: var(--color-bg-card-hover);
}

.pak-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

.pak-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pak-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.pak-delete {
  padding: 6px 16px;
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.pak-delete:hover {
  border-color: var(--color-danger, #ff4d4f);
  color: var(--color-danger, #ff4d4f);
  background: var(--color-bg-card-hover);
}

.pak-empty {
  font-size: 12px;
  color: var(--color-text-muted);
}

.pak-repo-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding: 8px 16px;
  background: var(--color-bg-card);
  border: 1.5px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s ease;
  cursor: pointer;
}

.pak-repo-link:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-bg-card-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-button-hover);
}

.pak-drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  border-radius: 12px;
  z-index: 10;
}

.pak-drag-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: var(--color-bg-secondary);
  border: 2px dashed var(--color-primary);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
}

.pak-drag-icon {
  font-size: 48px;
  line-height: 1;
}

.pak-drag-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
}
</style>
