<template>
  <div class="game-preview">
    <div class="game-cover">
      <div class="game-cover-float">
        <img
          v-if="gameImagePath"
          ref="coverImageRef"
          :src="gameImagePath"
          alt="游戏封面"
          class="game-cover-image"
          title="点击切换图片"
          @click="handleImageClick"
        />
      </div>
    </div>
    <div class="game-info">
      <h1 class="game-title">R2Beat</h1>
      <p class="game-subtitle">节奏与{{ text }}的完美融合</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import type { GameSettings } from '@types'
import { ipcEmitter } from '@renderer/ipc'

const props = defineProps<{
  gameSettings?: GameSettings
}>()

// 获取本地图片（作为后备）
const images = import.meta.glob('../assets/imgs/mujica/*.avif', {
  eager: true,
  import: 'default'
})

// 将图片对象转换为路径数组
const localImagePaths = Object.values(images) as string[]

// 本地图库图片路径列表
const libraryImagePaths = ref<string[]>([])

const text = Math.random() < 0.5 ? '恋爱' : '出轨'

// 随机游戏封面图片路径
const gameImagePath = ref<string>('')
// 封面图片元素的引用
const coverImageRef = ref<HTMLImageElement | null>(null)
// 动画进行中标志
const isAnimating = ref<boolean>(false)

// 加载本地图库图片
const loadLibraryImages = async () => {
  const libraryPath = props.gameSettings?.localImageLibrary
  if (!libraryPath || libraryPath.trim() === '') {
    libraryImagePaths.value = []
    return
  }

  try {
    const result = await ipcEmitter.invoke('get-local-image-library', libraryPath)
    if (result?.success && result.files && result.files.length > 0) {
      // 使用 r2shot:// 协议加载本地图片
      libraryImagePaths.value = result.files.map((file) => {
        const encodedPath = encodeURIComponent(file.path)
        return `r2shot://?path=${encodedPath}`
      })
      console.log('本地图库加载成功，共', libraryImagePaths.value.length, '张图片')
    } else {
      libraryImagePaths.value = []
    }
  } catch (error) {
    console.error('加载本地图库失败:', error)
    libraryImagePaths.value = []
  }
}

// 获取所有可用的图片路径（优先使用本地图库）
const getAllImagePaths = (): string[] => {
  // 如果本地图库有图片，优先使用
  if (libraryImagePaths.value.length > 0) {
    return libraryImagePaths.value
  }
  // 否则使用本地图片
  return localImagePaths
}

// 加载随机游戏封面图片
const loadRandomGameImage = () => {
  const imagePaths = getAllImagePaths()

  if (imagePaths.length === 0) {
    console.error('没有可用的游戏封面图片')
    gameImagePath.value = ''
    return
  }

  // 如果只有一张图片，直接使用
  if (imagePaths.length === 1) {
    gameImagePath.value = imagePaths[0]
    return
  }

  // 随机选择一个图片路径，确保与当前图片不同
  const currentPath = gameImagePath.value
  const availableImages = currentPath
    ? imagePaths.filter((path) => path !== currentPath)
    : imagePaths

  const randomIndex = Math.floor(Math.random() * availableImages.length)
  gameImagePath.value = availableImages[randomIndex]
  console.log('随机游戏封面加载成功:', gameImagePath.value)
}

// 处理图片点击事件：执行旋转动画并在90°时切换图片
const handleImageClick = async () => {
  // 如果动画正在进行中，直接返回
  if (isAnimating.value) return

  const el = coverImageRef.value
  if (!el) return

  // 设置动画标志
  isAnimating.value = true

  try {
    // 取消所有正在进行的动画
    el.getAnimations().forEach((animation) => animation.cancel())

    // 立即清除所有transform相关的样式，确保从干净的状态开始
    el.style.transform = ''

    // 等待浏览器处理样式清除
    await new Promise((resolve) => requestAnimationFrame(resolve))

    // 第一阶段：旋转到90°，同时保持scale(1.05)放大效果
    const firstAnimation = el.animate(
      [{ transform: 'rotateY(0deg) scale(1.05)' }, { transform: 'rotateY(90deg) scale(1.05)' }],
      {
        duration: 300,
        easing: 'ease-in-out',
        fill: 'forwards'
      }
    )

    await firstAnimation.finished

    // 在90°时切换图片
    loadRandomGameImage()

    // 第二阶段：从90°回到0°，同时保持scale(1.05)放大效果
    const secondAnimation = el.animate(
      [{ transform: 'rotateY(90deg) scale(1.05)' }, { transform: 'rotateY(0deg) scale(1.05)' }],
      {
        duration: 300,
        easing: 'ease-in-out',
        fill: 'forwards'
      }
    )

    await secondAnimation.finished

    // 动画结束后，取消动画并清除所有transform样式
    secondAnimation.cancel()
    el.style.transform = ''
  } finally {
    // 动画结束，重置标志
    isAnimating.value = false
  }
}

// 监听本地图库路径变化
watch(
  () => props.gameSettings?.localImageLibrary,
  () => {
    loadLibraryImages().then(() => {
      // 图库加载完成后，重新加载随机图片
      loadRandomGameImage()
    })
  },
  { immediate: true }
)

// 组件挂载时加载随机图片
onMounted(() => {
  loadLibraryImages().then(() => {
    loadRandomGameImage()
  })
})
</script>

<style scoped>
.game-preview {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  padding: 30px;
  background: var(--color-bg-card);
  border-radius: 16px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  text-align: center;
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal);

  .game-cover {
    perspective: 1000px;

    .game-cover-float {
      width: 70%;
      aspect-ratio: 1 / 1;
      max-width: 40vh;
      animation: float-cover 4s ease-in-out infinite;
      display: inline-block;

      .game-cover-image {
        width: 100%;
        height: 100%;
        margin: 0 auto;
        object-fit: cover;
        border-radius: 16px;
        border: 2px solid var(--color-border);
        box-shadow: var(--shadow-md);
        transform-style: preserve-3d;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        will-change: transform;
        transform: translateZ(0);
        transition:
          border-color var(--transition-normal),
          box-shadow var(--transition-normal),
          transform var(--transition-normal);
        cursor: pointer;

        &:hover {
          transform: scale(1.05);
          box-shadow: var(--shadow-lg);
          border-color: var(--color-primary);
        }

        @media (max-width: 768px) {
          width: 150px;
          height: 210px;
        }
      }
    }
  }

  .game-info {
    color: var(--color-text-primary);

    .game-title {
      font-size: 36px;
      font-weight: 700;
      margin: 0 0 10px 0;
      background: var(--gradient-primary);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transition: background var(--transition-normal);

      @media (max-width: 768px) {
        font-size: 28px;
      }
    }

    .game-subtitle {
      font-size: 16px;
      color: var(--color-text-secondary);
      margin: 0;
    }
  }
}

@keyframes float-cover {
  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-10px) rotate(2deg);
  }
}
</style>
