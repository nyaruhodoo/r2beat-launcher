<template>
  <div class="announcement-container">
    <div class="announcement-header">
      <span class="announcement-icon">📢</span>
      <span class="announcement-title">系统公告</span>
    </div>
    <div class="announcement-content">
      <div v-if="loading && announcements.length === 0" class="loading-state">
        <span class="loading-text">
          <span>正在加载公告</span>
          <span class="loading-dots">
            <span class="dot">.</span>
            <span class="dot">.</span>
            <span class="dot">.</span>
          </span>
        </span>
      </div>
      <div v-else-if="!loading && announcements.length === 0" class="empty-state">暂无公告</div>
      <div
        v-for="(item, index) in announcements"
        v-else
        :key="item.idx || index"
        class="announcement-item"
        :title="item.title"
        @click="handleAnnouncementClick(item)"
      >
        <span class="announcement-time">{{ formatDate(item.created_at) }}</span>
        <div class="announcement-title-box">
          <span v-if="isToday(item.created_at)" class="announcement-new">NEW</span>
          <span class="announcement-text">{{ item.title }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { checkAnnouncementsCacheTime, checkAnnouncementsTime } from '@config'
import { AnnouncementData } from '@types'
import { ref } from 'vue'
import { useInterval, useLocalStorageState } from 'vue-hooks-plus'

interface AnnouncementsCache {
  data: AnnouncementData[]
  timestamp: number
}

const [announcementsCache, setAnnouncementsCache] = useLocalStorageState<AnnouncementsCache | null>(
  'r2beat_announcements_cache',
  {
    defaultValue: null
  }
)

const announcements = ref<AnnouncementData[]>([])
// 记录上一次公告列表中第一条公告的 idx，用于判断是否有新公告
const lastFirstAnnouncementIdx = ref<number>()
const loading = ref(true)

// 格式化日期时间（24小时制，显示到秒）
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch {
    return dateString
  }
}

// 判断公告是否是当天的
const isToday = (dateString: string): boolean => {
  try {
    const announcementDate = new Date(dateString)
    const today = new Date()

    // 只比较年月日，不比较时间
    return (
      announcementDate.getFullYear() === today.getFullYear() &&
      announcementDate.getMonth() === today.getMonth() &&
      announcementDate.getDate() === today.getDate()
    )
  } catch {
    return false
  }
}

// 获取公告数据
const fetchAnnouncements = async () => {
  try {
    loading.value = true

    // 检查缓存是否有效
    const cache = announcementsCache.value
    if (cache?.data && Array.isArray(cache.data)) {
      const now = Date.now()
      const cacheAge = now - cache.timestamp

      // 如果缓存未过期（5分钟内），直接使用缓存
      if (cacheAge < checkAnnouncementsCacheTime) {
        console.log(`[Renderer] 使用缓存数据（缓存时间: ${Math.round(cacheAge / 1000)}秒）`)
        announcements.value = cache.data
        loading.value = false
        return
      }
    }

    // 缓存过期或不存在，重新获取数据
    const data = await window.api.getAnnouncements?.()

    if (Array.isArray(data)) {
      // 只根据“第一条公告是否变化”来判断是否有新公告
      const first = data[0]

      if (first && lastFirstAnnouncementIdx.value) {
        if (first.idx !== lastFirstAnnouncementIdx.value) {
          window.api.showNotification?.('有新的系统公告', first.title)
        }
      }

      lastFirstAnnouncementIdx.value = first?.idx
      announcements.value = data

      // 保存到缓存
      const newCache: AnnouncementsCache = {
        data,
        timestamp: Date.now()
      }
      setAnnouncementsCache(newCache)
      console.log('[Renderer] 公告数据已缓存')
    } else if (cache && cache.data && Array.isArray(cache.data)) {
      throw new Error('[Renderer] 获取失败，使用过期缓存数据')
    }
  } catch (error) {
    console.error('[Renderer] 获取公告失败:', error)
    // 如果获取失败，尝试使用过期缓存
    const cache = announcementsCache.value
    if (cache && cache.data && Array.isArray(cache.data)) {
      console.log('[Renderer] 使用过期缓存数据作为后备')
      announcements.value = cache.data
    }
  } finally {
    loading.value = false
  }
}

const handleAnnouncementClick = (item: AnnouncementData) => {
  const plainItem: AnnouncementData = {
    idx: item.idx,
    user_id: item.user_id,
    language: item.language,
    section: item.section,
    title: item.title,
    created_at: item.created_at
  }

  window.api.openAnnouncementDetail?.(plainItem)
}

fetchAnnouncements()

useInterval(() => {
  fetchAnnouncements()
}, checkAnnouncementsTime)
</script>

<style scoped>
.announcement-container {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-card);
  border-radius: 16px;
  padding: 12px 20px 20px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal);

  .announcement-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);

    .announcement-icon {
      font-size: 24px;
      animation: pulse 2s ease-in-out infinite;
    }

    .announcement-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-primary);
    }
  }

  .announcement-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: var(--color-bg-card);
      border-radius: 10px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 10px;

      &:hover {
        background: var(--color-border-hover);
      }
    }

    .announcement-item {
      padding: 6px 10px;
      border-radius: 10px;
      border: 1px solid transparent;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 15px;
      width: 100%;
      cursor: pointer;

      &:hover {
        background: var(--color-bg-card-hover);
        border-color: var(--color-border);
        transform: translateX(5px);
      }

      .announcement-title-box {
        display: flex;
        align-items: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .announcement-time {
        font-size: 12px;
        color: var(--color-text-tertiary);
        white-space: nowrap;
        font-family: 'Courier New', monospace;
      }

      .announcement-text {
        font-size: 14px;
        color: var(--color-text-primary);
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .announcement-new {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 8px;
        font-size: 10px;
        font-weight: 700;
        color: white;
        background: var(--gradient-primary);
        border-radius: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        animation: pulse-new 2s ease-in-out infinite;
        flex-shrink: 0;
        margin-right: 6px;
      }
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes pulse-new {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.loading-indicator {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-left: auto;
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-tertiary);
  font-size: 14px;
  gap: 12px;
}

.loading-state {
  flex-direction: column;
  gap: 16px;
}

.loading-text {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary);
  font-size: 14px;
  animation: fade-pulse 2s ease-in-out infinite;
}

.loading-dots {
  display: inline-flex;
  gap: 2px;

  .dot {
    display: inline-block;
    animation: dot-bounce 1.4s ease-in-out infinite;

    &:nth-child(1) {
      animation-delay: 0s;
    }
    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

@keyframes fade-pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@keyframes dot-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  40% {
    transform: translateY(-8px);
    opacity: 1;
  }
}
</style>
