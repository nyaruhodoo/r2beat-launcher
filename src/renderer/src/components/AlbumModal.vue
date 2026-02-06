<template>
  <Modal
    :visible="visible"
    title="相册"
    :title-icon-img="xiangceImg"
    :show-footer="false"
    cancel-text="关闭"
    :show-confirm="false"
    @close="handleClose"
    @cancel="handleClose"
  >
    <div class="album-body">
      <div v-if="loading" class="album-tip">加载中...</div>
      <div v-else-if="loadError" class="album-tip error">{{ loadError }}</div>
      <div v-else-if="!gamePath" class="album-tip">请先在设置中配置游戏目录</div>
      <div v-else-if="files.length === 0" class="album-tip">暂无截图</div>

      <div v-else class="album-grid">
        <button
          v-for="f in files"
          :key="f.path"
          class="album-item"
          type="button"
          @click="handleOpen(f.path)"
        >
          <img class="album-img" :src="toFileUrl(f.path)" :alt="f.name" loading="lazy" />
          <div class="album-delete" type="button" @click.stop="handleDelete(f)">✕</div>
        </button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from './Modal.vue'
import type { ScreenshotFileInfo } from '@types'
import { useToast } from '@renderer/composables/useToast'
import { confirm } from '@renderer/composables/useConfirm'
import xiangceImg from '@renderer/assets/imgs/xiangce.png'

const props = defineProps<{
  visible: boolean
  gamePath?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { error: showError } = useToast()

const loading = ref(false)
const loadError = ref<string | null>(null)
const files = ref<ScreenshotFileInfo[]>([])

const handleClose = () => {
  emit('close')
}

const toFileUrl = (p: string) => {
  // 使用自定义协议 r2shot://?path=ENCODED_PATH 由主进程 protocol.handle 读取本地文件
  return `r2shot://local?path=${encodeURIComponent(p)}`
}

const load = async () => {
  loadError.value = null
  files.value = []

  if (!props.gamePath) {
    return
  }

  loading.value = true
  try {
    const res = await window.api.getScreenshots?.(props.gamePath)
    if (!res) {
      loadError.value = '相册加载失败：IPC 未就绪'
      return
    }
    if (!res.success) {
      loadError.value = res.error || '相册加载失败'
      return
    }
    files.value = res.files ?? []
  } finally {
    loading.value = false
  }
}

const handleOpen = async (filePath: string) => {
  const res = await window.api.openScreenshot?.(filePath)
  if (!res?.success) {
    showError(res?.error || '打开图片失败')
  }
}

const handleDelete = async (file: ScreenshotFileInfo) => {
  try {
    await confirm({
      title: '删除截图',
      message: `确定要删除 ${file.name} 吗？`,
      confirmText: '删除',
      cancelText: '取消'
    })

    const res = await window.api.deleteScreenshot?.(file.path)
    if (!res?.success) {
      showError(res?.error || '删除截图失败')
      return
    }

    files.value = files.value.filter((f) => f.path !== file.path)
  } catch {
    // 用户取消
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) load()
  }
)
</script>

<style scoped>
.album-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.album-tip {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.album-tip.error {
  color: var(--color-danger);
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.album-item {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.album-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-primary);
}

.album-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
  display: block;
  background: var(--color-bg-card-hover);
}

.album-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.15s ease;
}

.album-item:hover .album-delete {
  opacity: 1;
  transform: translateY(0);
}
</style>
