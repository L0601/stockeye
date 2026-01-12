<template>
  <div class="home-container">
    <!-- Header -->
    <header class="header">
      <div class="header-content">
        <div class="logo">
          <div class="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M17 7H21V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 class="logo-text">StockEye</h1>
        </div>

        <div class="header-actions">
          <button class="action-btn" @click="handleRefresh" :disabled="stockStore.loading">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :class="{ 'spin': stockStore.loading }">
              <path d="M21 2V8M21 8H15M21 8L18 5.5C16.5 4 14.5 3 12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21C15.5 21 18.5 19 20 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>刷新</span>
          </button>
          <button class="action-btn" @click="showSettings = true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
              <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>设置</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Bento Grid Container -->
      <div class="bento-grid">
        <!-- Search Card -->
        <div class="bento-item search-item">
          <stock-search />
        </div>

        <!-- Stats Cards -->
        <div v-if="stockStore.stocks.length > 0" class="bento-item stats-item">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">关注中</div>
              <div class="stat-value">{{ stockStore.visibleStockCount }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">最后更新</div>
              <div class="stat-value small">{{ formatTime(stockStore.lastUpdateTime) }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">自动刷新</div>
              <div class="stat-status" :class="{ active: stockStore.autoRefresh }">
                <div class="status-dot"></div>
                <span>{{ stockStore.autoRefresh ? '开启' : '关闭' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Stock List -->
        <div class="bento-item stocks-item">
          <stock-list
            :stocks="stockStore.visibleStocks"
            :loading="stockStore.loading"
            @remove="handleRemove"
          />

          <div v-if="stockStore.visibleStocks.length === 0" class="empty-state">
            <div class="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <template v-if="stockStore.stocks.length === 0">
              <h3>开始关注股票</h3>
              <p>使用上方搜索框添加您关注的股票</p>
            </template>
            <template v-else>
              <h3>暂无可显示股票</h3>
              <p>已隐藏闭市股票，可在设置中关闭</p>
            </template>
          </div>
        </div>
      </div>
    </main>

    <!-- 设置弹窗 -->
    <n-modal
      v-model:show="showSettings"
      preset="card"
      title="设置"
      style="width: 500px"
    >
      <n-space vertical>
        <n-form-item label="自动刷新">
          <n-switch
            :value="stockStore.autoRefresh"
            @update:value="stockStore.toggleAutoRefresh"
          />
        </n-form-item>

        <n-form-item label="刷新间隔">
          <n-select
            :value="stockStore.refreshInterval"
            :options="intervalOptions"
            @update:value="handleIntervalChange"
          />
        </n-form-item>

        <n-form-item label="隐藏闭市股票">
          <div class="setting-toggle">
            <n-switch
              :value="stockStore.hideClosed"
              @update:value="stockStore.toggleHideClosed"
            />
            <span class="setting-hint">午间闭市不隐藏</span>
          </div>
        </n-form-item>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useDialog, useMessage } from 'naive-ui'
import StockSearch from '@/components/StockSearch.vue'
import StockList from '@/components/StockList.vue'

const stockStore = useStockStore()
const dialog = useDialog()
const message = useMessage()

const showSettings = ref(false)
let refreshTimer = null

const intervalOptions = [
  { label: '10秒', value: 10000 },
  { label: '30秒', value: 30000 },
  { label: '1分钟', value: 60000 },
  { label: '5分钟', value: 300000 }
]

onMounted(() => {
  stockStore.init()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

const handleRefresh = () => {
  stockStore.refreshData()
}

const handleRemove = (symbol) => {
  dialog.warning({
    title: '确认删除',
    content: '确定要删除这个股票吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      stockStore.removeStock(symbol)
      message.success('删除成功')
    }
  })
}

const handleIntervalChange = (value) => {
  stockStore.setRefreshInterval(value)
  stopAutoRefresh()
  startAutoRefresh()
}

const startAutoRefresh = () => {
  if (refreshTimer) return

  refreshTimer = setInterval(() => {
    if (stockStore.autoRefresh && stockStore.stocks.length > 0) {
      stockStore.refreshData()
    }
  }, stockStore.refreshInterval)
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

const formatTime = (time) => {
  const date = new Date(time)
  return date.toLocaleTimeString('zh-CN')
}
</script>

<style scoped>
/* Reset & Base */
* {
  letter-spacing: -0.02em;
}

.home-container {
  min-height: 100vh;
  background: #fafafa;
  position: relative;
  overflow-x: hidden;
}

/* Noise Texture */
.home-container::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.02;
  pointer-events: none;
  z-index: 1;
}

/* Mesh Gradient Background */
.home-container::after {
  content: '';
  position: fixed;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.03) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.03) 0%, transparent 50%),
              radial-gradient(circle at 40% 20%, rgba(59, 130, 246, 0.02) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* Header */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 48px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #18181b;
}

.logo-text {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #18181b;
  letter-spacing: -0.03em;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  color: #52525b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.05), transparent);
  transition: left 0.5s;
}

.action-btn:hover::before {
  left: 100%;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.12);
  color: #18181b;
  transform: translateY(-1px);
}

.action-btn:active {
  transform: scale(0.98);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Main Content */
.main-content {
  position: relative;
  z-index: 2;
  max-width: 1400px;
  margin: 0 auto;
  padding: 48px 48px 96px;
}

/* Bento Grid */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 24px;
  grid-auto-rows: minmax(100px, auto);
}

.bento-item {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 24px;
  padding: 32px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.bento-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.1), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}

.bento-item:hover::before {
  opacity: 1;
}

.bento-item:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* Grid Layout */
.search-item {
  grid-column: span 12;
}

.stats-item {
  grid-column: span 12;
}

.stocks-item {
  grid-column: span 12;
  min-height: 400px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-label {
  font-size: 13px;
  color: #71717a;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #18181b;
  line-height: 1;
  background: linear-gradient(135deg, #18181b 0%, #52525b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-value.small {
  font-size: 20px;
  font-weight: 600;
}

.stat-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #71717a;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d4d4d8;
  transition: all 0.3s;
}

.stat-status.active .status-dot {
  background: #10b981;
  box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
}

.stat-status.active {
  color: #10b981;
}

.setting-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-hint {
  font-size: 12px;
  color: #71717a;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d4d4d8;
  margin-bottom: 8px;
}

.empty-state h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #18181b;
  letter-spacing: -0.02em;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
  color: #71717a;
}

/* Responsive */
@media (max-width: 768px) {
  .header-content,
  .main-content {
    padding-left: 24px;
    padding-right: 24px;
  }

  .bento-grid {
    gap: 16px;
  }

  .bento-item {
    padding: 24px;
    border-radius: 20px;
  }
}
</style>
