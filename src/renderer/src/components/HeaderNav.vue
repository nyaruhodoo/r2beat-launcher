<template>
  <header class="header-nav">
    <div class="header-content">
      <div class="logo-section">
        <div class="logo-icon">🎮</div>
        <span class="logo-text">R2Beat Launcher</span>
      </div>
      <nav class="nav-links">
        <a href="#" class="nav-link" @click.prevent="handleNavClick('website')">
          <span class="nav-icon">🌐</span>
          <span>游戏官网</span>
        </a>
        <a href="#" class="nav-link" @click.prevent="handleNavClick('recharge')">
          <span class="nav-icon">💎</span>
          <span>充值中心</span>
        </a>
        <a href="#" class="nav-link" @click.prevent="handleNavClick('settings')">
          <span class="nav-icon">⚙️</span>
          <span>设置</span>
        </a>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (e: 'nav-click', type: 'website' | 'recharge' | 'settings'): void
}>()

const handleNavClick = (type: 'website' | 'recharge' | 'settings') => {
  emit('nav-click', type)
}
</script>

<style scoped>
.header-nav {
  position: fixed;
  top: 32px;
  left: 0;
  right: 0;
  height: 60px;
  background: var(--gradient-card);

  border-bottom: 1px solid var(--color-border);
  z-index: 1000;
  box-shadow: var(--shadow-sm);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 30px;
  max-width: 1400px;
  margin: 0 auto;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 700;
  font-size: 18px;
  color: var(--color-primary);
  text-shadow: var(--text-shadow-primary);

  .logo-icon {
    font-size: 28px;
    animation: float 3s ease-in-out infinite;
  }

  .logo-text {
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-5px);
  }
}

.nav-links {
  display: flex;
  gap: 20px;
  align-items: center;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  color: var(--color-text-primary);
  text-decoration: none;
  border-radius: 20px;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  cursor: pointer;

  &:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-button-hover);
    color: var(--color-primary);
  }

  .nav-icon {
    font-size: 18px;
  }
}
</style>
