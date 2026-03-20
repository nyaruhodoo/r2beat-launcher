import { createApp, h, ref, type Ref } from 'vue'
import ConfirmDialog from '@renderer/components/ConfirmDialog.vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

/**
 * 函数式确认对话框
 * @param options 对话框配置选项
 * @returns Promise，resolve 表示确认，reject 表示取消
 */
export function confirm(options: ConfirmOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    // 创建容器元素
    const container = document.createElement('div')
    document.body.appendChild(container)

    let isResolved = false
    let visibleRef: Ref<boolean> | null = null

    const cleanup = () => {
      if (container.parentNode) {
        document.body.removeChild(container)
      }
      app.unmount()
      // 移除 ESC 键监听器（需要匹配添加时的选项）
      document.removeEventListener('keydown', handleEscKey, true)
    }

    const handleConfirm = () => {
      if (isResolved || !visibleRef) return
      isResolved = true
      visibleRef.value = false
      setTimeout(() => {
        cleanup()
        resolve()
      }, 300) // 等待动画完成（与 Modal 的 transition 时间一致）
    }

    const handleCancel = () => {
      if (isResolved || !visibleRef) return
      isResolved = true
      visibleRef.value = false
      setTimeout(() => {
        cleanup()
        reject(new Error('用户取消操作'))
      }, 300) // 等待动画完成（与 Modal 的 transition 时间一致）
    }

    // ESC 键处理
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && visibleRef && visibleRef.value && !isResolved) {
        // 阻止事件继续传播，确保只影响当前的 confirm 对话框
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        handleCancel()
      }
    }

    // 添加 ESC 键监听器，使用捕获阶段以确保优先处理
    document.addEventListener('keydown', handleEscKey, true)

    // 创建 Vue 应用实例
    const app = createApp({
      setup() {
        // 在 setup 内部创建 visible ref，确保 Vue 能正确追踪响应式变化
        visibleRef = ref(true)

        return () => {
          if (!visibleRef) return null
          return h(ConfirmDialog, {
            visible: visibleRef.value,
            title: options.title ?? '提示',
            message: options.message,
            confirmText: options.confirmText ?? '确认',
            cancelText: options.cancelText ?? '取消',
            onConfirm: handleConfirm,
            onCancel: handleCancel
          })
        }
      }
    })

    // 挂载应用
    app.mount(container)
  })
}
