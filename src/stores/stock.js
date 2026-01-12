import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { storage, refreshSettings, listSettings } from '@/utils/storage'
import { batchGetStocks, searchStock as apiSearchStock, isMarketMiddayBreak, MARKET_TYPE, STOCK_TYPE } from '@/api/stock'

// 默认股票列表
const DEFAULT_STOCKS = [
  { symbol: '01810', name: '小米集团', market: MARKET_TYPE.HK, type: STOCK_TYPE.STOCK },
  { symbol: 'QQQ', name: 'QQQ', market: MARKET_TYPE.US, type: STOCK_TYPE.STOCK },
  { symbol: 'GOOGL', name: '谷歌', market: MARKET_TYPE.US, type: STOCK_TYPE.STOCK },
  { symbol: 'HSTECH', name: '恒生科技指数', market: MARKET_TYPE.HK, type: STOCK_TYPE.INDEX },
  { symbol: '601939', name: '中国建设银行', market: MARKET_TYPE.CN, type: STOCK_TYPE.STOCK }
]

export const useStockStore = defineStore('stock', () => {
  // 状态
  const stocks = ref([])
  const loading = ref(false)
  const autoRefresh = ref(refreshSettings.getAutoRefresh())
  const refreshInterval = ref(refreshSettings.getInterval())
  const lastUpdateTime = ref(null)
  const hideClosed = ref(listSettings.getHideClosed())

  // 计算属性
  const stockCount = computed(() => stocks.value.length)
  const visibleStocks = computed(() => {
    if (!hideClosed.value) return stocks.value

    return stocks.value.filter(stock => {
      if (!stock.status || stock.status === 'trading') return true
      return isMarketMiddayBreak(stock.market)
    })
  })
  const visibleStockCount = computed(() => visibleStocks.value.length)

  // 初始化 - 从本地存储加载
  function init() {
    const savedStocks = storage.getStocks()

    // 如果是首次使用（localStorage为空），添加默认股票
    if (savedStocks.length === 0) {
      DEFAULT_STOCKS.forEach(stock => {
        storage.addStock(stock)
      })
      stocks.value = storage.getStocks()
    } else {
      stocks.value = savedStocks
    }

    // 从localStorage加载自动刷新设置
    autoRefresh.value = refreshSettings.getAutoRefresh()
    refreshInterval.value = refreshSettings.getInterval()
    hideClosed.value = listSettings.getHideClosed()

    if (stocks.value.length > 0) {
      refreshData()
    }
  }

  // 添加股票
  function addStock(stock) {
    const success = storage.addStock(stock)
    if (success) {
      stocks.value = storage.getStocks()
      refreshData()
      return true
    }
    return false
  }

  // 删除股票
  function removeStock(symbol) {
    storage.removeStock(symbol)
    stocks.value = storage.getStocks()
  }

  // 刷新数据
  async function refreshData() {
    if (stocks.value.length === 0) return

    loading.value = true
    try {
      const updatedStocks = await batchGetStocks(stocks.value)
      stocks.value = updatedStocks

      // 更新本地存储
      updatedStocks.forEach(stock => {
        storage.updateStock(stock.symbol, stock)
      })

      lastUpdateTime.value = new Date()
    } catch (error) {
      console.error('刷新数据失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 搜索股票
  async function searchStock(keyword) {
    try {
      return await apiSearchStock(keyword)
    } catch (error) {
      console.error('搜索失败:', error)
      return []
    }
  }

  // 设置刷新间隔
  function setRefreshInterval(interval) {
    refreshInterval.value = interval
    refreshSettings.setInterval(interval)
  }

  // 切换自动刷新
  function toggleAutoRefresh(value) {
    autoRefresh.value = value
    refreshSettings.setAutoRefresh(value)
  }

  function toggleHideClosed(value) {
    hideClosed.value = value
    listSettings.setHideClosed(value)
  }

  return {
    stocks,
    loading,
    autoRefresh,
    refreshInterval,
    lastUpdateTime,
    hideClosed,
    stockCount,
    visibleStocks,
    visibleStockCount,
    init,
    addStock,
    removeStock,
    refreshData,
    searchStock,
    setRefreshInterval,
    toggleAutoRefresh,
    toggleHideClosed
  }
})
