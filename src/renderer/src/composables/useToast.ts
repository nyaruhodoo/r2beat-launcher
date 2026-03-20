import { ref, createApp, h } from 'vue'
import Toast from '@renderer/components/Toast.vue'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
  duration?: number
}

const toasts = ref<Toast[]>([])
let toastIdCounter = 0
let toastApp: ReturnType<typeof createApp> | null = null
let toastContainer: HTMLDivElement | null = null

/**
 * 初始化 Toast 容器（仅在第一次调用时执行）
 */
const initToastContainer = () => {
  if (toastApp && toastContainer) {
    return // 已经初始化过了
  }

  // 创建容器元素
  toastContainer = document.createElement('div')
  document.body.appendChild(toastContainer)

  // 创建 Vue 应用实例
  toastApp = createApp({
    setup() {
      return () => h(Toast)
    }
  })

  // 挂载应用
  toastApp.mount(toastContainer)
}

export const useToast = () => {
  // 确保 Toast 容器已初始化
  initToastContainer()

  const showToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = ++toastIdCounter
    const toast: Toast = {
      id,
      message,
      type,
      duration
    }

    toasts.value.push(toast)

    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }

    return id
  }

  const removeToast = (id: number) => {
    const index = toasts.value.findIndex((toast) => toast.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  const success = (message: string, duration: number = 3000) => {
    return showToast(message, 'success', duration)
  }

  const error = (message: string, duration: number = 5000) => {
    return showToast(message, 'error', duration)
  }

  const warning = (message: string, duration: number = 3000) => {
    return showToast(message, 'warning', duration)
  }

  const info = (message: string, duration: number = 3000) => {
    return showToast(message, 'info', duration)
  }

  return {
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info
  }
}
