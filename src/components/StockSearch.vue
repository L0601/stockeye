<template>
  <div class="search-container">
    <div class="search-input-wrapper">
      <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
        <path d="M21 21L16.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <input
        v-model="keyword"
        type="text"
        class="search-input"
        placeholder="搜索股票代码或公司名称..."
        @keyup.enter="handleSearch"
        @input="handleSearch"
      />
      <button
        v-if="keyword"
        class="clear-btn"
        @click="clearSearch"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div v-if="searching" class="search-loading">
      <div class="loading-spinner"></div>
      <span>搜索中...</span>
    </div>

    <div v-else-if="searchResults.length > 0" class="results-list">
      <div
        v-for="stock in searchResults"
        :key="stock.symbol"
        class="result-item"
        @click="handleAdd(stock)"
      >
        <div class="result-info">
          <div class="result-header">
            <span class="result-name">{{ stock.name }}</span>
            <div class="result-tags">
              <span class="result-tag" :class="`tag-${stock.market.toLowerCase()}`">
                {{ getMarketName(stock.market) }}
              </span>
              <span v-if="stock.type === 'index'" class="result-tag tag-index">
                指数
              </span>
              <span v-else-if="stock.type === 'etf'" class="result-tag tag-etf">
                ETF
              </span>
            </div>
          </div>
          <span class="result-symbol">{{ stock.symbol }}</span>
        </div>
        <button class="add-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-else-if="keyword && !searching" class="no-results">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
        <path d="M21 21L16.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <p>未找到相关股票</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useMessage } from 'naive-ui'

const stockStore = useStockStore()
const message = useMessage()

const keyword = ref('')
const searching = ref(false)
const searchResults = ref([])

const handleSearch = async () => {
  if (!keyword.value.trim()) {
    searchResults.value = []
    return
  }

  searching.value = true
  try {
    const results = await stockStore.searchStock(keyword.value)
    searchResults.value = results
    if (results.length === 0 && keyword.value.trim()) {
      // message.warning('未找到相关股票')
    }
  } catch (error) {
    console.error('搜索错误:', error)
    message.error('搜索失败')
  } finally {
    searching.value = false
  }
}

const handleAdd = (stock) => {
  const success = stockStore.addStock(stock)
  if (success) {
    message.success(`已添加 ${stock.name}`)
    searchResults.value = []
    keyword.value = ''
  } else {
    message.warning('该股票已存在')
  }
}

const clearSearch = () => {
  keyword.value = ''
  searchResults.value = []
}

const getMarketName = (market) => {
  const names = {
    CN: 'A股',
    HK: '港股',
    US: '美股'
  }
  return names[market] || market
}
</script>

<style scoped>
.search-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Search Input */
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 16px;
  color: #a1a1aa;
  pointer-events: none;
  z-index: 2;
}

.search-input {
  width: 100%;
  padding: 14px 48px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  color: #18181b;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.01em;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
}

.search-input::placeholder {
  color: #a1a1aa;
}

.search-input:hover {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.12);
}

.search-input:focus {
  background: #fff;
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.08);
}

.clear-btn {
  position: absolute;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
  border: none;
  border-radius: 8px;
  color: #71717a;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #18181b;
  transform: scale(1.05);
}

/* Loading */
.search-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  color: #71717a;
  font-size: 14px;
}

.tag-etf {
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: #71717a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Results List */
.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.result-item:hover {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
  transform: translateX(4px);
}

.result-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.result-name {
  font-size: 15px;
  font-weight: 600;
  color: #18181b;
  letter-spacing: -0.01em;
}

.result-symbol {
  font-size: 13px;
  color: #71717a;
  font-weight: 500;
  font-family: 'SF Mono', 'Consolas', monospace;
}

.result-tags {
  display: flex;
  gap: 6px;
}

.result-tag {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  border: 1px solid;
}

.tag-cn {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
  border-color: rgba(59, 130, 246, 0.2);
}

.tag-hk {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  border-color: rgba(245, 158, 11, 0.2);
}

.tag-us {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border-color: rgba(16, 185, 129, 0.2);
}

.tag-index {
  background: rgba(168, 85, 247, 0.1);
  color: #9333ea;
  border-color: rgba(168, 85, 247, 0.2);
}

.add-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 12px;
  color: #818cf8;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.add-btn:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
  color: #a5b4fc;
  transform: scale(1.08);
}

.add-btn:active {
  transform: scale(0.95);
}

/* No Results */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
  color: #a1a1aa;
}

.no-results svg {
  color: #d4d4d8;
}

.no-results p {
  margin: 0;
  font-size: 14px;
  color: #71717a;
}
</style>
