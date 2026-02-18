<template>
  <div class="detail-container">
    <CustomTitleBar type="detail" :title="detail?.title" />

    <div class="detail-content">
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner" />
      </div>
      <div v-else-if="errorText" class="placeholder error">
        <p>{{ errorText }}</p>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div v-else class="detail-body" v-html="formatRichTextImage(contentHtml) || '（暂无正文）'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import CustomTitleBar from './components/CustomTitleBar.vue'
import type { AnnouncementData } from '@types'
import { ipcEmitter, ipcListener } from '@renderer/ipc'

const detail = ref<AnnouncementData | null>(null)
const contentHtml = ref('')
const loading = ref(false)
const errorText = ref('')

const getPath = (section?: number) => {
  if (section === 1) return 'Notice'
  if (section === 6) return 'RuleAndRegulations'
  if (section === 4) return 'Event'
  return ''
}

const fetchDetail = async (payload: AnnouncementData) => {
  const path = getPath(payload.section)
  if (!path) {
    errorText.value = '无法识别公告类型'
    return
  }

  loading.value = true
  errorText.value = ''

  try {
    const res = await ipcEmitter.invoke('get-announcement-detail', { path, idx: payload.idx ?? 0 })
    if (!res?.success) {
      errorText.value = res?.error || '获取公告详情失败'
      return
    }

    contentHtml.value = res.data?.content ?? ''
  } catch (error) {
    console.error('[Renderer] 获取公告详情失败:', error)
    errorText.value = '获取公告详情时发生异常'
  } finally {
    loading.value = false
  }
}

const formatRichTextImage = (html: string) => {
  if (!html) return ''

  // 匹配 <img> 标签及其 style 属性
  return html.replace(/<img [^>]*style="([^"]+)"[^>]*>/gi, (match, styleStr) => {
    // 提取 width 和 height 的数值 (支持 px 或纯数字)
    const widthMatch = styleStr.match(/width:\s*(\d+)px/i)
    const heightMatch = styleStr.match(/height:\s*(\d+)px/i)

    if (widthMatch && heightMatch) {
      const w = widthMatch[1]
      const h = heightMatch[1]

      if (!styleStr.includes('aspect-ratio')) {
        const aspectRatioStyle = `aspect-ratio: ${w} / ${h};`
        return match.replace(`style="${styleStr}"`, `style="${aspectRatioStyle} ${styleStr}"`)
      }
    }

    return match
  })
}

onMounted(() => {
  // 主进程在窗口加载完成后会通过 IPC 发送 announcement-detail-data
  const off = ipcListener.on('announcement-detail-data', (_event, payload: AnnouncementData) => {
    detail.value = payload
    fetchDetail(payload)
  })

  onUnmounted(() => off?.())
})
</script>

<style scoped>
.detail-container {
  padding: 70px 30px 40px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-sizing: border-box;
}

.detail-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 16px;
}

.detail-body {
  color: var(--color-text-primary);
  white-space: pre-line;
  word-break: break-word;
  overflow-wrap: anywhere;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  line-height: 1.2;

  &:deep(img) {
    max-width: 75%;
    border-radius: 16px;
    height: auto !important;
  }

  &:deep(ul),
  &:deep(ol) {
    padding-left: 1.5em;
  }

  &:deep(div) {
    text-align: center !important;
  }
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--color-primary);
  animation: spin 0.8s linear infinite;
}

.loading-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.loading-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.placeholder {
  margin-top: 40px;
  text-align: center;
  color: var(--color-text-tertiary);

  &.error {
    color: var(--color-error, #e74c3c);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
