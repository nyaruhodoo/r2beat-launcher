<template>
  <div
    v-for="dir in directions"
    :key="dir"
    :class="['resize-handle', dir]"
    @mousedown="startResizing(dir, $event)"
  ></div>
</template>

<script setup lang="ts">
import { minWindowHeight, minWindowWidth } from '@config'
import { onUnmounted } from 'vue'

/**
 * 类型定义
 */
type ResizeDirection = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se' | ''

interface Props {
  minWidth?: number
  minHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  minWidth: minWindowWidth,
  minHeight: minWindowHeight
})

/**
 * 状态管理
 */
const state = {
  direction: '' as ResizeDirection,
  startX: 0, // 拖拽开始时的鼠标屏幕X坐标
  startY: 0, // 拖拽开始时的鼠标屏幕Y坐标
  startWidth: 0, // 拖拽开始时的窗口宽度
  startHeight: 0, // 拖拽开始时的窗口高度
  startLeft: 0, // 拖拽开始时的窗口左边缘屏幕X坐标
  startTop: 0 // 拖拽开始时的窗口顶部屏幕Y坐标
}

const directions: ResizeDirection[] = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se']

/**
 * 核心缩放计算逻辑 - 基于绝对位置而非增量
 */
const handleResizeLogic = (dir: ResizeDirection, mouseX: number, mouseY: number): void => {
  switch (dir) {
    case 'e': {
      // 右侧边缘：窗口右边缘应该等于鼠标X坐标
      const targetWidth = mouseX - state.startLeft
      if (targetWidth >= props.minWidth) {
        window.resizeTo(targetWidth, state.startHeight)
      }
      break
    }
    case 's': {
      // 底部边缘：窗口底部应该等于鼠标Y坐标
      const targetHeight = mouseY - state.startTop
      if (targetHeight >= props.minHeight) {
        window.resizeTo(state.startWidth, targetHeight)
      }
      break
    }
    case 'w': {
      // 左侧边缘：窗口左边缘应该等于鼠标X坐标
      const targetWidth = state.startLeft + state.startWidth - mouseX
      if (targetWidth >= props.minWidth) {
        window.resizeTo(targetWidth, state.startHeight)
        window.moveTo(mouseX, state.startTop)
      }
      break
    }
    case 'n': {
      // 顶部边缘：窗口顶部应该等于鼠标Y坐标
      const targetHeight = state.startTop + state.startHeight - mouseY
      if (targetHeight >= props.minHeight) {
        window.resizeTo(state.startWidth, targetHeight)
        window.moveTo(state.startLeft, mouseY)
      }
      break
    }
    case 'se': {
      // 右下角：窗口右下角应该等于鼠标位置
      const targetWidth = mouseX - state.startLeft
      const targetHeight = mouseY - state.startTop
      const canResizeWidth = targetWidth >= props.minWidth
      const canResizeHeight = targetHeight >= props.minHeight

      if (canResizeWidth && canResizeHeight) {
        // 两个维度都可以调整
        window.resizeTo(targetWidth, targetHeight)
      } else if (canResizeWidth) {
        // 只能调整宽度，高度保持最小
        window.resizeTo(targetWidth, props.minHeight)
      } else if (canResizeHeight) {
        // 只能调整高度，宽度保持最小
        window.resizeTo(props.minWidth, targetHeight)
      }
      // 如果两个维度都达到最小，不执行任何操作
      break
    }
    case 'sw': {
      // 左下角：窗口左下角应该跟随鼠标
      const targetWidth = state.startLeft + state.startWidth - mouseX
      const targetHeight = mouseY - state.startTop
      const canResizeWidth = targetWidth >= props.minWidth
      const canResizeHeight = targetHeight >= props.minHeight

      if (canResizeWidth && canResizeHeight) {
        // 两个维度都可以调整
        window.resizeTo(targetWidth, targetHeight)
        window.moveTo(mouseX, state.startTop)
      } else if (canResizeWidth) {
        // 只能调整宽度，高度保持最小
        window.resizeTo(targetWidth, props.minHeight)
        window.moveTo(mouseX, state.startTop)
      } else if (canResizeHeight) {
        // 只能调整高度，宽度保持最小，窗口左边缘不变
        const currentLeft = state.startLeft + state.startWidth - props.minWidth
        window.resizeTo(props.minWidth, targetHeight)
        window.moveTo(currentLeft, state.startTop)
      }
      // 如果两个维度都达到最小，不执行任何操作
      break
    }
    case 'ne': {
      // 右上角：窗口右上角应该跟随鼠标
      const targetWidth = mouseX - state.startLeft
      const targetHeight = state.startTop + state.startHeight - mouseY
      const canResizeWidth = targetWidth >= props.minWidth
      const canResizeHeight = targetHeight >= props.minHeight

      if (canResizeWidth && canResizeHeight) {
        // 两个维度都可以调整
        window.resizeTo(targetWidth, targetHeight)
        window.moveTo(state.startLeft, mouseY)
      } else if (canResizeWidth) {
        // 只能调整宽度，高度保持最小，窗口顶部不变
        const currentTop = state.startTop + state.startHeight - props.minHeight
        window.resizeTo(targetWidth, props.minHeight)
        window.moveTo(state.startLeft, currentTop)
      } else if (canResizeHeight) {
        // 只能调整高度，宽度保持最小
        window.resizeTo(props.minWidth, targetHeight)
        window.moveTo(state.startLeft, mouseY)
      }
      // 如果两个维度都达到最小，不执行任何操作
      break
    }
    case 'nw': {
      // 左上角：窗口左上角应该等于鼠标位置
      const targetWidth = state.startLeft + state.startWidth - mouseX
      const targetHeight = state.startTop + state.startHeight - mouseY
      const canResizeWidth = targetWidth >= props.minWidth
      const canResizeHeight = targetHeight >= props.minHeight

      if (canResizeWidth && canResizeHeight) {
        // 两个维度都可以调整
        window.resizeTo(targetWidth, targetHeight)
        window.moveTo(mouseX, mouseY)
      } else if (canResizeWidth) {
        // 只能调整宽度，高度保持最小，窗口顶部不变
        const currentTop = state.startTop + state.startHeight - props.minHeight
        window.resizeTo(targetWidth, props.minHeight)
        window.moveTo(mouseX, currentTop)
      } else if (canResizeHeight) {
        // 只能调整高度，宽度保持最小，窗口左边缘不变
        const currentLeft = state.startLeft + state.startWidth - props.minWidth
        window.resizeTo(props.minWidth, targetHeight)
        window.moveTo(currentLeft, mouseY)
      }
      // 如果两个维度都达到最小，不执行任何操作
      break
    }
  }
}

/**
 * 事件处理函数
 */
const onMouseMove = (e: MouseEvent): void => {
  if (!state.direction) return

  // 使用 screenX/screenY 获取屏幕绝对坐标，不受窗口移动影响
  // 直接使用鼠标的绝对位置来计算窗口应该的位置和大小
  handleResizeLogic(state.direction, e.screenX, e.screenY)
}

const onMouseUp = (): void => {
  state.direction = ''
  document.body.style.cursor = 'default'
  document.body.style.userSelect = '' // 恢复文本选择
  document.removeEventListener('mousemove', onMouseMove, { capture: true })
  document.removeEventListener('mouseup', onMouseUp, { capture: true })
}

const startResizing = (direction: ResizeDirection, event: MouseEvent): void => {
  event.preventDefault()
  event.stopPropagation() // 阻止事件冒泡，避免与其他拖拽冲突
  event.stopImmediatePropagation() // 立即停止事件传播，确保优先级最高

  state.direction = direction

  // 记录拖拽开始时的状态
  state.startX = event.screenX
  state.startY = event.screenY
  state.startWidth = window.outerWidth
  state.startHeight = window.outerHeight

  // 计算窗口在屏幕上的起始位置
  // 对于不同方向的拖拽，窗口起始位置的计算方式不同
  if (direction === 'e' || direction === 'se' || direction === 'ne') {
    // 右侧边缘或右上角、右下角：窗口左边缘 = 鼠标X - 窗口宽度
    state.startLeft = event.screenX - state.startWidth
    if (direction === 'se') {
      // 右下角：窗口顶部 = 鼠标Y - 窗口高度
      state.startTop = event.screenY - state.startHeight
    } else if (direction === 'ne') {
      // 右上角：窗口顶部 = 鼠标Y - clientY
      const clientY = event.clientY
      state.startTop = event.screenY - clientY
    } else {
      // 右侧边缘：需要计算窗口顶部
      const clientY = event.clientY // 鼠标相对于窗口的Y坐标
      state.startTop = event.screenY - clientY
    }
  } else if (direction === 's') {
    // 底部边缘：窗口左边缘 = 鼠标X - clientX
    const clientX = event.clientX
    state.startLeft = event.screenX - clientX
    state.startTop = event.screenY - state.startHeight
  } else if (direction === 'w' || direction === 'nw' || direction === 'sw') {
    // 左侧边缘或左上角、左下角：窗口左边缘 = 鼠标X（拖拽开始时）
    state.startLeft = event.screenX
    if (direction === 'sw') {
      // 左下角：还需要窗口顶部
      const clientY = event.clientY
      state.startTop = event.screenY - clientY
    } else if (direction === 'nw') {
      // 左上角：窗口顶部 = 鼠标Y（拖拽开始时）
      state.startTop = event.screenY
    } else {
      // 左侧边缘：需要窗口顶部
      const clientY = event.clientY
      state.startTop = event.screenY - clientY
    }
  } else if (direction === 'n') {
    // 顶部边缘：窗口顶部 = 鼠标Y（拖拽开始时）
    state.startTop = event.screenY
    // 顶部边缘：需要窗口左边缘
    const clientX = event.clientX // 鼠标相对于窗口的X坐标
    state.startLeft = event.screenX - clientX
  }

  // 锁定光标样式，防止拖拽过快时光标变回默认
  const target = event.target as HTMLElement
  const cursorStyle = getComputedStyle(target).cursor
  document.body.style.cursor = cursorStyle
  document.body.style.userSelect = 'none' // 防止拖拽时选中文本

  // 使用 capture 模式确保事件优先处理，并且不使用 passive 以允许 preventDefault
  document.addEventListener('mousemove', onMouseMove, { capture: true, passive: false })
  document.addEventListener('mouseup', onMouseUp, { capture: true })
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove, { capture: true })
  document.removeEventListener('mouseup', onMouseUp, { capture: true })
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
})
</script>

<style scoped>
/* 基础感应区样式 */
.resize-handle {
  position: fixed; /* 使用 fixed 确保不占据 DOM 空间且覆盖在边缘 */
  z-index: 100001; /* 确保在 CustomTitleBar (10000) 之上 */
  background: rgba(0, 0, 0, 0.001); /* 必须有颜色防止点击穿透，但肉眼不可见 */
}

/* --- 四条边 --- */
.n {
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  cursor: n-resize;
  pointer-events: auto;
  -webkit-app-region: no-drag; /* 覆盖 CustomTitleBar 的 drag 区域 */
  z-index: 100001; /* 确保在 CustomTitleBar (10000) 之上 */
}
.s {
  bottom: 0;
  left: 0;
  right: 0;
  height: 5px;
  cursor: s-resize;
  pointer-events: auto;
  z-index: 100001;
}
.w {
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: w-resize;
  pointer-events: auto;
  -webkit-app-region: no-drag; /* 覆盖 CustomTitleBar 的 drag 区域 */
  z-index: 100001;
}
.e {
  right: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: e-resize;
  pointer-events: auto;
  z-index: 100001;
}

/* --- 四个角 (优先级更高) --- */
.nw {
  top: 0;
  left: 0;
  width: 10px;
  height: 10px;
  cursor: nw-resize;
  z-index: 100002; /* 最高优先级 */
  pointer-events: auto;
  -webkit-app-region: no-drag; /* 覆盖 CustomTitleBar 的 drag 区域 */
}
.ne {
  top: 0;
  right: 0;
  width: 10px;
  height: 10px;
  cursor: ne-resize;
  z-index: 100002;
  pointer-events: auto;
  -webkit-app-region: no-drag; /* 覆盖 CustomTitleBar 的 drag 区域 */
}
.sw {
  bottom: 0;
  left: 0;
  width: 10px;
  height: 10px;
  cursor: sw-resize;
  z-index: 100002;
  pointer-events: auto;
}
.se {
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  cursor: se-resize;
  z-index: 100002;
  pointer-events: auto;
}
</style>
