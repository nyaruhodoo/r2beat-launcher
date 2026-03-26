<template>
  <div class="container">
    <CustomTitleBar type="detail" title="发货助手">
      <template #nav>
        <UserInfoCom :user-info-list="savedAccounts ?? []" @login-click="showLoginModal = true" />

        <!-- 抽奖中心和充值中心下拉框 -->
        <Dropdown :items="giftRechargeItems">
          <template #trigger="{ isOpen }">
            <button class="nav-btn">
              <span>🎁</span>
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
      </template>
    </CustomTitleBar>

    <main class="main-content">
      <el-tabs v-model="tabsActiveName">
        <el-tab-pane label="发货工具" name="fahuo">
          <ItemTable :accounts="enabledAccounts" :verify-login-before-sync="checkLoginStatus" />
        </el-tab-pane>
        <el-tab-pane label="抽奖工具" name="choujiang">
          <Lottery />
        </el-tab-pane>
        <el-tab-pane label="关于作者" name="zuozhe">
          <Author />
        </el-tab-pane>
      </el-tabs>
    </main>

    <!-- 登录模态框 -->
    <LoginModal
      :visible="showLoginModal"
      :account-list="savedAccounts"
      :delete-account="deleteAccount"
      @close="showLoginModal = false"
      @login-success="handleLoginSuccess"
      @update-account-disable="handleUpdateAccountDisable"
    />
  </div>
</template>

<script setup lang="ts">
import CustomTitleBar from '../components/CustomTitleBar.vue'
import UserInfoCom from './components/UserInfo.vue'
import LoginModal from './components/LoginModal.vue'
import { computed, ref } from 'vue'
import { useLocalStorageState } from 'vue-hooks-plus'
import { WebUserInfo } from '@src/types'
import { ipcEmitter, ipcArg } from '@renderer/ipc'
import { useToast } from '@renderer/composables/useToast'
import ItemTable from './components/ItemTable.vue'
import { DropdownItem } from '@renderer/components/Dropdown.vue'
import wangzhanImg from '@renderer/assets/imgs/wangzhan.png'
import Lottery from './components/Lottery.vue'
import Author from './components/Author.vue'

const { error: toastError } = useToast()

const tabsActiveName = ref('fahuo')
const showLoginModal = ref(false)

const giftRechargeItems: DropdownItem[] = [
  {
    label: '抽奖中心',
    icon: '🎁',
    href: 'https://r2beat.xiyouxi.com/gift/draw',
    target: '_blank',
  },
  {
    label: '充值中心',
    icon: '💎',
    onClick: () => {
      ipcEmitter.send('open-recharge-center', '')
    },
  },
  {
    label: '游戏官网',
    icon: wangzhanImg,
    href: 'https://r2beat.xiyouxi.com/',
    target: '_blank',
  },
]

/**
 * 存储所有登陆过的账号
 */
const [savedAccounts, setSavedAccounts] = useLocalStorageState<WebUserInfo[]>(
  'r2beat_saved_accounts_lottery',
  {
    defaultValue: [],
  },
)

/**
 * 过滤出已启用账号
 */
const enabledAccounts = computed<WebUserInfo[]>(() =>
  (savedAccounts.value ?? []).filter((a) => !a.disable),
)

/**
 * 登录成功保存账号
 */
const handleLoginSuccess = async (userInfo: WebUserInfo) => {
  const currentAccounts = savedAccounts.value ? [...savedAccounts.value] : []

  const targetIndex =
    currentAccounts.findIndex((account) => account.username === userInfo.username) ?? -1

  if (targetIndex > -1) {
    currentAccounts[targetIndex] = {
      ...userInfo,
    }
  } else {
    currentAccounts.push({
      ...userInfo,
    })
  }

  setSavedAccounts(currentAccounts)
}

/**
 * 移除账号
 */
const deleteAccount = (userName: string) => {
  const newAccounts = savedAccounts.value?.filter((account) => account.username !== userName)
  setSavedAccounts(newAccounts)
}

/**
 * 切换账号启用状态
 */
const handleUpdateAccountDisable = (payload: { username: string; disable: boolean }) => {
  const list = savedAccounts.value ? [...savedAccounts.value] : []
  const i = list.findIndex((a) => a.username === payload.username)
  if (i === -1) return
  list[i] = { ...list[i], disable: payload.disable }
  setSavedAccounts(list)
}

/**
 * 登录态检查并写回本地账号
 */
const checkLoginStatus = async (): Promise<boolean> => {
  const list = enabledAccounts.value
  if (list.length === 0) return false

  const check = await ipcEmitter.invoke('check-web-login', ipcArg(list))
  if (check.success) return true

  const result = await ipcEmitter.invoke('refresh-web-users', ipcArg(list))
  if (!result.success) {
    toastError(result.error ?? '刷新登录状态失败')
    return false
  }

  const newList = result.userInfoList ?? []
  if (newList.length === 0) return true

  const current = savedAccounts.value ? [...savedAccounts.value] : []
  const map = new Map(newList.map((u) => [u.username, u]))
  const merged = current.map((acc) => {
    const next = map.get(acc.username)
    return next ? { ...acc, ...next } : acc
  })
  setSavedAccounts(merged)
  return true
}

/**
 * 暂时不做主题适配，给个默认色得了
 */
const applyTheme = (newTheme?: string) => {
  if (!newTheme) return
  const root = document.documentElement
  root.setAttribute('data-theme', newTheme)
  root.className = ''
  root.classList.add(`${newTheme.trim()}-theme`)
}
applyTheme('qingchunlv')
</script>

<style scoped>
.container {
  height: 100%;
}
.main-content {
  height: 100%;
  padding: 50px 30px 40px;
  display: flex;

  .el-tabs {
    width: 100%;

    .el-tab-pane,
    .item-table-wrap {
      height: 100%;
    }
  }
}
:global(#app) {
  transition: none !important;
}
</style>
