<template>
  <n-spin :show="loading">
    <div class="stock-bento-grid">
      <div
        v-for="(stock, index) in sortedStocks"
        :key="stock.symbol"
        :class="['stock-card', getCardClass(index)]"
        @click="() => router.push(`/detail/${stock.symbol}`)"
      >
        <!-- Card Header -->
        <div class="card-header">
          <div class="stock-info">
            <h3 class="stock-name">{{ stock.name || stock.symbol }}</h3>
            <span class="stock-symbol">{{ stock.symbol }}</span>
          </div>
          <button
            class="delete-btn"
            @click.stop="emit('remove', stock.symbol)"
            title="删除"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Price Display -->
        <div class="price-display">
          <div class="current-price" :class="getPriceClass(stock.change)">
            {{ stock.current ? stock.current.toFixed(2) : '-' }}
          </div>
          <div class="price-change" :class="getPriceClass(stock.change)">
            <span v-if="stock.changePercent">
              {{ stock.change >= 0 ? '+' : '' }}{{ stock.changePercent }}%
            </span>
            <span v-else>-</span>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="card-footer">
          <div class="tags">
            <span class="tag" :class="`tag-${stock.market.toLowerCase()}`">
              {{ getMarketText(stock.market) }}
            </span>
            <span class="tag" :class="getTypeClass(stock.type)">
              {{ getTypeText(stock.type) }}
            </span>
          </div>
          <div class="status-badge" :class="{ active: stock.status === 'trading' }">
            <div class="status-dot"></div>
            <span>{{ stock.status === 'trading' ? '交易中' : '已闭市' }}</span>
          </div>
        </div>

        <!-- Hover Glow Effect -->
        <div class="card-glow"></div>
      </div>
    </div>
  </n-spin>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  stocks: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['remove'])
const router = useRouter()

// 排序：开盘在前，涨幅高的在前
const sortedStocks = computed(() => {
  return [...props.stocks].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'trading' ? -1 : 1
    }
    const aChange = parseFloat(a.changePercent) || 0
    const bChange = parseFloat(b.changePercent) || 0
    return bChange - aChange
  })
})

const getPriceClass = (change) => {
  if (change >= 0) return 'price-up'
  return 'price-down'
}

const getMarketText = (market) => {
  const map = {
    CN: 'A股',
    HK: '港股',
    US: '美股'
  }
  return map[market] || market
}

const getTypeText = (type) => {
  if (type === 'index') return '指数'
  if (type === 'etf') return 'ETF'
  return '股票'
}

const getTypeClass = (type) => {
  if (type === 'index') return 'tag-index'
  if (type === 'etf') return 'tag-etf'
  return 'tag-stock'
}

// Bento Grid 布局：不对称卡片大小
const getCardClass = (index) => {
  const patterns = ['large', 'medium', 'medium', 'large', 'medium', 'large']
  return `card-${patterns[index % patterns.length]}`
}
</script>

<style scoped>
.stock-bento-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  grid-auto-rows: auto;
  grid-auto-flow: dense;
}

.stock-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 24px;
  padding: 18px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

/* Bento Grid Variations */
.card-large {
  grid-column: span 2;
}

.card-medium {
  grid-column: span 1;
}

/* Hover Glow Effect */
.card-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
}

.stock-card:hover .card-glow {
  opacity: 1;
}

.stock-card::before {
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

.stock-card:hover::before {
  opacity: 1;
}

.stock-card:hover {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(0, 0, 0, 0.12);
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.05);
}

.stock-card:active {
  transform: translateY(-2px) scale(1.005);
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.stock-info {
  flex: 1;
  min-width: 0;
}

.stock-name {
  margin: 0 0 6px 0;
  font-size: 18px;
  font-weight: 600;
  color: #18181b;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stock-symbol {
  font-size: 13px;
  color: #71717a;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.delete-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  color: #71717a;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
  transform: scale(1.05);
}

.delete-btn:active {
  transform: scale(0.95);
}

/* Price Display */
.price-display {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin: 8px 0;
}

.current-price {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}

.price-up {
  color: #ef4444;
}

.price-down {
  color: #10b981;
}

.price-change {
  font-size: 16px;
  font-weight: 600;
}

/* Card Footer */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
  border: 1px solid;
  transition: all 0.2s;
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

.tag-stock {
  background: rgba(100, 116, 139, 0.1);
  color: #475569;
  border-color: rgba(100, 116, 139, 0.2);
}

.tag-etf {
  background: rgba(14, 165, 233, 0.1);
  color: #0369a1;
  border-color: rgba(14, 165, 233, 0.2);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #a1a1aa;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d4d4d8;
  transition: all 0.3s;
}

.status-badge.active .status-dot {
  background: #10b981;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
  animation: pulse-dot 2s infinite;
}

.status-badge.active {
  color: #10b981;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .card-large {
    grid-column: span 1;
  }
}

@media (max-width: 768px) {
  .stock-bento-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .card-large,
  .card-medium {
    grid-column: span 1;
  }

  .stock-card {
    padding: 16px;
  }

  .current-price {
    font-size: 28px;
  }
}
</style>
