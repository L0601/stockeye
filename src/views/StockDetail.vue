<template>
  <div class="detail-container">
    <n-layout>
      <n-layout-header class="detail-header">
        <div class="header-content">
          <n-space align="center">
            <n-button class="back-button" text @click="handleBack">
              <span class="back-icon">←</span> 返回
            </n-button>
            <h2 class="stock-title">{{ stockInfo.name || symbol }}</h2>
            <n-tag v-if="stockInfo.market" :type="getMarketTagType(stockInfo.market)" size="small">
              {{ getMarketName(stockInfo.market) }}
            </n-tag>
          </n-space>
          <n-space align="center" size="small">
            <n-button class="parser-button" @click="handleGoParser" type="info" round>
              公司指标解析
            </n-button>
            <n-button class="refresh-button" @click="loadData" :loading="loading" type="primary" round>
              <template #icon>
                <span>🔄</span>
              </template>
              刷新数据
            </n-button>
          </n-space>
        </div>
      </n-layout-header>

      <n-layout-content class="detail-content">
          <n-space vertical size="large">
            <!-- 基本信息 -->
            <n-card title="实时行情" class="info-card">
              <n-space vertical size="large">
                <!-- 价格信息 -->
                <div class="price-section">
                  <div class="current-price">
                    <span class="price-label">当前价</span>
                    <span class="price-value" :class="stockInfo.change >= 0 ? 'price-up' : 'price-down'">
                      {{ stockInfo.current ? stockInfo.current.toFixed(2) : '-' }}
                    </span>
                    <n-tag
                      v-if="stockInfo.changePercent"
                      :type="stockInfo.change >= 0 ? 'error' : 'success'"
                      size="medium"
                      class="change-tag"
                    >
                      {{ stockInfo.change >= 0 ? '+' : '' }}{{ stockInfo.change?.toFixed(2) }} ({{ stockInfo.changePercent }}%)
                    </n-tag>
                  </div>
                </div>

                <!-- 其他数据 -->
                <n-grid :cols="4" :x-gap="24" :y-gap="20">
                  <n-grid-item>
                    <div class="info-item">
                      <span class="info-label">昨收</span>
                      <span class="info-value">{{ stockInfo.yesterday?.toFixed(2) || '-' }}</span>
                    </div>
                  </n-grid-item>

                  <n-grid-item>
                    <div class="info-item">
                      <span class="info-label">最高</span>
                      <span class="info-value price-up">{{ stockInfo.high?.toFixed(2) || '-' }}</span>
                    </div>
                  </n-grid-item>

                  <n-grid-item>
                    <div class="info-item">
                      <span class="info-label">最低</span>
                      <span class="info-value price-down">{{ stockInfo.low?.toFixed(2) || '-' }}</span>
                    </div>
                  </n-grid-item>

                  <n-grid-item>
                    <div class="info-item">
                      <span class="info-label">成交量</span>
                      <span class="info-value">{{ formatVolume(stockInfo.volume) }}</span>
                    </div>
                  </n-grid-item>

                  <n-grid-item>
                    <div class="info-item">
                      <span class="info-label">成交额</span>
                      <span class="info-value">{{ formatAmount(stockInfo.amount) }}</span>
                    </div>
                  </n-grid-item>

                  <n-grid-item>
                    <div class="info-item">
                      <span class="info-label">状态</span>
                      <n-tag :type="stockInfo.status === 'trading' ? 'success' : 'default'" size="small">
                        {{ stockInfo.status === 'trading' ? '交易中' : '已闭市' }}
                      </n-tag>
                    </div>
                  </n-grid-item>

                  <n-grid-item>
                    <div class="info-item">
                      <span class="info-label">更新时间</span>
                      <span class="info-value small">{{ stockInfo.updateTime || '-' }}</span>
                    </div>
                  </n-grid-item>
                </n-grid>
              </n-space>
            </n-card>

            <!-- K线图 -->
            <n-card v-if="stockInfo.market === 'CN' || stockInfo.market === 'HK' || stockInfo.market === 'US'" title="K线图" class="chart-card">
              <div v-if="klineData.length > 0">
                <stock-chart :data="klineData" />
              </div>
              <n-empty v-else description="暂无K线数据" />
            </n-card>

            <!-- 技术指标 -->
            <n-card v-if="stockInfo.market === 'CN' || stockInfo.market === 'HK' || stockInfo.market === 'US'" title="技术指标" class="indicator-card">
              <div class="indicator-group">
                <div class="indicator-group-header">
                  <span class="group-title">短期趋势</span>
                  <span class="group-desc">基于日 K 计算</span>
                </div>
                <div class="indicator-note">说明：涨幅指标按后复权口径计算</div>
                <div class="indicator-grid">
                  <div v-for="item in shortTermIndicators" :key="item.label" class="indicator-item">
                    <span class="indicator-label">{{ item.label }}</span>
                    <span class="indicator-hint">{{ item.hint }}</span>
                    <div class="indicator-value" :class="item.value != null ? (item.value >= 0 ? 'value-up' : 'value-down') : ''">
                      {{ formatChange(item.value) }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="indicator-group long-term-group">
                <div class="indicator-group-header">
                  <span class="group-title">长期趋势</span>
                  <span class="group-desc">基于月 K 计算</span>
                </div>
                <div v-if="longTermIndicators.length" class="indicator-grid">
                  <div v-for="item in longTermIndicators" :key="item.label" class="indicator-item">
                    <span class="indicator-label">{{ item.label }}</span>
                    <div class="indicator-value" :class="item.value != null ? (item.value >= 0 ? 'value-up' : 'value-down') : ''">
                      {{ formatChange(item.value) }}
                    </div>
                  </div>
                </div>
                <n-empty v-else description="暂无月K数据" />
              </div>
            </n-card>

          </n-space>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getStockQuote, getStockKLine } from '@/api/stock'
import { storage } from '@/utils/storage'
import StockChart from '@/components/StockChart.vue'

const route = useRoute()
const router = useRouter()

const symbol = ref(route.params.symbol)
const stockInfo = ref({})
const klineData = ref([])
const monthlyKlineData = ref([])
const indicatorKlineData = ref([])
const indicatorMonthlyKlineData = ref([])
const loading = ref(false)

const shortTermConfigs = [
  { label: '5日涨跌', hint: '约1周', periods: 5 },
  { label: '20日涨跌', hint: '约1个月', periods: 20 },
  { label: '60日涨跌', hint: '约1个季度', periods: 60 },
  { label: '120日涨跌', hint: '约半年', periods: 120 },
  { label: '250日涨跌', hint: '约1年', periods: 250 }
]

const longTermConfigs = [
  { label: '2年涨跌', periods: 24 },
  { label: '3年涨跌', periods: 36 },
  { label: '5年涨跌', periods: 60 },
  { label: '10年涨跌', periods: 120 },
  { label: '20年涨跌', periods: 240 }
]

const calcChange = (data, periods) => {
  if (data.length <= periods) return null
  const current = data[data.length - 1]?.close
  const past = data[data.length - 1 - periods]?.close
  if (!current || !past) return null
  return (current - past) / past * 100
}

const shortTermIndicators = computed(() =>
  shortTermConfigs.map(item => ({
    ...item,
    value: calcChange(indicatorKlineData.value, item.periods)
  }))
)

const longTermIndicators = computed(() =>
  longTermConfigs.map(item => ({
    ...item,
    value: calcChange(indicatorMonthlyKlineData.value, item.periods)
  }))
)

onMounted(() => {
  loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    const stocks = storage.getStocks()
    const stock = stocks.find(s => s.symbol === symbol.value)
    if (!stock) return
    stockInfo.value = { ...stock }
    const quote = await getStockQuote(stock.symbol, stock.market)
    if (quote) stockInfo.value = { ...stock, ...quote }
  } catch (e) {
    console.error('加载行情失败:', e)
  } finally {
    loading.value = false
  }
  try {
    const stocks = storage.getStocks()
    const stock = stocks.find(s => s.symbol === symbol.value)
    if (!stock) return
    const [kline, monthlyKline, indicatorKline, indicatorMonthlyKline] = await Promise.all([
      getStockKLine(stock.symbol, stock.market),
      getStockKLine(stock.symbol, stock.market, 'monthly'),
      getStockKLine(stock.symbol, stock.market, 'daily', 'hfq'),
      getStockKLine(stock.symbol, stock.market, 'monthly', 'hfq')
    ])
    klineData.value = kline || []
    monthlyKlineData.value = monthlyKline || []
    indicatorKlineData.value = indicatorKline || []
    indicatorMonthlyKlineData.value = indicatorMonthlyKline || []
  } catch (e) {
    console.error('加载K线失败:', e)
  }
}

const handleBack = () => {
  router.push('/')
}

const handleGoParser = () => {
  const raw = String(symbol.value || '').trim().toUpperCase()
  const market = stockInfo.value.market
  let targetSymbol = raw

  if (market === 'HK' && raw && !raw.startsWith('HK')) {
    targetSymbol = `HK${raw}`
  } else if (market === 'US') {
    targetSymbol = raw.replace(/^US/, '')
  } else if (market === 'CN' && (raw.startsWith('SH') || raw.startsWith('SZ'))) {
    targetSymbol = raw.slice(2)
  }

  router.push({
    name: 'CompanyParser',
    query: {
      symbol: targetSymbol
    }
  })
}

const formatVolume = (volume) => {
  if (!volume) return '-'
  if (volume >= 100000000) {
    return (volume / 100000000).toFixed(2) + '亿'
  }
  if (volume >= 10000) {
    return (volume / 10000).toFixed(2) + '万'
  }
  return volume.toFixed(0)
}

const formatAmount = (amount) => {
  if (!amount) return '-'
  if (amount >= 100000000) {
    return (amount / 100000000).toFixed(2) + '亿'
  }
  if (amount >= 10000) {
    return (amount / 10000).toFixed(2) + '万'
  }
  return amount.toFixed(2)
}

const formatChange = (value) => {
  if (value == null) return '-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

const getMarketName = (market) => {
  const names = {
    CN: 'A股',
    HK: '港股',
    US: '美股'
  }
  return names[market] || market
}

const getMarketTagType = (market) => {
  const types = {
    CN: 'info',
    HK: 'warning',
    US: 'success'
  }
  return types[market] || 'default'
}
</script>

<style scoped>
.detail-container {
  min-height: 100vh;
  background: #fafafa;
  position: relative;
  overflow-x: hidden;
}

.detail-container::before {
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

.detail-container::after {
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

.detail-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
  padding: 20px 48px !important;
  height: auto !important;
  border: none !important;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
}

.back-button {
  font-size: 16px;
  font-weight: 600;
  color: #6366f1;
  transition: all 0.3s ease;
  letter-spacing: -0.01em;
}

.back-button:hover {
  color: #4f46e5;
  transform: translateX(-4px);
}

.back-icon {
  font-size: 20px;
  display: inline-block;
  transition: transform 0.3s ease;
}

.back-button:hover .back-icon {
  transform: translateX(-4px);
}

.stock-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #18181b;
  letter-spacing: -0.02em;
}

.refresh-button {
  background: rgba(0, 0, 0, 0.03) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  color: #52525b !important;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.refresh-button:hover {
  background: rgba(0, 0, 0, 0.06) !important;
  border-color: rgba(0, 0, 0, 0.12) !important;
  color: #18181b !important;
  transform: translateY(-1px);
}

.parser-button {
  background: rgba(79, 70, 229, 0.1) !important;
  border: 1px solid rgba(79, 70, 229, 0.2) !important;
  color: #4f46e5 !important;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.parser-button:hover {
  background: rgba(79, 70, 229, 0.18) !important;
  border-color: rgba(79, 70, 229, 0.3) !important;
  color: #4338ca !important;
  transform: translateY(-1px);
}

.detail-content {
  position: relative;
  z-index: 2;
  padding: 48px !important;
  max-width: 1400px;
  margin: 0 auto;
}

/* 卡片美化 */
:deep(.n-card) {
  border-radius: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px) saturate(180%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 24px;
}

:deep(.n-card:hover) {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.05);
}

:deep(.n-card-header) {
  font-weight: 600;
  font-size: 18px;
  color: #18181b;
  letter-spacing: -0.01em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

/* 价格区域美化 */
.price-section {
  padding: 24px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.current-price {
  display: flex;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}

.price-label {
  font-size: 14px;
  color: #71717a;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.price-value {
  font-size: 48px;
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

.change-tag {
  font-size: 16px;
  padding: 6px 16px;
  border-radius: 12px;
  font-weight: 600;
}

/* 信息项美化 */
.info-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-label {
  font-size: 13px;
  color: #71717a;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 20px;
  font-weight: 600;
  color: #18181b;
  letter-spacing: -0.01em;
}

.info-value.small {
  font-size: 14px;
  color: #52525b;
  font-weight: 500;
}

/* 标签美化 */
:deep(.n-tag) {
  border-radius: 8px;
  font-weight: 500;
  padding: 4px 12px;
}

/* K线图卡片美化 */
.chart-container {
  padding: 10px 0;
}

/* 技术指标美化 */
.indicator-item {
  padding: 24px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  text-align: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.indicator-item:hover {
  transform: translateY(-2px);
  background: rgba(0, 0, 0, 0.04);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.indicator-group {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.long-term-group {
  margin-top: 28px;
}

.indicator-group-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.group-title {
  font-size: 16px;
  font-weight: 700;
  color: #18181b;
}

.group-desc {
  font-size: 13px;
  color: #71717a;
}

.indicator-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
}

.indicator-note {
  font-size: 12px;
  color: #71717a;
}

.indicator-label {
  display: block;
  font-size: 14px;
  color: #71717a;
  font-weight: 500;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.indicator-hint {
  display: block;
  font-size: 12px;
  color: #a1a1aa;
  margin-bottom: 16px;
}

.indicator-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
}

.value-up {
  color: #ef4444;
}

.value-down {
  color: #10b981;
}

/* 警告提示美化 */
.warning-alert {
  padding: 20px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 16px;
  font-size: 15px;
}

:deep(.n-alert) {
  border-radius: 12px;
  background: transparent;
  border: none;
  padding: 0;
}

:deep(.n-alert__icon) {
  margin-right: 12px;
}

/* 网格美化 */
:deep(.n-grid) {
  gap: 24px;
}

/* 空状态美化 */
:deep(.n-empty) {
  padding: 60px 20px;
}

:deep(.n-empty__description) {
  color: #71717a;
  font-size: 14px;
}

@media (max-width: 768px) {
  .detail-header {
    padding: 16px 20px !important;
  }

  .detail-content {
    padding: 20px !important;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .price-value {
    font-size: 40px;
  }
}
</style>
