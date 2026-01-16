<template>
  <Transition name="modal" appear>
    <div v-if="visible" class="settings-modal-overlay" @click.self="handleClose">
      <div class="settings-modal">
        <div class="modal-header">
          <h2 class="modal-title">
            <span class="title-icon">⚙️</span>
            游戏设置
          </h2>
          <button class="close-btn" @click="handleClose">✕</button>
        </div>

        <div class="modal-content">
          <div class="settings-section">
            <h3 class="section-title">游戏路径</h3>
            <div class="setting-item">
              <label class="setting-label">游戏安装目录</label>
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
                <label class="fullscreen-checkbox">
                  <input v-model="fullscreen" type="checkbox" class="checkbox-input" />
                  <span>全屏</span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <label class="setting-label">声音</label>

              <div class="checkbox-group">
                <label class="audio-checkbox">
                  <input v-model="audioEffects" type="checkbox" class="checkbox-input" />
                  <span>特效音乐</span>
                </label>
                <label class="audio-checkbox">
                  <input v-model="backgroundMusic" type="checkbox" class="checkbox-input" />
                  <span>背景音乐</span>
                </label>
              </div>
            </div>

            <div class="setting-item">
              <label class="setting-label">图像质量</label>

              <div class="checkbox-group">
                <label class="audio-checkbox">
                  <input v-model="graphicsQuality" type="checkbox" class="checkbox-input" />
                  <span>描边</span>
                </label>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h3 class="section-title">启动选项</h3>
            <div class="setting-item">
              <label class="setting-label">进程优先级</label>
              <div class="resolution-group">
                <CustomSelect
                  v-model="settings.processPriority"
                  :options="processPriorityOptions"
                />

                <label class="fullscreen-checkbox">
                  <input
                    v-model="settings.lowerNPPriority"
                    type="checkbox"
                    class="checkbox-input"
                  />
                  <span>降低NP优先级</span>
                </label>
              </div>

              <p class="setting-hint">经常顿卡的玩家，该配置可能有一些作用</p>
              <p class="setting-hint">降低NP优先级会影响启动速度，但可以降低对CPU的占用率</p>
            </div>
            <div class="checkbox-group">
              <label class="setting-label checkbox-label">
                <input v-model="settings.autoUpdate" type="checkbox" class="checkbox-input" />
                <span>自动更新</span>
              </label>
              <label class="setting-label checkbox-label">
                <input v-model="settings.closeOnLaunch" type="checkbox" class="checkbox-input" />
                <span>启动游戏后关闭启动器</span>
              </label>
            </div>
            <!-- <div class="setting-item" style="margin-top: 20px">
              <label class="setting-label">命令行参数</label>
              <input
                v-model="settings.launchArgs"
                type="text"
                class="path-input"
                placeholder="例如: -windowed -novid"
              />
              <p class="setting-hint">启动游戏时传递的自定义命令行参数（可选）</p>
            </div> -->
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

          <div class="author-section qrcode">
            <p>滑到底干嘛，难道你想给我打钱？</p>
            <img :src="qrcode" alt="二维码" />
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-cancel" @click="handleClose">取消</button>
          <button class="btn btn-save" @click="handleSave">保存设置</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import CustomSelect from './CustomSelect.vue'
import { AppConfig, GameSettings } from '@types'
import qrcode from '@renderer/imgs/qrcode.jpg'
import { useToast } from '@renderer/composables/useToast'

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
  autoUpdate: true,
  closeOnLaunch: false,
  launchArgs: 'xyxOpen',
  processPriority: 'normal',
  lowerNPPriority: false
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
  set: (value: number) => {
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
      const result = await window.api.writeConfigIni?.(settings.value.gamePath, serializedConfig)
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
    const selectedPath = await window.api.selectFolder?.(settings.value.gamePath)
    if (selectedPath) {
      settings.value.gamePath = selectedPath
    }
  } catch (error) {
    console.error('选择文件夹失败:', error)
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
    const result = await window.api.readConfigIni?.(gamePath)

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

// ESC 键关闭弹框
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.visible) {
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.settings-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--modal-bg-overlay);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  transition:
    background var(--transition-normal),
    --modal-bg-overlay var(--transition-normal);
}

.settings-modal {
  background: var(--modal-bg);
  border-radius: 20px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal),
    transform 0.3s ease,
    opacity 0.3s ease,
    --modal-bg var(--transition-normal);
}

.modal-enter-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .settings-modal {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-leave-active .settings-modal {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.modal-enter-from {
  opacity: 0;
}

.modal-enter-from .settings-modal {
  transform: translateY(30px);
  opacity: 0;
}

.modal-enter-to {
  opacity: 1;
}

.modal-enter-to .settings-modal {
  transform: translateY(0);
  opacity: 1;
}

.modal-leave-from {
  opacity: 1;
}

.modal-leave-from .settings-modal {
  transform: translateY(0);
  opacity: 1;
}

.modal-leave-to {
  opacity: 0;
}

.modal-leave-to .settings-modal {
  transform: translateY(30px);
  opacity: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
  margin: 0;
}

.title-icon {
  font-size: 20px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: var(--color-bg-card-hover);
  color: var(--color-primary);
}

.modal-content {
  padding: 30px;
  overflow-y: auto;
  overflow-x: visible;
  max-height: calc(80vh - 160px);
}

.modal-content {
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--color-bg-card);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 10px;
  }
}

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

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  margin-bottom: 0;
  padding: 10px 15px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
  user-select: none;
  width: 100%;
  min-width: 0;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--gradient-card);
    opacity: 0;
    transition: opacity var(--transition-normal);
    z-index: 0;
  }

  &:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-primary);
    transform: translateY(-1px);
    box-shadow: var(--shadow-card-hover);

    &::before {
      opacity: 1;
    }

    span {
      color: var(--color-primary);
    }
  }

  &:active {
    transform: translateY(0) scale(0.98);
  }

  span {
    position: relative;
    z-index: 1;
    font-size: 14px;
    color: var(--color-text-primary);
    transition: color var(--transition-normal);
  }

  .checkbox-input {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-primary);
    transition: all var(--transition-normal);
    position: relative;
    z-index: 1;

    &:hover {
      transform: scale(1.1);
    }

    &:checked {
      transform: scale(1.05);
    }
  }
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
}

.resolution-group .custom-select-wrapper {
  flex: 1;
}

.fullscreen-checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  padding: 12px 16px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
  min-height: 44px;
}

.fullscreen-checkbox::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--gradient-card);
  opacity: 0;
  transition: opacity var(--transition-normal);
  z-index: 0;
}

.fullscreen-checkbox:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-card-hover);
}

.fullscreen-checkbox:hover::before {
  opacity: 1;
}

.fullscreen-checkbox:active {
  transform: translateY(0) scale(0.98);
}

.fullscreen-checkbox .checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary);
  transition: all var(--transition-normal);
  position: relative;
  z-index: 1;
}

.fullscreen-checkbox .checkbox-input:hover {
  transform: scale(1.1);
}

.fullscreen-checkbox .checkbox-input:checked {
  transform: scale(1.05);
}

.fullscreen-checkbox span {
  font-size: 14px;
  color: var(--color-text-primary);
  transition: color var(--transition-normal);
  position: relative;
  z-index: 1;
}

.fullscreen-checkbox:hover span {
  color: var(--color-primary);
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

.audio-checkbox {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
  padding: 12px 18px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
  width: 100%;
  min-width: 0;
}

.audio-checkbox::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--gradient-card);
  opacity: 0;
  transition: opacity var(--transition-normal);
  z-index: 0;
}

.audio-checkbox:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-active);
}

.audio-checkbox:hover::before {
  opacity: 1;
}

.audio-checkbox:active {
  transform: translateY(0) scale(0.98);
}

.audio-checkbox .checkbox-input {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--color-primary);
  transition: all var(--transition-normal);
  position: relative;
  z-index: 1;
}

.audio-checkbox .checkbox-input:hover {
  transform: scale(1.15);
}

.audio-checkbox .checkbox-input:checked {
  transform: scale(1.1);
}

.audio-checkbox span {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
  transition: color var(--transition-normal);
  position: relative;
  z-index: 1;
}

.audio-checkbox:hover span {
  color: var(--color-primary);
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

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  padding: 12px 24px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.btn {
  padding: 8px 24px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-cancel {
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  border: 1.5px solid var(--color-border);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--gradient-card);
    opacity: 0;
    transition: opacity var(--transition-normal);
    z-index: -1;
  }

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-bg-card-hover);
  }

  &:hover:not(:disabled)::before {
    opacity: 1;
  }
}

.btn-save {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-button-active);

  &:hover:not(:disabled) {
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
    padding-top: 600px;

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
