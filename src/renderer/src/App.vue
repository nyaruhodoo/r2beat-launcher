<template>
  <div class="app-container">
    <CustomTitleBar>
      <template #nav>
        <UserInfoCom
          :user-info="userInfo"
          @login-click="handleShowLogin"
          @switch-account="handleSwitchAccount"
          @show-logout-confirm="showLogoutConfirm = true"
        />
        <a href="https://r2beat.xiyouxi.com/gift/draw" target="_blank">
          <button class="nav-btn">
            <img :src="mangheImg" />
            <span class="nav-text">抽奖中心</span>
          </button>
        </a>

        <button class="nav-btn" @click="handleNavClick('recharge')">
          <img :src="zuanshiImg" />
          <span class="nav-text">充值中心</span>
        </button>

        <a
          href="https://tieba.baidu.com/f?kw=%E9%9F%B3%E9%80%9F%E8%A7%89%E9%86%92&fr=index"
          target="_blank"
        >
          <button class="nav-btn">
            <img :src="aixinImg" />
            <span class="nav-text">CPDD</span>
          </button>
        </a>

        <button class="nav-btn" @click="showPakModal = true">
          <img :src="budingImg" />
          <span class="nav-text">补丁</span>
        </button>

        <button class="nav-btn" @click="handleNavClick('settings')">
          <img :src="shezhiImg" />
          <span class="nav-text">设置</span>
        </button>
        <ThemeToggle :theme="theme" :toggle-theme="toggleTheme" />
      </template>
    </CustomTitleBar>

    <main class="main-content">
      <div class="content-wrapper">
        <!-- 左侧区域 -->
        <div class="left-section">
          <GamePreview />

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
      @save="handleSaveSettings"
    />

    <!-- 补丁模态框 -->
    <PakModal
      :visible="showPakModal"
      :game-path="gameSettings?.gamePath"
      @close="showPakModal = false"
    />

    <!-- 登录模态框 -->
    <LoginModal
      :visible="showLoginModal"
      :account-list="savedAccounts"
      :delete-account="deleteAccount"
      @close="handleCloseLoginModal"
      @login-success="handleLoginSuccess"
    />

    <!-- Toast 提示 -->
    <Toast />

    <!-- FIX 拖拽 -->
    <WindowResizer></WindowResizer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { useLocalStorageState } from 'vue-hooks-plus'
import CustomTitleBar from './components/CustomTitleBar.vue'
import Announcement from './components/Announcement.vue'
import VersionCheck from './components/VersionCheck.vue'
import LaunchButton from './components/LaunchButton.vue'
import SettingsModal from './components/SettingsModal.vue'
import LoginModal from './components/LoginModal.vue'
import Toast from './components/Toast.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import UserInfoCom from './components/UserInfo.vue'
import GamePreview from './components/GamePreview.vue'
import PakModal from './components/PakModal.vue'
import { GameSettings, Theme, UserInfo } from '../../types'
import mangheImg from '@renderer/assets/imgs/manghe.png'
import zuanshiImg from '@renderer/assets/imgs/zuanshi.png'
import shezhiImg from '@renderer/assets/imgs/shezhi.png'
import aixinImg from '@renderer/assets/imgs/aixin.png'
import budingImg from '@renderer/assets/imgs/buding.png'
import WindowResizer from './components/WindowResizer.vue'

// ========== 状态管理 ==========
const showSettings = ref(false)
const showLoginModal = ref(false)
const showLogoutConfirm = ref(false)
const showPakModal = ref(false)

/* 当前登录账号 */
const [userInfo, setUseInfo] = useLocalStorageState<UserInfo>('r2beat_user')

/**
 * 一些基础配置
 */
const [gameSettings, setGameSettings] = useLocalStorageState<GameSettings>('r2beat_game_settings', {
  defaultValue: {
    gamePath: '',
    autoUpdate: false,
    minimizeToTrayOnLaunch: true,
    processPriority: 'normal',
    lowerNPPriority: false,
    avoidSecondLogin: true
  }
})

// 已登录过账号
const [savedAccounts, setSavedAccounts] = useLocalStorageState<UserInfo[]>(
  'r2beat_saved_accounts',
  {
    defaultValue: []
  }
)
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

const applyTheme = (newTheme: Theme) => {
  const root = document.documentElement
  root.setAttribute('data-theme', newTheme)
  root.classList.remove('light-theme', 'dark-theme')
  root.classList.add(`${newTheme}-theme`)
}

const [theme, setTheme] = useLocalStorageState<Theme>('r2beat-launcher-theme', {
  defaultValue: (() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })()
})

// 监听主题变化
watch(
  theme,
  (newTheme) => {
    if (newTheme) {
      applyTheme(newTheme)
    }
  },
  { immediate: true }
)

// 监听系统主题变化(不写入缓存)
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
mediaQuery.addEventListener('change', (e) => {
  applyTheme(e.matches ? 'dark' : 'light')
})

// 主题切换方法
const toggleTheme = () => {
  const newTheme = theme.value === 'dark' ? 'light' : 'dark'
  setTheme(newTheme)
}

// 显示登录模态框
const handleShowLogin = () => {
  showLoginModal.value = true
}

// 关闭登录模态框
const handleCloseLoginModal = () => {
  showLoginModal.value = false
}

// 唤醒切换账号弹窗
const handleSwitchAccount = () => {
  showLoginModal.value = true
}

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

const handleNavClick = (type: 'website' | 'recharge' | 'settings') => {
  if (type === 'settings') {
    showSettings.value = true
  } else if (type === 'recharge') {
    window.api.openRechargeCenter?.(userInfo.value?.username)
  }
}

const handleSaveSettings = (settings: GameSettings) => {
  setGameSettings(settings)
  console.log('保存设置:', settings)
}

const searchGamePath = async () => {
  const res = await window.api.getR2beatPath?.()
  if (res?.path && res.success && !gameSettings.value?.gamePath) {
    setGameSettings({
      ...gameSettings.value!,
      gamePath: res.path
    })
  }
}

onMounted(() => {
  // 延迟创建窗口，否则会闪一下很烦
  nextTick(() => {
    setTimeout(() => {
      window.api.windowShow?.()
    }, 200)
  })

  searchGamePath()
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
