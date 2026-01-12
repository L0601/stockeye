// 本地存储管理
const STORAGE_KEY = 'stock_eye_data'

export const storage = {
  // 获取所有股票
  getStocks() {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  },

  // 保存所有股票
  saveStocks(stocks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks))
  },

  // 添加股票
  addStock(stock) {
    const stocks = this.getStocks()
    const exists = stocks.find(s => s.symbol === stock.symbol)
    if (exists) {
      return false
    }
    stocks.push({
      ...stock,
      addTime: Date.now()
    })
    this.saveStocks(stocks)
    return true
  },

  // 删除股票
  removeStock(symbol) {
    const stocks = this.getStocks()
    const filtered = stocks.filter(s => s.symbol !== symbol)
    this.saveStocks(filtered)
    return true
  },

  // 更新股票数据
  updateStock(symbol, data) {
    const stocks = this.getStocks()
    const index = stocks.findIndex(s => s.symbol === symbol)
    if (index !== -1) {
      stocks[index] = { ...stocks[index], ...data }
      this.saveStocks(stocks)
      return true
    }
    return false
  }
}

// 自动刷新设置
const REFRESH_KEY = 'stock_eye_refresh_interval'
const AUTO_REFRESH_KEY = 'stock_eye_auto_refresh'
const HIDE_CLOSED_KEY = 'stock_eye_hide_closed'

export const refreshSettings = {
  getInterval() {
    const interval = localStorage.getItem(REFRESH_KEY)
    return interval ? parseInt(interval) : 30000 // 默认30秒
  },

  setInterval(milliseconds) {
    localStorage.setItem(REFRESH_KEY, milliseconds.toString())
  },

  getAutoRefresh() {
    const value = localStorage.getItem(AUTO_REFRESH_KEY)
    return value !== null ? value === 'true' : true // 默认开启
  },

  setAutoRefresh(enabled) {
    localStorage.setItem(AUTO_REFRESH_KEY, enabled.toString())
  }
}

export const listSettings = {
  getHideClosed() {
    const value = localStorage.getItem(HIDE_CLOSED_KEY)
    return value !== null ? value === 'true' : false
  },

  setHideClosed(enabled) {
    localStorage.setItem(HIDE_CLOSED_KEY, enabled.toString())
  }
}
