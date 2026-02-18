<template>
  <Modal
    :visible="visible"
    title="游戏设置"
    :title-icon-img="shezhiImg"
    confirm-text="保存设置"
    cancel-text="取消"
    @close="handleClose"
    @confirm="handleSave"
    @cancel="handleClose"
  >
    <div class="settings-section">
      <h3 class="section-title">本地图库</h3>
      <div class="setting-item">
        <div class="path-input-group">
          <input
            v-model="settings.localImageLibrary"
            type="text"
            class="path-input"
            placeholder="请选择本地图库目录（可选）"
          />
          <button class="browse-btn" @click="handleBrowseLibrary">浏览</button>
        </div>
        <p class="setting-hint">设置后，将优先使用本地图库中的图片进行随机展示</p>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="section-title">游戏路径</h3>
      <div class="setting-item">
        <div class="path-input-group">
          <input
            v-model="settings.gamePath"
            type="text"
            class="path-input"
            placeholder="请选择游戏安装目录"
            readonly
          />
          <button class="browse-btn" @click="handleBrowse">浏览</button>
        </div>
      </div>
    </div>

    <div v-if="configIniJson" class="settings-section">
      <h3 class="section-title">游戏设置</h3>

      <div class="setting-item">
        <label class="setting-label">分辨率</label>
        <div class="resolution-group">
          <CustomSelect v-model="resolution" :options="resolutionOptions" />
          <Checkbox v-model="fullscreen">全屏</Checkbox>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">声音</label>

        <div class="checkbox-group">
          <Checkbox v-model="audioEffects">特效音乐</Checkbox>
          <Checkbox v-model="backgroundMusic">背景音乐</Checkbox>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">图像质量</label>

        <div class="checkbox-group">
          <Checkbox v-model="graphicsQuality">描边</Checkbox>
          <Checkbox v-model="jitterShake">禁止画面抖动</Checkbox>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h3 class="section-title">启动选项</h3>
      <div class="setting-item">
        <label class="setting-label">进程优先级</label>
        <div class="resolution-group">
          <CustomSelect v-model="settings.processPriority" :options="processPriorityOptions" />

          <Checkbox
            :model-value="settings.lowerNPPriority ?? false"
            @update:model-value="(val) => (settings.lowerNPPriority = val)"
            >降低NP优先级</Checkbox
          >
        </div>

        <p class="setting-hint">经常顿卡的玩家，该配置可能有一些作用</p>
        <p class="setting-hint">降低NP优先级会影响启动速度，但可以降低对CPU的占用率</p>
      </div>
      <div class="checkbox-group">
        <Checkbox v-model="settings.autoUpdate">自动更新游戏</Checkbox>
        <Checkbox v-model="settings.minimizeToTrayOnLaunch">启动游戏后最小化到托盘</Checkbox>
        <Checkbox v-model="settings.avoidSecondLogin">跳过密码登录</Checkbox>
        <Checkbox v-model="settings.isShieldWordDisabled">关闭屏蔽字</Checkbox>
      </div>
    </div>

    <!-- 作者模块 -->
    <div class="author-section">
      <a
        href="https://github.com/nyaruhodoo/r2beat-launcher"
        target="_blank"
        class="author-link"
        rel="noopener noreferrer"
      >
        <div class="author-avatar">
          <img
            src="https://gss0.baidu.com/7Ls0a8Sm2Q5IlBGlnYG/sys/portraith/item/tb.1.9b09c627.4LoOzN6MrpCOkeuc4sLdLw?t=1767761204"
            alt="Author"
            class="avatar-img"
          />
        </div>
      </a>
    </div>
    <div class="author-section">
      <a
        href="https://pan.baidu.com/s/1QLBIswxrGXZncMOExZDVow?pwd=yj4s"
        target="_blank"
        class="author-link"
        rel="noopener noreferrer"
      >
        版本更新/使用说明
      </a>
    </div>

    <div class="author-section qrcode">
      <p>滑到底干嘛，难道你想给我打钱？</p>
      <img :src="qrcode" alt="二维码" />
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Modal from './Modal.vue'
import CustomSelect from './CustomSelect.vue'
import Checkbox from './Checkbox.vue'
import type { AppConfig, GameSettings } from '@types'
import qrcode from '@renderer/assets/imgs/qrcode.jpg'
import shezhiImg from '@renderer/assets/imgs/shezhi.png'
import { useToast } from '@renderer/composables/useToast'
import { ipcEmitter } from '@renderer/ipc'

const props = defineProps<{
  visible: boolean
  gameSettings?: GameSettings
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', settings: GameSettings): void
}>()

const { error: showError } = useToast()

// 创建一个本地的响应式对象用于 v-model 绑定
const settings = ref<GameSettings>({
  gamePath: '',
  localImageLibrary: '',
  autoUpdate: true,
  minimizeToTrayOnLaunch: true,
  processPriority: 'normal',
  lowerNPPriority: false,
  avoidSecondLogin: true,
  isShieldWordDisabled: false
})

// 保存 config.ini 转换后的 JSON 数据
const configIniJson = ref<AppConfig>()

// 从 configIniJson 读取并双向绑定的计算属性
const resolution = computed({
  get: () => {
    if (!configIniJson.value?.VIDEO) return [1920, 1080] as const
    const width = configIniJson.value.VIDEO.WIDTH || 1920
    const height = configIniJson.value.VIDEO.HEIGHT || 1080
    return [width, height] as const
  },
  set: (value: [number, number]) => {
    if (!configIniJson.value) return
    if (!configIniJson.value.VIDEO)
      configIniJson.value.VIDEO = {
        WIDTH: 1920,
        HEIGHT: 1080,
        FULLSCREEN: 0,
        OUTLINE: 0,
        OUTLINING: 0
      }
    if (!configIniJson.value.FONT)
      configIniJson.value.FONT = { FILEPATH: '', WIDTH: 1920, HEIGHT: 1080 }

    configIniJson.value.VIDEO.WIDTH = value[0]
    configIniJson.value.VIDEO.HEIGHT = value[1]
    configIniJson.value.FONT.WIDTH = value[0]
    configIniJson.value.FONT.HEIGHT = value[1]
  }
})

const fullscreen = computed({
  get: () => {
    if (!configIniJson.value?.VIDEO) return false
    return configIniJson.value.VIDEO.FULLSCREEN === 1
  },
  set: (value: boolean) => {
    if (!configIniJson.value) return
    if (!configIniJson.value.VIDEO)
      configIniJson.value.VIDEO = {
        WIDTH: 1920,
        HEIGHT: 1080,
        FULLSCREEN: 0,
        OUTLINE: 0,
        OUTLINING: 0
      }
    configIniJson.value.VIDEO.FULLSCREEN = value ? 1 : 0
  }
})

const graphicsQuality = computed({
  get: () => {
    if (!configIniJson.value?.VIDEO) return true
    return configIniJson.value.VIDEO.OUTLINING === 1
  },
  set: (value: boolean) => {
    if (!configIniJson.value) return
    if (!configIniJson.value.VIDEO)
      configIniJson.value.VIDEO = {
        WIDTH: 1920,
        HEIGHT: 1080,
        FULLSCREEN: 0,
        OUTLINE: 2,
        OUTLINING: 1
      }
    configIniJson.value.VIDEO.OUTLINING = value ? 1 : 0
  }
})

const jitterShake = computed({
  get: () => {
    if (!configIniJson.value?.JITTER) return false
    return configIniJson.value.JITTER.ONOFF === 1
  },
  set: (value: boolean) => {
    if (!configIniJson.value) return
    if (!configIniJson.value.JITTER) {
      configIniJson.value.JITTER = { ONOFF: 0 }
    }
    configIniJson.value.JITTER.ONOFF = value ? 1 : 0
  }
})

const audioEffects = computed({
  get: () => {
    if (!configIniJson.value?.SOUND) return true
    return configIniJson.value.SOUND.EFFECT === 1
  },
  set: (value: boolean) => {
    if (!configIniJson.value) return
    if (!configIniJson.value.SOUND)
      configIniJson.value.SOUND = { BG: 1, EFFECT: 1, BGVOL: 100, EFFECTVOL: 100 }
    configIniJson.value.SOUND.EFFECT = value ? 1 : 0
  }
})

const backgroundMusic = computed({
  get: () => {
    if (!configIniJson.value?.SOUND) return true
    return configIniJson.value.SOUND.BG === 1
  },
  set: (value: boolean) => {
    if (!configIniJson.value) return
    if (!configIniJson.value.SOUND)
      configIniJson.value.SOUND = { BG: 1, EFFECT: 1, BGVOL: 100, EFFECTVOL: 100 }
    configIniJson.value.SOUND.BG = value ? 1 : 0
  }
})

const resolutionOptions = [
  { value: [1920, 1080], label: '1920 × 1080' },
  { value: [1024, 768], label: '1024 × 768' },
  { value: [800, 600], label: '800 × 600' }
]

const processPriorityOptions = [
  { value: 'realtime', label: '实时' },
  { value: 'high', label: '高' },
  { value: 'abovenormal', label: '高于正常' },
  { value: 'normal', label: '正常' },
  { value: 'belownormal', label: '低于正常' },
  { value: 'low', label: '低' }
]

const handleClose = () => {
  emit('close')
}

const handleSave = async () => {
  // 保存游戏设置
  emit('save', { ...settings.value })

  // 如果存在 configIniJson，将其保存回 config.ini 文件
  if (configIniJson.value && settings.value.gamePath) {
    try {
      // 使用 JSON 序列化/反序列化来确保对象可以被 IPC 传递
      const serializedConfig = JSON.parse(JSON.stringify(configIniJson.value))
      const result = await ipcEmitter.invoke('write-config-ini', settings.value.gamePath, serializedConfig)
      if (result?.success) {
        console.log('config.ini 保存成功')
      } else {
        throw new Error(result?.error)
      }
    } catch (error) {
      showError(`保存 config.ini 失败: ${error}`)
    }
  }

  handleClose()
}

const handleBrowse = async () => {
  try {
    // 传递当前已保存的路径，让对话框从该位置打开
    const selectedPath = await ipcEmitter.invoke('select-folder', settings.value.gamePath)
    if (selectedPath) {
      settings.value.gamePath = selectedPath
    }
  } catch (error) {
    console.error('选择文件夹失败:', error)
  }
}

const handleBrowseLibrary = async () => {
  try {
    // 传递当前已保存的路径，让对话框从该位置打开
    const selectedPath = await ipcEmitter.invoke('select-folder', settings.value.localImageLibrary)
    if (selectedPath) {
      settings.value.localImageLibrary = selectedPath
    }
  } catch (error) {
    console.error('选择图库文件夹失败:', error)
  }
}

// 读取并转换 config.ini 为 JSON
const loadConfigIni = async () => {
  const gamePath = settings.value.gamePath
  if (!gamePath || gamePath.trim() === '') {
    configIniJson.value = undefined
    return
  }

  try {
    const result = await ipcEmitter.invoke('read-config-ini', gamePath)

    if (result?.success && result.exists && result.data) {
      configIniJson.value = result.data
      console.log('config.ini 已读取并转换为 JSON:', configIniJson.value)
    } else {
      throw new Error(result?.error)
    }
  } catch {
    configIniJson.value = undefined
    showError(`读取 config.ini 异常`)
  }
}

// 当模态框打开时，从 props 加载设置并读取 config.ini
watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible && props.gameSettings) {
      settings.value = { ...props.gameSettings }
      // 弹窗打开时读取并转换 config.ini
      loadConfigIni()
    }
  },
  { immediate: true }
)

// 监听游戏路径变化，自动重新读取 config.ini
watch(
  () => settings.value.gamePath,
  (newPath, oldPath) => {
    if (props.visible && newPath && oldPath) {
      console.log(2)
      loadConfigIni()
    }
  }
)
</script>

<style scoped>
.settings-section {
  margin-bottom: 30px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--color-border);
}

.setting-item {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.setting-label {
  display: block;
  font-size: 14px;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.path-input-group {
  display: flex;
  gap: 10px;
}

.path-input {
  flex: 1;
  padding: 12px 15px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  transition: all var(--transition-normal);
  width: 100%;
  cursor: default; /* 只读输入框显示默认光标 */

  &::placeholder {
    color: var(--color-text-muted);
  }

  &[readonly] {
    cursor: default;
    user-select: text; /* 允许选择文本以便复制 */
  }

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    background: var(--color-bg-card-hover);
    box-shadow: var(--shadow-input-focus);

    :global(.light-theme) & {
      box-shadow: var(--shadow-input-focus-light);
    }
  }
}

.resolution-group {
  display: flex;
  align-items: center;
  gap: 15px;

  .custom-select-wrapper {
    flex: 1;
  }
}

.checkbox-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 768px) {
  .checkbox-group {
    grid-template-columns: 1fr;
  }
}

.setting-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 6px;
  line-height: 1.4;
}

/* 自定义下拉框样式 */
.custom-select-wrapper {
  position: relative;
  width: 100%;
}

.custom-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-normal);
  min-height: 44px;

  &:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-primary);
  }
}

.custom-select-value {
  flex: 1;
  text-align: left;
}

.custom-select-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  transition: transform var(--transition-normal);
  margin-left: 10px;
  flex-shrink: 0;

  &.rotated {
    transform: rotate(180deg);
  }
}

.custom-select-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--color-bg-secondary);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  overflow: hidden;
  max-height: 180px;
  overflow-y: auto;
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal);

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
    transition: background var(--transition-normal);

    &:hover {
      background: var(--color-border-hover);
    }
  }
}

.custom-select-option {
  padding: 8px 15px;
  cursor: pointer;
  transition: all var(--transition-normal);
  color: var(--color-text-primary);
  font-size: 13px;
  position: relative;
  line-height: 1.5;

  &:hover,
  &.active {
    background: var(--color-bg-card-hover);
    color: var(--color-text-primary);
  }

  &.active {
    font-weight: 500;
  }
}

/* 下拉动画 */
.dropdown-enter-active {
  animation: slideDown 0.2s ease;
}

.dropdown-leave-active {
  animation: slideUp 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}

.browse-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-normal);
  white-space: nowrap;
  box-shadow: var(--shadow-button-active);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-button-hover);
  }
}

/* 作者模块 */
.author-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
  border-top: 1px solid var(--color-border);

  &.qrcode {
    flex-direction: column;
    padding-top: 800px;

    img {
      width: 50%;
      margin-top: 20px;
      border-radius: 20px;
    }
  }
}

.author-link {
  display: inline-block;
  text-decoration: none;
  transition: transform var(--transition-normal);
  cursor: pointer;

  &:hover {
    transform: scale(1.1);

    .author-avatar {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-button-hover);
    }
  }

  .author-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid var(--color-border);
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-sm);
    background: var(--color-bg-card);
  }
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
