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
        <button class="nav-btn">
          <a href="https://r2beat.xiyouxi.com/" target="_blank">
            <svg
              t="1768407529180"
              class="icon nav-icon"
              viewBox="0 0 1024 1024"
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              p-id="13521"
              width="16"
              height="16"
            >
              <path
                d="M511.5 82c-236.6 0-429 192.4-429 429 0 236.5 192.5 429 429 429 236.6 0 429-192.4 429-429 0-236.5-192.4-429-429-429z m377.6 403.8H734.3c-4-139.9-41.4-259.9-97.5-331.9C776.5 203 879 332 889.1 485.8z m-402.8-349v349h-147c5.5-175.5 68.6-322.6 147-349z m0 399.4v349c-78.4-26.4-141.4-173.5-147-349h147z m50.5 349v-349h147c-5.6 175.5-68.6 322.6-147 349z m0-399.4v-349c78.4 26.4 141.4 173.5 147 349h-147zM386.3 153.9c-56.1 72-93.5 192-97.5 331.9H133.9C144.1 332 246.5 203 386.3 153.9zM133.9 536.2h154.8c4 139.9 41.4 259.9 97.5 331.9C246.5 819 144.1 690 133.9 536.2z m502.8 331.9c56.1-72 93.5-192 97.5-331.9H889C879 690 776.5 819 636.7 868.1z"
                fill="#5F9BEB"
                p-id="13522"
              ></path>
            </svg>
            <span class="nav-text">游戏官网</span>
          </a>
        </button>
        <button class="nav-btn" @click="handleNavClick('recharge')">
          <svg
            t="1768407402129"
            class="icon nav-icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="11462"
            width="16"
            height="16"
          >
            <path
              d="M805.004 164c17.092 0 32.584 10.06 39.532 25.672l97.708 219.436a47.764 47.764 0 0 1-10.808 54.128l-397.992 376.48a31.208 31.208 0 0 1-42.888 0l-397.992-376.48a47.764 47.764 0 0 1-10.808-54.128 3818185.76 3818185.76 0 0 1 97.708-219.436A43.268 43.268 0 0 1 218.996 164h586.008z"
              fill="#00A5FF"
              p-id="11463"
            ></path>
            <path
              d="M506.372 847.74a31.072 31.072 0 0 1-15.816-8.024l-397.992-376.48a47.764 47.764 0 0 1-10.808-54.128l97.708-219.436a43.212 43.212 0 0 1 16.104-18.784l310.804 676.852z"
              fill="#00A9FF"
              p-id="11464"
            ></path>
            <path
              d="M517.628 847.74l310.804-676.852a43.212 43.212 0 0 1 16.104 18.784l97.708 219.436a47.764 47.764 0 0 1-10.808 54.128l-397.992 376.48a31.072 31.072 0 0 1-15.816 8.024z"
              fill="#0099FF"
              p-id="11465"
            ></path>
            <path
              d="M79.02 440a47.72 47.72 0 0 1 2.736-30.892l97.708-219.436A43.268 43.268 0 0 1 218.996 164h586.008c17.092 0 32.584 10.06 39.532 25.672l97.708 219.436a47.72 47.72 0 0 1 2.736 30.892H79.02z"
              fill="#00D2FF"
              p-id="11466"
            ></path>
            <path
              d="M218.996 164h586.008c8.968 0 17.492 2.768 24.572 7.652l-311.92 676.084a31.36 31.36 0 0 1-11.216 0.02L198.372 169.228A43.26 43.26 0 0 1 218.996 164z"
              fill="#00F2FF"
              p-id="11467"
            ></path>
            <path
              d="M506.44 847.756L321.312 440h384.46l-188.116 407.736a31.36 31.36 0 0 1-11.216 0.02z"
              fill="#00B9FF"
              p-id="11468"
            ></path>
            <path d="M512 164l193.772 276H321.312L512 164z" fill="#9FFBFF" p-id="11469"></path>
          </svg>

          <span class="nav-text">充值中心</span>
        </button>
        <button class="nav-btn" @click="handleNavClick('settings')">
          <svg
            t="1768407618896"
            class="icon nav-icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="15711"
            width="16"
            height="16"
          >
            <path
              d="M219.479306 172.659422a209.594451 209.594451 0 0 1-55.520924 198.584971 209.890405 209.890405 0 0 1-92.515145 53.922775v170.824508a208.469827 208.469827 0 0 1 92.278381 53.626821 208.824971 208.824971 0 0 1 54.33711 200.893411L365.029364 935.213873a209.831214 209.831214 0 0 1 295.065896-1.775723l145.72763-84.110058a210.127168 210.127168 0 0 1 146.437919-255.408092v-165.734104a208.824971 208.824971 0 0 1-147.148208-255.881619L658.793064 87.602312a209.831214 209.831214 0 0 1-293.053411 0.651098z m-79.61156-32.791676L376.157225 3.492254l12.252486 3.255492a200.656647 200.656647 0 0 0 23.676301 31.489479 141.525087 141.525087 0 0 0 199.887167-0.414335 202.846705 202.846705 0 0 0 23.676301-31.134335l13.081156-3.492254 235.993526 136.138728 3.255491 12.252485A140.696416 140.696416 0 0 0 1012.99052 366.982659l7.87237 7.87237v272.277457l-7.280462 7.280462A141.702659 141.702659 0 0 0 887.861272 869.038613l-3.729018 13.909826-236.289479 136.138729-9.41133-2.486012a141.169942 141.169942 0 0 0-224.924855-33.501965 142.057803 142.057803 0 0 0-24.38659 32.554913l-13.969017 3.729017-235.993526-136.138728-3.373873-12.60763a140.933179 140.933179 0 0 0-20.361619-173.369711A140.518844 140.518844 0 0 0 11.83815 657.017341l-8.878612-8.878613v-272.277456l6.570173-11.364625a141.584277 141.584277 0 0 0 105.892254-41.433526q47.826127-47.766936 19.769711-175.559768z m880.995144 233.685086v1.124625h-7.87237V366.982659h1.124625a7.280462 7.280462 0 0 1 6.688554 6.688555z m0 0"
              fill="#467CFD"
              p-id="15712"
            ></path>
            <path
              d="M514.071676 659.384971a147.976879 147.976879 0 1 0-148.450404-147.976879 148.391214 148.391214 0 0 0 148.450404 147.976879z m0 68.187746a216.460578 216.460578 0 1 1 216.756532-216.460578 216.57896 216.57896 0 0 1-216.756532 216.460578z m0 0"
              fill="#8BAEF7"
              p-id="15713"
            ></path>
          </svg>
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
            class="launch-button-wrapper"
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
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
import { GameSettings, Theme, UserInfo } from '../../types'

// ========== 状态管理 ==========
const showSettings = ref(false)
const showLoginModal = ref(false)
const showLogoutConfirm = ref(false)

/* 当前登录账号 */
const [userInfo, setUseInfo] = useLocalStorageState<UserInfo>('r2beat_user')

const [gameSettings, setGameSettings] = useLocalStorageState<GameSettings>('r2beat_game_settings', {
  defaultValue: {
    gamePath: '',
    autoUpdate: false,
    closeOnLaunch: false,
    launchArgs: 'xyxOpen',
    processPriority: 'normal',
    lowerNPPriority: false
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
    window.api.openRechargeCenter?.()
  }
}

const handleSaveSettings = (settings: GameSettings) => {
  setGameSettings(settings)
  console.log('保存设置:', settings)
}

// 为什么会白一下呢。。。
onMounted(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.api.windowShow?.()
      }, 220)
    })
  })
})
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  position: relative;
}

.main-content {
  padding: 50px 30px 40px;
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.content-wrapper {
  max-width: 1400px;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 30px;
}

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

  .launch-button-wrapper {
    margin-top: auto;
  }
}
</style>
