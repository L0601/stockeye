import axios from 'axios'

// 创建axios实例
const request = axios.create({
  timeout: 10000
})

// 市场类型
export const MARKET_TYPE = {
  CN: 'CN',    // A股
  HK: 'HK',    // 港股
  US: 'US'     // 美股
}

// 股票类型
export const STOCK_TYPE = {
  STOCK: 'stock',
  INDEX: 'index'
}

// 判断是否是美国夏令时（3月第二个周日 - 11月第一个周日）
function isDST(date) {
  const year = date.getFullYear()

  // 3月第二个周日 2:00 AM
  const marchSecondSunday = new Date(year, 2, 1) // 3月1日
  marchSecondSunday.setDate(1 + (7 - marchSecondSunday.getDay()) + 7) // 第二个周日
  marchSecondSunday.setHours(2, 0, 0, 0)

  // 11月第一个周日 2:00 AM
  const novFirstSunday = new Date(year, 10, 1) // 11月1日
  novFirstSunday.setDate(1 + (7 - novFirstSunday.getDay())) // 第一个周日
  novFirstSunday.setHours(2, 0, 0, 0)

  return date >= marchSecondSunday && date < novFirstSunday
}

// 判断A股是否在交易时间（北京时间）
function isCNMarketOpen() {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 100 + minute

  // 周末不交易
  if (day === 0 || day === 6) return false

  // 交易时间：9:30-11:30, 13:00-15:00（北京时间）
  if ((time >= 930 && time <= 1130) || (time >= 1300 && time <= 1500)) {
    return true
  }

  return false
}

function isCNMarketMiddayBreak() {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 100 + minute

  if (day === 0 || day === 6) return false

  return time > 1130 && time < 1300
}

// 判断港股是否在交易时间（香港时间 = 北京时间）
function isHKMarketOpen() {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 100 + minute

  // 周末不交易
  if (day === 0 || day === 6) return false

  // 交易时间：9:30-12:00, 13:00-16:00（香港时间 = 北京时间）
  if ((time >= 930 && time <= 1200) || (time >= 1300 && time <= 1600)) {
    return true
  }

  return false
}

function isHKMarketMiddayBreak() {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const time = hour * 100 + minute

  if (day === 0 || day === 6) return false

  return time > 1200 && time < 1300
}

// 判断美股是否在交易时间
function isUSMarketOpen() {
  const now = new Date()

  // 转换为美东时间
  // 北京时间 = UTC+8
  // 美东夏令时 EDT = UTC-4，与北京时间相差12小时
  // 美东冬令时 EST = UTC-5，与北京时间相差13小时
  const offset = isDST(now) ? 12 : 13

  // 计算美东时间
  const etHour = (now.getHours() - offset + 24) % 24
  const etMinute = now.getMinutes()
  const etTime = etHour * 100 + etMinute

  // 计算美东的星期几（可能跨天）
  let etDay = now.getDay()
  if (now.getHours() < offset) {
    etDay = (etDay - 1 + 7) % 7
  }

  // 周末不交易
  if (etDay === 0 || etDay === 6) return false

  // 美股交易时间：9:30 AM - 4:00 PM ET
  if (etTime >= 930 && etTime <= 1600) {
    return true
  }

  return false
}

export function isMarketMiddayBreak(market) {
  if (market === MARKET_TYPE.CN) {
    return isCNMarketMiddayBreak()
  }
  if (market === MARKET_TYPE.HK) {
    return isHKMarketMiddayBreak()
  }
  return false
}

// 获取股票实时数据
export async function getStockQuote(symbol, market, type = STOCK_TYPE.STOCK) {
  try {
    // 如果是指数类型
    if (type === STOCK_TYPE.INDEX) {
      if (market === MARKET_TYPE.HK) {
        return await getHKIndexQuote(symbol)
      }
      // 其他市场的指数暂不支持
      return null
    }

    // 股票类型
    if (market === MARKET_TYPE.CN) {
      return await getCNStockQuote(symbol)
    } else if (market === MARKET_TYPE.HK) {
      return await getHKStockQuote(symbol)
    } else if (market === MARKET_TYPE.US) {
      return await getUSStockQuote(symbol)
    }
  } catch (error) {
    console.error('获取股票数据失败:', error)
    return null
  }
}

// 获取A股实时数据（新浪接口）
async function getCNStockQuote(symbol) {
  const prefix = symbol.startsWith('6') ? 'sh' : 'sz'
  const url = `/api/sina/list=${prefix}${symbol}`
  const response = await request.get(url)
  const data = response.data

  if (!data) return null

  const arr = data.split('"')[1].split(',')
  if (arr.length < 32) return null

  return {
    symbol,
    name: arr[0],
    current: parseFloat(arr[3]),
    yesterday: parseFloat(arr[2]),
    open: parseFloat(arr[1]),
    high: parseFloat(arr[4]),
    low: parseFloat(arr[5]),
    volume: parseFloat(arr[8]),
    amount: parseFloat(arr[9]),
    change: parseFloat(arr[3]) - parseFloat(arr[2]),
    changePercent: ((parseFloat(arr[3]) - parseFloat(arr[2])) / parseFloat(arr[2]) * 100).toFixed(2),
    status: isCNMarketOpen() ? 'trading' : 'closed',
    updateTime: `${arr[30]} ${arr[31]}`
  }
}

// 获取港股实时数据（新浪接口）
async function getHKStockQuote(symbol) {
  const url = `/api/sina/list=rt_hk${symbol}`
  const response = await request.get(url)
  const data = response.data

  if (!data) return null

  const arr = data.split('"')[1].split(',')
  if (arr.length < 10) return null

  return {
    symbol,
    name: arr[1], // 使用中文名
    current: parseFloat(arr[6]),
    yesterday: parseFloat(arr[3]),
    open: parseFloat(arr[4]), // 开盘价（不在页面显示）
    high: parseFloat(arr[4]), // 最高价
    low: parseFloat(arr[5]),
    volume: parseFloat(arr[12]),
    amount: parseFloat(arr[11]),
    change: parseFloat(arr[7]),
    changePercent: parseFloat(arr[8]),
    status: isHKMarketOpen() ? 'trading' : 'closed',
    updateTime: `${arr[17]} ${arr[18]}`
  }
}

// 获取港股指数实时数据（新浪接口）
async function getHKIndexQuote(symbol) {
  // 恒生科技指数的代码映射
  const indexCodeMap = {
    'HSTECH': 'hkHSTECH'
  }

  const indexCode = indexCodeMap[symbol] || symbol
  const url = `/api/sina/list=rt_${indexCode}`

  try {
    const response = await request.get(url)
    const data = response.data

    if (!data) return null

    const arr = data.split('"')[1].split(',')
    if (arr.length < 10) return null

    return {
      symbol,
      name: arr[1] || symbol,
      current: parseFloat(arr[6]),
      yesterday: parseFloat(arr[3]),
      open: parseFloat(arr[4]),
      high: parseFloat(arr[4]),
      low: parseFloat(arr[5]),
      volume: 0, // 指数没有成交量
      amount: 0, // 指数没有成交额
      change: parseFloat(arr[7]),
      changePercent: parseFloat(arr[8]),
      status: isHKMarketOpen() ? 'trading' : 'closed',
      updateTime: `${arr[17]} ${arr[18]}`
    }
  } catch (error) {
    console.error('获取指数数据失败:', error)
    return null
  }
}

// 获取美股实时数据（新浪接口）
async function getUSStockQuote(symbol) {
  // 去掉交易所后缀 (.oq, .n, .ps等)
  const cleanSymbol = symbol.split('.')[0].toLowerCase()
  const url = `/api/sina/list=gb_${cleanSymbol}`
  const response = await request.get(url)
  const data = response.data

  if (!data) return null

  const arr = data.split('"')[1].split(',')
  if (arr.length < 10) return null

  return {
    symbol,
    name: arr[0],
    current: parseFloat(arr[1]),
    yesterday: parseFloat(arr[26]),
    open: parseFloat(arr[5]),
    high: parseFloat(arr[6]),
    low: parseFloat(arr[7]),
    volume: parseFloat(arr[10]),
    amount: parseFloat(arr[11]) || 0,
    change: parseFloat(arr[4]),
    changePercent: parseFloat(arr[2]),
    status: isUSMarketOpen() ? 'trading' : 'closed',
    updateTime: arr[3]
  }
}

// 获取历史K线数据
export async function getStockKLine(symbol, market, period = 'daily') {
  try {
    if (market === MARKET_TYPE.CN) {
      return await getCNStockKLine(symbol, period)
    }
    // 港股、美股K线数据需要其他接口或付费API
    return []
  } catch (error) {
    console.error('获取K线数据失败:', error)
    return []
  }
}

// 获取A股K线数据
async function getCNStockKLine(symbol, period) {
  // 使用腾讯财经接口获取K线数据
  const prefix = symbol.startsWith('6') ? 'sh' : 'sz'
  const url = `/api/qq/appstock/app/fqkline/get?param=${prefix}${symbol},day,,,320,qfq`

  const response = await request.get(url)
  const klineData = response.data?.data?.[`${prefix}${symbol}`]?.qfqday || []

  return klineData.map(item => ({
    date: item[0],
    open: parseFloat(item[1]),
    close: parseFloat(item[2]),
    high: parseFloat(item[3]),
    low: parseFloat(item[4]),
    volume: parseFloat(item[5])
  }))
}

// 搜索股票
export async function searchStock(keyword) {
  try {
    // 使用腾讯财经的搜索接口
    const url = `/api/search/s3/?q=${encodeURIComponent(keyword)}&t=all`
    const response = await request.get(url)
    let data = response.data

    if (!data) return []

    // 提取v_hint的值
    const match = data.match(/v_hint="([^"]*)"/)
    if (!match || !match[1]) {
      console.log('未匹配到v_hint')
      return []
    }

    console.log('原始数据:', match[1])

    // 解码Unicode转义序列
    let hintData = match[1]
    try {
      hintData = JSON.parse(`"${hintData}"`)
      console.log('解码后数据:', hintData)
    } catch (e) {
      console.error('解码失败:', e)
    }

    const results = []

    // 用^分割不同的股票，然后解析每个股票
    const items = hintData.split('^').filter(item => item)
    console.log('分割后数组:', items)

    for (const item of items) {
      const parts = item.split('~')
      if (parts.length < 3) continue

      // 判断是否是指数（GP.I 开头）或股票（GP 开头）
      let itemType = STOCK_TYPE.STOCK
      if (parts[4]) {
        if (parts[4].startsWith('GP.I')) {
          itemType = STOCK_TYPE.INDEX
        } else if (!parts[4].startsWith('GP')) {
          // 过滤掉衍生品（如窝轮、牛熊证等）
          console.log('过滤掉:', parts[2], parts[4])
          continue
        }
      }

      console.log('添加:', parts[2], parts[1], parts[4], itemType)
      results.push({
        symbol: parts[1],
        name: parts[2],
        market: parts[0].includes('hk') ? MARKET_TYPE.HK :
                parts[0].includes('us') ? MARKET_TYPE.US : MARKET_TYPE.CN,
        code: parts[1],
        type: itemType
      })
    }

    console.log('搜索结果数量:', results.length)
    return results
  } catch (error) {
    console.error('搜索股票失败:', error)
    return []
  }
}

// 批量获取股票数据
export async function batchGetStocks(stocks) {
  const promises = stocks.map(stock =>
    getStockQuote(stock.symbol, stock.market, stock.type || STOCK_TYPE.STOCK)
  )

  try {
    const results = await Promise.allSettled(promises)
    return results.map((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        return { ...stocks[index], ...result.value }
      }
      return stocks[index]
    })
  } catch (error) {
    console.error('批量获取数据失败:', error)
    return stocks
  }
}
