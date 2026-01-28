<template>
  <Modal
    :visible="visible"
    title="登录"
    title-icon="🔐"
    cancel-text="取消"
    confirm-text="登录"
    :show-confirm="false"
    :show-cancel="false"
    max-width="450px"
    @close="handleClose"
  >
    <div class="login-form">
      <!-- 已保存账号下拉框 -->
      <div v-if="(accountList?.length ?? 0) > 0" class="form-item">
        <label class="form-label">选择账号</label>
        <div ref="accountSelectRef" class="account-select-wrapper">
          <div class="account-select-trigger" @click.stop="toggleAccountDropdown">
            <span class="account-select-value">
              {{ selectedAccount?.remark || selectedAccount?.username || '请选择账号或输入新账号' }}
            </span>
            <div class="account-select-arrow" :class="{ rotated: isAccountDropdownOpen }">
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
          </div>
          <Transition name="dropdown">
            <div v-if="isAccountDropdownOpen" class="account-select-dropdown" @click.stop>
              <div
                v-for="account in accountList"
                :key="account.username"
                class="account-select-option"
                :class="{ active: account.username === selectedAccount?.username }"
                @click="selectSavedAccount(account)"
              >
                <div class="account-option-info">
                  <span class="account-option-username">{{
                    account.remark || account.username
                  }}</span>
                  <span class="account-option-badge">🔒</span>
                </div>
                <button
                  class="account-delete-btn"
                  title="删除账号"
                  @click.stop="handleDeleteAccount(account)"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <div class="form-item">
        <label class="form-label">用户名</label>
        <input
          v-model="formData.username"
          type="text"
          class="form-input"
          placeholder="请输入用户名"
          spellcheck="false"
          @keyup.enter="handleLogin"
        />
      </div>

      <div class="form-item">
        <label class="form-label">密码</label>
        <div class="password-input-wrapper">
          <input
            v-model="formData.password"
            :type="showPassword ? 'text' : 'password'"
            class="form-input password-input"
            placeholder="请输入密码"
            @keyup.enter="handleLogin"
          />
          <button
            type="button"
            class="password-toggle-btn"
            :title="showPassword ? '隐藏密码' : '显示密码'"
            @click="showPassword = !showPassword"
          >
            <svg v-if="showPassword" width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 3.75C5.25 3.75 2.0475 6.0975 0.75 9.375C2.0475 12.6525 5.25 15 9 15C12.75 15 15.9525 12.6525 17.25 9.375C15.9525 6.0975 12.75 3.75 9 3.75ZM9 13.125C6.93 13.125 5.25 11.445 5.25 9.375C5.25 7.305 6.93 5.625 9 5.625C11.07 5.625 12.75 7.305 12.75 9.375C12.75 11.445 11.07 13.125 9 13.125ZM9 7.125C7.755 7.125 6.75 8.13 6.75 9.375C6.75 10.62 7.755 11.625 9 11.625C10.245 11.625 11.25 10.62 11.25 9.375C11.25 8.13 10.245 7.125 9 7.125Z"
                fill="currentColor"
              />
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M1.5 1.5L16.5 16.5M7.425 7.425C7.0725 7.7775 6.75 8.205 6.75 8.625C6.75 9.87 7.755 10.875 9 10.875C9.42 10.875 9.8475 10.5525 10.2 10.2M13.5 13.5C12.2475 14.3025 10.65 14.625 9 14.625C5.25 14.625 2.0475 12.2775 0.75 9C1.305 7.5225 2.19 6.2475 3.3 5.25M6.75 3.75C7.5 3.5625 8.25 3.375 9 3.375C12.75 3.375 15.9525 5.7225 17.25 9C16.695 10.4775 15.81 11.7525 14.7 12.75L13.5 13.5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="form-item">
        <label class="form-label">备注（可选）</label>
        <input
          v-model="formData.remark"
          type="text"
          class="form-input"
          placeholder="为账号添加备注，方便识别"
          @keyup.enter="handleLogin"
        />
      </div>

      <div class="form-options">
        <Checkbox v-model="rememberPassword" label="记住密码" />
      </div>
    </div>

    <template #footer>
      <button class="btn btn-cancel" @click="handleClose">取消</button>
      <button class="btn btn-login" :disabled="isLoading || countdown > 0" @click="handleLogin">
        <span v-if="isLoading">登录中...</span>
        <span v-else-if="countdown > 0">请等待 {{ countdown }} 秒后重试</span>
        <span v-else>登录</span>
      </button>
    </template>
  </Modal>

  <!-- 确认删除对话框 -->
  <ConfirmDialog
    :visible="showDeleteConfirm"
    title="删除账号"
    :message="deleteConfirmMessage"
    confirm-text="删除"
    cancel-text="取消"
    @confirm="confirmDeleteAccount"
    @cancel="cancelDeleteAccount"
  />
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import Modal from './Modal.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import Checkbox from './Checkbox.vue'
import { useToast } from '@renderer/composables/useToast'
import { UserInfo } from '@types'
import useEventListener from 'vue-hooks-plus/lib/useEventListener'

const props = defineProps<{
  visible: boolean
  accountList?: UserInfo[]
  deleteAccount: (username: string) => void
}>()

const { error: showError } = useToast()

const emit = defineEmits<{
  (e: 'close'): void
  (
    e: 'login-success',
    data: { username: string; password: string; rememberPassword: boolean; remark?: string }
  ): void
}>()

const formData = ref({
  username: '',
  password: '',
  remark: ''
})
const selectedAccount = ref<UserInfo>()

const rememberPassword = ref(false)
const showPassword = ref(false)
const isLoading = ref(false)
const isAccountDropdownOpen = ref(false)
const accountSelectRef = ref<HTMLElement>()
const showDeleteConfirm = ref(false)
const pendingDeleteUsername = ref<string>('')
const deleteConfirmMessage = ref<string>('')
// 倒计时相关状态
const countdown = ref<number>(0)
const countdownTimer = ref<ReturnType<typeof setInterval> | null>(null)

// 监听visible变化，重置表单
watch(
  () => props.visible,
  (visible) => {
    // 打开时，先重置表单，确保输入框可编辑
    if (visible) {
      formData.value = { username: '', password: '', remark: '' }
      rememberPassword.value = false
      showPassword.value = false
      isLoading.value = false
    }
  }
)

// 监听用户名输入
watch(
  () => formData.value.username,
  (userName) => {
    const account = props.accountList?.find((i) => {
      return i.username === userName
    })
    selectedAccount.value = account
  }
)

// ESC 键关闭弹框
useEventListener('keydown', (event) => {
  if (event.key === 'Escape' && props.visible) {
    // 如果确认删除对话框打开，先关闭它
    if (showDeleteConfirm.value) {
      cancelDeleteAccount()
    } else {
      handleClose()
    }
  }
})
// 点击外部关闭下拉框
useEventListener('click', (event) => {
  if (accountSelectRef.value && !accountSelectRef.value.contains(event.target as Node)) {
    closeAccountDropdown()
  }
})

onUnmounted(() => {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
})

// 切换账号下拉框
const toggleAccountDropdown = () => {
  isAccountDropdownOpen.value = !isAccountDropdownOpen.value
}

// 关闭账号下拉框
const closeAccountDropdown = () => {
  isAccountDropdownOpen.value = false
}

// 选择已保存的账号
const selectSavedAccount = (userInfo: UserInfo) => {
  formData.value.username = userInfo.username || ''
  formData.value.password = userInfo.password || ''
  formData.value.remark = userInfo.remark || ''
  rememberPassword.value = userInfo.rememberPassword || false

  closeAccountDropdown()
}

// 唤醒删除账号弹窗
const handleDeleteAccount = (userInfo: UserInfo) => {
  deleteConfirmMessage.value = `确定要删除账号 "${userInfo?.remark || userInfo.username}" 吗？`
  pendingDeleteUsername.value = userInfo.username ?? ''
  showDeleteConfirm.value = true
}

// 确认删除账号
const confirmDeleteAccount = () => {
  const username = pendingDeleteUsername.value
  const wasSelected = formData.value.username === username

  props.deleteAccount(username)

  // 如果删除的是当前选中的账号，清空表单
  if (wasSelected) {
    formData.value = { username: '', password: '', remark: '' }
    rememberPassword.value = false
  }

  showDeleteConfirm.value = false
  pendingDeleteUsername.value = ''
}

// 取消删除账号
const cancelDeleteAccount = () => {
  showDeleteConfirm.value = false
  pendingDeleteUsername.value = ''
}

const handleClose = () => {
  formData.value = { username: '', password: '', remark: '' }
  rememberPassword.value = false
  showPassword.value = false
  isAccountDropdownOpen.value = false

  emit('close')
}

// 启动倒计时
const startCountdown = (seconds: number) => {
  // 清除之前的定时器
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
  }

  countdown.value = seconds

  countdownTimer.value = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownTimer.value) {
        clearInterval(countdownTimer.value)
        countdownTimer.value = null
      }
      countdown.value = 0
    }
  }, 1000)
}

const handleLogin = async () => {
  if (!formData.value.username.trim() || !formData.value.password.trim()) {
    showError('请输入用户名或密码')
    return
  }

  // 如果正在倒计时，不允许登录
  if (countdown.value > 0) {
    return
  }

  isLoading.value = true

  try {
    // 发送 TCP 登录请求
    const result = await window.api.tcpLogin?.(
      formData.value.username.trim(),
      formData.value.password.trim()
    )

    console.log(result)

    /**
     * 1005 不知道是什么东西，暂时也算作正常登录
     */
    if ((result?.success && result.status === 'SUCCESS') || result?.data?.CommandID === 1005) {
      // 登录成功，触发登录事件，由父组件处理后续逻辑
      emit('login-success', {
        username: formData.value.username,
        password: formData.value.password,
        rememberPassword: rememberPassword.value,
        remark: formData.value.remark
      })
    } else {
      throw new Error(result?.message || result?.error)
    }
  } catch (error) {
    console.error('登录异常:', error)
    const errorMessage = error instanceof Error ? error.message : '登录时发生未知错误'
    showError(errorMessage)

    // 检测错误消息是否包含 "TCP链接被意外中断"
    if (errorMessage.includes('TCP链接被意外中断')) {
      // 启动30秒倒计时
      startCountdown(30)
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* 账号选择下拉框 */
.account-select-wrapper {
  position: relative;
  width: 100%;
}

.account-select-trigger {
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

.account-select-value {
  flex: 1;
  text-align: left;
  color: var(--color-text-primary);
}

.account-select-arrow {
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

.account-select-dropdown {
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
  z-index: 1001;
  overflow: hidden;
  max-height: 180px;
  overflow-y: auto;
  transform-origin: top center;
  will-change: transform, opacity;
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

.account-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

    .account-delete-btn {
      opacity: 1;
    }
  }

  &.active {
    font-weight: 500;
  }
}

.account-option-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.account-option-username {
  font-size: 13px;
}

.account-option-badge {
  font-size: 12px;
}

.account-delete-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  margin-left: 8px;

  &:hover {
    background: var(--color-error-bg);
    color: var(--color-error);
  }
}

/* 下拉框动画 */
.dropdown-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.dropdown-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.form-input {
  padding: 12px 15px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  transition: all 0.3s ease;
  width: 100%;
  user-select: text;
  -webkit-user-select: text;

  &::placeholder {
    color: var(--color-text-muted);
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

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  padding-right: 45px;
}

.password-toggle-btn {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  width: 28px;
  height: 28px;

  &:hover {
    background: var(--color-bg-card-hover);
    color: var(--color-primary);
  }

  &:active {
    background: var(--color-bg-card);
  }
}

.form-options {
  display: flex;
  align-items: center;
}

.error-message {
  padding: 10px 15px;
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  border-radius: 10px;
  color: var(--color-error);
  font-size: 13px;
  text-align: center;
}

.btn {
  padding: 8px 24px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
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

.btn-login {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-button-active);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-button-hover);
  }
}
</style>
