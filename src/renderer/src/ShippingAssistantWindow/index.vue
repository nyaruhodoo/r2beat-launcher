<template>
  <div class="container">
    <CustomTitleBar type="detail" title="发货助手">
      <template #nav>
        <UserInfoCom :user-info-list="savedAccounts ?? []" @login-click="showLoginModal = true" />
      </template>
    </CustomTitleBar>

    <main class="main-content">
      <el-tabs v-model="tabsActiveName">
        <el-tab-pane label="发货工具" name="shipping">
          <ItemTable :accounts="enabledAccounts" :verify-login-before-sync="checkLoginStatus" />
        </el-tab-pane>
        <el-tab-pane label="抽奖工具" name="lottery">抽奖</el-tab-pane>
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
import { WebUserInfo } from '@types'
import { ipcEmitter, ipcArg } from '@renderer/ipc'
import { useToast } from '@renderer/composables/useToast'
import ItemTable from './components/ItemTable.vue'

const { error: toastError } = useToast()

const tabsActiveName = ref('shipping')
const showLoginModal = ref(false)
const [savedAccounts, setSavedAccounts] = useLocalStorageState<WebUserInfo[]>(
  'r2beat_saved_accounts_lottery',
  {
    defaultValue: [],
  },
)

/** 未禁用的账号*/
const enabledAccounts = computed<WebUserInfo[]>(() =>
  (savedAccounts.value ?? []).filter((a) => a.disable !== true),
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
 * 数据同步前：先 check-web-login 校验 token；仅在校验失败时再 refresh-web-users 并写回本地账号
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
</style>
