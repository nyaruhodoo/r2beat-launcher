<template>
  <div class="app-container">
    <CustomTitleBar>
      <template #nav>
        <UserInfoCom
          :user-info="userInfo"
          @login-click="showLoginModal = true"
          @switch-account="showLoginModal = true"
          @show-logout-confirm="showLogoutConfirm = true"
        />

        <a
          href="https://tieba.baidu.com/f?kw=%E9%9F%B3%E9%80%9F%E8%A7%89%E9%86%92&fr=index"
          target="_blank"
        >
          <button class="nav-btn">
            <img :src="aixinImg" />
            <span class="nav-text">CPDD</span>
          </button>
        </a>

        <!-- 抽奖中心和充值中心下拉框 -->
        <Dropdown :items="giftRechargeItems">
          <template #trigger="{ isOpen }">
            <button class="nav-btn">
              <img :src="mangheImg" />
              <span class="nav-text">充值</span>
              <div class="dropdown-icon" :class="{ rotated: isOpen }">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </button>
          </template>
        </Dropdown>

        <ThemeToggle :theme="theme" :toggle-theme="setTheme" />

        <!-- 补丁和设置下拉框 -->
        <Dropdown :items="patchSettingsItems">
          <template #trigger="{ isOpen }">
            <button class="nav-btn">
              <img :src="budingImg" />
              <span class="nav-text">设置</span>
              <div class="dropdown-icon" :class="{ rotated: isOpen }">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </button>
          </template>
        </Dropdown>
      </template>
    </CustomTitleBar>

    <main class="main-content">
      <div class="content-wrapper">
        <!-- 左侧区域 -->
        <div class="left-section">
          <GamePreview :game-settings="gameSettings" />

          <VersionCheck :game-settings="gameSettings" />
        </div>

        <!-- 右侧区域 -->
        <div class="right-section">
          <Announcement />

          <LaunchButton
            :user-info="userInfo"
            :game-settings="gameSettings"
            @login-required="showLoginModal = true"
          />
        </div>
      </div>
    </main>

    <!-- 设置模态框 -->
    <SettingsModal
      :visible="showSettings"
      :game-settings="gameSettings"
      @close="showSettings = false"
      @save="setGameSettings"
    />

    <!-- 补丁模态框 -->
    <PakModal
      :visible="showPakModal"
      :game-path="gameSettings?.gamePath"
      @close="showPakModal = false"
    />

    <!-- 相册模态框 -->
    <AlbumModal
      :visible="showAlbumModal"
      :game-path="gameSettings?.gamePath"
      @close="showAlbumModal = false"
    />

    <!-- 登录模态框 -->
    <LoginModal
      :visible="showLoginModal"
      :account-list="savedAccounts"
      :delete-account="deleteAccount"
      @close="showLoginModal = false"
      @login-success="handleLoginSuccess"
    />

    <!-- FIX 拖拽 -->
    <WindowResizer></WindowResizer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'
import { useLocalStorageState } from 'vue-hooks-plus'
import CustomTitleBar from './components/CustomTitleBar.vue'
import Announcement from './components/Announcement.vue'
import VersionCheck from './components/VersionCheck.vue'
import LaunchButton from './components/LaunchButton.vue'
import SettingsModal from './components/SettingsModal.vue'
import LoginModal from './components/LoginModal.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import UserInfoCom from './components/UserInfo.vue'
import GamePreview from './components/GamePreview.vue'
import PakModal from './components/PakModal.vue'
import AlbumModal from './components/AlbumModal.vue'
import Dropdown from './components/Dropdown.vue'
import type { DropdownItem } from './components/Dropdown.vue'
import { GameSettings, UserInfo } from '../../types'
import mangheImg from '@renderer/assets/imgs/manghe.png'
import zuanshiImg from '@renderer/assets/imgs/zuanshi.png'
import shezhiImg from '@renderer/assets/imgs/shezhi.png'
import aixinImg from '@renderer/assets/imgs/aixin.png'
import budingImg from '@renderer/assets/imgs/buding.png'
import shanchuImg from '@renderer/assets/imgs/shanchu.png'
import xiangceImg from '@renderer/assets/imgs/xiangce.png'
import xiufuImg from '@renderer/assets/imgs/xiufu.png'
import wangzhanImg from '@renderer/assets/imgs/wangzhan.png'
import WindowResizer from './components/WindowResizer.vue'
import { useToast } from './composables/useToast'
import { checkUpdateIntervalTime } from '@config'
import { confirm } from './composables/useConfirm'
import { ipcEmitter } from '@renderer/ipc'

const { info, success, error } = useToast()

// ========== 状态管理 ==========
const showSettings = ref(false)
const showLoginModal = ref(false)
const showLogoutConfirm = ref(false)
const showPakModal = ref(false)
const showAlbumModal = ref(false)

// ========== 下拉框菜单项 ==========
// 抽奖中心和充值中心下拉菜单
const giftRechargeItems = computed<DropdownItem[]>(() => [
  {
    label: '抽奖中心',
    icon: mangheImg,
    href: 'https://r2beat.xiyouxi.com/gift/draw',
    target: '_blank'
  },
  {
    label: '充值中心',
    icon: zuanshiImg,
    onClick: () => {
      ipcEmitter.send('open-recharge-center', userInfo.value?.username)
    }
  },
  {
    label: '游戏官网',
    icon: wangzhanImg,
    href: 'https://r2beat.xiyouxi.com/',
    target: '_blank'
  }
])

// 补丁和设置下拉菜单
const patchSettingsItems = computed<DropdownItem[]>(() => [
  {
    label: '设置',
    icon: shezhiImg,
    onClick: () => (showSettings.value = true)
  },
  {
    label: 'MOD',
    icon: budingImg,
    onClick: () => (showPakModal.value = true)
  },
  {
    label: '相册',
    icon: xiangceImg,
    onClick: () => (showAlbumModal.value = true)
  },
  {
    label: '修复',
    icon: xiufuImg,
    onClick: async () => {
      const gamePath = gameSettings.value?.gamePath
      if (!gamePath) {
        info('请先在设置中配置游戏目录')
        return
      }

      const res = await ipcEmitter.invoke('open-game-recovery', gamePath)

      if (!res?.success) {
        error(res?.error ?? '无法运行 GameRecovery')
      }
    }
  },
  {
    label: '重置GG',
    icon: shanchuImg,
    onClick: async () => {
      await confirm({
        message:
          '该功能会移除游戏目录下的 GameGuard ，如果你经常遇到游戏弹出相关警告，或许可以通过该功能修复'
      })

      const gamePath = gameSettings.value?.gamePath
      if (!gamePath) {
        info('请先在设置中配置游戏目录')
        return
      }

      const res = await ipcEmitter.invoke('reset-gg', gamePath)

      if (!res?.success) {
        error(res?.error || '重置GG失败')
        return
      }

      success('重置GG完成')
    }
  }
])

/**
 * 一些基础配置
 */
const [gameSettings, setGameSettings] = useLocalStorageState<GameSettings>('r2beat_game_settings', {
  defaultValue: {
    gamePath: '',
    localImageLibrary: '',
    autoUpdate: false,
    minimizeToTrayOnLaunch: true,
    processPriority: 'normal',
    lowerNPPriority: false,
    avoidSecondLogin: true,
    isShieldWordDisabled: false
  }
})

// 已登录过账号
const [savedAccounts, setSavedAccounts] = useLocalStorageState<UserInfo[]>(
  'r2beat_saved_accounts',
  {
    defaultValue: []
  }
)

/* 当前登录账号 - 应用内状态，不永久存储 */
const userInfo = ref<UserInfo | undefined>(savedAccounts.value?.[0])
const setUseInfo = (info?: UserInfo) => {
  userInfo.value = info
}

// 账号管理方法
const saveAccount = (userInfo: UserInfo): void => {
  const filteredAccounts =
    savedAccounts.value?.filter((account) => account.username !== userInfo.username) ?? []
  setSavedAccounts([userInfo, ...filteredAccounts])
}
const deleteAccount = (userName: string): void => {
  const newAccounts = savedAccounts.value?.filter((account) => account.username !== userName)
  setSavedAccounts(newAccounts)
}

const [theme, setTheme] = useLocalStorageState<string>('r2beat-launcher-theme', {
  defaultValue: (() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })()
})
const applyTheme = (newTheme?: string) => {
  if (!newTheme) return
  const root = document.documentElement
  root.setAttribute('data-theme', newTheme)
  root.className = ''
  root.classList.add(`${newTheme.trim()}-theme`)
}

// 上次检查更新的时间（用于缓存，30分钟内不重复检查）
const [lastUpdateCheckTime, setLastUpdateCheckTime] = useLocalStorageState<number>(
  'r2beat_last_update_check_time',
  {
    defaultValue: 0
  }
)

// 监听主题变化
watch(
  theme,
  (newTheme) => {
    applyTheme(newTheme)
  },
  { immediate: true }
)

/**
 * 登录成功，只存储到本地即可
 */
const handleLoginSuccess = async (userInfo: UserInfo) => {
  setUseInfo(userInfo)

  // 如果勾选了记住密码，保存账号信息
  if (userInfo.rememberPassword) {
    saveAccount(userInfo)
  } else {
    deleteAccount(userInfo.username ?? '')
  }

  showLoginModal.value = false
}

const searchGamePath = async () => {
  const res = await ipcEmitter.invoke('get-r2beat-path')
  if (res?.path && res.success && !gameSettings.value?.gamePath) {
    setGameSettings({
      ...gameSettings.value!,
      gamePath: res.path
    })
  }
}

/**
 * 检查应用更新（带缓存，30分钟内不重复检查）
 */
const checkAppUpdate = async () => {
  const now = Date.now()
  const timeSinceLastCheck = now - (lastUpdateCheckTime.value || 0)

  if (timeSinceLastCheck >= checkUpdateIntervalTime) {
    // 距离上次检查已超过30分钟，执行检查
    try {
      const result = await ipcEmitter.invoke('check-app-update')
      // 更新最后检查时间
      setLastUpdateCheckTime(now)

      if (result) {
        info(`发现新版本 ${result.latestVersion}，可以前往网盘或github下载最新版`, 5000)
        // downloadUrl 已保存在 result.downloadUrl 中，可供后续使用
      }
    } catch (error) {
      console.error('[App] 检查更新失败:', error)
      // 即使失败也更新检查时间，避免频繁失败重试
      setLastUpdateCheckTime(now)
    }
  } else {
    // 距离上次检查不足30分钟，跳过本次检查
    const remainingMinutes = Math.ceil((checkUpdateIntervalTime - timeSinceLastCheck) / (60 * 1000))
    console.log(
      `[App] 距离上次检查更新不足30分钟，跳过本次检查（还需等待约 ${remainingMinutes} 分钟）`
    )
  }
}

onMounted(() => {
  // 延迟创建窗口，否则会闪一下很烦
  nextTick(() => {
    ipcEmitter.send('window-show')
  })

  searchGamePath()
  checkAppUpdate()
})
</script>

<style scoped>
.app-container {
  height: 100%;
  position: relative;
}

.main-content {
  height: 100%;
  padding: 50px 30px 40px;
  position: relative;
  z-index: 1;

  .content-wrapper {
    display: grid;
    height: 100%;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 30px;

    .left-section {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .right-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
      align-items: center;
      min-height: 0;
    }
  }
}
</style>
